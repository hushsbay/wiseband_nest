import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, Brackets } from 'typeorm'
import { Propagation, Transactional } from 'typeorm-transactional'

import appConfig from 'src/app.config'
import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { Org, User, UserCode } from 'src/user/user.entity'
import { GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity'

@Injectable({ scope: Scope.REQUEST })
export class UserService {
    
    constructor(
        //@InjectRepository(Org) private orgRepo: Repository<Org>, 
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

    async chkUserRightForGroup(grid: string, userid: string): Promise<[GrMst, string]> {
        const grmst = await this.grmstRepo.findOneBy({ GR_ID: grid })
        if (!grmst) return [null, '해당 그룹이 없습니다 : ' + grid + '/' + userid]
        let grdtl = await this.grdtlRepo.findOneBy({ GR_ID: grid, USERID: userid }) //1) useridToProc이 아닌 현재 사용자인 userid의 자격을 먼저 체크
        if (!grdtl) return [null, '해당 그룹에 본인이 없습니다 : ' + grid + '/' + userid]
        //행저장은 SYNC=Y이든 W입력멤버든 admin이라면 모두 가능하도록 함 (그룹 만들때만 W입력멤버는 제한하도록 함)
        if (grmst.MASTERID != userid && grdtl.KIND != 'admin') return [null, '해당 그룹의 관리자가 아닙니다 : ' + grid + '/' + userid]
        //MASTERID는 admin으로 자동으로 만들어지나 MASTERID 체크는 일단 그냥 두기로 함
        return [grmst, '']
    }

    async chkUser(uid: string, secret: string): Promise<[User, string]> {
        if (!uid || !secret) return [null, '아이디/OTP(비번) 값이 없습니다 : ' + uid + '/' + secret]
        const user = await this.userRepo.findOneBy({ USERID: uid })
        if (!user) return [null, '아이디가 없습니다 : ' + uid]
        return [user, '']
    }

    ///////////////////////////////////////////////////////////////////////////////위는 서비스내 공통 모듈

    async login(uid: string, pwd: string): Promise<ResJson> {
        const resJson = new ResJson()
        let fv = hush.addFieldValue([uid], 'uid')
        try {
            // if (!uid || !pwd) {
            //     return hush.setResJson(resJson, hush.Msg.BLANK_DATA + fv, hush.Code.BLANK_DATA, this.req, 'user>login')
            // }
            // const user = await this.userRepo.findOneBy({ USERID: uid })
            // if (!user) {
            //     return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'user>login')
            // }
            const [user, retStr] = await this.chkUser(uid, pwd)
            if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, 'user>login')
            const config = appConfig()
            const decoded = hush.decrypt(user.PWD, config.crypto.key)
            if (pwd !== decoded) {
                return hush.setResJson(resJson, hush.Msg.PWD_MISMATCH + fv, hush.Code.PWD_MISMATCH, this.req, 'user>login')
            }
            const { PWD, PICTURE, OTP_NUM, OTP_DT, ISUR, MODR, ...userFiltered } = user 
            resJson.data = userFiltered
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async setOtp(uid: string, otpNum: string): Promise<ResJson> {
        const resJson = new ResJson()
        let fv = hush.addFieldValue([uid], 'uid')
        try {
            // if (!uid || !otpNum) {
            //     return hush.setResJson(resJson, hush.Msg.BLANK_DATA + fv, hush.Code.BLANK_DATA, this.req, 'user>setOtp')
            // }
            // const user = await this.userRepo.findOneBy({ USERID: uid })
            // if (!user) {
            //     return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'user>setOtp')
            // }
            const [user, retStr] = await this.chkUser(uid, otpNum)
            if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, 'user>login')
            const curdtObj = await this.userRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            user.OTP_NUM = otpNum
            user.OTP_DT = curdtObj.DT
            this.userRepo.save(user)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async verifyOtp(uid: string, otpNum: string): Promise<ResJson> {
        const resJson = new ResJson()
        let fv = hush.addFieldValue([uid], 'uid')
        try {
            // if (!uid || !otpNum) {
            //     return hush.setResJson(resJson, hush.Msg.BLANK_DATA + fv, hush.Code.BLANK_DATA, this.req, 'user>verifyOtp')
            // }
            // const user = await this.userRepo.findOneBy({ USERID: uid })
            // if (!user) {
            //     return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'user>verifyOtp')
            // }
            const [user, retStr] = await this.chkUser(uid, otpNum)
            if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, 'user>login')
            if (otpNum != user.OTP_NUM) {
                return hush.setResJson(resJson, hush.Msg.OTP_MISMATCH + fv, hush.Code.OTP_MISMATCH, this.req, 'user>verifyOtp')
            }
            const curdtObj = await this.userRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            const minDiff = hush.getDateTimeDiff(user.OTP_DT, curdtObj.DT, 'M')
            if (minDiff > hush.cons.otpDiffMax) {
                return hush.setResJson(resJson, 'OTP 체크시간(' + hush.cons.otpDiffMax + '분)을 초과했습니다.' + fv, hush.Code.OTP_TIMEOVER, this.req, 'user>verifyOtp')
            }
            const { PWD, PICTURE, OTP_NUM, OTP_DT, ISUR, MODR, ...userFiltered } = user 
            resJson.data = userFiltered
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
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
    //         .select(['B.USERID', 'B.USERNM', 'B.KIND', 'B.SYNC'])
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
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        try {
            const { myteam } = dto //console.log(myteam, "@@@@@")
            let maxLevel = -1
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
            let myOrgArr = []
            const qb = this.userRepo.createQueryBuilder()
            for (let i = 0; i < orglist.length; i++) {
                const item = orglist[i]
                const orgcd = item.ORG_CD
                const lvl = item.LVL + 1
                const userlist = await qb
                .select([
                    'USERID', 'KIND', 'USERNM', 'SEQ', 'ORG_CD', 'ORG_NM', 'TOP_ORG_CD', 'TOP_ORG_NM', 
                    'JOB', 'EMAIL', 'TELNO', lvl.toString() + ' LVL', 'PICTURE'
                ])
                .where("ORG_CD = :orgcd ", { 
                    orgcd: orgcd
                }).orderBy('SEQ', 'ASC').getRawMany()
                item.userlist = userlist
                if (lvl > maxLevel) maxLevel = lvl
                if (myteam != '' && orgcd == myteam) myOrgArr.push(item)
            }
            if (myOrgArr.length > 0) { //아래는 내팀 찾아서 트리에서 펼칠 수 있게 상위노드 가져오는 로직임
                let ok = true
                while (ok) {
                    const seq = myOrgArr[myOrgArr.length - 1].SEQ
                    const lvl = myOrgArr[myOrgArr.length - 1].LVL
                    let sql = "SELECT ORG_CD, ORG_NM, SEQ, LVL FROM S_ORG_TBL WHERE SEQ < ? AND LVL < ? ORDER BY SEQ DESC LIMIT 1 "
                    const orgList = await this.dataSource.query(sql, [seq, lvl])
                    if (orgList.length == 0) {
                        ok = false
                    } else {
                        myOrgArr.push(orgList[0]) //console.log(orgList[0].ORG_NM, orgList[0].ORG_CD)
                    }
                }
            }
            resJson.list = orglist
            const vipList = await this.getVipList(userid)
            resJson.data.myOrgArr = myOrgArr
            resJson.data.vipList = vipList //데이터 없으면 vipList[0].VIP = null로 나옴
            resJson.data.maxLevel = maxLevel            
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async procOrgSearch(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { searchText } = dto
            const userlist = await this.userRepo.createQueryBuilder('A') //A 없으면 조회안됨
            .select(['A.USERID', 'A.USERNM', 'A.ORG_CD', 'A.ORG_NM', 'A.TOP_ORG_CD', 'A.TOP_ORG_NM', 'A.JOB', 'A.EMAIL', 'A.TELNO', 'A.PICTURE'])
            .where("A.SYNC = 'Y' ")
            .andWhere(new Brackets(qb => {
                qb.where("A.USERNM LIKE :usernm ", { usernm: `%${searchText}%` })
                .orWhere("A.ORG_NM LIKE :ormnm ", { ormnm: `%${searchText}%` })
                .orWhere("A.JOB LIKE :job ", { job: `%${searchText}%` })
            }))
            .orderBy('A.USERNM', 'ASC').getMany()
            resJson.list = userlist
            const vipList = await this.getVipList(userid)
            resJson.data.vipList = vipList //데이터 없으면 vipList[0].VIP = null로 나옴
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryGroupWithUser(dto: Record<string, any>): Promise<any> { //umenu의 qryGroup all과 거의 동일하나 user가 있음
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try { //내가 만들지 않았지만 내가 관리자로 들어가 있는 그룹도 포함됨 (관리자로 지정이 안되어 있으면 편집 권한 없음)
            const { grid } = dto
            let sql = "SELECT A.GR_ID, A.GR_NM, A.MASTERID, A.MASTERNM, 0 LVL "
            sql += "     FROM S_GRMST_TBL A "
            sql += "    INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID "
            sql += "    WHERE B.USERID = ? AND B.KIND = 'admin' " //A.MASTERID는 무조건 B.KIND가 admin임
            if (grid) {
                sql += "  AND A.GR_ID = '" + grid + "' "
            } //sql += "      AND A.MASTERID = '" + userid + "' "
            sql += "    ORDER BY GR_NM, GR_ID "
            const list = await this.dataSource.query(sql, [userid])
            if (list.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'user>qryGroupWithUser')
            }
            for (let i = 0; i < list.length; i++) {
                const row = list[i]
                sql = "SELECT A.GR_ID, A.USERID, A.USERNM, A.KIND, A.SYNC, 1 LVL, B.PICTURE, "
                sql += "      CASE WHEN A.SYNC = 'Y' THEN CONCAT(B.TOP_ORG_NM, '/', B.ORG_NM) ELSE A.ORG END ORG, "
                sql += "      CASE WHEN A.SYNC = 'Y' THEN B.JOB ELSE A.JOB END JOB, "
                sql += "      CASE WHEN A.SYNC = 'Y' THEN B.EMAIL ELSE A.EMAIL END EMAIL, "
                sql += "      CASE WHEN A.SYNC = 'Y' THEN B.TELNO ELSE A.TELNO END TELNO, "
                sql += "      CASE WHEN A.SYNC = 'Y' THEN '' ELSE A.RMKS END RMKS "
                sql += " FROM S_GRDTL_TBL A "
                sql += " LEFT OUTER JOIN S_USER_TBL B ON A.USERID = B.USERID "
                sql += "WHERE A.GR_ID = ? "
                sql += "ORDER BY A.USERNM, A.USERID "
                const userlist = await this.dataSource.query(sql, [row.GR_ID])
                row.userlist = userlist
            }
            resJson.list = list
            const vipList = await this.getVipList(userid)
            resJson.data.vipList = vipList //데이터 없으면 vipList[0].VIP = null로 나옴
            resJson.data.maxLevel = 1 //내그룹의 depth가 무조건 2 (starts from 0)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv) 
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async setVip(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        try {            
            const { list, bool } = dto
            let retCnt = 0
            const qbUserCode = this.usercodeRepo.createQueryBuilder()
            for (let i = 0; i < list.length; i++) { //list.forEach(async (item, index) => {            
                const usercode = await qbUserCode
                .select("COUNT(*) CNT")
                .where("KIND = 'vip' and USERID = :userid and UID = :uid ", {
                    userid: userid, uid: list[i].userid
                }).getRawOne()
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
                    }
                }
            }
            resJson.data.retCnt = retCnt
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    chkFieldValidA(usernm: string, org: string, job: string, email: string, telno: string, rmks: string): string {
        if (!usernm || usernm.trim() == '' || usernm.trim().length > 30) return '이름은 공란없이 30자까지 가능합니다.'
        if (!org || org.trim() == '' || org.trim().length > 50) return '소속은 공란없이 50자까지 가능합니다.'
        if ((job && job.trim() != '') && job.trim().length > 50) return '직책/업무 입력시 50자까지 가능합니다.'
        if (!email || email.trim() == '' || email.trim().length > 50) return '이메일은 공란없이 50자까지 가능합니다.'
        if (!email.includes('@')) return '이메일은 인증되어야 하므로 정확하게 입력하시기 바랍니다.' //정규식 체크는 일단 보류
        if (!telno || telno.trim() == '' || telno.trim().length > 50) return '전화번호는 공란없이 50자까지 가능합니다.'
        if ((rmks && rmks.trim() != '') && rmks.trim().length > 200) return '비고 입력시 200자까지 가능합니다.'
        return ''
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async saveMember(dto: Record<string, any>): Promise<any> { //삭제는 별도 서비스 처리
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = '' //여기선 특별히 아래에서 읽어오기
        try {
            const { crud, GR_ID, USERID, USERNM, ORG, JOB, EMAIL, TELNO, RMKS, SYNC, KIND } = dto
            const useridToProc = (crud == 'U') ? USERID : (SYNC == 'Y' ? USERID : EMAIL) //수동입력의 경우 EMAIL이 USERID가 됨
            fv = hush.addFieldValue(dto, null, [userid, useridToProc]) //console.log(useridToProc, crud, USERID, SYNC, EMAIL)
            const [grmst, retStr] = await this.chkUserRightForGroup(GR_ID, userid)
            if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, 'user>saveMember>chkUserRightForGroup')
            const curdtObj = await this.grdtlRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            let grdtl = await this.grdtlRepo.findOneBy({ GR_ID: GR_ID, USERID: useridToProc }) //2) 여기서부터는 처리할 멤버(useridToProc)를 대상으로 체크
            if (crud == 'U') {                
                if (!grdtl) {
                    return hush.setResJson(resJson, '해당 그룹에 편집 대상 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, 'user>saveMember>grdtl')
                }
                if (KIND != 'admin' && grmst.MASTERID == useridToProc) {
                    return hush.setResJson(resJson, '해당 그룹 생성자는 항상 admin이어야 합니다.' + fv, hush.Code.NOT_OK, null, 'user>saveMember>grdtl')
                }
                if (SYNC != 'Y') {
                    const ret = this.chkFieldValidA(USERNM, ORG, JOB, EMAIL, TELNO, RMKS)
                    if (ret != '') return hush.setResJson(resJson, ret + fv, hush.Code.NOT_OK, null, 'user>saveMember>grdtl')
                    grdtl.ORG = ORG
                    grdtl.JOB = JOB
                    grdtl.EMAIL = EMAIL
                    grdtl.TELNO = TELNO
                    grdtl.RMKS = RMKS    
                }
                grdtl.USERNM = USERNM
                grdtl.KIND = KIND ? KIND : 'member'                
                grdtl.MODR = userid
                grdtl.UDT = curdtObj.DT
                await this.grdtlRepo.save(grdtl)
            } else { //crud=C (조직도에서 SYNC=Y를 선택해 추가하는 경우도 있음)
                if (grdtl) {
                    return hush.setResJson(resJson, '해당 그룹에 편집 대상 사용자가 이미 있습니다.' + fv, hush.Code.NOT_OK, null, 'user>saveMember>grdtl')
                }
                grdtl = this.grdtlRepo.create()
                if (SYNC != 'Y') {
                    const ret = this.chkFieldValidA(USERNM, ORG, JOB, EMAIL, TELNO, RMKS)
                    if (ret != '') return hush.setResJson(resJson, ret + fv, hush.Code.NOT_OK, null, 'user>saveMember>grdtl')
                    grdtl.ORG = ORG
                    grdtl.JOB = JOB
                    grdtl.EMAIL = EMAIL
                    grdtl.TELNO = TELNO
                    grdtl.RMKS = RMKS
                }
                grdtl.GR_ID = GR_ID
                grdtl.USERID = useridToProc //수동입력의 경우 EMAIL이 USERID가 됨
                grdtl.USERNM = USERNM
                grdtl.KIND = KIND ? KIND : 'member'
                grdtl.SYNC = SYNC //수동입력시는 빈칸. 조직도에서 넘어오면 Y
                grdtl.ISUR = userid
                grdtl.CDT = curdtObj.DT
                await this.grdtlRepo.save(grdtl)
            }
            if (SYNC == '') { //수동입력시 사용자테이블 연동 처리
                let user = await this.userRepo.findOneBy({ USERID: useridToProc })
                if (!user) { //사용자아이디가 없으면 만들기
                    user = this.userRepo.create()
                    user.USERID = useridToProc
                    user.KIND = 'U'
                    user.SEQ = 'ZZZZ' //마지막 순서로 잡기
                    user.SYNC = 'W' //S_GRDTL_TBL에는 ''로 입력되는데 S_USER_TBL에는 'W'로 입력됨
                    user.ISUR = userid
                    user.ISUDT = curdtObj.DT
                } else { //사용자아이디가 있으면 수정하기
                    user.MODR = userid
                    user.MODDT = curdtObj.DT
                }
                user.USERNM = USERNM
                user.JOB = JOB
                user.EMAIL = EMAIL
                user.TELNO = TELNO
                await this.userRepo.save(user)
            }
            return resJson
        } catch (ex) {            
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async deleteMember(dto: Record<string, any>): Promise<any> { //그룹 멤버를 DELETE하면 그룹에 속한 채널에 대한 권한도 없어지므로 사용자 안내가 필요함 (다시 추가하면 권한 생김)
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { GR_ID, USERID } = dto
            const [grmst, retStr] = await this.chkUserRightForGroup(GR_ID, userid)
            if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, 'user>deleteMember>chkUserRightForGroup')
            let grdtl = await this.grdtlRepo.findOneBy({ GR_ID: GR_ID, USERID: USERID }) //2) 여기서부터는 처리할 멤버(USERID)를 대상으로 체크
            if (!grdtl) {
                return hush.setResJson(resJson, '해당 그룹에 편집 대상 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, 'user>deleteMember>grdtl')
            }
            if (grmst.MASTERID == USERID) {
                return hush.setResJson(resJson, '해당 그룹 생성자는 삭제할 수 없습니다.' + fv, hush.Code.NOT_OK, null, 'user>deleteMember>grdtl')
            } /*아래는 S_GRDTLDEL_TBL로의 백업 시작
            const curdtObj = await this.grmstRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            let sqlDel = "SELECT COUNT(*) CNT FROM S_GRDTLDEL_TBL WHERE GR_ID = ? AND USERID = ? "
            const deluser = await this.dataSource.query(sqlDel, [GR_ID, USERID])
            if (deluser[0].CNT > 0) {
                sqlDel =  "DELETE FROM S_GRDTLDEL_TBL WHERE GR_ID = ? AND USERID = ? "
                await this.dataSource.query(sqlDel, [GR_ID, USERID])
            }
            sqlDel = " INSERT INTO S_GRDTLDEL_TBL (GR_ID, USERID, USERNM, KIND, ORG, JOB, EMAIL, TELNO, RMKS, SYNC, ISUR, CDT, MODR, UDT) "
            sqlDel += "SELECT GR_ID, USERID, USERNM, KIND, ORG, JOB, EMAIL, TELNO, RMKS, SYNC, ISUR, CDT, ?, ? "
            sqlDel += "  FROM S_GRDTL_TBL "
            sqlDel += " WHERE GR_ID = ? AND USERID = ? "
            await this.dataSource.query(sqlDel, [userid, curdtObj.DT, GR_ID, USERID])
            S_GRDTLDEL_TBL로의 백업 종료*/
            await this.grdtlRepo.delete(grdtl) //더 위로 올라가면 안됨
            if (grdtl.SYNC == '') { //수동입력(W입력)만 추가 처리
                let sqlChk = "SELECT COUNT(*) CNT FROM S_GRDTL_TBL WHERE USERID = ? "
                const menuList = await this.dataSource.query(sqlChk, [USERID])
                if (menuList[0].CNT == 0) { //하나라도 남아 있으면 사용자테이블에서는 그냥 둬야 함
                    sqlChk =  "DELETE FROM S_USER_TBL WHERE USERID = ? "
                    await this.dataSource.query(sqlChk, [USERID])
                }
            }
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async saveGroup(dto: Record<string, any>): Promise<any> { //삭제는 별도 서비스 처리
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            const { GR_ID, GR_NM } = dto
            const unidObj = await this.grmstRepo.createQueryBuilder().select(hush.cons.unidMySqlStr).getRawOne()
            let grmst: GrMst
            if (GR_ID != 'new') {
                const [grmst1, retStr] = await this.chkUserRightForGroup(GR_ID, userid)
                if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, 'user>saveGroup>chkUserRightForGroup')
                grmst = grmst1                
                grmst.GR_NM = GR_NM
                grmst.MODR = userid
                grmst.UDT = unidObj.DT
            } else { //신규
                const user = await this.userRepo.findOneBy({ USERID: userid })
                if (!user) {
                    return hush.setResJson(resJson, '현재 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, 'user>saveGroup>grmst')
                }
                if (user.SYNC != 'Y') {
                    return hush.setResJson(resJson, '현재 사용자는 그룹을 만들 수 없습니다.' + fv, hush.Code.NOT_OK, null, 'user>saveGroup>grmst')
                }
                grmst = this.grmstRepo.create()
                grmst.GR_ID = unidObj.ID
                grmst.GR_NM = GR_NM
                grmst.MASTERID = userid
                grmst.MASTERNM = usernm
                grmst.ISUR = userid
                grmst.CDT = unidObj.DT
            }
            if (!GR_NM || GR_NM.trim() == '' || GR_NM.trim().length > 50) {
                hush.setResJson(resJson, '그룹명은 50자까지 가능합니다.' + fv, hush.Code.NOT_OK, null, 'user>saveGroup>grmst')
            }
            await this.grmstRepo.save(grmst)
            if (GR_ID == 'new') {
                const grdtl = this.grdtlRepo.create()                
                grdtl.GR_ID = unidObj.ID
                grdtl.USERID = userid
                grdtl.USERNM = usernm
                grdtl.KIND = 'admin'
                grdtl.SYNC = 'Y'
                grdtl.ISUR = userid
                grdtl.CDT = unidObj.DT
                await this.grdtlRepo.save(grdtl)
                resJson.data.grid = unidObj.ID
            }            
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async deleteGroup(dto: Record<string, any>): Promise<any> { //멤버는 지워도 마스터가 있으므로 복원이 상대적으로 쉬우나 마스터를 DELETE하면 복구는 어려워짐
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { GR_ID } = dto
            const [grmst, retStr] = await this.chkUserRightForGroup(GR_ID, userid)
            if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, 'user>deleteGroup>chkUserRightForGroup')
            let sql = "SELECT COUNT(*) CNT FROM S_CHANMST_TBL WHERE GR_ID = ? "
            const chanmst = await this.dataSource.query(sql, [GR_ID])
            if (chanmst[0].CNT > 0) {
                return hush.setResJson(resJson, '해당 그룹에서 생성된 채널이 있습니다.' + fv, hush.Code.NOT_OK, null, 'user>deleteGroup')
            } //채널 여부만 체크해도 되는 것이 채널은 그 안에 메시지 및 멤버 모두 삭제해야 채널마스터도 삭제 가능한 것으로 되어 있음
            // sql = "SELECT COUNT(*) CNT FROM S_GRDTL_TBL WHERE GR_ID = ? "
            // const grdtl = await this.dataSource.query(sql, [GR_ID])
            // if (grdtl[0].CNT > 0) {
            //     return hush.setResJson(resJson, '먼저 해당 그룹의 멤버를 모두 제거해 주시기 바랍니다.' + fv, hush.Code.NOT_OK, null, 'user>deleteGroup')
            // }
            await this.dataSource.query("DELETE FROM S_GRDTL_TBL WHERE GR_ID = ? ", [GR_ID])
            await this.dataSource.query("DELETE FROM S_GRMST_TBL WHERE GR_ID = ? ", [GR_ID])
            /*아래는 S_GRMSTDEL_TBL로의 백업 시작
            const curdtObj = await this.grmstRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            let sqlDel = "SELECT COUNT(*) CNT FROM S_GRMSTDEL_TBL WHERE GR_ID = ? "
            const delgrmst = await this.dataSource.query(sqlDel, [GR_ID])
            if (delgrmst[0].CNT > 0) {
                sqlDel =  "DELETE FROM S_GRMSTDEL_TBL WHERE GR_ID = ? "
                await this.dataSource.query(sqlDel, [GR_ID])
            }
            sqlDel = " INSERT INTO S_GRMSTDEL_TBL (GR_ID, GR_NM, MASTERID, MASTERNM, ISUR, CDT, MODR, UDT) "
            sqlDel += "SELECT GR_ID, GR_NM, MASTERID, MASTERNM, ISUR, CDT, ?, ? "
            sqlDel += "  FROM S_GRMST_TBL "
            sqlDel += " WHERE GR_ID = ? "
            await this.dataSource.query(sqlDel, [userid, curdtObj.DT, GR_ID])
            //S_GRMSTDEL_TBL로의 백업 종료*/
            //sql = "DELETE FROM S_GRMST_TBL WHERE GR_ID = ? "
            //await this.dataSource.query(sql, [GR_ID]) //더 위로 올라가면 안됨
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

}

