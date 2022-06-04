import { IMarketHistoryEntry, db, MarketHistoryEntry } from './database.js'
import { api, ZombieNFT, MonsterNFT } from './near-worker/api.js'
import { time, sleep } from './utils.js'

await api.connect()

async function scrap() {
    let added = 0
    const history = await api.account.zomland.marketHistory()
    for (const entry of history!.nft) {
        const nftEntry: IMarketHistoryEntry = {
            date: Number(( entry.timestamp/1000000 ).toFixed(0)), // to normal
            price: entry.price * Math.pow(10, -24),
            price_yacto: entry.price,
            nft_type: entry.nft_type,
            nft: (entry.nft_type === "Zombie" ?
                (await api.account.zomland.zombie.getById([ entry.token_id ]))?.zombie[0] :
                (await api.account.zomland.monster.getById([ entry.token_id ]))?.monster[0])
        }
        // if not exits
        if (nftEntry.nft && !(await db.market.findOne(e => e.nft.token_id === entry.token_id))) {
            added++
            await new MarketHistoryEntry(nftEntry).sync()
        }
    }
    return added
}

async function worker() {
    try {
        console.log("Added", await scrap(), "entries", time.format(new Date().getTime(), "H:i:s"))
    } catch(e) {}
    await sleep(10000)
    await worker()
}

await worker()
