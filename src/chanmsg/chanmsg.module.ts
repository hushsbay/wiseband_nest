import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { MsgMst, MsgSub, MsgDtl, ChanMst, ChanDtl, GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity'
import { ChanmsgService } from 'src/chanmsg/chanmsg.service'
import { ChanmsgController } from 'src/chanmsg/chanmsg.controller'

@Module({
    imports: [TypeOrmModule.forFeature([MsgMst, MsgSub, MsgDtl, ChanMst, ChanDtl, GrMst, GrDtl])],
    controllers: [ChanmsgController],
    providers: [ChanmsgService]
})
export class ChanmsgModule {}
