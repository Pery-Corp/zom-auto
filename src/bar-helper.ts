import { mpb, accountBarID } from './global.js'
import chalk from 'chalk';
import { Account } from './accounts.js'

export class WorkerBarHelper {
    private curTask = 0
    constructor(
        private account: Account,
        private tasks: Array<string>
    ) {

    }

    create() {
        mpb.addTask(accountBarID(this.account), {
            type: "percentage",
            message: this.tasks[this.curTask],
            barTransformFn: (m) => chalk.blueBright(m)
        })
    }

    next() {
        this.curTask++
        mpb.updateTask(accountBarID(this.account), {
            message: this.tasks[this.curTask],
            percentage: this.curTask/this.tasks.length
        })
    }

    done(success: boolean) {
        mpb.done(accountBarID(this.account), {
            barTransformFn: (m) => chalk[(success ? "green" : "red")](m),
            message: (success ? "Success" : "Failed")
        })
    }
}

export function createMainProgress(cur: number, overall: number) {
    mpb.addTask("Processing", {
        type: "percentage",
        message: cur+"/"+overall+" 0 errors",
        barTransformFn: (m) => chalk.blueBright(m)
    })
}

export function updateMainProgress(cur: number, overall: number, errors: number) {
    mpb.updateTask("Processing", {
        message: cur+"/"+overall+" "+errors+" errors"
    })
}
