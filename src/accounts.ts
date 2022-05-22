import * as fs from 'fs'
import * as crypt from 'crypto'
import { number, array, assert, object, string } from 'superstruct'
import { Database } from 'aloedb-node'
import { log } from './utils.js'

interface IAccount {
    phrases: string[],
    wallet?: {
        addr: string,
        key: string,
    },
    id?: string,
    lastMint?: number,
    zombyCount?: number,
}

const AccountSign = object({
    phrases: array(string()),
    wallet: object({
        addr: string(),
        key: string(),
    }),
    id: string(),
    lastMint: number(),
    zombyCount: number()
})

const AccountValidator = (document: any) => assert(document, AccountSign)
let accounts_db = new Database<IAccount>({
    path: "./accounts.json",
    pretty: true,
    autoload: true,
    immutable: true,
    onlyInMemory: false,
    schemaValidator: AccountValidator
})

export class Account implements IAccount {
    readonly phrases: string[];
    readonly id: string;
    wallet: {
        addr: string,
        key: string
    };
    lastMint: number;
    zombyCount: number;

    constructor(acc: IAccount) {
        this.phrases = acc.phrases
        if (this.phrases.length != 12) {
            throw new Error("Creating account with " + this.phrases.length + " phrases")
        }
        this.id = acc.id ?? crypt.createHash('sha256').update(this.phrases.join(" ")).digest('hex')
        this.lastMint = acc.lastMint ?? 0
        this.zombyCount = acc.zombyCount ?? 0
        this.wallet = ( acc.wallet ?? {addr: "", key: ""} )
    }

    async sync() {
        if (await accounts_db.findOne({ id: this.id })) {
            return await accounts_db.updateOne({ id: this.id }, this);
        } else {
            return await accounts_db.insertOne(this);
        }
    }

    async updateLastMint(date: number) {
        this.lastMint = date
        return await this.sync()
    }

    async updateZombyCount(num: number) {
        this.zombyCount = num
        return await this.sync()
    }

    async setWallet(wal: {addr: string, key: string}) {
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

    async getAccountById(id: string) {
        return await Account.findOne({ id: id })
    }

    getAccountByPos(pos: number) {
        return new Account(accounts_db.documents[pos])
    }

    private readRawPhrases(file: fs.PathLike) {
        let blob = fs.readFileSync(file).toString()
        blob.replace(/[^\w ]/g, '')
        let ph = blob.split(" ")
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

    async importPhrases(file: fs.PathLike) {
        let phs = this.readRawPhrases(file)

        let imported = 0;
        let existed = 0;
        for await (let ph of phs) {
            if (await accounts_db.findOne({
                            id: crypt.createHash('sha256').update(ph.join(" ")).digest('hex') })) {
                existed++;
            } else {
                let account = new Account({ phrases: ph })
                await account.sync()
                imported++;
            }
        }

        await accounts_db.save();

        log("Imported", imported, ". Excluded", existed, "accounts")
    }
}

export let accounts = new Accounts()
