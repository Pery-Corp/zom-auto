import { Worker, WorkerFactory } from './../worker.js'
import * as near from 'near-api-js'
import { api } from './api.js'
import { log } from './../utils.js'
// import { addTime } from './../utils.js'
import { Account } from './../accounts.js'
import { Config } from './../Config.js'
import { WorkerBarHelper } from './../bar-helper.js'

export class NWorkerFactory extends WorkerFactory {
    constructor() { super() }
    async init() { api.connect() }
    produce(acc: Account) { return new NWorker(acc) }
}

export class NWorker extends Worker {
    constructor(acc: Account) {
        super(acc)
        this.barHelper = new WorkerBarHelper(this.account,
            [
                "Connecting to near",
                "Clearing access key duplicates",
                "Cheking for lands",
                "Cheking for zombies",
                "Minting",
                "Buring zomby",
                "Transfering ntf/ft"
            ]
        )
    }

    async run() {
        let err = false
        try {
            if (this.account.wallet == "") {
                throw "No wallet address"
            }
            this.barHelper.create()
            this.barHelper.next()
            await api.account.add({
                addr: this.account.wallet,
                phrases: this.account.phrases
            })

            this.barHelper.next()
            await api.zomland.dropDups(this.account.wallet)

            this.barHelper.next()
            let lands_req
            try {
                lands_req = await api.zomland.lands(this.account.wallet)
            } catch (e: any) {
                throw "cannot get lands details"
            }

            this.barHelper.next()
            if (lands_req) {
                for await (let land of lands_req.lands) {
                    try {
                        // if (addTime(24, 0, 0, new Date(Number((land.last_zombie_claim/1000000).toFixed()))).getTime() <= new Date().getTime()) {
                            // this.emit('msg', { text: 'Skiping minting: not time yet', details: {} })
                            // continue
                        // }
                        await api.zomland.mint(this.account.wallet, land.token_id)
                    } catch (e: any) {
                        log.error("Cannot mint zombie")
                    }
                }
            } else {
                throw "no avalible lands"
            }

            this.barHelper.next()
            let zombies_req
            try {
                zombies_req = await api.zomland.zombies(this.account.wallet)
            } catch (e: any) {
                throw "Cannot get zombies"
            }

            this.barHelper.next()
            if (zombies_req) {
                if (Config().burn && Config().transfer != 'zombie') {
                    for await (let zombie of zombies_req.zombies) {
                        try {
                            await api.zomland.kill(this.account.wallet, zombie.token_id)
                        } catch (e: any) {
                            log.error("Cannot kill zombie:", zombie.token_id)
                        }
                    }
                }

                this.barHelper.next()
                if (this.account.wallet != Config().mother) {
                    // let transfer_fn: (arg: any) => Promise<near.providers.FinalExecutionOutcome>
                    switch (Config().transfer) {
                        case 'zombie':
                            // transfer_fn = async (arg: ZombieNFT) => await api.zomland.transfer.zombie(this.account.wallet, Config().mother, arg)
                            for await (let zombie of zombies_req.zombies) {
                                try {
                                    await api.zomland.transfer.zombie(this.account.wallet, Config().mother, zombie)
                                } catch (e:any) {
                                    log.error("Cannot transfer zombie:", zombie.token_id)
                                }
                            }
                            break;
                        case 'zlt':
                            try {
                                let balance = await api.account.balances.zomland.zlt(this.account.wallet)
                                try {
                                    await api.zomland.transfer.zlt(this.account.wallet, Config().mother,
                                        near.utils.format.formatNearAmount(balance!.zlt))
                                } catch (e: any) {
                                    log.echo("Cannot transfer zlt")
                                }
                            } catch(e: any){
                                throw {
                                    text: "cannot get account balance",
                                    details: e
                                }
                            }
                            break;
                        case 'none':
                            break;
                        default:
                            log.error("ambigous config for transfer:", Config().transfer)
                            break;
                    }
                }
            }
        } catch (e: any) {
            log.error(e)
            err = true
        } finally {
            this.barHelper.done(err)
            this.emit("done", err)
        }
    }
}
