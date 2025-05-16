import { Controller, HttpCode, HttpStatus, Post, Body } from '@nestjs/common'

import { UserService } from 'src/user/user.service'

@Controller('user')
export class UserController {

    constructor(private readonly userSvc: UserService) {}

    @Post('qryGroupDetail')
    qryGroupDetail(@Body() dto: Record<string, any>) { return this.userSvc.qryGroupDetail(dto) }

    @Post('orgTree')
    orgTree(@Body() dto: Record<string, any>) { return this.userSvc.orgTree(dto) }

    @Post('setVip')
    setVip(@Body() dto: Record<string, any>) { return this.userSvc.setVip(dto) }

}
