import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'

import appConfig from 'src/app.config'
import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { User, Org } from 'src/user/user.entity'
import { GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity'

@Injectable({ scope: Scope.REQUEST })
export class UserService {
    
    constructor(
        @InjectRepository(User) private userRepo: Repository<User>, 
        @InjectRepository(Org) private orgRepo: Repository<Org>, 
        @InjectRepository(GrMst) private grmstRepo: Repository<GrMst>, 
        @InjectRepository(GrDtl) private grdtlRepo: Repository<GrDtl>, 
        private dataSource : DataSource,
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
            .select(['B.USERID', 'B.USERNM', 'B.KIND', 'B.IS_SYNC'])
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

    async orgTree(dto: Record<string, any>): Promise<any> {
        try {
            let listOrg = [], maxLevel = -1
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const orglist = await this.orgRepo.createQueryBuilder('A')
            .select(['A.ORG_CD', 'A.ORG_NM', 'A.SEQ', 'A.LVL'])
            .orderBy('A.SEQ', 'ASC').getMany()
            if (!orglist) {
                return hush.setResJson(resJson, '조직이 없습니다.', hush.Code.NOT_FOUND, null, 'user>orgTree')
            }
            listOrg = orglist
            const qb = this.userRepo.createQueryBuilder()
            for (let i = 0; i < listOrg.length; i++) {
                const item = listOrg[i]
                const orgcd = item.ORG_CD
                const lvl = item.LVL + 1
                const userlist = await qb
                .select(['USER_ID', 'ID_KIND', 'USER_NM', 'SEQ', 'ORG_CD', 'ORG_NM', 'TOP_ORG_CD', 'TOP_ORG_NM', 'JOB', 'EMAIL', 'TELNO', lvl.toString() + ' LVL', 'PICTURE'])
                .where("ORG_CD = :orgcd ", { 
                    orgcd: orgcd
                }).orderBy('SEQ', 'ASC').getRawMany() //order by 이름
                if (!userlist) {
                    return hush.setResJson(resJson, '해당 그룹 사용자가 없습니다.', hush.Code.NOT_FOUND, null, 'user>orgTree>orgcd')
                }
                item.userlist = userlist
                if (lvl > maxLevel) maxLevel = lvl
            }
            let sql = "SELECT GROUP_CONCAT(UID) VIPS FROM S_USERCODE_TBL WHERE KIND = 'vip' AND USERID = ? "
            const vipList = await this.dataSource.query(sql, [userid])
            resJson.list = listOrg
            resJson.data.vipList = vipList //데이터 없으면 vipList[0].VIP = null로 나옴
            resJson.data.maxLevel = maxLevel            
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

}

