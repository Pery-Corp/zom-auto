import { Account, db } from './accounts.js'
import { api } from './near-worker/api.js'
import { Config } from './Config.js'

await api.connect()

let accounts = db.accounts.documents.map(a => new Account(a))

for (const acc of accounts) {
    if (acc.wallet === "" || acc.wallet == Config().mother) {
        continue
    }
    await api.account.add({
        addr: acc.wallet,
        phrases: acc.phrases
    })

    let _balance = await api.account.balances.near.yactoNear(acc.wallet)
    let balance = parseInt(_balance.available) * Math.pow(10, -24)

    if (balance > 1) {
        console.log("Balance:", balance)
        console.log("Sending:", String( balance - 0.3 ))
        await api.account.send.near(acc.wallet, Config().mother, String( balance - 0.3 ))
    }
}

// import * as fs from 'fs'

// let str = fs.readFileSync('accounts.yan.json').toString()
// let json: any[] = JSON.parse(str)

// for (let a of json) {
//     await new Account({
//         wallet: a.wallet,
//         phrases: a.phrases
//     }).sync()
// }
