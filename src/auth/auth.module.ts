import { Module, Logger } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { Response } from 'express'

import appConfig from 'src/app.config'
import { UserModule } from 'src/user/user.module'
import { AuthGuard } from 'src/auth/auth.guard'
import { AuthController } from 'src/auth/auth.controller'
import { AuthService } from 'src/auth/auth.service'

@Module({
    imports: [        
        JwtModule.registerAsync({ //JwtModule.register()는 process.env 읽어오기 전에 실행될 수도 있어 Async로 처리
            useFactory() {  
                const config = appConfig()
                return {
                    global: true,
                    secret: config.jwt.key, //sendjay에 맞춘 것임
                    signOptions: { algorithm: 'HS256', expiresIn: '4h' } //HS512도 있으나 sendjay에 맞춘 것임. expiryIn 예) "59s", "1h", "365 days"
                }
            }            
        }),
        UserModule
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
