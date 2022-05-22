import { EventEmitter } from './EventEmitter.js'
import { Account } from './accounts.js'

export default class Worker extends EventEmitter<{"done": boolean}> {
    protected account: Account;

    constructor(account: Account) {
        super()
        this.account = account
    }

    async run() { }
}
