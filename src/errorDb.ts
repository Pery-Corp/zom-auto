// import { number, array, assert, object, string } from 'superstruct'
// import { Database } from 'aloedb-node'
// import { Account, AccountSign } from './accounts.js'

// type ErrorType = "payment" | "mint" | "basic"

// interface IErrorEntry {
//     account: Account,
//     type: ErrorType,
//     desc: string
// }

// const ErrorSign = object({
//     account: AccountSign,
//     id: string(),
//     lastMint: number(),
//     zombyCount: number()
// })

// const AccountValidator = (document: any) => assert(document, AccountSign)
// let accounts_db = new Database<IAccount>({
//     path: "./accounts.json",
//     pretty: false,
//     autoload: true,
//     immutable: true,
//     onlyInMemory: false,
//     schemaValidator: AccountValidator
// })
