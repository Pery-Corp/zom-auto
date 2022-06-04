import near from 'near-api-js'
import {Base64} from './../base64.js'
import { log } from './../utils.js'
const { KeyPair, keyStores, utils } = near;
import { Describe, optional, nullable, enums, number, array, assert, object, string } from 'superstruct'
// @ts-ignore
import * as seed from 'near-seed-phrase'
import sha256 from 'js-sha256'
import https from 'https'

type ZL_MarketHistoryEntry = {
    from_user: string;
    to_user: string;
    price: number;
    token_id: string;
    nft_type: ZL_NFT_Type,
    timestamp: number
}

export enum Collection {
    Mummy = 1,
    Pirate = 2,
    Punk = 3,
    Stylish = 4,
    Combat = 5
}

export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic"

const RaritySign = enums([ "Common", "Uncommon", "Rare", "Epic" ])

export type ZL_NFT_Type = 'Zombie' | 'Monster'
export const ZL_NFT_TypeSign = enums([ "Zombie", "Monster" ])

export interface MonsterNFT {
    token_id: string,
    card_rarity: Rarity,
    sale_price: number | null,
    kill_tokens: string,
    collection_id: number,
    media: string,
    mint_date: number,
    health: number,
    attack: number,
    brain: number,
    nft_type: ZL_NFT_Type,
    owner_id: string,
    next_land_discovery: number,
    next_battle: number
}

export const MonsterNFTSign: Describe<MonsterNFT> = object({
    token_id: string(),
    card_rarity: RaritySign,
    sale_price: nullable(number()),
    kill_tokens: string(),
    collection_id: number(),
    media: string(),
    mint_date: number(),
    health: number(),
    attack: number(),
    brain: number(),
    nft_type: ZL_NFT_TypeSign,
    owner_id: string(),
    next_land_discovery: number(),
    next_battle: number()
})

export interface ZombieNFT {
    token_id: string;
    card_rarity: Rarity;
    sale_price: number | null;
    kill_tokens: string;
    media: string;
    collection_id: number;
    collection_index: number;
    mint_date: number;
    health: number;
    attack: number;
    brain: number;
    speed: number;
    nft_type: ZL_NFT_Type;
    owner_id: string;
    modifier_items: any[];
    next_battle: number 
}

export const ZombieNFTSign: Describe<ZombieNFT> = object({
    token_id: string(),
    card_rarity: RaritySign,
    sale_price: nullable(number()),
    kill_tokens: string(),
    media: string(),
    collection_id: number(),
    collection_index: number(),
    mint_date: number(),
    health: number(),
    attack: number(),
    brain: number(),
    speed: number(),
    nft_type: ZL_NFT_TypeSign,
    owner_id: string(),
    modifier_items: array(string()),
    next_battle:  number()
})

export interface LandNFT {
    token_id: string,
    land_type: 'Micro' | 'Small' | 'Medium' | 'Large',
    last_zombie_claim: number,
    discover_events: number,
    count_minted_zombies: number
}

export let api = ((networkId = 'mainnet') => {
    type ZLQ_Result = {
        block_hash: string,
        block_height: number,
        logs: any[],
        result: any[]
    }

    let keyStore = new keyStores.InMemoryKeyStore()
    let connection: near.Near
    let provider: near.providers.JsonRpcProvider
    const zomlandContractId = "zomland.near"
    const MAX_GAS_CONST = "300000000000000"
    const MAX_GAS_REAL = async () => ( await getBlocks(1, 0) )[0].gas_limit.toString()

    const GAS_PRICES = {
        transfer: {
            zombie: String( 80000000000000 ),
            zlt: String( 20000000000000 ),
        },
        publish: String( 180000000000000 ),
        mint: String( 280000000000000 ),
        kill: String( 280000000000000 ),
        real_est_T: {
            transfer: {
                zombie: 26,
                zlt: 6,
            },
            mint: {
                zombie: 26,
                collection: 76
            },
            kill: 6
        }
    }

    const DEPOSITS = {
        mint: near.utils.format.parseNearAmount("0.01"),
        kill: near.utils.format.parseNearAmount("0.000000000000000000000001"),
        publish: near.utils.format.parseNearAmount("0.000001"),
        transfer: {
            zombie: near.utils.format.parseNearAmount("0.009"),
            zlt: near.utils.format.parseNearAmount("0.000000000000000000000001")
        },
    }

    function parseJsonRPC(input: any[]) {
        let ret = ""
        for (let x of input) {
            ret += String.fromCharCode(x)
        }
        return JSON.parse(ret)
    }

    async function connect() {
        const config: near.ConnectConfig = {
            networkId:   networkId,
            keyStore:    keyStore,
            nodeUrl:     `https://rpc.${networkId}.near.org`,
            walletUrl:   `https://wallet.${networkId}.near.org`,
            helperUrl:   `https://helper.${networkId}.near.org`,
            headers: {}
        };

        provider = new near.providers.JsonRpcProvider({
            url: `https://rpc.${networkId}.near.org`
        })
        connection = await near.connect(config);
    }

    async function addAccount(account: {addr: string, phrases: string[]}) {
        let keys = seed.parseSeedPhrase(account.phrases.join(" "))
        const keyPair = KeyPair.fromString(keys.secretKey);
        await keyStore.setKey(connection.config.networkId, account.addr, keyPair);
        const acc = await connection.account(account.addr);
    }

    interface NearBlocksIO_Block {
        block_height: 0,
            block_hash: string,
            block_timestamp: number,
            txn: number,
            receipt: number,
            author: string,
            gas_used: number,
            gas_limit: number,
            gas_fee: string
    }

    async function getBlocks(count: number = 1, offset: number = 0): Promise<NearBlocksIO_Block[]> {
        let raw: string = ""
        return new Promise(resolve => {
            https.get(`https://nearblocks.io/api/blocks?limit=${count}&offset=${offset}`, (res) => {
                res.on('data', (chunk) => {
                    raw += chunk
                })
                res.on("end", () => {
                    resolve(JSON.parse(raw).blocks)
                })
            })
        })
    }

    async function gasPrice(blockHash: string): Promise<number> {
        return parseInt((await provider.gasPrice(blockHash)).gas_price)
    }

    async function sendNear(from: string, to: string, amountn: string) {
        const amount = utils.format.parseNearAmount(amountn);

        const senderAccount = await connection.account(from);

        try {
            const result = await senderAccount.sendMoney(to, amount);
            log("Transfer complete:", result.status)
        } catch(error) {
            log("Transfer error:", error);
        }
    }

    async function ZLviewAccount(addr: string) {
        let res = await provider.query({
            account_id: addr,
            finality: "optimistic",
            request_type: "view_account"
        })
        return res
    }

    async function autorizedApps(addr: string) {
        const acc = await connection.account(addr)
        return await acc.getAccountDetails()
    }

    async function ZLdeleteDuplicateAutorization(addr: string) {
        let autorized = await autorizedApps(addr)

        let count = autorized.authorizedApps.length
        let cur = 0
        for await (let app of autorized.authorizedApps) {
            const acc = await connection.account(addr)
            if (app.contractId == zomlandContractId) {
                cur++
                if (cur >= count) {
                    break;
                }
                await acc.deleteKey(app.publicKey)
            }
        }
    }

    type MarketSearch = {
        start?: number,
        count?: number,
        collection?: Collection,
        rarity?: Rarity
    }

    async function getMarket<NFT>(nft_type: ZL_NFT_Type, search_arg?: MarketSearch) {
        let def_arg  = { start: 0, count: 20 }
        let arg = { ...def_arg, ...search_arg }
        const payload = {
            start: arg.start,
            limit: arg.count,
            filter_rarity: arg.rarity,
            filter_collection: arg.collection
        }
        if (!payload.filter_rarity) delete payload.filter_rarity
        if (!payload.filter_collection) delete payload.filter_collection
        let res = <ZLQ_Result>await provider.query({
            account_id: zomlandContractId,
            args_base64: Base64.encode(JSON.stringify(payload)),
            finality: "optimistic",
            method_name: (nft_type == "Monster" ? "get_monsters_from_market" : "get_zombies_from_market"),
            request_type: "call_function"
        })
        if (res && res.result) {
            let m = parseJsonRPC(res.result)
            return {
                ...res,
                count: m[0],
                nft: <NFT[]>m[1]
            }
        } else {
            return undefined
        }
    }

    async function getMarketHistory() {
        let res = <ZLQ_Result>await provider.query({
            account_id: zomlandContractId,
            args_base64: Base64.encode(JSON.stringify({})),
            finality: "optimistic",
            method_name: "get_last_market_history",
            request_type: "call_function"
        })
        if (res && res.result) {
            return {
                ...res,
                nft: <ZL_MarketHistoryEntry[]>parseJsonRPC(res.result)
            }
        } else {
            return undefined
        }
    }

    async function getYactoNearBalance(addr: string) {
        const acc = await connection.account(addr)
        return await acc.getAccountBalance()
    }

    async function getZLTBalance(addr: string) {
        let res = <ZLQ_Result>await provider.query({
            account_id: "ft." + zomlandContractId,
            args_base64: Base64.encode(JSON.stringify({
                account_id: addr
            })),
            finality: "optimistic",
            method_name: "ft_balance_of",
            request_type: "call_function"
        })
        if (res && res.result) {
            return {
                ...res,
                zlt: parseJsonRPC(res.result)
            }
        } else {
            return null
        }
    }

    async function getLands(addr: string): Promise<( ZLQ_Result & { lands: LandNFT[] } ) | null> {
        let res = <ZLQ_Result>await provider.query({
            account_id: zomlandContractId,
            args_base64: Base64.encode(JSON.stringify({
                id_list:[],
                user_id: addr
            })),
            finality: "optimistic",
            method_name: "user_lands_info",
            request_type: "call_function"
        })
        if (res && res.result) {
            return {
                ...res,
                lands: parseJsonRPC(res.result)
            }
        } else {
            return null
        }
    }

    async function getZombiesById(id: string[]) {
        let res = <ZLQ_Result>await provider.query({
            account_id: zomlandContractId,
            args_base64: Base64.encode(JSON.stringify({
                id_list: id
            })),
            finality: "optimistic",
            method_name: "get_zombies_by_id",
            request_type: "call_function"
        })
        if (res && res.result) {
            return {
                ...res,
                zombie: parseJsonRPC(res.result)
            }
        } else {
            return null
        }
    }

    async function getZombies(addr: string, page = 1, count = 20): Promise<( ZLQ_Result&{zombies_count: number, zombies: ZombieNFT[]} ) | null> {
        let res = <ZLQ_Result>await provider.query({
            account_id: zomlandContractId,
            args_base64: Base64.encode(JSON.stringify({
                account_id: addr,
                page_num: page.toString(),
                page_limit: count.toString() 
            })),
            finality: "optimistic",
            method_name: "user_zombies",
            request_type: "call_function"
        })
        if (res && res.result) {
            let zombies = parseJsonRPC(res.result)
            return {
                ...res,
                zombies_count: Number(zombies[0]),
                zombies: zombies[1]
            }
        } else {
            return null
        }
    }

    async function getMonstersById(id: string[]) {
        let res = <ZLQ_Result>await provider.query({
            account_id: zomlandContractId,
            args_base64: Base64.encode(JSON.stringify({
                id_list: id
            })),
            finality: "optimistic",
            method_name: "get_monsters_by_id",
            request_type: "call_function"
        })
        if (res && res.result) {
            return {
                ...res,
                monster: parseJsonRPC(res.result)
            }
        } else {
            return null
        }
    }

    async function getMonsters(addr: string, page = 1, count = 20) {
        let res = <ZLQ_Result>await provider.query({
            account_id: zomlandContractId,
            args_base64: Base64.encode(JSON.stringify({
                account_id: addr,
                page_num: page.toString(),
                page_limit: count.toString() 
            })),
            finality: "optimistic",
            method_name: "user_monsters",
            request_type: "call_function"
        })
        if (res && res.result) {
            let monsters = parseJsonRPC(res.result)
            return {
                ...res,
                monsters_count: monsters[0],
                monsters: monsters[1]
            }
        } else {
            return null
        }
    }

    async function mintCollection(addr: string, zombies: string[], collection_id: number) {
        const acc = await connection.account(addr)
        return await acc.functionCall({
            contractId: zomlandContractId,
            methodName: "mint_free_zombie_nft",
            args: {
                collection_id: collection_id,
                zombie_list: zombies
            },
            attachedDeposit: DEPOSITS.mint,
            gas: GAS_PRICES.mint
        })
    }

    async function mintZombieV1(sender: string, land: string) {
        const acc = await connection.account(sender)
        return await acc.functionCall({
            contractId: zomlandContractId,
            methodName: "mint_free_zombie_nft",
            args: { land_id: land },
            attachedDeposit: DEPOSITS.mint,
            gas: GAS_PRICES.mint
        })
    }

    async function mintZombieV2(sender: string, phrases: string[], land: string) {
        let keys = seed.parseSeedPhrase(phrases.join(" "))
        const keyPair = near.utils.key_pair.KeyPairEd25519.fromString(keys.secretKey);
        const publicKey = keyPair.getPublicKey();
        const accessKey: any = await provider.query(`access_key/${sender}/${publicKey.toString()}`, '');
        const nonce = ++accessKey.nonce;

        if (accessKey.permission !== 'FullAccess') {
            return console.log(
                `Account [ ${sender}  ] does not have permission to send tockens using key: [ ${publicKey}  ]`
            );
        }

        let actions = [
            near.transactions.functionCall(
                "mint_free_zombie_nft",
                { land_id: land },
                (await MAX_GAS_REAL()),
                DEPOSITS.mint,
            )
        ]

        const recentBlockHash = near.utils.serialize.base_decode(accessKey.block_hash);
        const transaction = near.transactions.createTransaction(
            sender, 
            publicKey, 
            zomlandContractId, 
            nonce, 
            actions, 
            recentBlockHash
        );

        const serializedTx = near.utils.serialize.serialize(
            near.transactions.SCHEMA, 
            transaction
        )
        const serializedTxHash = new Uint8Array(sha256.sha256.array(serializedTx))
        const signature = keyPair.sign(serializedTxHash)

        const signedTransaction = new near.transactions.SignedTransaction({
            transaction,
            signature: new near.transactions.Signature({ 
                keyType: transaction.publicKey.keyType, 
                data: signature.signature 
            })
        });

        const signedSerializedTx = signedTransaction.encode();
        const result: any = await provider.sendJsonRpc(
            'broadcast_tx_commit', 
            [Buffer.from(signedSerializedTx).toString('base64')]
        )

        return result
    }

    async function killZombie(addr: string, zombies: string[]) {
        const acc = await connection.account(addr)
        return await acc.functionCall({
            contractId: zomlandContractId,
            methodName: "kill_zombie",
            args: {
                zombie_list: zombies
            },
            attachedDeposit: DEPOSITS.kill,
            gas: GAS_PRICES.kill
        })
    }

    async function transferZombie(from: string, to: string, zombie: ZombieNFT) {
        const acc = await connection.account(from)
        return await acc.functionCall({
            contractId: zomlandContractId,
            methodName: "transfer_zombie",
            args: {
                token_id: zombie.token_id,
                recipient_id: to
            },
            attachedDeposit: DEPOSITS.transfer.zombie,
            gas: GAS_PRICES.transfer.zombie
        })
    }

    async function transferZLT(from: string, to: string, amount: string) {
        const acc = await connection.account(from)
        return await acc.functionCall({
            contractId: "ft." + zomlandContractId,
            methodName: "ft_transfer",
            args: {
                receiver_id: to,
                amount: near.utils.format.parseNearAmount(amount)
            },
            attachedDeposit: DEPOSITS.transfer.zlt,
            gas: GAS_PRICES.transfer.zlt
        })
    }

    async function publishMonsterOnMarket(publisher: string, ...price_list: { id: string, price: string }[]) {
        const acc = await connection.account(publisher)
        let payload = {
            token_price_list: {
            },
            account_id: publisher
        }
        price_list.forEach(e => {
            // @ts-ignore
            payload.token_price_list[e.id] = e.price
        })
        return await acc.functionCall({
            contractId: zomlandContractId,
            methodName: "publish_monsters_on_market",
            args: payload,
            attachedDeposit: DEPOSITS.publish,
            gas: GAS_PRICES.publish
        })
    }

    return {
        connect,
        lastBlock: async () => (await getBlocks(1, 0))[0],
        getBlocks: getBlocks,
        gasPrice: gasPrice,
        account: {
            add: addAccount,
            autorizedApps: autorizedApps,
            view: ZLviewAccount,
            balances: {
                near: {
                    yactoNear: getYactoNearBalance,
                },
            },
            send: {
                near: sendNear
            },
            zomland: {
                balances: {
                    zlt: {
                        get: getZLTBalance,
                        transfer: transferZLT
                    }
                },
                dropDups: ZLdeleteDuplicateAutorization,
                marketHistory: getMarketHistory,
                zombie: {
                    mint: mintZombieV1,
                    transfer: transferZombie,
                    get: getZombies,
                    getById: getZombiesById,
                    kill: killZombie,
                    market: {
                        get: (arg?: MarketSearch) => getMarket<ZombieNFT>("Zombie", arg),
                        sell: {},
                        remove_from_market: {},
                        buy: {}
                    }
                },
                monster: {
                    mint: mintCollection,
                    get: getMonsters,
                    getById: getMonstersById,
                    transfer: {},
                    kill: {},
                    market: {
                        get: (arg?: MarketSearch) => getMarket<MonsterNFT>("Monster", arg),
                        sell: publishMonsterOnMarket,
                        remove_from_market: () => { throw "Not impl" },
                        buy: {}
                    }
                },
                lands: getLands,
            },
        },
        constants: {
            GAS_PRICES,
            DEPOSITS
        }
    }
})()

// import { Account, db } from './../database.js'

// let account = new Account(db.accounts.documents[0])

// await api.connect()
// await api.account.add({addr:account.wallet, phrases:account.phrases})
// console.log(await api.account.zomland.lands(account.wallet))
// // console.log(await api.account.zomland.zombie.get(account.wallet))
// // console.log((await api.account.zomland.marketHistory()))
// // await api.account.zomland.monster.market.sell("address", { id: "1", price: "123123" }, { id: "123", price: "9812123" })
