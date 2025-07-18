"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.winstonLogger = void 0;
const nest_winston_1 = require("nest-winston");
const winston = require("winston");
const winstonDaily = require("winston-daily-rotate-file");
const hush = require("./common");
const dailyOption = (level) => {
    return {
        level,
        datePattern: 'YYYY-MM-DD',
        dirname: `./logs/${level}`,
        filename: `%DATE%.${level}.log`,
        maxFiles: 30,
        zippedArchive: true,
        format: winston.format.combine(winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }), nest_winston_1.utilities.format.nestLike('nest', { colors: false, prettyPrint: true, processId: true, appName: true }))
    };
};
exports.winstonLogger = nest_winston_1.WinstonModule.createLogger({
    transports: [
        new winston.transports.Console({
            level: 'debug',
            format: winston.format.combine(winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }), winston.format.ms(), nest_winston_1.utilities.format.nestLike(hush.cons.appName, {
                colors: true, prettyPrint: true, processId: true, appName: true
            }))
        }),
        new winstonDaily(dailyOption('warn')),
        new winstonDaily(dailyOption('error'))
    ]
});
//# sourceMappingURL=winston.util.js.map