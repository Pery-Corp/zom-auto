import { plot, Plot, Layout } from 'nodeplotlib'
import { time } from './utils.js'
import { db, MarketHistoryEntry } from './database.js'
import { ZombieNFT, MonsterNFT } from './near-worker/api.js'

const history = db.market.documents
const zombieHistory = await db.market.findMany(e => e.nft_type === "Zombie")
const monsterHistory = await db.market.findMany(e => e.nft_type === "Monster")

const z_commons = zombieHistory.filter(a => a.nft.card_rarity === "Common")
const z_uncommons = zombieHistory.filter(a => a.nft.card_rarity === "Uncommon")
const z_rares = zombieHistory.filter(a => a.nft.card_rarity === "Rare")
const z_epics = zombieHistory.filter(a => a.nft.card_rarity === "Epic")

const m_commons = monsterHistory.filter(a => a.nft.card_rarity === "Common")
const m_uncommons = monsterHistory.filter(a => a.nft.card_rarity === "Uncommon")
const m_rares = monsterHistory.filter(a => a.nft.card_rarity === "Rare")
const m_epics = monsterHistory.filter(a => a.nft.card_rarity === "Epic")

const z_trackCommon: Plot = {
    name: 'Zombie Commons',
    x: z_commons.map(a => time.format(a.date, "m-d H:i:s")),
    y: z_commons.map(a => a.price),
    type: 'scatter',
}

const z_trackUncommon: Plot = {
    name: 'Zombie Uncommons',
    x: z_uncommons.map(a => time.format(a.date, "m-d H:i:s")),
    y: z_uncommons.map(a => a.price),
    type: 'scatter',
}

const z_trackRare: Plot = {
    name: 'Zombie Rares',
    x: z_rares.map(a => time.format(a.date, "m-d H:i:s")),
    y: z_rares.map(a => a.price),
    type: 'scatter',
}

const z_trackEpic: Plot = {
    name: 'Zombie Epics',
    x: z_epics.map(a => time.format(a.date, "m-d H:i:s")),
    y: z_epics.map(a => a.price),
    type: 'scatter',
}

const m_trackCommon: Plot = {
    name: 'Monster Commons',
    x: m_commons.map(a => time.format(a.date, "m-d H:i:s")),
    y: m_commons.map(a => a.price),
    type: 'scatter',
}

const m_trackUncommon: Plot = {
    name: 'Monster Uncommons',
    x: m_uncommons.map(a => time.format(a.date, "m-d H:i:s")),
    y: m_uncommons.map(a => a.price),
    type: 'scatter',
}

const m_trackRare: Plot = {
    name: 'Monster Rares',
    x: m_rares.map(a => time.format(a.date, "m-d H:i:s")),
    y: m_rares.map(a => a.price),
    type: 'scatter',
}

const m_trackEpic: Plot = {
    name: 'Monster Epics',
    x: m_epics.map(a => time.format(a.date, "m-d H:i:s")),
    y: m_epics.map(a => a.price),
    type: 'scatter',
}

console.log("Zombies sold:", zombieHistory.length)
console.log("Monsters sold:", monsterHistory.length)

const times = history.map(e => e.date).sort((a: number, b: number) => {
    if (a > b) {
        return <number>a
    } else {
        return <number>b
    }
})
console.log("Sold rates:")
const hours = times.map(e => new Date(e).getHours)
console.log("Per hour:", )
console.log("AVG Sold delay:", time.format(Number( ( times.reduce((prev, cur) => cur+prev, 0)/times.length ).toFixed(0) ), "H:i:s"))

plot([ z_trackCommon ], { title: "Zombie common " + z_commons.length })
plot([ z_trackUncommon ], { title: "Zombie uncommon " + z_uncommons.length })
plot([ z_trackRare ], { title: "Zombie rare " + z_rares.length })
plot([ z_trackEpic ], { title: "Zombie epic " + z_epics.length })
plot([ m_trackCommon, m_trackUncommon, m_trackRare, m_trackEpic ], { title: "Monsters " + monsterHistory.length })
