// import { Account, db } from './accounts.js'
// import { api } from './near-worker/api.js'
// import { plot, Plot, Layout } from 'nodeplotlib'

// await api.connect()
// const accounts = await db.accounts.documents

// const last_block = await api.lastBlock()
// const gas_price_near = await api.gasPrice(last_block.block_hash)

// let balances: {
//     id: number;
//     total: number;
//     available: number;
//     mints: number
// }[] = new Array()

// if (fs.existsSync('balances.json')) {
//     balances = JSON.parse(fs.readFileSync("balances.json").toString())
// }

// let cur = 0, overall = accounts.length
// for await (let account of accounts) {
//     console.log('\r'+cur+'/'+overall+' '+(cur/overall*100).toFixed(0))
//     cur++
//     if (account.wallet && account.wallet != "") {
//         if (balances.filter(e => e.id == account.id).length > 0) {
//             continue;
//         }
//         await api.account.add({
//             addr: account.wallet,
//             phrases: account.phrases
//         })
//         let balance = await api.account.balances.near.yactoNear(account.wallet)
//         let mints = (await api.zomland.lands(account.wallet))!.lands.reduce((prev, cur) => prev + ( cur.count_minted_zombies ?? 0 ), 0)
//         balances.push({
//             id: <number>account.id,
//             total: parseInt(balance.total) * Math.pow(10, -24),
//             available: parseInt(balance.available) * Math.pow(10, -24),
//             mints: mints
//         })
//     }
// }

// import * as fs from 'fs'

// fs.writeFileSync("balances.json", JSON.stringify(balances, null, '  '))

// var trace1 = {
//       x: ['Liam', 'Sophie', 'Jacob', 'Mia', 'William', 'Olivia'],
//       y: [8.0, 8.0, 12.0, 12.0, 13.0, 20.0],
//       type: 'bar',
//       text: ['4.17 below the mean', '4.17 below the mean', '0.17 below the mean', '0.17 below the mean', '0.83 above the mean', '7.83 above the mean'],
//     marker: {
//             color: 'rgb(142,124,195)'
//     }
// };

// let traceAvalible: Plot = {
//     name: 'Avalible',
//     x: balances.map(a => a.id),
//     y: balances.map(a => a.total-a.available + a.available),
//     type: 'bar',
// }

// let traceBlocked: Plot = {
//     name: 'Storage coverage',
//     x: balances.map(a => a.id),
//     y: balances.map(a => a.total-a.available),
//     marker: {
//         color: 'red'
//     },
//     type: 'bar',
// }

// let layout: Layout = {barmode: 'stack'};
// plot([ traceBlocked, traceAvalible ], layout)
