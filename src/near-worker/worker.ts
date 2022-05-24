import { Worker, WorkerFactory } from './../worker.js'
import * as near from 'near-api-js'
import { api } from './api.js'
// import { addTime } from './../utils.js'
import { Account } from './../accounts.js'
import { Config } from './../Config.js'

export class NWorkerFactory extends WorkerFactory {
    constructor() { super() }
    async init() { api.connect() }
    produce(acc: Account) { return new NWorker(acc) }
}

export class NWorker extends Worker {
    constructor(acc: Account) {
        super(acc)
    }
    
    async run() {
        let err = false
        try {
            await api.account.add({
                addr: this.account.wallet,
                phrases: this.account.phrases
            })

            await api.zomland.dropDups(this.account.wallet)

            let lands_req
            try {
                lands_req = await api.zomland.lands(this.account.wallet)
            } catch (e: any) {
                throw {
                    text: "cannot get lands details",
                    details: e
                }
            }

            if (lands_req) {
                for await (let land of lands_req.lands) {
                    try {
                        // if (addTime(24, 0, 0, new Date(Number((land.last_zombie_claim/1000000).toFixed()))).getTime() <= new Date().getTime()) {
                            // this.emit('msg', { text: 'Skiping minting: not time yet', details: {} })
                            // continue
                        // }
                        await api.zomland.mint(this.account.wallet, this.account.phrases, land.token_id)
                    } catch (e: any) {
                        throw {
                            text: "cannot mint zombie",
                            details: e
                        }
                    }
                }
            } else {
                throw {
                    text: "no avalible lands",
                    details: {}
                }
            }

            let zombies_req
            try {
                zombies_req = await api.zomland.zombies(this.account.wallet)
            } catch (e: any) {
                throw {
                    text: "cannot get zombies",
                    details: e
                }
            }

            if (zombies_req) {
                if (Config().burn && Config().transfer != 'zombie') {
                    for await (let zombie of zombies_req.zombies) {
                        try {
                            await api.zomland.kill(this.account.wallet, zombie.token_id)
                        } catch (e: any) {
                            throw {
                                text: "cannot kill zombie",
                                details: e
                            }
                        }
                    }
                }

                if (this.account.wallet != Config().mother) {
                    // let transfer_fn: (arg: any) => Promise<near.providers.FinalExecutionOutcome>
                    switch (Config().transfer) {
                        case 'zombie':
                            // transfer_fn = async (arg: ZombieNFT) => await api.zomland.transfer.zombie(this.account.wallet, Config().mother, arg)
                            for await (let zombie of zombies_req.zombies) {
                                try {
                                    await api.zomland.transfer.zombie(this.account.wallet, Config().mother, zombie)
                                } catch (e:any) {
                                    throw {
                                        text: "cannot transfer zombie",
                                        details: e
                                    }
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
                                    throw {
                                        text: "cannot transfer zlt",
                                        details: e
                                    }
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
                            this.emit("msg", {text: "ambigous config for transfer:", details: Config().transfer})
                            break;
                    }
                }
            }
        } catch (e: any) {
            this.emit("msg", e)
            err = true
        } finally {
            this.emit("done", err)
        }
    }
}
