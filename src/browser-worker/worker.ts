import { Worker, WorkerFactory} from './../worker.js'
import { Account } from './../accounts.js'
import { Config } from './../Config.js'
// @ts-ignore
import { proxyRequest } from 'puppeteer-proxy'
import { addTime } from './../utils.js'
import puppeteer from 'puppeteer'
import { Navigator } from './Navigator.js'

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
    }

    private async runWraper() {
        let err = false
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
        } finally {
            await this.account.sync()
            await this.dispose()
            return err
        }
    }

    public async run(): Promise<void> {
        let err = false
        try {
            err = await this.runWraper()
        } finally {
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
            return true
        }
        return false
    }

    private async tryMint() {
        let ret = await Navigator.mint.zomby(<puppeteer.Page>this.page)
        this.page = ret!.page
        let desc=""
        switch (ret.error.type) {
            case "time":
                this.account.updateLastMint(
                    addTime(ret.error.time!.hours - 24,
                        ret.error.time!.minutes - 60,
                        ret.error.time!.seconds - 60).getTime())
                desc = "Not time yet, to mint " + ret.error.time!.hours + "h " + ret.error.time!.minutes + "m " + ret.error.time!.seconds + "s"
                break;
            case "basic": desc = "basic error" + ret.error.msgs!.join("; ")
                break;
            case "payment": desc = "payment error: " + ret.error.msgs!.join("; ")
                break;
            case "ok": this.emit("msg", { text: "Zomby mint success", details: {} }); this.account.updateLastMint(new Date().getTime())
                break;
            default: desc = "Unknown error while minting"
                break;
        }
        if (desc != "") { this.emit("msg", {text: "cannot mint zomby: " + desc, details: {} }); return true }
        return false
    }

    private async tryBurn() {
        let ret = await Navigator.burn.zombies(<puppeteer.Page>this.page)
        switch (ret.error.type) {
            case "payment":
                this.emit("msg", { text: "payment error: " + ret.error.msgs!.join("; "), details: {}})
                return true
                break;
            case "ok":
                this.emit("msg", {text: "all zombies burned", details: {} })
                return false
                break;
            case "basic":
                this.emit("msg", { text:"basic error " + ret.error.msgs!.join("; "), details: {} })
                return true
                break;
            default:
                this.emit("msg", { text:ret.error.type, details: {}})
                return true
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
        if (desc != "") { this.emit("msg", { text: "zomby transfer: " + desc, details: {}}); return true }
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
                this.emit("msg", { text: 'browser error: ' + errorMessage + " account: " + this.account.id + " retraing", details: {}})
                await this.dispose()
                await this.run()
            });
            await this.page.on('pageerror', async (err: any) => {
                const errorMessage = err.toString();
                this.emit("msg", { text: 'browser this.page error: ' + errorMessage + " account: " + this.account.id, details: {} })
                await this.dispose()
                await this.run()
            });
        } catch (err) {
            throw new Error('this.page initialization failed. Reason: ' + err);
        }
        return this.page;
    }
}

