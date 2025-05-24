import { Controller, HttpCode, HttpStatus, Post, Get, Body, Query } from '@nestjs/common'

import { Unauth } from 'src/common/unauth.decorator'
import { AuthService } from 'src/auth/auth.service'

@Controller('auth')
export class AuthController {

    constructor(private authSvc: AuthService) {}

    @Unauth()
    //@HttpCode(HttpStatus.OK)
    @Post('login')
    login(@Body() dto: Record<string, any>) { return this.authSvc.login(dto) }

    @Unauth()
    @Post('setOtp')
    setOtp(@Body() dto: Record<string, any>) { return this.authSvc.setOtp(dto) }

    @Unauth()
    @Post('verifyOtp')
    verifyOtp(@Body() dto: Record<string, any>) { return this.authSvc.verifyOtp(dto) }

    // @Unauth()
    // @Get('logintest')
    // logintest(@Query() dto: Record<string, any>) { return this.authSvc.logintest(dto) }

}