import { Controller, HttpCode, HttpStatus, Post, Body } from '@nestjs/common'

import { UserService } from 'src/user/user.service';

@Controller('user') //test
export class UserController {

    constructor(private readonly userSvc: UserService) {}

    @HttpCode(HttpStatus.OK)
    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.userSvc.qry(dto) }

}
