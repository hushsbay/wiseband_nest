import { WinstonModule, utilities } from 'nest-winston'
import * as winston from 'winston'
import * as winstonDaily from 'winston-daily-rotate-file'
import * as hush from 'src/common/common'

const dailyOption = (level: string) => {
    return {
        level,
        datePattern: 'YYYY-MM-DD',
        dirname: `./logs/${level}`,
        filename: `%DATE%.${level}.log`,
        maxFiles: 30,
        zippedArchive: true,
        format: winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            utilities.format.nestLike('nest', { colors: false, prettyPrint: true, processId: true, appName: true })
        )
    }
}

export const winstonLogger = WinstonModule.createLogger({
    transports: [
        new winston.transports.Console({
            level: 'debug', //process.env.NODE_ENV === 'production' ? 'http' : 'debug',
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                winston.format.ms(),
                utilities.format.nestLike(hush.cons.appName, { 
                    colors: true, prettyPrint: true, processId: true, appName: true
                })
            )
        }),
        new winstonDaily(dailyOption('warn')),
        new winstonDaily(dailyOption('error'))
    ]
})
