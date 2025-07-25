"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerMiddleware = void 0;
const common_1 = require("@nestjs/common");
const winston_util_1 = require("./winston.util");
let LoggerMiddleware = class LoggerMiddleware {
    constructor() { }
    use(req, res, next) {
        const { ip, method, originalUrl } = req;
        const userAgent = req.get('user-agent');
        res.on('finish', () => {
            const { statusCode } = res;
            const str = `[${method}]${originalUrl}(${statusCode}) ${ip} ${userAgent}`;
            if (statusCode >= 400 && statusCode < 500) {
                winston_util_1.winstonLogger.warn(str);
            }
            else if (statusCode >= 500) {
                winston_util_1.winstonLogger.error(str);
            }
            else {
                if (originalUrl.includes('chanmsg/qryDataLogEach')) {
                }
                else {
                    winston_util_1.winstonLogger.log(str);
                }
            }
        });
        next();
    }
};
exports.LoggerMiddleware = LoggerMiddleware;
exports.LoggerMiddleware = LoggerMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], LoggerMiddleware);
//# sourceMappingURL=logger.middleware.js.map