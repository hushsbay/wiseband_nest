import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { JwtService } from '@nestjs/jwt'
import { DataSource } from 'typeorm'
import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { UserService } from 'src/user/user.service'
import { MailService } from 'src/mail/mail.service'

@Injectable({ scope: Scope.REQUEST })                 
export class AuthService {

    constructor(
        private userSvc: UserService, 
        private jwtSvc: JwtService, 
        private mailSvc: MailService, 
        private dataSource : DataSource,
        @Inject(REQUEST) private readonly req: Request                         
    ) {}

    async setUserDataWithToken(userDataObj: any): Promise<any> {
        const payload = { userid: userDataObj.USERID, usernm: userDataObj.USERNM, orgcd: userDataObj.ORG_CD, toporgcd: userDataObj.TOP_ORG_CD }
        const token = await this.jwtSvc.signAsync(payload)
        return { token: token, ...userDataObj } //모바일 앱 개발 편의성 고려. token을 쿠키나 헤더로 저장하지 않고 그냥 응답 Json에 넣기
    }

    ///////////////////////////////////////////////////////////////////////////////위는 서비스내 공통 모듈

    async login(dto: Record<string, any>): Promise<ResJson> {
        const resJson = new ResJson()        
        const { uid, pwd } = dto
        try {
            const json = await this.userSvc.login(uid, pwd)
            if (json.code != hush.Code.OK) return hush.setResJson(resJson, json.msg, json.code, this.req)
            resJson.data = await this.setUserDataWithToken(json.data) //this.res.cookie('token', token)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async setOtp(dto: Record<string, any>): Promise<ResJson> {
        const resJson = new ResJson()        
        const { uid } = dto
        try {
            if (!uid.includes('@')) return hush.setResJson(resJson, '아이디가 메일형식이 아닙니다.', hush.Code.NOT_OK, this.req)
            const otpNum = hush.getRnd().toString()
            const json = await this.userSvc.setOtp(uid, otpNum)
            if (json.code != hush.Code.OK) return hush.setResJson(resJson, json.msg, json.code, this.req)
            const mailTitle = '[' + hush.cons.appName + '] OTP : ' + otpNum
            const mailBody = '아래 6자리 숫자를 ' + hush.cons.appName + ' 인증창에서 입력합니다. \n\nOTP : ' + otpNum + '\n\n'
            this.mailSvc.sendMail([uid], mailTitle, mailBody)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)  
        }
    }

    async verifyOtp(dto: Record<string, any>): Promise<ResJson> {
        const resJson = new ResJson()        
        const { uid, otpNum } = dto
        try {
            const json = await this.userSvc.verifyOtp(uid, otpNum)
            if (json.code != hush.Code.OK) return hush.setResJson(resJson, json.msg, json.code, this.req)
            resJson.data = await this.setUserDataWithToken(json.data)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryUserList(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        try { 
            let sql = "SELECT USERID, USERNM, ORG_CD, ORG_NM, TOP_ORG_CD, TOP_ORG_NM "
            sql += "     FROM S_USER_TBL "
            sql += "    ORDER BY TOP_ORG_NM, ORG_NM, USERNM "
            const list = await this.dataSource.query(sql, null)
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, 'qryUserList')
        }
    }

}
