import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { JwtService } from '@nestjs/jwt'

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
        @Inject(REQUEST) 
        private readonly req: Request
    ) {}

    async login(dto: Record<string, any>): Promise<ResJson> {
        const resJson = new ResJson()        
        const { uid, pwd } = dto
        try {
            const obj = await this.userSvc.login(uid, pwd)
            if (!hush.chkResJson(obj)) return hush.setResJson(resJson, obj.msg, obj.code, this.req)
            const payload = { userid: obj.data.USER_ID, usernm: obj.data.USER_NM, orgcd: obj.data.ORG_CD, toporgcd: obj.data.TOP_ORG_CD }
            const token = await this.jwtSvc.signAsync(payload)
            this.mailSvc.sendMail("oldclock@sbs.co.kr", "가나다", "본문입니다.\n\n하하하<br><br>하하하")
            resJson.data = { token: token, ...obj.data } //모바일 앱 개발 편의성 고려. token을 쿠키나 헤더로 저장하지 않고 그냥 응답 Json에 넣기
            //this.res.cookie('token', token) //위 한행을 2행으로 분리(token은 쿠키로만 처리)하고자 했으나 쿠키 처리 못해서 위 1행으로 그대로 당분간 유지
            //resJson.data = obj.data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async setOtp(dto: Record<string, any>): Promise<ResJson> {
        const resJson = new ResJson()        
        const { uid } = dto
        console.log(uid,"@@@@@@@@@")
        try {
            const obj = await this.userSvc.setOtp(uid)
            if (!hush.chkResJson(obj)) return hush.setResJson(resJson, obj.msg, obj.code, this.req)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async logintest(dto: Record<string, any>): Promise<ResJson> {
        const resJson = new ResJson()        
        const { uid, pwd } = dto
        try {
            const obj = await this.userSvc.login(uid, pwd)
            if (!hush.chkResJson(obj)) return hush.setResJson(resJson, obj.msg, obj.code, this.req)
            const payload = { userid: obj.data.USER_ID, usernm: obj.data.USER_NM, orgcd: obj.data.ORG_CD, toporgcd: obj.data.TOP_ORG_CD }
            const token = await this.jwtSvc.signAsync(payload)
            resJson.data = { token: token, ...obj.data } //모바일 앱 개발 편의성 고려. token을 쿠키나 헤더로 저장하지 않고 그냥 응답 Json에 넣기
            //this.res.cookie('token', token) //위 한행을 2행으로 분리(token은 쿠키로만 처리)하고자 했으나 쿠키 처리 못해서 위 1행으로 그대로 당분간 유지
            //resJson.data = obj.data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

}
