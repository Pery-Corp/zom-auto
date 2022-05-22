// import { Worker as nodeWorker } from 'worker_threads';
import { existsSync } from 'fs'
import progress from 'progress'
import { parse } from 'ts-command-line-args';
import { Mutex } from 'async-mutex'
import { Config } from './Config.js'
import { sendNear } from './near-distributor.js'
import BWorker from './browser-worker/worker.js'
import NWorker from './near-worker/worker.js'
import Worker from './worker.js'
import { sleep, log, addTime } from './utils.js'
import { accounts, Account } from './accounts.js'
import { EventEmitter } from './EventEmitter.js'

class Controller extends EventEmitter<{"done": void}> {
    private workers: Set<Worker>;
    private active: number = 0;
    private mtx: Mutex;

    private overall = 0;
    private progress: any

    constructor(private cuncurrency: number, private createWorker: (...arg: any[])=>Worker) {
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
            // let nextMintTime = addTime(24, 0, 0, new Date(a.lastMint)).getTime()
            // if (nextMintTime <= new Date().getTime()) {
                await this.addWork(this.createWorker(a))
            // } else {
            //     minTimeToMint = Math.min(minTimeToMint, nextMintTime)
            // }
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
    worker?: string,
}

class App {
    private concurrency: number = 1;
    private mode: "normal" | "provide" = "normal";
    private worker = "browser"

    constructor() {

    }

    async init() {
        let argv = parse<opts>({
            importPath:  { type: String, alias: 'i', optional: true },
            concurrency: { type: Number, alias: 'c', optional: true },
            mode:        { type: String, alias: 'p', optional: true },
            worker:      { type: String, alias: 'w', optional: true },
        })
        if (argv.importPath) {
                log.echo("Importing accounts from:", argv.importPath)
            await accounts.importPhrases(argv.importPath)
        } else {
            if (Config().import != '' && existsSync(Config().import)) {
                log.echo("Importing accounts from:", Config().import)
                await accounts.importPhrases(Config().import)
            }
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
            log.echo("Accounts with determined wallet:", accounts.count - (await Account.findMany({ wallet: {addr: "", key: ""} })).length)
        } else {
            this.mode = "normal"

            if (argv.worker) {
                if (argv.worker === "browser" || argv.worker === "near") {
                    this.worker = argv.worker
                } else {
                    throw "Unknown worker " + argv.worker
                }
            }

            let accCount: number = accounts.count;
            let withoutWL = (await Account.findMany({ wallet: {addr: "", key: ""} })).length
            let withoutMintInfo = (await Account.findMany({ lastMint: 0 })).length

            log.echo("\nStarting normal mode",
            "\nWorker:", this.worker,
            "\nMother account:", Config().mother,
            "\nNEAR provider:", Config().NEARProvider.addr,
            "\nMode:",
                "\n\ttransfer:", Config().transfer,
                "\n\tburn:", Config().burn,
                "\n\theadless:", Config().headless,
            "\nOverall accounts:", accCount,
                "\n\tWithout determined wallet:", withoutWL,
                "\n\tWithout determined mint schedule:", withoutMintInfo,
            "\nCuncurrency:", this.concurrency,
            "\nProxy count setted:", Config().proxy.length)
        }

        return this
    }

    private async runProvideMode() {
        // TODO check wallets before send
        let accs = accounts.getRange(0, accounts.count);
        for await (let acc of accs) {
            if (acc.wallet.addr != "" && acc.wallet.addr != Config().NEARProvider.addr) {
                await sendNear(Config().NEARProvider, acc.wallet.addr, '0.1')
            }
        }
    }

    private async runNormalMode() {
        let ctl = new Controller(this.concurrency,
            (this.worker === "browser" ? (...arg: any[]) => { return new BWorker(arg[0]) } :
                (this.worker === "near" ? (...arg: any[]) => { return new NWorker(arg[0]) } :
                    (...arg: any[]) => { return new BWorker(arg[0]) } // default
                )
            )
        )
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
