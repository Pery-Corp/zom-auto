import near from 'near-api-js'
import {Base64} from './../base64.js'
import { log } from './../utils.js'
const { KeyPair, keyStores, utils } = near;
// @ts-ignore
import * as seed from 'near-seed-phrase'

// const createNewTransaction = async ({
//       receiverId,
//       actions,
//       nonceOffset = 1,
    
// }) => {
//       const nearInternal = window.walletConnection._near;
//     const localKey = await nearInternal.connection.signer.getPublicKey(
//             window.accountId,
//             nearInternal.config.networkId
          
//     );

//       const accessKey = await window.walletConnection
//         .account()
//         .accessKeyForTransaction(receiverId, actions, localKey);
//     if (!accessKey) {
//         throw new Error(
//                   `Cannot find matching key for transaction sent to ${receiverId}`
                
//         );
          
//     }

//     const block = await nearInternal.connection.provider.block({
//             finality: "final",
          
//     });
//       const blockHash = base_decode(block.header.hash);
//       const publicKey = PublicKey.from(accessKey.public_key);
//       const nonce = accessKey.access_key.nonce + nonceOffset;

//     return createTransaction(
//             window.walletConnection.account().accountId,
//             publicKey,
//             receiverId,
//             nonce,
//             actions,
//             blockHash
          
//     );
    
// };

// export const signAndSendMultipleTransactions = async (
//       transactions,
//       callbackUrl
    
// ) => {
//     const nearTransactions = await Promise.all(
//             transactions.map((tx, i) =>
//                 createNewTransaction({
//                             receiverId: tx.receiverId,
//                             nonceOffset: i + 1,
//                             actions: tx.functionCalls.map((fc) =>
//                                       functionCall(fc.methodName, fc.args, fc.gas, fc.attachedDeposit)
//                                     ),
                          
//                 })
//                 )
          
//     );

//     return window.walletConnection.requestSignTransactions({
//             transactions: nearTransactions,
//             callbackUrl,
          
//     });
    
// };

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
    const zomlandContractId = "zomland.near"
    const MAX_GAS = "300000000000000"

    const zomlandTransactionFee = "0.000000000000000000000001" // 1 yactoNear
    const zomlandMintFee = "0.001"

    function parseJsonRPC(input: any[]) {
        let ret = ""
        for (let x of input) {
            ret += String.fromCharCode(x)
        }
        return JSON.parse(ret)
    }

    // contract = await new near.Contract(
    //     acc,
    //     zomlandContractId,
    //     {
    //         viewMethods: [
    //             "user_lands",
    //             "user_lands_info",
    //             "user_zombies",
    //             "get_land_paras_series",
    //             "total_lands_count",
    //             "get_collections",
    //             "get_one_collection",
    //             "user_collection_counts",
    //             "get_lands_from_market",
    //             "get_zombies_from_market",
    //             "get_monsters_from_market",
    //             "user_monsters",
    //             "zombie_kill_tokens",
    //             "is_stake_monster",
    //             "leaderboard",
    //         ],
    //         changeMethods: [
    //             "mint_land_nft",
    //             "mint_free_zombie_nft",
    //             "import_paras_land",
    //             "publish_lands_on_market",
    //             "publish_zombies_on_market",
    //             "publish_monsters_on_market",
    //             "remove_lands_from_market",
    //             "remove_zombies_from_market",
    //             "remove_monsters_from_market",
    //             "transfer_nft_on_market",
    //             "transfer_land",
    //             "transfer_zombie",
    //             "transfer_monster",
    //             "mint_collection",
    //             "kill_zombie",
    //             "kill_monster",
    //             "stake_monster",
    //             "unstake_monster",
    //         ],
    //     }
    // );

    // window.ftContract = await new Contract(
    //     window.walletConnection.account(),
    //     `ft.${nearConfig.contractName}`,
    //     {
    //         viewMethods: [
    //             "ft_balance_of",
    //             "get_user_earned",
    //             "get_user_stake",
    //             "get_stake_total_supply",
    //             "get_apr",
    //             "get_stake_monster_pct",
    //             "storage_balance_of",
    //             "get_total_supply",

    //         ],
    //         changeMethods: [
    //             "ft_mint",
    //             "ft_transfer",
    //             "ft_transfer_call",
    //             "withdraw_stake",
    //             "withdraw_reward",

    //         ],

    //     }

    // );

    // window.parasContract = await new Contract(
    //     window.walletConnection.account(),
    //     `${process.env.PARAS_TOKEN_CONTRACT}`,
    //     {
    //         viewMethods: ["nft_tokens_for_owner", "nft_get_series_single"],
    //         changeMethods: ["nft_transfer", "nft_approve"],

    //     }

    // );

    // window.parasMarketContract = await new Contract(
    //     window.walletConnection.account(),
    //     `${process.env.PARAS_MARKET_CONTRACT}`,
    //     {
    //         viewMethods: ["get_market_data"],
    //         changeMethods: ["storage_minimum_balance", "delete_market_data", "buy"],

    //     }

    // );

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
    }

    async function sendNear(from: {addr: string, key: string}, to: string, amountn: string) {
        const amount = utils.format.parseNearAmount(amountn);

        const senderAccount = await connection.account(from.addr);

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
                zombies: zombies
            }
        } else {
            return null
        }
    }

    async function mintZombie(addr: string, land: string) {
        const acc = await connection.account(addr)
        return await acc.functionCall({
            contractId: zomlandContractId,
            methodName: "mint_free_zombie_nft",
            args: { land_id: land },
            attachedDeposit: utils.format.parseNearAmount(zomlandMintFee),
            gas: MAX_GAS
        })
    }

    async function killZombie(addr: string, zombie: string) {
        const acc = await connection.account(addr)
        return await acc.functionCall({
            contractId: zomlandContractId,
            methodName: "kill_zombie",
            args: {
                zombie_id: zombie
            },
            attachedDeposit: utils.format.parseNearAmount(zomlandTransactionFee),
            gas: MAX_GAS
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
            attachedDeposit: utils.format.parseNearAmount(zomlandTransactionFee),
            gas: MAX_GAS
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
            gas: MAX_GAS
        })
    }

    return {
        connect,
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
            mint: mintZombie,
            transfer: {
                zombie: transferZombie,
                zlt: transferZLT
            }
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
