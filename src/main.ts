// import { Worker as nodeWorker } from 'worker_threads';
import { existsSync } from 'fs'
import { parse } from 'ts-command-line-args';
import { Mutex } from 'async-mutex'
import { Config } from './Config.js'
// import { sendNear } from './near-distributor.js'
import { api } from './near-worker/api.js'
import { BWorkerFactory } from './browser-worker/worker.js'
import { NWorkerFactory } from './near-worker/worker.js'
import { Worker, WorkerFactory } from './worker.js'
import { sleep, log, addTime } from './utils.js'
import { accounts, db, Account } from './accounts.js'
import { EventEmitter } from './EventEmitter.js'
import { createMainProgress, updateMainProgress } from './bar-helper.js'
import { mpb } from './global.js'
import * as fs from 'fs'
// import { addParentTask, updateParentTask, doneReferalTask } from './libs/bar-helper.js'

class Controller extends EventEmitter<{"done": void}> {
    private workers: Set<Worker>;
    private active: number = 0;
    private mtx: Mutex;

    private overall = 0;
    private ok = 0;
    private err = 0;

    constructor(private cuncurrency: number, private factory: WorkerFactory) {
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

    private shift = false
    private async onWorkDone(w: Worker, err: boolean) {
        const lock = await this.mtx.acquire();
        try {
            if (err) {
                this.err++
            } else {
                this.ok++
            }
            this.workers.delete(w)
            if (this.workers.size) {
                this.workers.values().next().value.run()
            }
        } finally {
            if (this.shift ||
                ( (this.err+this.ok)%8 == 0 && (this.err+this.ok) != 0 )) {
                this.shift = true
                mpb.removeTask(2, true)
            }
            updateMainProgress(this.err+this.ok, this.overall, this.err)
            if (this.workers.size === 0) {
                this.emit("done")
            }
            lock()
        }
    }

    async process(): Promise<Date> {
        let minTimeToMint = addTime(24, 0, 0).getTime();
        let accs = (await db.accounts.findMany((a) => {
            if ( <number>a.nextMint == 0 || <number>a.nextMint <= new Date().getTime()) {
                return true
            } else if (a.nextMint != 0) {
                minTimeToMint = Math.min(minTimeToMint, <number>a.nextMint)
                return false
            } else {
                return false
            }
        })).map(a => new Account(a))

        this.overall = 0
        this.err = 0
        this.ok = db.accounts.documents.length-accs.length
        createMainProgress(this.ok, db.accounts.documents.length)

        await this.factory.init()
        log.echo("Initializing workers queue")
        for (let a of accs) {
            await this.addWork(this.factory.produce(a))
        }

        if (this.workers.size === 0) {
            this.emit("done")
        }

        let waitDonePromise: Promise<Date> = new Promise(resolve => {
            this.on("done", () => {
                resolve(new Date(minTimeToMint))
            })
        })

        return await waitDonePromise
    }
}

interface opts {
    importPath?: string;
    concurrency?: number;
    mode?: string;
    worker?: string;
}

class App {
    private concurrency: number = 1;
    private mode: "normal" | "provide" = "normal";
    private worker: "browser" | "near" = "near"

    constructor() { }

    private async import(path: any) {
        if (path) {
            log.echo("Importing accounts from:", path)
            let pathes = path.split(' ')
            await accounts.importPhrases(pathes[0], pathes[1] ?? undefined)
        } else {
            if (Config().import != '' && existsSync(Config().import)) {
                log.echo("Importing accounts from:", Config().import)
                let pathes = Config().import.split(' ')
                await accounts.importPhrases(pathes[0], pathes[1] ?? undefined)
            }
        }
    }

    private async setCuncurrency(val: any) {
        this.concurrency = val ?? Config().concurrency
    }

    private setWorker(worker: any) {
        if (worker) {
            if (worker === "browser" || worker === "near") {
                this.worker = worker
            } else {
                throw "Unknown worker " + worker
            }
        }
    }

    private setMode(mode: any) {
        if (mode === "provide") {
            this.mode = "provide"

            log.echo("Starting provide mode")
            log.echo("NEAR Provider:", Config().NEARProvider.addr)
            log.echo("Send amount:", "Noet implemented, sending 0.1 NEAR")
            log.echo("Overall accounts:", accounts.count)
        } else {
            this.mode = "normal"

            let accCount: number = accounts.count;

            log.echo("\nStarting normal mode",
                "\nWorker:", this.worker,
                "\nMother account:", Config().mother,
                "\nNEAR provider:", Config().NEARProvider.addr,
                "\nMode:",
                "\n\ttransfer:", Config().transfer,
                "\n\tburn:", Config().burn,
                "\n\theadless:", Config().headless,
                "\nOverall accounts:", accCount,
                "\nCuncurrency:", this.concurrency,
                "\nProxy count setted:", Config().proxy.length)
        }

    }

    async init() {
        const argv: opts = parse<opts>({
            importPath:  { type: String, alias: 'i', optional: true },
            concurrency: { type: Number, alias: 'c', optional: true },
            mode:        { type: String, alias: 'p', optional: true },
            worker:      { type: String, alias: 'w', optional: true },
        })

        await this.import(argv.importPath)
        this.setCuncurrency(argv.concurrency)
        this.setWorker(argv.worker)
        this.setMode(argv.mode)

        return this
    }

    private async runProvideMode() {
        // TODO check wallets before send
        let accs = accounts.getRange(0, accounts.count);
        await api.connect()
        let provider_id = Config().NEARProvider.addr
        await api.account.add({
            addr: provider_id,
            phrases: (await db.accounts.findOne({ wallet: provider_id }))!.phrases
        })
        let passed = 0
        for await (let acc of accs) {
            if (acc.wallet != ""
                && passed == 0
                && acc.wallet != provider_id) {
                passed++
                continue
            }

            await api.account.add({
                addr: acc.wallet,
                phrases: acc.phrases
            })
            let _balance = await api.account.balances.near.yactoNear(acc.wallet)
            let balance = parseInt(_balance.available) * Math.pow(10, -24)
            // TODO serve more then one land
            if (await api.account.zomland.lands(acc.wallet)) {

            } else {
                fs.appendFileSync("./unminted", JSON.stringify(acc))
            }

            if (balance >= 0.16) { // todo
                console.log("Skiping:", balance.toFixed(4), "near")
                continue
            }

            if (acc.wallet != "" && acc.wallet != provider_id) {
                log.echo("Sending to", acc.wallet, "id: ", acc.id)
                await api.account.send.near(provider_id, acc.wallet, String(.16-balance+0.05))
            }
            passed++
        }
    }

    private async runNormalMode() {
        let ctl = new Controller(this.concurrency,
            (this.worker === "browser" ? new BWorkerFactory() :
                (this.worker === "near" ? new NWorkerFactory() :
                    new NWorkerFactory() // default
                )
            )
        )
        let next = await ctl.process()

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
