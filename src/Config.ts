import { array, enums,Infer, assert, boolean, object, number, string } from 'superstruct'
import { readFileSync } from 'fs'

const ConfigSign = object({
    headless: boolean(),
    import: string(),
    concurrency: number(),
    burn: boolean(),
    transfer: enums([ "none", "zml", "zomby" ]),
    mother: string(),
    NEARProvider: object({
        addr: string(),
        key: string()
    }),

    proxy: array(
        object({
            host: string(),
            user: string(),
            password: string()
        })
    )
})

type ConfigType = Infer<typeof ConfigSign>;

export function Config(): ConfigType {
    let config;
    try {
        config = JSON.parse(readFileSync("./config.json").toString());
    } catch(e) {
        throw new Error("Config parse error: " + e);
    }

    assert(config, ConfigSign);

    return config;
}
