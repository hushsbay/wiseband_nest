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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("typeorm");
const hush = require("../common/common");
const resjson_1 = require("../common/resjson");
const user_service_1 = require("../user/user.service");
const mail_service_1 = require("../mail/mail.service");
let AuthService = class AuthService {
    constructor(userSvc, jwtSvc, mailSvc, dataSource, req) {
        this.userSvc = userSvc;
        this.jwtSvc = jwtSvc;
        this.mailSvc = mailSvc;
        this.dataSource = dataSource;
        this.req = req;
    }
    async setUserDataWithToken(userDataObj) {
        const payload = { userid: userDataObj.USERID, usernm: userDataObj.USERNM, orgcd: userDataObj.ORG_CD, toporgcd: userDataObj.TOP_ORG_CD };
        const token = await this.jwtSvc.signAsync(payload);
        return { token: token, ...userDataObj };
    }
    async login(dto) {
        const resJson = new resjson_1.ResJson();
        const { uid, pwd } = dto;
        try {
            const json = await this.userSvc.login(uid, pwd);
            if (json.code != hush.Code.OK)
                return hush.setResJson(resJson, json.msg, json.code, this.req);
            resJson.data = await this.setUserDataWithToken(json.data);
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req);
        }
    }
    async setOtp(dto) {
        const resJson = new resjson_1.ResJson();
        const { uid } = dto;
        try {
            if (!uid.includes('@'))
                return hush.setResJson(resJson, '아이디가 메일형식이 아닙니다.', hush.Code.NOT_OK, this.req);
            const otpNum = hush.getRnd().toString();
            const json = await this.userSvc.setOtp(uid, otpNum);
            if (json.code != hush.Code.OK)
                return hush.setResJson(resJson, json.msg, json.code, this.req);
            const mailTitle = '[' + hush.cons.appName + '] OTP : ' + otpNum;
            const mailBody = '아래 6자리 숫자를 ' + hush.cons.appName + ' 인증창에서 입력합니다. \n\nOTP : ' + otpNum + '\n\n';
            this.mailSvc.sendMail([uid], mailTitle, mailBody);
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req);
        }
    }
    async verifyOtp(dto) {
        const resJson = new resjson_1.ResJson();
        const { uid, otpNum } = dto;
        try {
            const json = await this.userSvc.verifyOtp(uid, otpNum);
            if (json.code != hush.Code.OK)
                return hush.setResJson(resJson, json.msg, json.code, this.req);
            resJson.data = await this.setUserDataWithToken(json.data);
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req);
        }
    }
    async qryUserList(dto) {
        const resJson = new resjson_1.ResJson();
        try {
            let sql = "SELECT USERID, USERNM, ORG_CD, ORG_NM, TOP_ORG_CD, TOP_ORG_NM, CASE WHEN PWD <> '' THEN 'N' ELSE 'Y' END ISOPEN ";
            sql += "     FROM S_USER_TBL ";
            sql += "    ORDER BY CASE WHEN PWD <> '' THEN 'N' ELSE 'Y' END, TOP_ORG_NM, ORG_NM, USERNM ";
            const list = await this.dataSource.query(sql, null);
            resJson.list = list;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, 'qryUserList');
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)({ scope: common_1.Scope.REQUEST }),
    __param(4, (0, common_1.Inject)(core_1.REQUEST)),
    __metadata("design:paramtypes", [user_service_1.UserService,
        jwt_1.JwtService,
        mail_service_1.MailService,
        typeorm_1.DataSource, Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map