import { EventEmitter } from './EventEmitter.js'
import { Account } from './accounts.js'
import { WorkerBarHelper } from './bar-helper.js'

export class WorkerFactory {
    async init() { }

    // @ts-ignore
    produce(acc: Account): Worker { }
}

export class Worker extends EventEmitter<{"done": boolean, "msg": {text: string, details: any}}> {
    protected account: Account;
    // @ts-ignore
    protected barHelper: WorkerBarHelper

    constructor(account: Account) {
        super()
        this.account = account
    }

    async run() { }
}
