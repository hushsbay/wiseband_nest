import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserModule } from 'src/user/user.module'
import { MailModule } from 'src/mail/mail.module'
import { MsgMst, MsgSub, MsgDtl, ChanMst, ChanDtl, GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity'
import { User } from 'src/user/user.entity'
import { ChanmsgService } from 'src/chanmsg/chanmsg.service'
import { ChanmsgController } from 'src/chanmsg/chanmsg.controller'

@Module({
    imports: [
        TypeOrmModule.forFeature([MsgMst, MsgSub, MsgDtl, ChanMst, ChanDtl, GrMst, GrDtl, User]), 
        UserModule, MailModule
    ],
    controllers: [ChanmsgController],
    providers: [ChanmsgService]
})
export class ChanmsgModule {}
