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
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const app_config_1 = require("../app.config");
const hush = require("../common/common");
const unauth_decorator_1 = require("../common/unauth.decorator");
let AuthGuard = class AuthGuard {
    constructor(jwtSvc, reflector, logger) {
        this.jwtSvc = jwtSvc;
        this.reflector = reflector;
        this.logger = logger;
    }
    async canActivate(context) {
        let payloadStr = '';
        try {
            const isUnauth = this.reflector.getAllAndOverride(unauth_decorator_1.IS_UNAUTH_KEY, [context.getHandler(), context.getClass()]);
            if (isUnauth)
                return true;
            const request = context.switchToHttp().getRequest();
            const response = context.switchToHttp().getResponse();
            const token = this.extractToken(request);
            if (!token) {
                throw new Error(hush.Msg.JWT_NEEDED);
            }
            const arr = token.split('.');
            payloadStr = Buffer.from(arr[1], 'base64').toString('utf-8');
            const config = (0, app_config_1.default)();
            const payload = await this.jwtSvc.verifyAsync(token, { secret: config.jwt.key });
            console.log(JSON.stringify(payload));
            if (payloadStr != JSON.stringify(payload)) {
                throw new Error(hush.Msg.JWT_MISMATCH + '\n[payloadStr]' + payloadStr + '\n[payload]' + JSON.stringify(payload));
            }
            console.log(payload.userid, payload.usernm, payload.orgcd, payload.toporgcd);
            request['user'] = payload;
            const payloadToUpdate = { userid: payload.userid, usernm: payload.usernm, orgcd: payload.orgcd, toporgcd: payload.toporgcd };
            const tokenToUpdate = await this.jwtSvc.signAsync(payloadToUpdate);
            response.cookie('token', tokenToUpdate);
        }
        catch (ex) {
            let userInfoStr = '';
            if (payloadStr) {
                const payload = JSON.parse(payloadStr);
                userInfoStr = payload.userid + '/' + payload.usernm + '/' + payload.orgcd;
            }
            else {
                userInfoStr = payloadStr;
            }
            console.log(ex.message);
            if (ex.name == 'TokenExpiredError') {
                const strErr = hush.Msg.JWT_EXPIRED + ' ' + userInfoStr;
                this.logger.error(strErr, hush.Code.JWT_EXPIRED);
                hush.throwHttpEx(strErr, hush.Code.JWT_EXPIRED);
            }
            else {
                const strErr = hush.Msg.JWT_ETC + ' (' + ex.name + ') ' + ex.message + ' ' + userInfoStr;
                this.logger.error(strErr, hush.Code.JWT_ETC);
                hush.throwHttpEx(strErr, hush.Code.JWT_ETC);
            }
        }
        return true;
    }
    extractToken(request) {
        const jwtToken = request.cookies.token;
        if (jwtToken)
            return jwtToken;
        let reqObj = (request.method == 'POST') ? request.body : request.query;
        const jwtToken1 = reqObj.token;
        if (jwtToken1)
            return jwtToken1;
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService, core_1.Reflector, common_1.Logger])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map