import { Account, db } from './accounts.js'
import { api } from './near-worker/api.js'
import { plot, Plot } from 'nodeplotlib'

await api.connect()
const accounts = await db.accounts.documents

const last_block = await api.lastBlock()
const gas_price_near = await api.gasPrice(last_block.block_hash)

let balances: {
    id: number,
        total: number,
        available: number
}[] = new Array()
let cur = 0, overall = accounts.length
for await (let account of accounts) {
    console.log('\r\r'+cur+'/'+overall+' '+cur/overall*100)
    cur++
    if (account.wallet && account.wallet != "") {
        await api.account.add({
            addr: account.wallet,
            phrases: account.phrases
        })
        let balance = await api.account.balances.near.yactoNear(account.wallet)
        balances.push({
            id: cur-1,
            total: parseInt(balance.total) * Math.pow(10, -24),
            available: parseInt(balance.available) * Math.pow(10, -24)
        })
        console.log(account.wallet)
        console.log(balances[balances.length-1])
        console.log(balance)
    }
}


let trace: Plot[] = [
    {
        x: balances.map(a => a.id),
        y: balances.map(a => a.available),
        marker: {
            color: [ 'red', 'blue' ],
            size: [ 20, 50, 80 ]
        },
        mode: 'markers',
    }
]
plot(trace)
