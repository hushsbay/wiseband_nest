import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'
import appConfig from 'src/app.config'
import * as hush from 'src/common/common'
import { IS_UNAUTH_KEY } from 'src/common/unauth.decorator'
  
@Injectable()
export class AuthGuard implements CanActivate {

    constructor(private jwtSvc: JwtService, private reflector: Reflector, private logger: Logger) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        let payloadStr = ''
        try {
            const isUnauth = this.reflector.getAllAndOverride<boolean>(IS_UNAUTH_KEY, [context.getHandler(), context.getClass()])
            if (isUnauth) return true
            const request = context.switchToHttp().getRequest()
            const response = context.switchToHttp().getResponse()
            const token = this.extractToken(request)
            if (!token) { //hush.throwHttpEx(hush.Msg.JWT_NEEDED, hush.Code.JWT_NEEDED)
                throw new Error(hush.Msg.JWT_NEEDED)
            }
            const arr = token.split('.')
            payloadStr = Buffer.from(arr[1], 'base64').toString('utf-8')
            const config = appConfig()
            const payload = await this.jwtSvc.verifyAsync(token, { secret: config.jwt.key })
            console.log(JSON.stringify(payload))
            if (payloadStr != JSON.stringify(payload)) { //필요시 위변조 가능성도 체크
                hush.throwHttpEx(hush.Msg.JWT_MISMATCH + '\n[payloadStr]' + payloadStr + '\n[payload]' + JSON.stringify(payload), hush.Code.JWT_MISMATCH)
            }
            console.log(payload.userid, payload.usernm, payload.orgcd, payload.toporgcd)
            request['user'] = payload
            const payloadToUpdate = { userid: payload.userid, usernm: payload.usernm, orgcd: payload.orgcd, toporgcd: payload.toporgcd }
            const tokenToUpdate = await this.jwtSvc.signAsync(payloadToUpdate) //무조건 갱신함
            response.cookie('token', tokenToUpdate)
        } catch (ex) {
            let userInfoStr = ''
            if (payloadStr) {
                const payload = JSON.parse(payloadStr)
                userInfoStr = payload.userid + '/' + payload.usernm + '/' + payload.orgcd 
            } else {
                userInfoStr = payloadStr
            }
            console.log(ex.message)
            if (ex.name == 'TokenExpiredError') {
                const strErr = hush.Msg.JWT_EXPIRED + ' ' + userInfoStr
                this.logger.error(strErr, hush.Code.JWT_EXPIRED)
                hush.throwHttpEx(strErr, hush.Code.JWT_EXPIRED)
            } else {
                const strErr = hush.Msg.JWT_ETC + ' (' + ex.name + ') ' + ex.message + ' ' + userInfoStr
                this.logger.error(strErr, hush.Code.JWT_ETC)
                hush.throwHttpEx(strErr, hush.Code.JWT_ETC)
            }
        }
        return true
    }

    private extractToken(request: Request): string | undefined {
        const jwtToken = request.cookies.token
        if (jwtToken) return jwtToken
        let reqObj = (request.method == 'POST') ? request.body : request.query //POST와 GET 방식만 사용하기로 함
        const jwtToken1 = reqObj.token
        if (jwtToken1) return jwtToken1
        const [type, token] = request.headers.authorization?.split(' ') ?? []
        return type === 'Bearer' ? token : undefined
    }
    
}