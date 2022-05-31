import { Account, db } from './accounts.js'
import { api } from './near-worker/api.js'

const accounts = await db.accounts.documents

const 

await api.connect()
for await (let account of accounts) {
    if (account.wallet && account.wallet != "") {
        await api.account.add({
            addr: account.wallet,
            phrases: account.phrases
        })
        let balance = await api.account.balances.near.yactoNear(account.wallet)
        let available = parseInt(balance.available) * Math.pow(10, -24)
        let total = parseInt(balance.total) * Math.pow(10, -24)
    }
}
