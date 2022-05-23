import { ElementHandle } from 'puppeteer'
import { appendFileSync } from 'fs'
import chalk from 'chalk'

export function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

export async function smrtClick(
    element: ElementHandle|null,
    params: {retries: number, idleTime: number} = {
        retries: 5,
        idleTime: 1000
    })
{
    const hoverAndClick = async () => {
        return await element!.hover()
            .then(() => {
                return element!.click();
            })
            .catch(err => {
                if (params.retries <= 0) {
                    throw err;
                }
                params.retries -= 1;
                sleep(params.idleTime).then(hoverAndClick);
            });
    }

    return await hoverAndClick();
}

function logTime() {
    return '[' + new Date().toLocaleTimeString() + ']'
}

const logFileName = "log_" + new Date().toLocaleDateString().replaceAll('/', '.') + "_" + new Date().toLocaleTimeString("ru")

type ExtendedLog = {
    (...arg: any[]): void,
    echo:  (...arg: any[]) => void
    error: (...arg: any[]) => void
}
export let log = <ExtendedLog>function(...arg: any[]): void {
    appendFileSync(logFileName, logTime() + ' - ' + arg.join(" ") + "\n")
}

log.error = function(...arg: any[]) {
    log("ERROR:", ...arg)
    
    // progress remove \r
    console.error(logTime(), '-', chalk.red(...arg))
}
log.echo = function(...arg: any[]) {
    log(...arg)
    console.log(logTime(), '-', ...arg)
}

export function addTime(h: number, m: number, s: number, date = new Date()) {
    let copy = new Date(date)
    return new Date(copy.setTime(copy.getTime() +
        h * 3600000 +
        m * 6000 +
        s * 1000))
}
