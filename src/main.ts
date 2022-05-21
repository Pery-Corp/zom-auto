// import { Worker as nodeWorker } from 'worker_threads';
import puppeteer from 'puppeteer'
import progress from 'progress'
import { sleep, log, addTime } from './utils.js'
import { Navigator } from './Navigator.js'
import { accounts, Account } from './accounts.js'
import { EventEmitter } from './EventEmitter.js'
import { parse } from 'ts-command-line-args';
import { Mutex } from 'async-mutex'
import { Config } from './Config.js'
import { sendNear } from './near-distributor.js'
// @ts-ignore
import { proxyRequest } from 'puppeteer-proxy'

let browserOpts = () => {
    return {
        headless: Config().headless,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ]
    }
}

class Runner {
    protected browser?: puppeteer.Browser;
    protected page?: puppeteer.Page;

    constructor(private account: Account) {}

    private async prepare() {
        this.browser = await puppeteer.launch(browserOpts())
        return this.setupPage();
    }

    private async tryLogin() {
        this.page = await Navigator.login.phrase(<puppeteer.Page>this.page, this.account)
    }

    private async tryMint() {
        log("Trying to mint zomby, account:", this.account.id)
        let ret = await Navigator.mint.zomby(<puppeteer.Page>this.page)
        this.page = ret!.page
        let desc=""
        switch (ret.error.type) {
            case "time":
                this.account.lastMint =
                    addTime(24-ret.error.time!.hours, 60-ret.error.time!.minutes, 60-ret.error.time!.seconds).getTime()
                desc = "Not time yet"
                break;
            case "basic": desc = "basic error" + ret.error.msgs!.join("; ")
                break;
            case "payment": desc = "payment error: " + ret.error.msgs!.join("; ")
                break;
            case "ok": log("Zomby mint success"); this.account.updateLastMint(new Date().getTime())
                break;
            default: desc = "Unknown error while minting"
                break;
        }
        if (desc != "") { log.error("cannot mint zomby:",  desc) }
    }

    private async tryBurn() {
        let ret = await Navigator.burn.zombies(<puppeteer.Page>this.page)
        switch (ret.error.type) {
            case "payment":
                log.error("payment error:", ret.error.msgs!.join("; "))
                break;
            case "ok":
                log("all zombies burned")
                break;
            case "basic":
                log.error("basic error", ret.error.msgs!.join("; "))
                break;
            default:
                log.error(ret.error.type)
        }
    }

    private async tryTransferZomby() {
        let ret = await Navigator.transfer.zombies(<puppeteer.Page>this.page)
        let desc = ""
        switch (ret.error.type) {
            case "payment":
                desc = "payment error:" + ret.error.msgs!.join("; ")
                break;
            case "ok":
                desc = "all zombies transfered"
                break;
            case "basic":
                desc = "basic error:" + ret.error.msgs!.join("; ")
                break;
            default:
                desc = "unknown: " + ret.error.type
        }
        if (desc != "") { log.error("zomby transfer:", desc) }
    }

    public async start() {
        try {
            this.page = await this.prepare()
            await this.tryLogin()

            await this.tryMint()

            if (Config().burn) {
                await this.tryBurn()
            }

            if (Config().mother != this.account.wallet) {
                switch (Config().transfer) {
                    case "zlt":
                        // await this.tryT()
                        break;
                    case "zomby":
                        await this.tryTransferZomby()
                        break;
                    case "none":
                        break;
                }
            }

        } catch (e) {
            log.error(e, "account:", this.account.id)
        } finally {
            await this.account.sync()
            await this.dispose()
        }
    }

    public async dispose() {
        await this.browser?.close();
    }

    protected async setupPage(): Promise<puppeteer.Page> {
        try {
            if (!this.browser) {
                throw "setuping page before creating browser"
            }
            this.page = await this.browser.newPage();

            if (Config().proxy.length) {
                await this.page.setRequestInterception(true)

                function randomProxy() {
                    let proxy = Config().proxy.at(0+Math.floor(Math.random() * Config().proxy.length) )
                    // @ts-ignore
                    return "http://" + proxy.user + ":" + proxy.password + "@" + proxy.host;
                }

                this.page.on('request', async (request) => {
                    await proxyRequest({
                        page: this.page,
                        proxyUrl: randomProxy(),
                        request,
                    });
                });
            }

            await this.page
                .setUserAgent(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36')

            await this.page.setViewport({ width: 1920, height: 1060 })
            await this.page.setDefaultNavigationTimeout(500000);
            await this.page.on('dialog', async (dialog: puppeteer.Dialog) => {
                await dialog.accept();
            });
            await this.page.on('error', async (err) => {
                const errorMessage = err.toString();
                log.error('browser error: ' + errorMessage, "account:", this.account.id, " retraing")
                await this.dispose()
                await this.start()
            });
            await this.page.on('pageerror', async (err: any) => {
                const errorMessage = err.toString();
                log.error('browser this.page error: ' + errorMessage, "account:", this.account.id)
                await this.dispose()
                await this.start()
            });
        } catch (err) {
            throw new Error('this.page initialization failed. Reason: ' + err);
        }
        return this.page;
    }
}

class Worker extends EventEmitter<{'done': boolean}> {
    constructor(private acc: Account) {
        super()
    }

    get account() {
        return this.acc
    }

    async run() {
        let err = false
        try {
            let runner = new Runner(this.acc);
            await runner.start()
        } catch (e) {
            err = true
            log.error("Error occured while passing", this.acc.id, "account. Reason:", e)
        } finally {
            this.emit('done', err)
        }
    }
}

class Controller extends EventEmitter<{"done": void}> {
    private workers: Set<Worker>;
    private active: number = 0;
    private mtx: Mutex;

    private overall = 0;
    private progress: any

    constructor(private cuncurrency: number) {
        super()
        this.workers = new Set<Worker>()
        this.mtx = new Mutex()
    }

    async addWork(w: Worker) {
        this.overall++
        const lock = await this.mtx.acquire();
        try {
            w.on('done', (e) => this.onWorkDone(w, e))
            if (this.active < this.cuncurrency) {
                this.active++
                w.run()
            }
            this.workers.add(w)
        } finally {
            lock()
        }
    }

    private async onWorkDone(w: Worker, err: boolean) {
        const lock = await this.mtx.acquire();
        try {
            if (err) {

            }
            this.workers.delete(w)
            if (this.workers.size) {
                this.workers.values().next().value.run()
            }
        } finally {
            lock()
            this.progress.tick()
            if (this.workers.size === 0) {
                log.echo("done")
                this.emit("done")
            }
        }
    }

    async process() {
        let accs = accounts.getRange(0, accounts.count);
        let minTimeToMint = addTime(24, 0, 0).getTime();
        for (let a of accs) {
            let nextMintTime = addTime(24, 0, 0, new Date(a.lastMint)).getTime()
            if (nextMintTime <= new Date().getTime()) {
                await this.addWork(new Worker(a))
            } else {
                minTimeToMint = Math.min(minTimeToMint, nextMintTime)
            }
        }

        log.echo("Start processing", this.workers.size, "of", accounts.count)

        this.progress = new progress("Processing [:bar] :current/:total :percent :etas rate :rate", {
            complete: '=',
            incomplete: '-',
            head: '>',
            width: process.stdout.columns,
            total: this.overall,
        })

        this.progress.tick(0)

        sleep(100).then(() => {
            if (this.workers.size === 0) {
                this.emit("done")
            }
        })

        return new Date(minTimeToMint)
    }
}

interface opts {
    importPath?: string,
    concurrency?: number,
    mode?: string, 
}

class App {
    private concurrency: number = 1;
    private mode: "normal" | "provide" = "normal";

    constructor() {

    }

    async init() {
        let argv = parse<opts>({
            importPath:  { type: String, alias: 'i', optional: true },
            concurrency: { type: Number, alias: 'c', optional: true },
            mode:        { type: String, alias: 'p', optional: true },
        })
        if (argv.importPath) {
            await accounts.importPhrases(argv.importPath)
        } else {
            await accounts.importPhrases(Config().import)
        }
        if (argv.concurrency) {
            this.concurrency = argv.concurrency
        } else {
            this.concurrency = Config().concurrency
        }

        if (argv.mode === "provide") {
            this.mode = "provide"
            
            log.echo("Starting provide mode")
            log.echo("NEAR Provider:", Config().NEARProvider.addr)
            log.echo("Send amount:", "Noet implemented, sending 0.1 NEAR")
            log.echo("Overall accounts:", accounts.count)
            log.echo("Accounts with determined wallet:", accounts.count - (await Account.findMany({ wallet: "" })).length)
        } else {
            this.mode = "normal"

            let accCount: number = accounts.count;
            let withoutWL = (await Account.findMany({ wallet: "" })).length
            let withoutMintInfo = (await Account.findMany({ lastMint: 0 })).length

            log.echo("Starting normal mode")
            log.echo("Overall accounts:", accCount,
                "\n\t\tWithout determined wallet:", withoutWL,
                "\n\t\tWithout determined mint schedule:", withoutMintInfo)
            log.echo("Cuncurrency:", this.concurrency)
            log.echo("Proxy count setted:", Config().proxy.length)
            log.echo("Mother account:", Config().mother)
            log.echo("Mode:",
                "\n\t\ttransfer:", Config().transfer,
                "\n\t\tburn:", Config().burn,
                "\n\t\theadless:", Config().headless)
        }

        return this
    }

    private async runProvideMode() {
        // TODO check wallets before send
        let accs = accounts.getRange(0, accounts.count);
        for await (let acc of accs) {
            if (acc.wallet != "" && acc.wallet != Config().NEARProvider.addr) {
                await sendNear(Config().NEARProvider, acc.wallet, '0.1')
            }
        }
    }

    private async runNormalMode() {
        let ctl = new Controller(this.concurrency)
        let next = await ctl.process()

        ctl.on("done", () => {
            let now = new Date()
            let sleepDate = new Date(next.getTime() - now.getTime())
            let sleepMs = sleepDate.getUTCHours() * 60 * 60 * 1000 +
                sleepDate.getUTCMinutes() * 60 * 1000 +
                sleepDate.getUTCSeconds() * 1000

            log.echo("Next mint at:", next, "going to sleep for:", sleepMs, "ms")

            sleep(sleepMs).then(async () => {
                log.echo("Going to next loop")
                await this.runNormalMode()
            })
        })
    }

    async run() {
        if (this.mode === "provide") {
            this.runProvideMode()
        } else if (this.mode === "normal") {
            this.runNormalMode()
        }
    }
}

Config()
new App().init().then((app) => app.run())
