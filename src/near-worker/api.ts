import near from 'near-api-js'
import {Base64} from './../base64.js'
import { log } from './../utils.js'
const { KeyPair, keyStores, utils } = near;
// @ts-ignore
import * as seed from 'near-seed-phrase'
import sha256 from 'js-sha256'
import https from 'https'

export interface ZombieNFT {
    token_id: string;
    card_rarity: string;
    sale_price: any;
    kill_tokens: string;
    media: string;
    collection_id: number;
    collection_index: number;
    mint_date: number;
    health: number;
    attack: number;
    brain: number;
    speed: number;
    nft_type: string | 'Zombie';
    owner_id: string;
    modifier_items: any[];
    next_battle:number 
}

export interface LandNFT {
    token_id: string,
    land_type: 'Micro' | 'Small' | 'Medium' | 'Large',
    last_zombie_claim: number,
    discover_events: number,
    count_minted_zombies: number
}

export let api = ((networkId = 'mainnet') => {
    let keyStore = new keyStores.InMemoryKeyStore()
    let connection: near.Near
    let provider: near.providers.JsonRpcProvider
    // let walletConnection: near.WalletConnection
    const zomlandContractId = "zomland.near"
    const MAX_GAS_CONST = "300000000000000"
    const MAX_GAS_REAL = async () => ( await getBlocks(1, 0) )[0].gas_limit.toString()

    const GAS_PRICES = {
        transfer: {
            zomby: String( 80000000000000 ),
            zlt: String( 20000000000000 ),
        },
        mint: String( 280000000000000 ),
        kill: String( 280000000000000 )
    }

    // not fee, its deposits xD
    const DEPOSITS ={
        mint: near.utils.format.parseNearAmount("0.01"),
        kill: near.utils.format.parseNearAmount("0.000000000000000000000001"),
        transfer: {
            zomby: near.utils.format.parseNearAmount("0.000000000000000000000001"),
            zlt: near.utils.format.parseNearAmount("0.009")
        },
    }

    // let contracts: Map<string, near.Contract>

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
        // walletConnection = new near.WalletConnection(connection, null)
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
        // const acc = await connection.account(addr)
        let res = await provider.query({
            account_id: addr,
            finality: "optimistic",
            request_type: "view_account"
        })
        // let conf = await provider.experimental_protocolConfig()
        // conf.
        return res
        // // @ts-ignore
        // if (res && res.result) {
        //     // @ts-ignore
        //     let result = parseJsonRPC(res.result)
        //     return {
        //         block_hash: res.block_hash,
        //         block_height: res.block_height,
        //         // @ts-ignore
        //         logs: res.logs,
        //         result: result
        //     }
        // } else {
        //     return null
        // }
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

    async function getYactoNearBalance(addr: string) {
        const acc = await connection.account(addr)
        return await acc.getAccountBalance()
    }

    async function getZLTBalance(addr: string) {
        let res = await provider.query({
            account_id: "ft." + zomlandContractId,
            args_base64: Base64.encode(JSON.stringify({
                account_id: addr
            })),
            finality: "optimistic",
            method_name: "ft_balance_of",
            request_type: "call_function"
        })
        // @ts-ignore
        if (res && res.result) {
            // @ts-ignore
            let zlt = parseJsonRPC(res.result)
            return {
                block_hash: res.block_hash,
                block_height: res.block_height,
                // @ts-ignore
                logs: res.logs,
                zlt: zlt
            }
        } else {
            return null
        }
    }

    async function getLands(addr: string): Promise<{block_hash: string, block_height: number, logs: any[], lands: LandNFT[]} | null> {
        let res = await provider.query({
            account_id: zomlandContractId,
            args_base64: Base64.encode(JSON.stringify({
                id_list:[],
                user_id: addr
            })),
            finality: "optimistic",
            method_name: "user_lands_info",
            request_type: "call_function"
        })
        // @ts-ignore
        if (res && res.result) {
            // @ts-ignore
            let lands = parseJsonRPC(res.result)
            return {
                block_hash: res.block_hash,
                block_height: res.block_height,
                // @ts-ignore
                logs: res.logs,
                lands: lands
            }
        } else {
            return null
        }
    }

    async function getZombies(addr: string): Promise<{block_hash: string, block_height: number, logs: any[], zombies: ZombieNFT[]} | null> {
        let res = await provider.query({
            account_id: zomlandContractId,
            args_base64: Base64.encode(JSON.stringify({
                account_id: addr,
                page_num: "1",
                page_limit: "20"
            })),
            finality: "optimistic",
            method_name: "user_zombies",
            request_type: "call_function"
        })
        // @ts-ignore
        if (res && res.result) {
            // @ts-ignore
            let zombies = parseJsonRPC(res.result)
            return {
                block_hash: res.block_hash,
                block_height: res.block_height,
                // @ts-ignore
                logs: res.logs,
                zombies: zombies[1]
            }
        } else {
            return null
        }
    }

    async function mintZombieV1(sender: string, land: string) {
        const acc = await connection.account(sender)
        return await acc.functionCall({
            contractId: zomlandContractId,
            methodName: "mint_free_zombie_nft",
            args: { land_id: land },
            attachedDeposit: utils.format.parseNearAmount(zomlandMintFee),
            gas: GAS_PRICES.mint
        })
    }

    async function mintZombieV2(sender: string, phrases: string[], land: string) {
        // const acc = await connection.account(addr)

        let keys = seed.parseSeedPhrase(phrases.join(" "))
        const keyPair = near.utils.key_pair.KeyPairEd25519.fromString(keys.secretKey);
        const publicKey = keyPair.getPublicKey();
        const accessKey: any = await provider.query(`access_key/${sender}/${publicKey.toString()}`, '');
        const nonce = ++accessKey.nonce;

        if (accessKey.permission !== 'FullAccess') {
            return console.log(
                `Account [ ${sender}  ] does not have permission to send tokens using key: [ ${publicKey}  ]`
            );
        }

        let actions = [
            near.transactions.functionCall(
                "mint_free_zombie_nft",
                { land_id: land },
                (await MAX_GAS_REAL()),
                utils.format.parseNearAmount(zomlandMintFee)
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
        );

        return result

        // console.log('Transaction Results: ', result);
        // console.log('Transaction Results: ', result?.result);

        // return await acc.functionCall({
        // })
        // {
        //     contractId: zomlandContractId,
        //     methodName: "mint_free_zombie_nft",
        //     args: { land_id: land },
        //     attachedDeposit: utils.format.parseNearAmount(zomlandMintFee),
        //     gas: MAX_GAS
        // })
    }

    async function killZombie(addr: string, zombies: string[]) {
        const acc = await connection.account(addr)
        return await acc.functionCall({
            contractId: zomlandContractId,
            methodName: "kill_zombie",
            args: {
                zombie_list: zombies
            },
            attachedDeposit: utils.format.parseNearAmount(zomlandTransactionFee),
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
            attachedDeposit: utils.format.parseNearAmount(zomlandTransferFee),
            gas: GAS_PRICES.transfer.zomby
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
            attachedDeposit: utils.format.parseNearAmount(zomlandTransactionFee),
            gas: GAS_PRICES.transfer.zlt
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
                zomland: {
                    zlt: getZLTBalance
                }
            },
        },
        send: {
            near: sendNear
        },
        zomland: {
            dropDups: ZLdeleteDuplicateAutorization,
            zombies: getZombies,
            lands: getLands,
            kill: killZombie,
            mint: mintZombieV1,
            mintV2: mintZombieV2,
            transfer: {
                zombie: transferZombie,
                zlt: transferZLT
            }
        },
        CONSTANTS: {
            GAS_PRICES,
            DEPOSITS
        }
    }
})()

// import { accounts } from './../accounts.js'

// await api.connect()
// let acc = await accounts.getAccountById("2252896c236b8dc96730a956255bead1144ca92250dbb1360bd7778015d38a78")
// await api.account.add({ addr: acc!.wallet, phrases: acc!.phrases })
// let landr = await api.zomland.lands(acc!.wallet)
// console.log(landr)
// console.log(await api.zomland.mint(acc!.wallet, landr!.lands[0].token_id))
// // console.log(await api.account.view(acc.wallet))
// // await api.zomland.dropDups("110df5cc208086fcdf85e06f3b74f8bec48acb4717fa5bd1f18904ce859a1150")
// // console.log(await api.account.autorizedApps("110df5cc208086fcdf85e06f3b74f8bec48acb4717fa5bd1f18904ce859a1150"))

// await api.connect()
// // let block = await api.lastBlock()
// let price = await api.gasPrice("2UWduj1oT2hdCojZx4PZ8QAPQLRY7iEUXWSNesxFnArD")
// console.log(price)
