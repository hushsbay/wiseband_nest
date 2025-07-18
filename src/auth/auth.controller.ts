import { Controller, Post, Body } from '@nestjs/common'
import { Unauth } from 'src/common/unauth.decorator'
import { AuthService } from 'src/auth/auth.service'

@Controller('auth')
export class AuthController {

    constructor(private authSvc: AuthService) {}

    @Unauth()
    @Post('login')
    login(@Body() dto: Record<string, any>) { return this.authSvc.login(dto) }

    @Unauth()
    @Post('setOtp')
    setOtp(@Body() dto: Record<string, any>) { return this.authSvc.setOtp(dto) }

    @Unauth()
    @Post('verifyOtp')
    verifyOtp(@Body() dto: Record<string, any>) { return this.authSvc.verifyOtp(dto) }

    @Unauth()
    @Post('qryUserList')
    qryUserList(@Body() dto: Record<string, any>) { return this.authSvc.qryUserList(dto) }
    
}