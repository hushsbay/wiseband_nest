import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { Propagation, Transactional } from 'typeorm-transactional'

import appConfig from 'src/app.config'
import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { Org, User, UserCode } from 'src/user/user.entity'
import { GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity'

@Injectable({ scope: Scope.REQUEST })
export class UserService {
    
    constructor(
        @InjectRepository(User) private userRepo: Repository<User>, 
        @InjectRepository(UserCode) private usercodeRepo: Repository<UserCode>, 
        @InjectRepository(GrMst) private grmstRepo: Repository<GrMst>, 
        @InjectRepository(GrDtl) private grdtlRepo: Repository<GrDtl>, 
        private dataSource : DataSource,
        @Inject(REQUEST) private readonly req: Request) {}

    async getVipList(userid: string): Promise<any> {
        let sql = "SELECT GROUP_CONCAT(UID) VIPS FROM S_USERCODE_TBL WHERE KIND = 'vip' AND USERID = ? "
        const vipList = await this.dataSource.query(sql, [userid])
        return vipList //데이터 없으면 vipList[0].VIP = null로 나옴
    }

    ///////////////////////////////////////////////////////////////////////////////위는 서비스내 공통 모듈

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

    async setOtp(uid: string, otpNum: string): Promise<ResJson> {
        const resJson = new ResJson()
        const detailInfo = hush.addDetailInfo(uid, '아이디')
        try {
            if (!uid || !otpNum) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req)
            const user = await this.userRepo.findOneBy({ USER_ID: uid })
            if (!user) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            const curdtObj = await this.userRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            user.OTP_NUM = otpNum
            user.OTP_DT = curdtObj.DT
            this.userRepo.save(user)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async verifyOtp(uid: string, otpNum: string): Promise<ResJson> {
        const resJson = new ResJson()
        const detailInfo = hush.addDetailInfo(uid, '아이디')
        try {
            if (!uid || !otpNum) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req)
            const user = await this.userRepo.findOneBy({ USER_ID: uid })
            if (!user) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            const curdtObj = await this.userRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            console.log(user.OTP_NUM, otpNum, user.OTP_DT, curdtObj.DT)
            if (otpNum != user.OTP_NUM) return hush.setResJson(resJson, hush.Msg.OTP_MISMATCH + detailInfo, hush.Code.OTP_MISMATCH, this.req)
            const minDiff = hush.getDateTimeDiff(user.OTP_DT, curdtObj.DT, 'M')
            if (minDiff > hush.cons.otpDiffMax) return hush.setResJson(resJson, 'OTP 체크시간(' + hush.cons.otpDiffMax + '분)을 초과했습니다', hush.Code.OTP_TIMEOVER, this.req)
            const { PWD, PICTURE, MIMETYPE, ...userFiltered } = user 
            resJson.data = userFiltered
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    // async qryGroupDetail(dto: Record<string, any>): Promise<any> { //사용하지 말기 : 아래로 대체 qryMyGroup => gryOneGroup으로 변경해서 my, other중에 권한있으면 조회가능하도록 하기
    //     try {
    //         let data = { grmst: null, grdtl: [] }
    //         const resJson = new ResJson()
    //         const userid = this.req['user'].userid
    //         const { grid } = dto
    //         let fv = hush.addFieldValue([userid, grid], 'userid/grid')
    //         const grmst = await this.grmstRepo.createQueryBuilder('A')
    //         .select(['A.GR_NM', 'A.MASTERID', 'A.MASTERNM'])
    //         .where("A.GR_ID = :grid and A.INUSE = 'Y' ", { 
    //             grid: grid
    //         }).getOne()
    //         if (!grmst) {
    //             return hush.setResJson(resJson, '해당 그룹이 없습니다.' + fv, hush.Code.NOT_FOUND, null, 'user>qryGroupDetail>grmst')
    //         }
    //         data.grmst = grmst
    //         const grdtl = await this.grdtlRepo.createQueryBuilder('B')
    //         .select(['B.USERID', 'B.USERNM', 'B.KIND', 'B.IS_SYNC'])
    //         .where("B.GR_ID = :grid ", { 
    //             grid: grid
    //         }).getMany()
    //         if (!grdtl) {
    //             return hush.setResJson(resJson, '해당 그룹 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, 'user>qryGroupDetail>grdtl')
    //         }
    //         data.grdtl = grdtl
    //         resJson.data = data
    //         return resJson
    //     } catch (ex) {
    //         hush.throwCatchedEx(ex, this.req)
    //     }
    // }

    async orgTree(dto: Record<string, any>): Promise<any> {
        try {
            let listOrg = [], maxLevel = -1
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const orglist = await this.dataSource.createQueryBuilder()
            .select('A.ORG_CD', 'ORG_CD')
            .addSelect('A.ORG_NM', 'ORG_NM')
            .addSelect('A.SEQ', 'SEQ')
            .addSelect('A.LVL', 'LVL')
            .addSelect((subQuery) => {
                return subQuery.select('COUNT(*)').from(User, 'B').where("B.ORG_CD = A.ORG_CD ")
            }, 'CNT')
            .from(Org, 'A')
            .orderBy('A.SEQ', 'ASC').getRawMany()
            if (orglist.length == 0) {
                return hush.setResJson(resJson, '조직정보가 없습니다.', hush.Code.NOT_FOUND, null, 'user>orgTree')
            }
            listOrg = orglist
            const qb = this.userRepo.createQueryBuilder()
            for (let i = 0; i < listOrg.length; i++) {
                const item = listOrg[i]
                const orgcd = item.ORG_CD
                const lvl = item.LVL + 1
                const userlist = await qb
                .select([
                    'USER_ID', 'ID_KIND', 'USER_NM', 'SEQ', 'ORG_CD', 'ORG_NM', 'TOP_ORG_CD', 'TOP_ORG_NM', 
                    'JOB', 'EMAIL', 'TELNO', lvl.toString() + ' LVL', 'PICTURE'
                ])
                .where("ORG_CD = :orgcd ", { 
                    orgcd: orgcd
                }).orderBy('SEQ', 'ASC').getRawMany()
                if (!userlist) {
                    return hush.setResJson(resJson, '해당 그룹 사용자가 없습니다.', hush.Code.NOT_FOUND, null, 'user>orgTree>orgcd')
                }
                item.userlist = userlist
                if (lvl > maxLevel) maxLevel = lvl
            }
            resJson.list = listOrg
            const vipList = await this.getVipList(userid)
            resJson.data.vipList = vipList //데이터 없으면 vipList[0].VIP = null로 나옴
            resJson.data.maxLevel = maxLevel            
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async procOrgSearch(dto: Record<string, any>): Promise<any> {
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const searchText = dto.searchText
            const userlist = await this.userRepo.createQueryBuilder('A') //A 없으면 조회안됨
            .select(['A.USER_ID', 'A.USER_NM', 'A.ORG_CD', 'A.ORG_NM', 'A.TOP_ORG_CD', 'A.TOP_ORG_NM', 'A.JOB', 'A.EMAIL', 'A.TELNO', 'A.PICTURE'])
            .where("A.USER_NM LIKE :usernm ", { usernm: `%${searchText}%` })
            .orWhere("A.ORG_NM LIKE :ormnm ", { ormnm: `%${searchText}%` })
            .orWhere("A.JOB LIKE :job ", { job: `%${searchText}%` })
            .orderBy('A.USER_NM', 'ASC').getMany()
            resJson.list = userlist
            const vipList = await this.getVipList(userid)
            resJson.data.vipList = vipList //데이터 없으면 vipList[0].VIP = null로 나옴
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryInvolvedGroup(dto: Record<string, any>): Promise<any> { //umenu의 qryGroup all과 거의 동일
        try { //내가 멤버로 들어가 있는 그룹만 조회 가능
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { grid } = dto
            let sql = "SELECT A.GR_ID, A.GR_NM, A.MASTERID, A.MASTERNM, 0 LVL "
            sql += "     FROM S_GRMST_TBL A "
            sql += "    INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID "
            sql += "    WHERE A.INUSE = 'Y' "
            sql += "      AND B.USERID = '" + userid + "' "
            if (grid) {
                sql += "  AND A.GR_ID = '" + grid + "' "
            }
            //sql += "      AND A.MASTERID = '" + userid + "' "
            sql += "    ORDER BY GR_NM, GR_ID "
            const list = await this.dataSource.query(sql, null)
            if (!list) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND, hush.Code.NOT_FOUND, this.req, 'menu>qryMyGroup')
            }
            for (let i = 0; i < list.length; i++) {
                const row = list[i]
                sql = "SELECT A.USERID, A.USERNM, A.KIND, A.IS_SYNC, 1 LVL, A.RMKS, B.TOP_ORG_CD, B.TOP_ORG_NM, B.ORG_CD, B.ORG_NM, "
                sql += "      CASE WHEN A.IS_SYNC = 'Y' THEN B.JOB ELSE A.JOB END JOB, "
                sql += "      CASE WHEN A.IS_SYNC = 'Y' THEN B.EMAIL ELSE A.EMAIL END EMAIL, "
                sql += "      CASE WHEN A.IS_SYNC = 'Y' THEN B.TELNO ELSE A.TELNO END TELNO, "
                sql += "      CASE WHEN A.IS_SYNC = 'Y' THEN B.PICTURE ELSE null END PICTURE "
                sql += " FROM S_GRDTL_TBL A "
                sql += " LEFT OUTER JOIN S_USER_TBL B ON A.USERID = B.USER_ID "
                sql += "WHERE GR_ID = ? "
                const userlist = await this.dataSource.query(sql, [row.GR_ID])
                row.userlist = userlist
            }
            resJson.list = list
            const vipList = await this.getVipList(userid)
            resJson.data.vipList = vipList //데이터 없으면 vipList[0].VIP = null로 나옴
            resJson.data.maxLevel = 1 //내그룹의 depth가 무조건 2 (starts from 0)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req) 
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async setVip(dto: Record<string, any>): Promise<any> {
        try {            
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { list, bool } = dto
            let retCnt = 0
            console.log(JSON.stringify(list), bool)
            const qbUserCode = this.usercodeRepo.createQueryBuilder()
            for (let i = 0; i < list.length; i++) { //list.forEach(async (item, index) => {            
                const usercode = await qbUserCode
                .select("COUNT(*) CNT")
                .where("KIND = 'vip' and USERID = :userid and UID = :uid ", {
                    userid: userid, uid: list[i].userid
                }).getRawOne()
                console.log(list[i].USER_NM, bool, userid, usercode.CNT)
                if (bool) {
                    if (usercode.CNT == 0) {
                        await qbUserCode
                        .insert().values({ 
                            KIND: 'vip', USERID: userid, UID: list[i].userid, UNM: list[i].USER_NM
                        }).execute()
                        retCnt += 1
                    }
                } else {
                    if (usercode.CNT > 0) {
                        await qbUserCode
                        .delete()
                        .where("KIND = 'vip' and USERID = :userid and UID = :uid ", {
                            userid: userid, uid: list[i].userid
                        }).execute()
                        retCnt += 1
                        console.log(list[i].USER_NM, retCnt)
                    }
                }
            }
            resJson.data.retCnt = retCnt
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

}

