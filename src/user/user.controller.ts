import { Controller, HttpCode, HttpStatus, Post, Body } from '@nestjs/common'

import { UserService } from 'src/user/user.service'

@Controller('user')
export class UserController {

    constructor(private readonly userSvc: UserService) {}

    @Post('orgTree')
    orgTree(@Body() dto: Record<string, any>) { return this.userSvc.orgTree(dto) }

    @Post('procOrgSearch')
    procOrgSearch(@Body() dto: Record<string, any>) { return this.userSvc.procOrgSearch(dto) }

    @Post('qryGroupWithUser')
    qryGroupWithUser(@Body() dto: Record<string, any>) { return this.userSvc.qryGroupWithUser(dto) }

    @Post('setVip')
    setVip(@Body() dto: Record<string, any>) { return this.userSvc.setVip(dto) }

    @Post('saveMember')
    saveMember(@Body() dto: Record<string, any>) { return this.userSvc.saveMember(dto) }

    @Post('deleteMember')
    deleteMember(@Body() dto: Record<string, any>) { return this.userSvc.deleteMember(dto) }

    @Post('saveGroup')
    saveGroup(@Body() dto: Record<string, any>) { return this.userSvc.saveGroup(dto) }

    @Post('deleteGroup')
    deleteGroup(@Body() dto: Record<string, any>) { return this.userSvc.deleteGroup(dto) }

}
