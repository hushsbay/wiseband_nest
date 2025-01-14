import { Controller, HttpCode, HttpStatus, Post, Body, Res } from '@nestjs/common'

import { Unauth } from 'src/common/unauth.decorator'
import { AuthService } from 'src/auth/auth.service'

@Controller('auth')
export class AuthController {

    constructor(private authSvc: AuthService) {}

    @Unauth()
    @HttpCode(HttpStatus.OK)
    @Post('login')
    login(@Body() dto: Record<string, any>) { return this.authSvc.login(dto) }

}