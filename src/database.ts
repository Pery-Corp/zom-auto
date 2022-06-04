import * as fs from 'fs'
import * as crypt from 'crypto'
import { Describe, Infer, union, number, array, assert, object, string } from 'superstruct'
import { Database } from 'aloedb-node'
import { log } from './utils.js'
import { ZombieNFT, ZombieNFTSign, MonsterNFT, MonsterNFTSign, ZL_NFT_Type, ZL_NFT_TypeSign } from './near-worker/api.js'

const MarketHistoryEntrySign: Describe<IMarketHistoryEntry> = object({
    nft: union([ ZombieNFTSign, MonsterNFTSign ]),
    nft_type: ZL_NFT_TypeSign,
    date: number(),
    price: number(),
    price_yacto: number()
})

// export type IMarketHistoryEntry = Infer<typeof MarketHistoryEntrySign>
export interface IMarketHistoryEntry {
    nft: any,
    nft_type: ZL_NFT_Type,
    date: number,
    price: number,
    price_yacto: number 
}

interface IAccount {
    id?: number,
    phrases: string[],
    wallet?: string,
    nextMint?: number,
}

const AccountSign = object({
    id: number(),
    phrases: array(string()),
    wallet: string(),
    nextMint: number(),
})

const AccountValidator = (document: any) => assert(document, AccountSign)
const MarketHistoryEntryValidator = (document: any) => assert(document, MarketHistoryEntrySign)
let accounts_db = new Database<IAccount>({
    path: "./accounts.json",
    pretty: true,
    autoload: true,
    immutable: true,
    onlyInMemory: false,
    schemaValidator: AccountValidator
})

let market_db = new Database<IMarketHistoryEntry>({
    path: "./market.json",
    pretty: true,
    autoload: true,
    immutable: true,
    onlyInMemory: false,
    schemaValidator: MarketHistoryEntryValidator
})

export let db = { accounts: accounts_db, market: market_db }

export class MarketHistoryEntry implements IMarketHistoryEntry {
    nft: ZombieNFT | MonsterNFT;
    nft_type: ZL_NFT_Type;
    date: number;
    price: number;
    price_yacto: number;

    constructor(e: IMarketHistoryEntry) {
        this.nft = e.nft
        this.nft_type = e.nft_type
        this.price = e.price
        this.price_yacto = e.price_yacto
        this.date = e.date
    }

    async sync() {
        if (await market_db.findOne({ nft: { token_id: this.nft.token_id } })) {
            return await market_db.updateOne({ nft: { token_id: this.nft.token_id } }, this);
        } else {
            return await market_db.insertOne(this);
        }
    }
}

export class Account implements IAccount {
    readonly phrases: string[];
    readonly id: number;
    wallet: string;
    nextMint: number;

    constructor(acc: IAccount) {
        if (acc.id) {
            this.id = acc.id
        } else {
            if (accounts_db.documents.length == 0) {
                this.id = 0
            } else {
                this.id = Math.max(...accounts_db.documents.map(a => <number>a.id))+1
            }
        }
        if (this.id == null) {
            this.id = 0
        }
        this.phrases = acc.phrases
        if (this.phrases.length != 12) {
            throw new Error("Creating account with " + this.phrases.length + " phrases")
        }
        this.nextMint = acc.nextMint ?? 0
        this.wallet = acc.wallet ?? ""
    }

    async sync() {
        if (await accounts_db.findOne({ id: this.id })) {
            return await accounts_db.updateOne({ id: this.id }, this);
        } else {
            return await accounts_db.insertOne(this);
        }
    }

    async updateNextMint(date: number) {
        this.nextMint= date
        return await this.sync()
    }

    async setWallet(wal: string) {
        this.wallet = wal
        return await this.sync()
    }

    static async findOne(query: Partial<IAccount>): Promise<Account | null> {
        const object = await accounts_db.findOne(query);
        if (object) return new Account(object);
        return null;
    }

    static async findMany(query: Partial<IAccount>): Promise<Account[]> {
        const objects = await accounts_db.findMany(query);

        return objects.map((obj) => {
            return new Account(obj);
        });
    }
}

export class Accounts {
    constructor() {
    }

    [Symbol.iterator]() {
        let cur = 0;
        return {
            next: () => {
                return {
                    done: cur >= accounts_db.documents.length-1,
                    value: accounts_db.documents[cur++]
                }
            }
        }
    }

    get count() {
        return accounts_db.documents.length;
    }

    getRange(from: number, to: number): Array<Account> {
        let ret = new Array<Account>()
        for (; from < to; from++) {
            ret.push(new Account(accounts_db.documents[from]))
        }
        return ret;
    }

    async getAccountById(id: number) {
        return await Account.findOne({ id: id })
    }

    getAccountByPos(pos: number) {
        return new Account(accounts_db.documents[pos])
    }

    private readRawPhrases(file: fs.PathLike) {
        let blob = fs.readFileSync(file).toString()
        let ph = blob.replace(/(\[rn]|[\r\n]+)+/g, ' ').split(" ")
        let wordc = 0;
        let phrases: Array<Array<string>> = new Array();
        phrases[0] = new Array<string>();
        let pos = 0
        ph.forEach(word => {
            if (wordc == 12) {
                pos++
                wordc = 0
                phrases[pos] = new Array<string>()
            }
            phrases[pos].push(word)
            wordc++
        })

        return phrases
    }

    private readRawWallets(file: fs.PathLike) {
        let blob = fs.readFileSync(file).toString()
        return blob.replace(/(\[rn]|[\r\n]+)+/g, ' ').split(" ")
    }

    async importPhrases(file: fs.PathLike, fileWallets?: fs.PathLike) {
        let phs = this.readRawPhrases(file)

        let wallets
        if (fileWallets) {
            wallets = this.readRawWallets(fileWallets)
        }

        // if (wallets && wallets.length != phs.length) {
        //     throw "Incorect import"
        // }

        let imported = 0;
        let existed = 0;
        for await (let [ i, ph ] of phs.entries()) {
            if (await accounts_db.findOne(a => a.phrases.join('') === ph.join(''))) {
                existed++;
            } else {
                let account = new Account({ phrases: ph, wallet: wallets ? wallets[i] : "" })
                await account.sync()
                imported++;
            }
        }

        await accounts_db.save();

        log.echo("Imported", imported, ". Excluded", existed, "accounts")
    }
}

export let accounts = new Accounts()
