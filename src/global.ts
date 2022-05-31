import { MultiProgressBars  } from 'multi-progress-bars';
import { Account } from "./accounts.js"

export let mpb: MultiProgressBars = new MultiProgressBars({
    initMessage: ' $ Zomland ',
    anchor: 'top',
    persist: true,
    border: true,
});

export function accountBarID(account: Account) {
    return "id:"+account.wallet
}
