import Worker from './../worker.js'
import { Account } from './../accounts.js'
import { Config } from './../Config.js'
// @ts-ignore
import { proxyRequest } from 'puppeteer-proxy'
import { log, addTime } from './../utils.js'
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

export default class BWorker extends  Worker {
    protected browser?: puppeteer.Browser;
    protected page?: puppeteer.Page;

    constructor(acc: Account) {
        super(acc)
    }

    dum() {
        this.tryMint()
    }

    private async runWraper() {
        try {
            this.page = await this.prepare()
            await this.tryLogin()

            // await this.tryMint()

            if (Config().burn) {
                await this.tryBurn()
            }

            if (Config().mother != this.account.wallet.addr) {
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

    public async run(): Promise<void> {
        let err = false
        try {
            await this.runWraper()
        } catch (e) {
            err = true // useless
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
        this.page = await Navigator.login.phrase(<puppeteer.Page>this.page, this.account)
    }

    private async tryMint() {
        log("Trying to mint zomby, account:", this.account.id)
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
                log.error('browser error: ' + errorMessage, "account:", this.account.id, " retraing")
                await this.dispose()
                await this.run()
            });
            await this.page.on('pageerror', async (err: any) => {
                const errorMessage = err.toString();
                log.error('browser this.page error: ' + errorMessage, "account:", this.account.id)
                await this.dispose()
                await this.run()
            });
        } catch (err) {
            throw new Error('this.page initialization failed. Reason: ' + err);
        }
        return this.page;
    }
}

