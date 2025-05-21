import { Controller, HttpCode, HttpStatus, Post, Body } from '@nestjs/common'

import { UserService } from 'src/user/user.service'

@Controller('user')
export class UserController {

    constructor(private readonly userSvc: UserService) {}

    // @Post('qryGroupDetail')
    // qryGroupDetail(@Body() dto: Record<string, any>) { return this.userSvc.qryGroupDetail(dto) }

    @Post('orgTree')
    orgTree(@Body() dto: Record<string, any>) { return this.userSvc.orgTree(dto) }

    @Post('procOrgSearch')
    procOrgSearch(@Body() dto: Record<string, any>) { return this.userSvc.procOrgSearch(dto) }

    @Post('qryInvolvedGroup')
    qryInvolvedGroup(@Body() dto: Record<string, any>) { return this.userSvc.qryInvolvedGroup(dto) }

    @Post('setVip')
    setVip(@Body() dto: Record<string, any>) { return this.userSvc.setVip(dto) }

    @Post('saveMember')
    saveMember(@Body() dto: Record<string, any>) { return this.userSvc.saveMember(dto) }

    @Post('deleteMember')
    deleteMember(@Body() dto: Record<string, any>) { return this.userSvc.deleteMember(dto) }

}
