import * as fs from 'fs'
import { Account } from './accounts.js'

function read(): Account[] {
    let data = fs.readFileSync("accounts.json").toString()

    return JSON.parse(data)
}

let accounts = read()

for (let account of accounts) {
    account.wallet = { addr: "", key: "" }
}

fs.writeFileSync("accounts.tmp.json", JSON.stringify(accounts))
