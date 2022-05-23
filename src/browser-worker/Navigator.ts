import {
    sleep,
    smrtClick,
    log
} from './../utils.js'

import { Config } from './../Config.js'

import puppeteer from 'puppeteer'
import { Account } from './../accounts.js'

export const Navigator = (() => {
    const url = {
        main: 'https://zomland.com',
        myZomy: 'https://zomland.com/zombies',
        myLends: "https://",
        myMonsters: "https://"
    }

    async function approveTx(page: puppeteer.Page) {
        try {
            try {
                await smrtClick((await page.$$("button.sc-bdvvtL.ifrRMa.blue"))[1]);
            } catch (e) {
                throw { type: "basic", msgs: [ "cannot click approve" ] }
            }

            await sleep(1000)
            try {
                let msgs = await page.$$eval('.alert-banner.warning > div', e=>e.map(el=>el.textContent))
                if (msgs.length) {
                    throw {
                        type: "payment",
                        msgs: msgs
                    }
                }
            } catch (e: any) {
                if (e.type) {
                    throw e
                } else {
                    throw { type: "basic", msgs: [ "unknown error" ] }
                }
            }

            await page.waitForNavigation({waitUntil: 'networkidle2'})
        } catch(e: any) {
            return {
                error: {
                    ...e
                },
                page: page
            }
        }

        return {
            error: {
                type: "ok"
            },
            page: page
        }
    }

    async function loginNearByPhrase(page: puppeteer.Page, account: Account): Promise<puppeteer.Page> {
        await page.goto(url.main, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('button.sc-gKXOVf')
        await smrtClick(await page.$('button.sc-gKXOVf'))
        await page.waitForNavigation({waitUntil: 'networkidle2'})

        await smrtClick((await page.$$('div > button'))[1])
        await smrtClick((await page.$$('button'))[0])

        await page.type('form > input', account.phrases.join(" "))
        await smrtClick(await page.$("button.sc-bdvvtL.ifrRMa.blue"))
        await page.waitForNavigation({waitUntil: 'networkidle2'})

        try {
            await page.waitForSelector("button")
            await smrtClick((await page.$$("button"))[2])
        } catch (e) {
            throw "Not enought balance"
        }

        await smrtClick((await page.$$("button"))[1])
        await page.waitForNavigation({waitUntil: 'networkidle2'})
        log("Logined")

        if (account.wallet == "") {
            log("Going to scrap wallet address")
            await page.goto("https://wallet.near.org/profile", { waitUntil: 'domcontentloaded' })
            await page.waitForSelector('div[data-test-id="ownerAccount.accountId"] > span')
            let addr = await page.$eval('div[data-test-id="ownerAccount.accountId"] > span', e => e.textContent)
            if (addr) {
                // const key = await page.evaluate((addr) => localStorage.getItem("nearlib:keystore:" + addr + ":default")!.split(":")[1] , addr);
                await account.setWallet(addr)
                log.echo("Added wallet:", JSON.stringify(account.wallet))
            } else {
                log("Cannot scrap wallet")
            }
        }

        return page;
    }

    async function mintZomby(page: puppeteer.Page):
        Promise<{
            error: {
                type: string,
                time?: { hours: number, minutes: number, seconds: number },
                msgs?: string[]
            },
            page: puppeteer.Page
        }>
    {
        try {
            try {
                await page.goto(url.myZomy, { waitUntil: 'domcontentloaded' });
                await page.waitForSelector(".mt-8 > button")
                await smrtClick(await page.$(".mt-8 > button"))
                await sleep(1000)
            } catch (e) {
                throw { type: "basic", msgs: [ "no zomby" ] }
            }

            try {
                await smrtClick((await page.$$(".pt-1 > button"))[1])
                await page.waitForNavigation({waitUntil: 'networkidle2'})
            } catch (e) {
                let ts = await page.$$eval('div > div > p > small', e => e.map(el => el.textContent));
                let time
                try {
                    // @ts-ignore
                    time = ts[1].split(" ")
                } catch(e) {
                    throw { type: "basic", msgs: [ "page error" ] }
                }
                throw {
                    type: "time",
                    time: {
                        hours: time[0],
                        minutes: time[2],
                        seconds: time[4],
                    }
                }
            }

            let ret = await approveTx(page)
            page = ret.page
            if (ret.error.type != "ok") {
                throw ret.error
            }
        } catch (e: any) {
            return {
                error: {
                    ...e
                },
                page: page
            }
        }

        return {
            error: {
                type: "ok",
            },
            page: page
        }
    }

    async function mintLand() {
        // buttons ".mt-4>button", from 0 to 3, by land size grows
    }

    enum ZombyMenuItem {
        transfer = 0,
        sell = 1,
        burn = 2,
    }
    async function selectZombyMenu(page: puppeteer.Page, menuItem: ZombyMenuItem) {
        try {
            await page.goto(url.myZomy, { waitUntil: "domcontentloaded" })
            await sleep(1000)

            try {
                await page.waitForSelector("div.w-full > div > div > div > div > div > div > div > button", { timeout: 5000 })
                await smrtClick(await page.$("div.w-full > div > div > div > div > div > div > div > button"))
            } catch (e) {
                throw { type: "basic", msgs: [ "no zomby" ] }
            }

            await sleep(1500)

            let menuItems = await page.$$("div.w-full > div > div > div > div > div > div > button")
            // 0 - transfer
            // 1 - sell
            // 2 - kill/burn
            try {
                await smrtClick(menuItems[menuItem])
            } catch(e) {
                throw { type: "basic", msgs: ["zomby menu not avalible"] }
            }
            await sleep(1000)
        } catch (e: any) {
            return {
                error: {
                    ...e
                },
                page: page
            }
        }

        return {
            error: {
                type: "ok"
            },
            page: page
        }
    }

    async function transferZombies(page: puppeteer.Page):
        Promise<{
            error: {
                type: string,
                time?: { hours: number, minutes: number, seconds: number },
                msgs?: string[]
            },
            page: puppeteer.Page
        }>
    {
        try {
            let ret = await selectZombyMenu(page, ZombyMenuItem.transfer)
            page = ret.page
            if (ret.error.type != "ok") {
                throw ret.error
            }

            await sleep(1500)

            try {
                await page.type('p.mb-3 > input', Config().mother)
                await smrtClick(await page.$('.ml-10 > button'))
            } catch (e) {
                throw { type: "basic", msgs: [ "cannot prepare transaction" ] }
            }

            await page.waitForNavigation({waitUntil: 'networkidle2'})

            ret = await approveTx(page)
            page = ret.page

            if (ret.error.type === "ok") {
                sleep(1000)
                return await transferZombies(page)
            } else {
                return ret
            }

        } catch (e: any) {
            return {
                error: {
                    ...e
                },
                page: page
            }
        }

        return {
            error: { type: "ok" }, page: page
        }
    }

    async function transferZLT(page: puppeteer.Page) {
        await page.goto(url.main)
    }

    async function burnZombies(page: puppeteer.Page):
        Promise<{
            error: {
                type: string,
                time?: { hours: number, minutes: number, seconds: number },
                msgs?: string[]
            },
            page: puppeteer.Page
        }>
    {
        try {
            let ret = await selectZombyMenu(page, ZombyMenuItem.burn)
            page = ret.page
            if (ret.error.type != "ok") {
                throw ret.error
            }
            await sleep(1000)

            // proceed
            await smrtClick((await page.$$('div.mt-2 > div.inline-block > button'))[1])
            await page.waitForNavigation({waitUntil: 'networkidle2'})

            ret = await approveTx(page)
            page = ret.page

            if (ret.error.type === "ok") {
                return await burnZombies(page)
            } else {
                return ret
            }
        } catch (e: any) {
            return {
                error: {
                    ...e
                },
                page: page
            }
        }

        return {
            error: { type: "ok" }, page: page
        }
    }

    return {
        login: {
            phrase: loginNearByPhrase,
            ladger: () => { throw "Not implemented" }
        },
        transfer: {
            zlt: transferZLT,
            zombies: transferZombies
        },
        burn: {
            zombies: burnZombies
        },
        mint: {
            land: mintLand,
            zomby: mintZomby,
        },
    }})()

