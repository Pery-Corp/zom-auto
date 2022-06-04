import { Worker, WorkerFactory} from './../worker.js'
import { Account } from './../database.js'
import { Config } from './../Config.js'
// @ts-ignore
import { proxyRequest } from 'puppeteer-proxy'
import { addTime } from './../utils.js'
import puppeteer from 'puppeteer'
import { Navigator } from './Navigator.js'
import { WorkerBarHelper } from './../bar-helper.js'
import { log } from './../utils.js'

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

export class BWorkerFactory extends WorkerFactory {
    constructor() { super() }
    async init() { }
    produce(acc: Account) { return new BWorker(acc) }
}

export class BWorker extends  Worker {
    protected browser?: puppeteer.Browser;
    protected page?: puppeteer.Page;

    constructor(acc: Account) {
        super(acc)
        this.barHelper = new WorkerBarHelper(this.account,
            [
                "Login",
                "Minting",
                "Buring zombie",
                "Transfering ntf/ft"
            ]
        )
    }

    public async run(): Promise<void> {
        let err = false
        this.barHelper.create()
        try {
            this.page = await this.prepare()
            err = await this.tryLogin()

            this.barHelper.next()
            await this.tryMint()

            this.barHelper.next()
            if (Config().burn && Config().transfer != "zombie") {
                await this.tryBurn()
            }

            this.barHelper.next()
            if (Config().mother != this.account.wallet) {
                switch (Config().transfer) {
                    case "zlt":
                        // await this.tryT()
                        break;
                    case "zombie":
                        await this.tryTransferZombie()
                        break;
                    case "none":
                        break;
                }
            }
        } finally {
            this.barHelper.done(err)
            await this.account.sync()
            await this.dispose()
            this.emit('done', err)
        }
    }

    public async dispose() {
        await this.browser?.close();
    }

    private async prepare() {
        this.browser = await puppeteer.launch(browserOpts())
        return this.setupPage();
    }

    private async tryLogin() {
        try {
            this.page = await Navigator.login.phrase(<puppeteer.Page>this.page, this.account)
        } catch (e) {
            log.error(e)
            return true
        }
        return false
    }

    private async tryMint() {
        let ret = await Navigator.mint.zombie(<puppeteer.Page>this.page)
        this.page = ret!.page
        let desc=""
        switch (ret.error.type) {
            case "time":
                this.account.updateNextMint(
                    addTime(ret.error.time!.hours,
                        ret.error.time!.minutes,
                        ret.error.time!.seconds).getTime())
                desc = "Not time yet, to mint " + ret.error.time!.hours + "h " + ret.error.time!.minutes + "m " + ret.error.time!.seconds + "s"
                break;
            case "basic": desc = "basic error" + ret.error.msgs!.join("; ")
                break;
            case "payment": desc = "payment error: " + ret.error.msgs!.join("; ")
                break;
            case "ok": log.echo("Zombie mint success"); this.account.updateNextMint(addTime(24, 0, 0).getTime())
                break;
            default: desc = "Unknown error while minting"
                break;
        }
        if (desc != "") { log.error("cannot mint zombie: " + desc); return true }
        return false
    }

    private async tryBurn() {
        let ret = await Navigator.burn.zombies(<puppeteer.Page>this.page)
        switch (ret.error.type) {
            case "payment":
                log.error("payment error:", ret.error.msgs)
                return true
                break;
            case "ok":
                log.echo("all zombies burned")
                return false
                break;
            case "basic":
                log.error("basic error:", ret.error.msgs)
                return true
                break;
            default:
                log.error(ret.error.type)
                return true
        }
    }

    private async tryTransferZombie() {
        let ret = await Navigator.transfer.zombies(<puppeteer.Page>this.page)
        let desc = ""
        switch (ret.error.type) {
            case "payment":
                desc = "payment error:" + ret.error.msgs!.join("; ")
                break;
            case "ok":
                log.echo("All zombie transfered")
                break;
            case "basic":
                desc = "basic error:" + ret.error.msgs!.join("; ")
                break;
            default:
                desc = "unknown: " + ret.error.type
        }
        if (desc != "") { log.error("zombie transfer:", desc); return true }
        return false
    }

    protected async setupPage(): Promise<puppeteer.Page> {
        try {
            if (!this.browser) {
                throw "setuping page before creating browser"
            }
            this.page = await this.browser.newPage();

            if (Config().proxy.length) {
                await this.page.setRequestInterception(true)

                function randomProxy(): string {
                    let proxy = Config().proxy.at(0+Math.floor(Math.random() * Config().proxy.length) )
                    if (!proxy) {
                        return randomProxy()
                    }
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
                log.error('browser error: ' + errorMessage)
                await this.dispose()
                await this.run()
            });
            await this.page.on('pageerror', async (err: any) => {
                const errorMessage = err.toString();
                log.error('browser this.page error:', errorMessage)
                await this.dispose()
                await this.run()
            });
        } catch (err) {
            throw new Error('this.page initialization failed. Reason: ' + err);
        }
        return this.page;
    }
}
