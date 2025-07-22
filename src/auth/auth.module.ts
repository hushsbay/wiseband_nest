import { Module, Logger } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { Response } from 'express'

import appConfig from 'src/app.config'
import { UserModule } from 'src/user/user.module'
import { AuthGuard } from 'src/auth/auth.guard'
import { AuthController } from 'src/auth/auth.controller'
import { AuthService } from 'src/auth/auth.service'
import { MailModule } from 'src/mail/mail.module'

@Module({
    imports: [        
        JwtModule.registerAsync({ //JwtModule.register()는 process.env 읽어오기 전에 실행될 수도 있어 Async로 처리
            useFactory() {  
                const config = appConfig()
                return {
                    global: true,
                    secret: config.jwt.key, //sendjay에 맞춘 것임
                    signOptions: { algorithm: 'HS256', expiresIn: '4h' } //HS512도 있으나 기존 환경(sendjay)에 맞추는 목적. expiryIn 예) "59s", "1h", "365 days"
                    //토큰 만료 및 갱신은 59s로 설정해 테스트 완료함 (갱신시 브라우저F12에서 토큰 스트링이 육안으로 (리프레시해도) 동일하게 보이는데 달라져야 하지 않을까 싶음 - 어쨋든 테스트 완료)
                }
            }            
        }),
        UserModule, MailModule
    ],
    providers: [
        {
          provide: APP_GUARD,
          useClass: AuthGuard,
        }, 
        AuthService, 
        Logger, 
        Response
    ],
    controllers: [AuthController],
    exports: [AuthService]
})

export class AuthModule {}
