import { ElementHandle } from 'puppeteer'
import { appendFileSync } from 'fs'
import chalk from 'chalk'
import * as fs from 'fs'

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

if (!fs.existsSync("./.log/")) {
    fs.mkdirSync("./.log")
}
const logFileName = "./.log/log_" + new Date().toLocaleDateString().replaceAll('/', '') + "_" + new Date().toLocaleTimeString("ru").replaceAll(":", '')

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

export function msToHMS(duration: number): string {
    // @ts-ignore
    var milliseconds = parseInt((duration % 1000) / 100),
    // @ts-ignore
        seconds = parseInt((duration / 1000) % 60),
    // @ts-ignore
        minutes = parseInt((duration / (1000 * 60)) % 60),
    // @ts-ignore
        hours = parseInt((duration / (1000 * 60 * 60)) % 24);

    // @ts-ignore
    hours = (hours < 10) ? "0" + hours : hours;
    // @ts-ignore
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    // @ts-ignore
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + "h " + minutes + "m " + seconds + "s " + milliseconds + "ms";
    // let seconds = ms / 1000;
    // // @ts-ignore
    // const hours = parseInt( seconds / 3600  ); // 3,600 seconds in 1 hour
    // seconds = seconds % 3600; // seconds remaining after extracting hours
    // // @ts-ignore
    // const minutes = parseInt( seconds / 60  ); // 60 seconds in 1 minute
    // seconds = seconds % 60;
    // return "%Hh %Mm %S %s"
    //     .replace("%H", hours.toString())
    //     .replace("%M", minutes.toString())
    //     .replace("%S", seconds.toString())
    //     .replace("%s", ( (ms%1000) ).toString())
}

export let time = (() => {
    function toDate(date: any) {
        if (date === void 0) {
            return new Date(0);
        }
        if (isDate(date)) {
            return date;
        } else {
            return new Date(parseFloat(date.toString()));
        }
    }

    function isDate(date: any) {
        return (date instanceof Date);
    }

    function format(date: any, format: string) {
        var d = toDate(date);
        return format
            .replace(/Y/gm, d.getFullYear().toString())
            .replace(/m/gm, ('0' + (d.getMonth() + 1)).substr(-2))
            .replace(/d/gm, ('0' + (d.getDate() + 1)).substr(-2))
            .replace(/H/gm, ('0' + (d.getHours() + 0)).substr(-2))
            .replace(/i/gm, ('0' + (d.getMinutes() + 0)).substr(-2))
            .replace(/s/gm, ('0' + (d.getSeconds() + 0)).substr(-2))
            .replace(/v/gm, ('0000' + (d.getMilliseconds() % 1000)).substr(-3));
    }

    return {
        toDate,
        isDate,
        format
    }
})()
