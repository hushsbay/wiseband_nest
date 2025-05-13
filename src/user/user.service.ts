import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import appConfig from 'src/app.config'
import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { User } from 'src/user/user.entity'
import { GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity'

@Injectable({ scope: Scope.REQUEST })
export class UserService {
    
    constructor(
        @InjectRepository(User) private userRepo: Repository<User>, 
        @InjectRepository(GrMst) private grmstRepo: Repository<GrMst>, 
        @InjectRepository(GrDtl) private grdtlRepo: Repository<GrDtl>, 
        @Inject(REQUEST) private readonly req: Request) {}

    async login(uid: string, pwd: string): Promise<ResJson> {
        const resJson = new ResJson()
        const detailInfo = hush.addDetailInfo(uid, '아이디')
        try {
            if (!uid || !pwd) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req)
            const user = await this.userRepo.findOneBy({ USER_ID: uid })
            if (!user) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            const config = appConfig()
            const decoded = hush.decrypt(user.PWD, config.crypto.key) //sendjay와 SSO (동일한 암호화 키값 사용)
            if (pwd !== decoded) return hush.setResJson(resJson, hush.Msg.PWD_MISMATCH + detailInfo, hush.Code.PWD_MISMATCH, this.req)
            const { PWD, PICTURE, MIMETYPE, ...userFiltered } = user 
            resJson.data = userFiltered
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryGroupDetail(dto: Record<string, any>): Promise<any> {
        try {
            let data = { grmst: null, grdtl: [] }
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { grid } = dto
            let fv = hush.addFieldValue([userid, grid], 'userid/grid')
            const grmst = await this.grmstRepo.createQueryBuilder('A')
            .select(['A.GR_NM', 'A.MASTERID', 'A.MASTERNM'])
            .where("A.GR_ID = :grid and A.INUSE = 'Y' ", { 
                grid: grid
            }).getOne()
            if (!grmst) {
                return hush.setResJson(resJson, '해당 그룹이 없습니다.' + fv, hush.Code.NOT_FOUND, null, 'user>qryGroupDetail>grmst')
            }
            data.grmst = grmst
            const grdtl = await this.grdtlRepo.createQueryBuilder('B')
            .select(['B.USERID', 'B.USERNM', 'B.KIND', 'B.TYP'])
            .where("B.GR_ID = :grid ", { 
                grid: grid
            }).getMany()
            if (!grdtl) {
                return hush.setResJson(resJson, '해당 그룹 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, 'user>qryGroupDetail>grdtl')
            }
            data.grdtl = grdtl
            resJson.data = data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

}
