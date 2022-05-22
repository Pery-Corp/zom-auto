import near from 'near-api-js'
// import chalk from 'chalk'
import {Base64} from './../base64.js'
import { log } from './../utils.js'
const { KeyPair, keyStores, utils } = near;

export let api = ((networkId = 'mainnet') => {
    let keyStore = new keyStores.InMemoryKeyStore()
    let connection: near.Near
    let provider: near.providers.JsonRpcProvider
    const zomlandContractId = "zomland.near"
    const MAX_GAS = "300000000000000"

    const killPrise = "0.000000000000000000000001"

    // let contract: near.Contract

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

    async function addAccount(account: {addr: string, key: string}) {
        const keyPair = KeyPair.fromString(account.key);
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

    async function accountInfo(addr: string) {
        const acc = await connection.account(addr)
        return await acc.getAccountDetails()
    }

    async function accountBalance(addr: string) {
        const acc = await connection.account(addr)
        return await acc.getAccountBalance()
    }

    async function getZombies(addr: string): Promise<{block_hash: string, block_height: number, logs: any[], result: any[]}> {
        // const acc = await connection.account(addr)

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
        // contract.user_zombies({
        // })
        return await provider.query({
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
    }

    async function killZombie(addr: string, zombie: string) {
        const acc = await connection.account(addr)
        return await acc.functionCall({
            contractId: zomlandContractId,
            methodName: "kill_zombie",
            args: {
                zombie_id: zombie
            },
            attachedDeposit: utils.format.parseNearAmount(killPrise),
            gas: MAX_GAS
        })
    }

    return {
        connect,
        account: {
            add: addAccount,
            info: accountInfo,
            balances: accountBalance,
        },
        send: {
            near: sendNear
        },
        zomland: {
            zombies: getZombies,
            kill: killZombie
        }
    }
})()

// api.send.near({
//     addr: "110df5cc208086fcdf85e06f3b74f8bec48acb4717fa5bd1f18904ce859a1150",
//     key: "5GcSC1xet3JVmtx43AZiyLkqZqmyKkoAMKygJvanyN7YZ4SEmzK4mFFNbRrwDU9TBVvMPgeQw6EJhLQZ4vFBRBWN"
// }, "38daef8ce513b2208ab0fa42f71f471b829b0ded70a28081cc5b4ff9b97cedce", "0.01")

await api.connect()
await api.account.add({
    addr: "110df5cc208086fcdf85e06f3b74f8bec48acb4717fa5bd1f18904ce859a1150",
    key: "5GcSC1xet3JVmtx43AZiyLkqZqmyKkoAMKygJvanyN7YZ4SEmzK4mFFNbRrwDU9TBVvMPgeQw6EJhLQZ4vFBRBWN"
})

// console.log(await api.zomland.account.zombies("110df5cc208086fcdf85e06f3b74f8bec48acb4717fa5bd1f18904ce859a1150"))
// console.log(api.zomland.kill("110df5cc208086fcdf85e06f3b74f8bec48acb4717fa5bd1f18904ce859a1150", "z:2143-11"))

let res = await api.zomland.zombies("110df5cc208086fcdf85e06f3b74f8bec48acb4717fa5bd1f18904ce859a1150")
console.log(Base64.decode(res.result.join(" ")))
