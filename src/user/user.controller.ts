import { Controller, Post, Get, Body, Query, Header, UseInterceptors, UploadedFile } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UserService } from 'src/user/user.service'

@Controller('user')
export class UserController {

    constructor(private readonly userSvc: UserService) {}

    @Get('getUserInfo') //이미지 Caching이 필요한 Get 방식으로 처리
    @Header('Cache-Control', 'no-cache') //= @Header('Cache-Control', 'max-age=0, must-revalidate')
    //현재 max-age 동작 안되고 있으나 이미지 캐싱에만 사용할 것이므로 no-cache나 max-age=0, must-revalidate로 설정하기로 함 (서버 기본 설정값이기도 함)
    //참고) no-cache는 캐시는 가능한데 사용할 때마다 서버에 재검증하는 것이고 진짜 캐싱하지 않는 것은 no-store임
    //실제로 no-cache로 설정후 이미지를 변경하면 200/201로 내려오고 그 다음에 요청시 바로 304 not modified로 잘 되는 것을 확인함 (브라우저가 알아서 처리하고 있음)
    getUserInfo(@Query() dto: Record<string, any>) { return this.userSvc.getUserInfo(dto) }

    @Post('getUserInfo')
    getUserInfo1(@Body() dto: Record<string, any>) { return this.userSvc.getUserInfo(dto) }

    @Post('setUserInfo')
    @UseInterceptors(FileInterceptor('file'))
    setUserInfo(@Body() dto: Record<string, any>, @UploadedFile() file: Express.Multer.File) { 
        return this.userSvc.setUserInfo(dto, file) 
    }

    @Post('setNoti')
    setNoti(@Body() dto: Record<string, any>) { return this.userSvc.setNoti(dto) }

    @Post('changePwd')
    changePwd(@Body() dto: Record<string, any>) { return this.userSvc.changePwd(dto) }
    
    @Post('orgTree')
    orgTree(@Body() dto: Record<string, any>) { return this.userSvc.orgTree(dto) }

    @Post('procOrgSearch')
    procOrgSearch(@Body() dto: Record<string, any>) { return this.userSvc.procOrgSearch(dto) }

    @Post('qryGroupWithUser')
    qryGroupWithUser(@Body() dto: Record<string, any>) { return this.userSvc.qryGroupWithUser(dto) }

    @Post('getVip')
    getVip(@Body() dto: Record<string, any>) { return this.userSvc.getVip(dto) }

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
