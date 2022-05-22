import nearAPI from 'near-api-js'
import { log } from './utils.js'
const { connect, KeyPair, keyStores, utils } = nearAPI;

export async function sendNear(from: {addr: string, key: string}, to: string, amountn: string) {
    const networkId = 'mainnet';
    const amount = utils.format.parseNearAmount(amountn);

    const keyStore = new keyStores.InMemoryKeyStore();
    const keyPair = KeyPair.fromString(from.key);
    await keyStore.setKey(networkId, from.addr, keyPair);

    const config = {
        networkId,
        keyStore,
        nodeUrl:     `https://rpc.${networkId}.near.org`,
        walletUrl:   `https://wallet.${networkId}.near.org`,
        helperUrl:   `https://helper.${networkId}.near.org`,
        explorerUrl: `https://explorer.${networkId}.near.org`
    };

    // @ts-ignore
    const near = await connect(config);
    const senderAccount = await near.account(from.addr);

    try {
        const result = await senderAccount.sendMoney(to, amount);
        log("Transfer complete:", result)
// zone shift behind run illness trouble they tide tumble wet ghost together
    } catch(error) {
        log("Transfer error:", error);
    }
}
