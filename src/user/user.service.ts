import { Inject, Injectable, Scope, UploadedFile } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, Brackets } from 'typeorm'
import { Propagation, Transactional } from 'typeorm-transactional'
import appConfig from 'src/app.config'
import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { Org, User, UserCode, UserEnv } from 'src/user/user.entity'
import { GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity'

@Injectable({ scope: Scope.REQUEST })
export class UserService {
    
    constructor(
        //@InjectRepository(Org) private orgRepo: Repository<Org>, 
        @InjectRepository(User) private userRepo: Repository<User>, 
        @InjectRepository(UserCode) private usercodeRepo: Repository<UserCode>, 
        @InjectRepository(UserEnv) private userenvRepo: Repository<UserEnv>, 
        @InjectRepository(GrMst) private grmstRepo: Repository<GrMst>, 
        @InjectRepository(GrDtl) private grdtlRepo: Repository<GrDtl>, 
        private dataSource : DataSource,
        @Inject(REQUEST) private readonly req: Request) {}

    async getVipList(userid: string): Promise<any> {
        let sql = "SELECT GROUP_CONCAT(UID) VIPS FROM S_USERCODE_TBL WHERE KIND = 'vip' AND USERID = ? "
        const vipList = await this.dataSource.query(sql, [userid]) //console.log(JSON.stringify(vipList[0]), "0000000000000")
        return vipList //데이터 없으면 vipList[0].VIP = null로 나옴
    }

    async chkUserRightForGroup(grid: string, userid: string): Promise<[GrMst, string]> { 
        //userid는 본인이어야 함. req['user']를 전달받지 않는 것은 혹시나 req를 받지못하는 상황이 올 수도 있어서임
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
        if (!user) return [null, '해당 아이디가 없습니다 : ' + uid]
        return [user, '']
    }

    ///////////////////////////////////////////////////////////////////////////////위는 서비스내 공통 모듈

    async login(uid: string, pwd: string): Promise<ResJson> {
        const methodName = 'user>login'
        const resJson = new ResJson()
        let fv = hush.addFieldValue([uid], 'uid')
        try {
            const user = await this.userRepo.findOneBy({ USERID: uid })
            if (!user) return hush.setResJson(resJson, '해당 아이디가 없습니다 : ' + uid, hush.Code.NOT_OK, null, methodName)
            if (user.PWD == '') { //from Vue 로그인 화면
                //fake id이므로 인증없이 그냥 넘어가기
            } else {
                if (!pwd) return hush.setResJson(resJson, '비번을 입력하시기 바랍니다 : ' + uid, hush.Code.NOT_OK, null, methodName)
                const config = appConfig()
                const decoded = hush.decrypt(user.PWD, config.crypto.key) //console.log(pwd, 'CCCCCCCC', decoded)
                if (pwd !== decoded) {
                    return hush.setResJson(resJson, hush.Msg.PWD_MISMATCH + fv, hush.Code.PWD_MISMATCH, this.req, methodName)
                }
            }
            const { PWD, PICTURE, OTP_NUM, OTP_DT, ISUR, MODR, ...userFiltered } = user 
            resJson.data = userFiltered
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async getUserInfo(dto: Record<string, any>): Promise<any> {
        const methodName = 'user>getUserInfo'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { uid, pictureOnly } = dto //console.log(uid, pictureOnly)
            const uidReal = uid ? uid : userid //사용자 아이디 어떤 것이라도 허용
            const user = await this.userRepo.findOneBy({ USERID: uidReal })
            if (!user) return hush.setResJson(resJson, '해당 아이디가 없습니다 : ' + uidReal, hush.Code.NOT_OK, null, methodName)
            if (pictureOnly) {
                resJson.data.PICTURE = user.PICTURE
            } else {
                const { PWD, OTP_NUM, OTP_DT, ISUR, MODR, ...userFiltered } = user //PWD 등 제외
                const userEnv = await this.userenvRepo.findOneBy({ USERID: uidReal }) //개인설정정보
                resJson.list = userEnv //not array but object
                resJson.data = userFiltered
            }
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async setUserInfo(dto: Record<string, any>, @UploadedFile() file: Express.Multer.File): Promise<any> {
        const methodName = 'user>setUserInfo'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid]) //본인 아이디만 처리
        try {
            const { usernm } = dto
            const user = await this.userRepo.findOneBy({ USERID: userid })
            if (!user) return hush.setResJson(resJson, '해당 아이디가 없습니다 : ' + userid, hush.Code.NOT_OK, null, methodName)
            const curdtObj = await hush.getMysqlCurdt(this.dataSource)
            if (usernm) {
                user.USERNM = usernm
                resJson.data.USERNM = usernm
            } else {
                user.PICTURE = Buffer.from(new Uint8Array(file.buffer))
                resJson.data.PICTURE = user.PICTURE 
            }
            user.MODR = userid
            user.MODDT = curdtObj.DT
            await this.userRepo.save(user)            
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }
    
    async setNoti(dto: Record<string, any>): Promise<ResJson> {
        const methodName = 'user>setNoti'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid]) //본인 아이디만 처리
        try {
            const { kind, bool } = dto
            const user = await this.userRepo.findOneBy({ USERID: userid })
            if (!user) return hush.setResJson(resJson, '해당 아이디가 없습니다 : ' + userid, hush.Code.NOT_OK, null, methodName)
            const qbUserEnv = this.userenvRepo.createQueryBuilder()
            const curdtObj = await hush.getMysqlCurdt(this.dataSource)
            const userEnv = await this.userenvRepo.findOneBy({ USERID: userid })
            if (!userEnv) {
                let notiBool = 'N', bodyBool = 'N', authorBool = 'N'
                if (kind == "body") {
                    bodyBool = bool
                } else if (kind == "author") {
                    authorBool = bool
                } else {//noti
                    notiBool = bool
                }
                await qbUserEnv
                .insert().values({ 
                    USERID: userid, USERNM: user.USERNM, NOTI_OFF: notiBool, BODY_OFF: bodyBool, AUTHOR_OFF: authorBool,
                    ISUR: userid, ISUDT: curdtObj.DT, MODR: userid, MODDT: curdtObj.DT
                }).execute()
            } else {
                let obj = { MODR: userid, MODDT: curdtObj.DT }
                const obj1 = (kind == "body") ? { BODY_OFF: bool } : (kind == "author") ? { AUTHOR_OFF: bool } : { NOTI_OFF: bool }
                Object.assign(obj, obj1)
                await qbUserEnv.update().set(obj).where("USERID = :userid ", { userid: userid }).execute()
            }
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async changePwd(dto: Record<string, any>): Promise<any> {
        const methodName = 'user>changePwd'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid]) //본인 아이디만 처리
        try {
            const { pwdOld, pwdNew } = dto
            const config = appConfig()
            const user = await this.userRepo.findOneBy({ USERID: userid })
            if (!user) return hush.setResJson(resJson, '해당 아이디가 없습니다 : ' + userid, hush.Code.NOT_OK, null, methodName)
            const curdtObj = await hush.getMysqlCurdt(this.dataSource)
            if (user.PWD) {
                const decoded = hush.decrypt(user.PWD, config.crypto.key)
                if (pwdOld !== decoded) {
                    return hush.setResJson(resJson, '기존 비번이 다릅니다.', hush.Code.NOT_OK, null, methodName)
                }
            }
            if (pwdNew.includes('@')) {
                return hush.setResJson(resJson, '기호 @는 지원하지 않습니다.', hush.Code.NOT_OK, null, methodName)
            }
            const encoded = hush.encrypt(pwdNew, config.crypto.key)
            user.PWD = encoded
            user.MODR = userid
            user.MODDT = curdtObj.DT
            await this.userRepo.save(user)            
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async setOtp(uid: string, otpNum: string): Promise<ResJson> {
        const methodName = 'user>setOtp'
        const resJson = new ResJson()
        let fv = hush.addFieldValue([uid], 'uid')
        try {
            const [user, retStr] = await this.chkUser(uid, otpNum)
            if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName)
            const curdtObj = await hush.getMysqlCurdt(this.dataSource)
            user.OTP_NUM = otpNum
            user.OTP_DT = curdtObj.DT
            await this.userRepo.save(user)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async verifyOtp(uid: string, otpNum: string): Promise<ResJson> {
        const methodName = 'user>verifyOtp'
        const resJson = new ResJson()
        let fv = hush.addFieldValue([uid], 'uid')
        try {
            const [user, retStr] = await this.chkUser(uid, otpNum)
            if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName)
            if (otpNum != user.OTP_NUM) {
                return hush.setResJson(resJson, hush.Msg.OTP_MISMATCH + fv, hush.Code.OTP_MISMATCH, this.req, methodName)
            }
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) //await this.userRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            const minDiff = hush.getDateTimeDiff(user.OTP_DT, curdtObj.DT, 'M')
            if (minDiff > hush.cons.otpDiffMax) {
                return hush.setResJson(resJson, 'OTP 체크시간(' + hush.cons.otpDiffMax + '분)을 초과했습니다.' + fv, hush.Code.OTP_TIMEOVER, this.req, methodName)
            }
            const { PWD, PICTURE, OTP_NUM, OTP_DT, ISUR, MODR, ...userFiltered } = user 
            resJson.data = userFiltered
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async orgTree(dto: Record<string, any>): Promise<any> { //권한체크X
        const methodName = 'user>orgTree'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        try {
            const { myteam, mycomp } = dto
            let maxLevel = -1
            // const orglist = await this.dataSource.createQueryBuilder()
            // .select('A.ORG_CD', 'ORG_CD').addSelect('A.ORG_NM', 'ORG_NM').addSelect('A.SEQ', 'SEQ').addSelect('A.LVL', 'LVL')  
            // .addSelect((subQuery) => { return subQuery.select('COUNT(*)').from(User, 'B').where("B.ORG_CD = A.ORG_CD ")}, 'CNT')
            // .from(Org, 'A').orderBy('A.SEQ', 'ASC').getRawMany()
            let sql = "SELECT ORG_CD, ORG_NM, TOP_ORG_CD, SEQ, LVL, (SELECT COUNT(*) FROM S_USER_TBL WHERE ORG_CD = A.ORG_CD) CNT "
            sql += "     FROM S_ORG_TBL A "
            if (mycomp) {
                sql += "WHERE TOP_ORG_CD = '" + mycomp + "' "
            }
            sql += "    ORDER BY SEQ "
            const orglist = await this.dataSource.query(sql, null)
            if (orglist.length == 0) {
                return hush.setResJson(resJson, '조직정보가 없습니다.', hush.Code.NOT_FOUND, null, methodName)
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
                if (myteam != '' && orgcd == myteam) myOrgArr.push(item) //###9
            }
            if (myOrgArr.length > 0) { //아래는 내팀 찾아서 트리에서 펼칠 수 있게 상위노드 가져오는 로직임 ###9
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
            resJson.data.myOrgArr = myOrgArr //현재 내팀 로직은 클라이언트 개선이 필요함 ###9
            resJson.data.vipList = vipList //데이터 없으면 vipList[0].VIP = null로 나옴
            resJson.data.maxLevel = maxLevel            
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async procOrgSearch(dto: Record<string, any>): Promise<any> { //권한체크X
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { searchText, onlyAllUsers } = dto
            const fieldArr = ['A.USERID', 'A.USERNM', 'A.ORG_CD', 'A.ORG_NM', 'A.TOP_ORG_CD', 'A.TOP_ORG_NM', 'A.JOB', 'A.EMAIL', 'A.TELNO', 'A.PICTURE']
            if (onlyAllUsers) {
                const userlist = await this.userRepo.createQueryBuilder('A') //A 없으면 조회안됨
                .select(fieldArr).where("A.USERNM LIKE :usernm ", { usernm: `%${searchText}%` }).orderBy('A.USERNM', 'ASC').getMany()
                resJson.list = userlist
            } else {
                const userlist = await this.userRepo.createQueryBuilder('A') //A 없으면 조회안됨
                .select(fieldArr).where("A.SYNC = 'Y' ")
                .andWhere(new Brackets(qb => {
                    qb.where("A.USERNM LIKE :usernm ", { usernm: `%${searchText}%` })
                    qb.orWhere("A.ORG_NM LIKE :ormnm ", { ormnm: `%${searchText}%` })
                    qb.orWhere("A.JOB LIKE :job ", { job: `%${searchText}%` })
                })).orderBy('A.USERNM', 'ASC').getMany()
                resJson.list = userlist
            }
            const vipList = await this.getVipList(userid)
            resJson.data.vipList = vipList //데이터 없으면 vipList[0].VIP = null로 나옴
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryGroupWithUser(dto: Record<string, any>): Promise<any> { //menu의 qryGroup all과 거의 동일하나 user가 있음
        const methodName = 'user>qryGroupWithUser'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try { //내가 만들지 않았지만 내가 관리자로 들어가 있는 그룹도 포함됨 (관리자로 지정이 안되어 있으면 편집 권한 없음)
            const { grid } = dto
            let sql = "SELECT A.GR_ID, A.GR_NM, A.MASTERID, A.MASTERNM, 0 LVL "
            sql += "     FROM S_GRMST_TBL A "
            sql += "    INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID "
            sql += "    WHERE B.USERID = ? " //AND B.KIND = 'admin' " //A.MASTERID는 무조건 B.KIND가 admin임
            if (grid) {
                sql += "  AND A.GR_ID = '" + grid + "' "
            } //sql += "      AND A.MASTERID = '" + userid + "' "
            sql += "    ORDER BY GR_NM, GR_ID "
            const list = await this.dataSource.query(sql, [userid])
            if (list.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, methodName)
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

    async getVip(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try { //vipList가 아닌 vipStr임을 유의 (chanmsg>qry 참조)
            const viplist = await this.getVipList(userid) //데이터 없으면 vipList[0].VIP = null로 나옴
            resJson.data.vipStr = viplist[0].VIPS
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
            const { list, bool } = dto //let retCnt = 0
            const qbUserCode = this.usercodeRepo.createQueryBuilder()
            for (let i = 0; i < list.length; i++) { //list.forEach(async (item, index) => {            
                const usercode = await qbUserCode
                .select("COUNT(*) CNT")
                .where("USERID = :userid and KIND = 'vip' and UID = :uid ", {
                    userid: userid, uid: list[i].USERID
                }).getRawOne()
                if (bool) {
                    if (usercode.CNT == 0) {
                        await qbUserCode
                        .insert().values({ 
                            USERID: userid, KIND: 'vip', UID: list[i].USERID, UNM: list[i].USERNM
                        }).execute() //retCnt += 1
                    }
                } else {
                    if (usercode.CNT > 0) {
                        await qbUserCode
                        .delete()
                        .where("USERID = :userid and KIND = 'vip' and UID = :uid ", {
                            userid: userid, uid: list[i].USERID
                        }).execute() //retCnt += 1
                    }
                }
            } //resJson.data.retCnt = retCnt
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    chkFieldValidSync(rmks: string): string {
        if ((rmks && rmks.trim() != '') && rmks.trim().length > 200) return '비고 입력시 200자까지 가능합니다.'
        return ''
    }

    chkFieldValidNoSync(usernm: string, org: string, job: string, email: string, telno: string, rmks: string, kind: string): string {
        if (!usernm || usernm.trim() == '' || usernm.trim().length > 30) return '이름이 빈칸이거나 30자를 초과합니다.'
        if (!org || org.trim() == '' || org.trim().length > 50) return '소속이 빈칸이거나 50자를 초과합니다.'
        if (!job || job.trim() == '' || job.trim().length > 50) return '직책/업무가 빈칸이거나 50자를 초과합니다.'
        if (!email || email.trim() == '' || email.trim().length > 50) return '이메일이 빈칸이거나 50자를 초과합니다.'
        if (!email.includes('@')) return '이메일은 인증되어야 하므로 정확하게 입력하시기 바랍니다.' //정규식 체크는 일단 보류
        if (!telno || telno.trim() == '' || telno.trim().length > 50) return '전화번호가 빈칸이거나 50자를 초과합니다.'
        if ((rmks && rmks.trim() != '') && rmks.trim().length > 200) return '비고 입력시 200자까지 가능합니다.'
        if (kind == 'admin') return '수동입력(외부인) 사용자는 Admin으로 설정할 수 없습니다.' //그러나, 채널멤버로서는 Admin이 가능해야 함
        return ''
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async saveMember(dto: Record<string, any>): Promise<any> { //삭제는 별도 서비스 처리
        const methodName = 'user>saveMember'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = '' //여기선 특별히 아래에서 읽어오기
        try {
            const { crud, GR_ID, USERID, USERNM, ORG, JOB, EMAIL, TELNO, RMKS, SYNC, KIND } = dto
            const useridToProc = (crud == 'U') ? USERID : (SYNC == 'Y' ? USERID : EMAIL) //수동입력의 경우 EMAIL이 USERID가 됨
            fv = hush.addFieldValue(dto, null, [userid, useridToProc]) //console.log(useridToProc, crud, USERID, SYNC, EMAIL)
            const [grmst, retStr] = await this.chkUserRightForGroup(GR_ID, userid)
            if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName)
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) //await this.grdtlRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            let grdtl = await this.grdtlRepo.findOneBy({ GR_ID: GR_ID, USERID: useridToProc }) //2) 여기서부터는 처리할 멤버(useridToProc)를 대상으로 체크
            if (crud == 'U') {                
                if (!grdtl) {
                    return hush.setResJson(resJson, '해당 그룹에 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName)
                }
                if (KIND != 'admin' && grmst.MASTERID == useridToProc) {
                    return hush.setResJson(resJson, '해당 그룹 마스터는 항상 admin이어야 합니다.' + fv, hush.Code.NOT_OK, null, methodName)
                }
                if (SYNC != 'Y') {
                    const ret = this.chkFieldValidNoSync(USERNM, ORG, JOB, EMAIL, TELNO, RMKS, KIND)
                    if (ret != '') return hush.setResJson(resJson, ret + fv, hush.Code.NOT_OK, null, methodName)
                    grdtl.ORG = ORG
                    grdtl.JOB = JOB
                    grdtl.EMAIL = EMAIL
                    grdtl.TELNO = TELNO
                } else {
                    const ret = this.chkFieldValidSync(RMKS)
                    if (ret != '') return hush.setResJson(resJson, ret + fv, hush.Code.NOT_OK, null, methodName)
                }
                grdtl.USERNM = USERNM
                grdtl.KIND = KIND ? KIND : 'member'    
                grdtl.RMKS = RMKS                
                grdtl.MODR = userid
                grdtl.UDT = curdtObj.DT
                await this.grdtlRepo.save(grdtl)
            } else { //crud=C (조직도에서 SYNC=Y를 선택해 추가하는 경우도 있음)           
                if (grdtl) {
                    return hush.setResJson(resJson, '해당 그룹에 사용자가 이미 있습니다.' + fv, hush.Code.NOT_OK, null, methodName)
                }
                grdtl = this.grdtlRepo.create()
                if (SYNC != 'Y') {
                    const ret = this.chkFieldValidNoSync(USERNM, ORG, JOB, EMAIL, TELNO, RMKS, KIND)
                    if (ret != '') return hush.setResJson(resJson, ret + fv, hush.Code.NOT_OK, null, methodName)
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
                grdtl.MODR = userid
                grdtl.UDT = curdtObj.DT
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
            const logObj = { //그룹은 chanid에 grid 대체
                cdt: curdtObj.DT, msgid: '', replyto: '', chanid: GR_ID, userid: userid, usernm: usernm, 
                cud: crud, kind: 'mem', typ: 'group', bodytext: '', subkind: ''
            }
            const ret = await hush.insertDataLog(this.dataSource, logObj)
            if (ret != '') throw new Error(ret)
            return resJson
        } catch (ex) {            
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async deleteMember(dto: Record<string, any>): Promise<any> { //그룹 멤버를 DELETE하면 그룹에 속한 채널에 대한 권한도 없어지므로 사용자 안내가 필요함 (다시 추가하면 권한 생김)
        const methodName = 'user>deleteMember'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { GR_ID, USERID, USERNM } = dto //fv 표시할 때 USERNM 필요
            const [grmst, retStr] = await this.chkUserRightForGroup(GR_ID, userid)
            if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName)
            let grdtl = await this.grdtlRepo.findOneBy({ GR_ID: GR_ID, USERID: USERID }) //2) 여기서부터는 처리할 멤버(USERID)를 대상으로 체크
            if (!grdtl) {
                return hush.setResJson(resJson, '해당 그룹에 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName)
            }
            if (grmst.MASTERID == USERID) {
                return hush.setResJson(resJson, '해당 그룹 마스터를 삭제할 수 없습니다.' + fv, hush.Code.NOT_OK, null, methodName)
            }
            await this.grdtlRepo.delete(grdtl) //더 위로 올라가면 안됨
            if (grdtl.SYNC == '') { //수동입력(W입력)만 추가 처리
                let sqlChk = "SELECT COUNT(*) CNT FROM S_GRDTL_TBL WHERE USERID = ? "
                const menuList = await this.dataSource.query(sqlChk, [USERID])
                if (menuList[0].CNT == 0) { //하나라도 남아 있으면 사용자테이블에서는 그냥 둬야 함
                    sqlChk =  "DELETE FROM S_USER_TBL WHERE USERID = ? "
                    await this.dataSource.query(sqlChk, [USERID])
                }
            }
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) 
            const logObj = { //그룹은 chanid에 grid 대체
                cdt: curdtObj.DT, msgid: '', replyto: '', chanid: GR_ID, userid: userid, usernm: usernm, 
                cud: 'D', kind: 'mem', typ: 'group', bodytext: '', subkind: ''
            }
            const ret = await hush.insertDataLog(this.dataSource, logObj)
            if (ret != '') throw new Error(ret)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async saveGroup(dto: Record<string, any>): Promise<any> { //삭제는 별도 서비스 처리
        const methodName = 'user>saveGroup'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            const { GR_ID, GR_NM } = dto
            const unidObj = await hush.getMysqlUnid(this.dataSource) //await this.grmstRepo.createQueryBuilder().select(hush.cons.unidMySqlStr).getRawOne()
            let grmst: GrMst
            if (GR_ID != 'new') {
                const [grmst1, retStr] = await this.chkUserRightForGroup(GR_ID, userid)
                if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName)
                grmst = grmst1                
                grmst.GR_NM = GR_NM
                grmst.MODR = userid
                grmst.UDT = unidObj.DT
            } else { //신규
                const user = await this.userRepo.findOneBy({ USERID: userid })
                if (!user) {
                    return hush.setResJson(resJson, '현재 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName)
                }
                if (user.SYNC != 'Y') {
                    return hush.setResJson(resJson, '현재 사용자는 그룹 생성 권한이 없습니다.' + fv, hush.Code.NOT_OK, null, methodName)
                }
                grmst = this.grmstRepo.create()
                grmst.GR_ID = unidObj.ID
                grmst.GR_NM = GR_NM
                grmst.MASTERID = userid
                grmst.MASTERNM = usernm
                grmst.ISUR = userid
                grmst.CDT = unidObj.DT
                grmst.MODR = userid
                grmst.UDT = unidObj.DT
            }
            if (!GR_NM || GR_NM.trim() == '' || GR_NM.trim().length > 50) {
                hush.setResJson(resJson, '그룹명은 50자까지 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName)
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
                grdtl.MODR = userid
                grdtl.UDT = unidObj.DT
                await this.grdtlRepo.save(grdtl)
                resJson.data.grid = unidObj.ID
            }    
            const logObj = { //그룹은 chanid에 grid 대체
                cdt: unidObj.DT, msgid: '', replyto: '', chanid: (GR_ID == 'new') ? unidObj.ID : GR_ID, userid: userid, usernm: usernm, 
                cud: (GR_ID == 'new')  ? 'C' : 'U', kind: 'mst', typ: 'group', bodytext: '', subkind: ''
            }
            const ret = await hush.insertDataLog(this.dataSource, logObj)
            if (ret != '') throw new Error(ret)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async deleteGroup(dto: Record<string, any>): Promise<any> { //멤버는 지워도 마스터가 있으므로 복원이 상대적으로 쉬우나 마스터를 DELETE하면 복구는 어려워짐
        const methodName = 'user>deleteGroup'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { GR_ID } = dto
            const [grmst, retStr] = await this.chkUserRightForGroup(GR_ID, userid)
            if (retStr != '') return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName)
            let sql = "SELECT COUNT(*) CNT FROM S_CHANMST_TBL WHERE GR_ID = ? "
            const chanmst = await this.dataSource.query(sql, [GR_ID])
            if (chanmst[0].CNT > 0) {
                return hush.setResJson(resJson, '해당 그룹에서 생성된 채널이 있습니다.' + fv, hush.Code.NOT_OK, null, methodName)
            }
            if (grmst.MASTERID != userid) {
                return hush.setResJson(resJson, '그룹삭제는 해당 그룹 마스터만 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName)
            }
            await this.dataSource.query("DELETE FROM S_GRDTL_TBL WHERE GR_ID = ? ", [GR_ID])
            await this.dataSource.query("DELETE FROM S_GRMST_TBL WHERE GR_ID = ? ", [GR_ID])
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) 
            const logObj = { //그룹은 chanid에 grid 대체
                cdt: curdtObj.DT, msgid: '', replyto: '', chanid: GR_ID, userid: userid, usernm: usernm, 
                cud: 'D', kind: 'mst', typ: 'group', bodytext: '', subkind: ''
            }
            const ret = await hush.insertDataLog(this.dataSource, logObj)
            if (ret != '') throw new Error(ret)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

}

