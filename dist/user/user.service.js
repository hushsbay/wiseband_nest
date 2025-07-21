"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const typeorm_transactional_1 = require("typeorm-transactional");
const app_config_1 = require("../app.config");
const hush = require("../common/common");
const resjson_1 = require("../common/resjson");
const user_entity_1 = require("./user.entity");
const chanmsg_entity_1 = require("../chanmsg/chanmsg.entity");
let UserService = class UserService {
    constructor(userRepo, usercodeRepo, grmstRepo, grdtlRepo, dataSource, req) {
        this.userRepo = userRepo;
        this.usercodeRepo = usercodeRepo;
        this.grmstRepo = grmstRepo;
        this.grdtlRepo = grdtlRepo;
        this.dataSource = dataSource;
        this.req = req;
    }
    async getVipList(userid) {
        let sql = "SELECT GROUP_CONCAT(UID) VIPS FROM S_USERCODE_TBL WHERE KIND = 'vip' AND USERID = ? ";
        const vipList = await this.dataSource.query(sql, [userid]);
        return vipList;
    }
    async chkUserRightForGroup(grid, userid) {
        const grmst = await this.grmstRepo.findOneBy({ GR_ID: grid });
        if (!grmst)
            return [null, '해당 그룹이 없습니다 : ' + grid + '/' + userid];
        let grdtl = await this.grdtlRepo.findOneBy({ GR_ID: grid, USERID: userid });
        if (!grdtl)
            return [null, '해당 그룹에 본인이 없습니다 : ' + grid + '/' + userid];
        if (grmst.MASTERID != userid && grdtl.KIND != 'admin')
            return [null, '해당 그룹의 관리자가 아닙니다 : ' + grid + '/' + userid];
        return [grmst, ''];
    }
    async chkUser(uid, secret) {
        if (!uid || !secret)
            return [null, '아이디/OTP(비번) 값이 없습니다 : ' + uid + '/' + secret];
        const user = await this.userRepo.findOneBy({ USERID: uid });
        if (!user)
            return [null, '아이디가 없습니다 : ' + uid];
        return [user, ''];
    }
    async login(uid, pwd) {
        const methodName = 'user>login';
        const resJson = new resjson_1.ResJson();
        let fv = hush.addFieldValue([uid], 'uid');
        try {
            const user = await this.userRepo.findOneBy({ USERID: uid });
            if (!user)
                return hush.setResJson(resJson, '해당 아이디가 없습니다 : ' + uid, hush.Code.NOT_OK, null, methodName);
            if (user.PWD == '') {
            }
            else {
                if (!pwd)
                    return hush.setResJson(resJson, '비번을 입력하시기 바랍니다 : ' + uid, hush.Code.NOT_OK, null, methodName);
                const config = (0, app_config_1.default)();
                const decoded = hush.decrypt(user.PWD, config.crypto.key);
                console.log(pwd, 'BBBB', decoded);
                if (pwd !== decoded) {
                    return hush.setResJson(resJson, hush.Msg.PWD_MISMATCH + fv, hush.Code.PWD_MISMATCH, this.req, methodName);
                }
            }
            const { PWD, PICTURE, OTP_NUM, OTP_DT, ISUR, MODR, ...userFiltered } = user;
            resJson.data = userFiltered;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async setOtp(uid, otpNum) {
        const methodName = 'user>setOtp';
        const resJson = new resjson_1.ResJson();
        let fv = hush.addFieldValue([uid], 'uid');
        try {
            const [user, retStr] = await this.chkUser(uid, otpNum);
            if (retStr != '')
                return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName);
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            user.OTP_NUM = otpNum;
            user.OTP_DT = curdtObj.DT;
            this.userRepo.save(user);
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async verifyOtp(uid, otpNum) {
        const methodName = 'user>verifyOtp';
        const resJson = new resjson_1.ResJson();
        let fv = hush.addFieldValue([uid], 'uid');
        try {
            const [user, retStr] = await this.chkUser(uid, otpNum);
            if (retStr != '')
                return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName);
            if (otpNum != user.OTP_NUM) {
                return hush.setResJson(resJson, hush.Msg.OTP_MISMATCH + fv, hush.Code.OTP_MISMATCH, this.req, methodName);
            }
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            const minDiff = hush.getDateTimeDiff(user.OTP_DT, curdtObj.DT, 'M');
            if (minDiff > hush.cons.otpDiffMax) {
                return hush.setResJson(resJson, 'OTP 체크시간(' + hush.cons.otpDiffMax + '분)을 초과했습니다.' + fv, hush.Code.OTP_TIMEOVER, this.req, methodName);
            }
            const { PWD, PICTURE, OTP_NUM, OTP_DT, ISUR, MODR, ...userFiltered } = user;
            resJson.data = userFiltered;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async orgTree(dto) {
        const methodName = 'user>login';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        try {
            const { myteam, mycomp } = dto;
            let maxLevel = -1;
            let sql = "SELECT ORG_CD, ORG_NM, TOP_ORG_CD, SEQ, LVL, (SELECT COUNT(*) FROM S_USER_TBL WHERE ORG_CD = A.ORG_CD) CNT ";
            sql += "     FROM S_ORG_TBL A ";
            if (mycomp) {
                sql += "WHERE TOP_ORG_CD = '" + mycomp + "' ";
            }
            sql += "    ORDER BY SEQ ";
            const orglist = await this.dataSource.query(sql, null);
            if (orglist.length == 0) {
                return hush.setResJson(resJson, '조직정보가 없습니다.', hush.Code.NOT_FOUND, null, methodName);
            }
            let myOrgArr = [];
            const qb = this.userRepo.createQueryBuilder();
            for (let i = 0; i < orglist.length; i++) {
                const item = orglist[i];
                const orgcd = item.ORG_CD;
                const lvl = item.LVL + 1;
                const userlist = await qb
                    .select([
                    'USERID', 'KIND', 'USERNM', 'SEQ', 'ORG_CD', 'ORG_NM', 'TOP_ORG_CD', 'TOP_ORG_NM',
                    'JOB', 'EMAIL', 'TELNO', lvl.toString() + ' LVL', 'PICTURE'
                ])
                    .where("ORG_CD = :orgcd ", {
                    orgcd: orgcd
                }).orderBy('SEQ', 'ASC').getRawMany();
                item.userlist = userlist;
                if (lvl > maxLevel)
                    maxLevel = lvl;
                if (myteam != '' && orgcd == myteam)
                    myOrgArr.push(item);
            }
            if (myOrgArr.length > 0) {
                let ok = true;
                while (ok) {
                    const seq = myOrgArr[myOrgArr.length - 1].SEQ;
                    const lvl = myOrgArr[myOrgArr.length - 1].LVL;
                    let sql = "SELECT ORG_CD, ORG_NM, SEQ, LVL FROM S_ORG_TBL WHERE SEQ < ? AND LVL < ? ORDER BY SEQ DESC LIMIT 1 ";
                    const orgList = await this.dataSource.query(sql, [seq, lvl]);
                    if (orgList.length == 0) {
                        ok = false;
                    }
                    else {
                        myOrgArr.push(orgList[0]);
                    }
                }
            }
            resJson.list = orglist;
            const vipList = await this.getVipList(userid);
            resJson.data.myOrgArr = myOrgArr;
            resJson.data.vipList = vipList;
            resJson.data.maxLevel = maxLevel;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req);
        }
    }
    async procOrgSearch(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { searchText, onlyAllUsers } = dto;
            const fieldArr = ['A.USERID', 'A.USERNM', 'A.ORG_CD', 'A.ORG_NM', 'A.TOP_ORG_CD', 'A.TOP_ORG_NM', 'A.JOB', 'A.EMAIL', 'A.TELNO', 'A.PICTURE'];
            if (onlyAllUsers) {
                const userlist = await this.userRepo.createQueryBuilder('A')
                    .select(fieldArr).where("A.USERNM LIKE :usernm ", { usernm: `%${searchText}%` }).orderBy('A.USERNM', 'ASC').getMany();
                resJson.list = userlist;
            }
            else {
                const userlist = await this.userRepo.createQueryBuilder('A')
                    .select(fieldArr).where("A.SYNC = 'Y' ")
                    .andWhere(new typeorm_2.Brackets(qb => {
                    qb.where("A.USERNM LIKE :usernm ", { usernm: `%${searchText}%` });
                    qb.orWhere("A.ORG_NM LIKE :ormnm ", { ormnm: `%${searchText}%` });
                    qb.orWhere("A.JOB LIKE :job ", { job: `%${searchText}%` });
                })).orderBy('A.USERNM', 'ASC').getMany();
                resJson.list = userlist;
            }
            const vipList = await this.getVipList(userid);
            resJson.data.vipList = vipList;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryGroupWithUser(dto) {
        const methodName = 'user>qryGroupWithUser';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { grid } = dto;
            let sql = "SELECT A.GR_ID, A.GR_NM, A.MASTERID, A.MASTERNM, 0 LVL ";
            sql += "     FROM S_GRMST_TBL A ";
            sql += "    INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID ";
            sql += "    WHERE B.USERID = ? AND B.KIND = 'admin' ";
            if (grid) {
                sql += "  AND A.GR_ID = '" + grid + "' ";
            }
            sql += "    ORDER BY GR_NM, GR_ID ";
            const list = await this.dataSource.query(sql, [userid]);
            if (list.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, methodName);
            }
            for (let i = 0; i < list.length; i++) {
                const row = list[i];
                sql = "SELECT A.GR_ID, A.USERID, A.USERNM, A.KIND, A.SYNC, 1 LVL, B.PICTURE, ";
                sql += "      CASE WHEN A.SYNC = 'Y' THEN CONCAT(B.TOP_ORG_NM, '/', B.ORG_NM) ELSE A.ORG END ORG, ";
                sql += "      CASE WHEN A.SYNC = 'Y' THEN B.JOB ELSE A.JOB END JOB, ";
                sql += "      CASE WHEN A.SYNC = 'Y' THEN B.EMAIL ELSE A.EMAIL END EMAIL, ";
                sql += "      CASE WHEN A.SYNC = 'Y' THEN B.TELNO ELSE A.TELNO END TELNO, ";
                sql += "      CASE WHEN A.SYNC = 'Y' THEN '' ELSE A.RMKS END RMKS ";
                sql += " FROM S_GRDTL_TBL A ";
                sql += " LEFT OUTER JOIN S_USER_TBL B ON A.USERID = B.USERID ";
                sql += "WHERE A.GR_ID = ? ";
                sql += "ORDER BY A.USERNM, A.USERID ";
                const userlist = await this.dataSource.query(sql, [row.GR_ID]);
                row.userlist = userlist;
            }
            resJson.list = list;
            const vipList = await this.getVipList(userid);
            resJson.data.vipList = vipList;
            resJson.data.maxLevel = 1;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async setVip(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        try {
            const { list, bool } = dto;
            let retCnt = 0;
            const qbUserCode = this.usercodeRepo.createQueryBuilder();
            for (let i = 0; i < list.length; i++) {
                const usercode = await qbUserCode
                    .select("COUNT(*) CNT")
                    .where("KIND = 'vip' and USERID = :userid and UID = :uid ", {
                    userid: userid, uid: list[i].USERID
                }).getRawOne();
                if (bool) {
                    if (usercode.CNT == 0) {
                        await qbUserCode
                            .insert().values({
                            KIND: 'vip', USERID: userid, UID: list[i].USERID, UNM: list[i].USERNM
                        }).execute();
                        retCnt += 1;
                    }
                }
                else {
                    if (usercode.CNT > 0) {
                        await qbUserCode
                            .delete()
                            .where("KIND = 'vip' and USERID = :userid and UID = :uid ", {
                            userid: userid, uid: list[i].USERID
                        }).execute();
                        retCnt += 1;
                    }
                }
            }
            resJson.data.retCnt = retCnt;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req);
        }
    }
    chkFieldValidSync(rmks) {
        if ((rmks && rmks.trim() != '') && rmks.trim().length > 200)
            return '비고 입력시 200자까지 가능합니다.';
        return '';
    }
    chkFieldValidNoSync(usernm, org, job, email, telno, rmks, kind) {
        if (!usernm || usernm.trim() == '' || usernm.trim().length > 30)
            return '이름은 공란없이 30자까지 가능합니다.';
        if (!org || org.trim() == '' || org.trim().length > 50)
            return '소속은 공란없이 50자까지 가능합니다.';
        if ((job && job.trim() != '') && job.trim().length > 50)
            return '직책/업무 입력시 50자까지 가능합니다.';
        if (!email || email.trim() == '' || email.trim().length > 50)
            return '이메일은 공란없이 50자까지 가능합니다.';
        if (!email.includes('@'))
            return '이메일은 인증되어야 하므로 정확하게 입력하시기 바랍니다.';
        if (!telno || telno.trim() == '' || telno.trim().length > 50)
            return '전화번호는 공란없이 50자까지 가능합니다.';
        if ((rmks && rmks.trim() != '') && rmks.trim().length > 200)
            return '비고 입력시 200자까지 가능합니다.';
        if (kind == 'admin')
            return '수동입력(외부인) 사용자는 Admin으로 설정할 수 없습니다.';
        return '';
    }
    async saveMember(dto) {
        const methodName = 'user>saveMember';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = '';
        try {
            const { crud, GR_ID, USERID, USERNM, ORG, JOB, EMAIL, TELNO, RMKS, SYNC, KIND } = dto;
            const useridToProc = (crud == 'U') ? USERID : (SYNC == 'Y' ? USERID : EMAIL);
            fv = hush.addFieldValue(dto, null, [userid, useridToProc]);
            const [grmst, retStr] = await this.chkUserRightForGroup(GR_ID, userid);
            if (retStr != '')
                return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName);
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            let grdtl = await this.grdtlRepo.findOneBy({ GR_ID: GR_ID, USERID: useridToProc });
            if (crud == 'U') {
                if (!grdtl) {
                    return hush.setResJson(resJson, '해당 그룹에 편집 대상 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName);
                }
                if (KIND != 'admin' && grmst.MASTERID == useridToProc) {
                    return hush.setResJson(resJson, '해당 그룹 마스터는 항상 admin이어야 합니다.' + fv, hush.Code.NOT_OK, null, methodName);
                }
                if (SYNC != 'Y') {
                    const ret = this.chkFieldValidNoSync(USERNM, ORG, JOB, EMAIL, TELNO, RMKS, KIND);
                    if (ret != '')
                        return hush.setResJson(resJson, ret + fv, hush.Code.NOT_OK, null, methodName);
                    grdtl.ORG = ORG;
                    grdtl.JOB = JOB;
                    grdtl.EMAIL = EMAIL;
                    grdtl.TELNO = TELNO;
                }
                else {
                    const ret = this.chkFieldValidSync(RMKS);
                    if (ret != '')
                        return hush.setResJson(resJson, ret + fv, hush.Code.NOT_OK, null, methodName);
                }
                grdtl.USERNM = USERNM;
                grdtl.KIND = KIND ? KIND : 'member';
                grdtl.RMKS = RMKS;
                grdtl.MODR = userid;
                grdtl.UDT = curdtObj.DT;
                await this.grdtlRepo.save(grdtl);
            }
            else {
                if (grdtl) {
                    return hush.setResJson(resJson, '해당 그룹에 편집 대상 사용자가 이미 있습니다.' + fv, hush.Code.NOT_OK, null, methodName);
                }
                grdtl = this.grdtlRepo.create();
                if (SYNC != 'Y') {
                    const ret = this.chkFieldValidNoSync(USERNM, ORG, JOB, EMAIL, TELNO, RMKS, KIND);
                    if (ret != '')
                        return hush.setResJson(resJson, ret + fv, hush.Code.NOT_OK, null, methodName);
                    grdtl.ORG = ORG;
                    grdtl.JOB = JOB;
                    grdtl.EMAIL = EMAIL;
                    grdtl.TELNO = TELNO;
                    grdtl.RMKS = RMKS;
                }
                grdtl.GR_ID = GR_ID;
                grdtl.USERID = useridToProc;
                grdtl.USERNM = USERNM;
                grdtl.KIND = KIND ? KIND : 'member';
                grdtl.SYNC = SYNC;
                grdtl.ISUR = userid;
                grdtl.CDT = curdtObj.DT;
                grdtl.MODR = userid;
                grdtl.UDT = curdtObj.DT;
                await this.grdtlRepo.save(grdtl);
            }
            if (SYNC == '') {
                let user = await this.userRepo.findOneBy({ USERID: useridToProc });
                if (!user) {
                    user = this.userRepo.create();
                    user.USERID = useridToProc;
                    user.KIND = 'U';
                    user.SEQ = 'ZZZZ';
                    user.SYNC = 'W';
                    user.ISUR = userid;
                    user.ISUDT = curdtObj.DT;
                }
                else {
                    user.MODR = userid;
                    user.MODDT = curdtObj.DT;
                }
                user.USERNM = USERNM;
                user.JOB = JOB;
                user.EMAIL = EMAIL;
                user.TELNO = TELNO;
                await this.userRepo.save(user);
            }
            const logObj = {
                cdt: curdtObj.DT, msgid: '', replyto: '', chanid: GR_ID, userid: userid, usernm: usernm,
                cud: crud, kind: 'mem', typ: 'group', bodytext: '', subkind: ''
            };
            const ret = await hush.insertDataLog(this.dataSource, logObj);
            if (ret != '')
                throw new Error(ret);
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async deleteMember(dto) {
        const methodName = 'user>deleteMember';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { GR_ID, USERID } = dto;
            const [grmst, retStr] = await this.chkUserRightForGroup(GR_ID, userid);
            if (retStr != '')
                return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName);
            let grdtl = await this.grdtlRepo.findOneBy({ GR_ID: GR_ID, USERID: USERID });
            if (!grdtl) {
                return hush.setResJson(resJson, '해당 그룹에 편집 대상 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName);
            }
            if (grmst.MASTERID == USERID) {
                return hush.setResJson(resJson, '해당 그룹 마스터를 삭제할 수 없습니다.' + fv, hush.Code.NOT_OK, null, methodName);
            }
            await this.grdtlRepo.delete(grdtl);
            if (grdtl.SYNC == '') {
                let sqlChk = "SELECT COUNT(*) CNT FROM S_GRDTL_TBL WHERE USERID = ? ";
                const menuList = await this.dataSource.query(sqlChk, [USERID]);
                if (menuList[0].CNT == 0) {
                    sqlChk = "DELETE FROM S_USER_TBL WHERE USERID = ? ";
                    await this.dataSource.query(sqlChk, [USERID]);
                }
            }
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            const logObj = {
                cdt: curdtObj.DT, msgid: '', replyto: '', chanid: GR_ID, userid: userid, usernm: usernm,
                cud: 'D', kind: 'mem', typ: 'group', bodytext: '', subkind: ''
            };
            const ret = await hush.insertDataLog(this.dataSource, logObj);
            if (ret != '')
                throw new Error(ret);
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async saveGroup(dto) {
        const methodName = 'user>saveGroup';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { GR_ID, GR_NM } = dto;
            const unidObj = await hush.getMysqlUnid(this.dataSource);
            let grmst;
            if (GR_ID != 'new') {
                const [grmst1, retStr] = await this.chkUserRightForGroup(GR_ID, userid);
                if (retStr != '')
                    return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName);
                grmst = grmst1;
                grmst.GR_NM = GR_NM;
                grmst.MODR = userid;
                grmst.UDT = unidObj.DT;
            }
            else {
                const user = await this.userRepo.findOneBy({ USERID: userid });
                if (!user) {
                    return hush.setResJson(resJson, '현재 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName);
                }
                if (user.SYNC != 'Y') {
                    return hush.setResJson(resJson, '현재 사용자는 그룹을 만들 수 없습니다.' + fv, hush.Code.NOT_OK, null, methodName);
                }
                grmst = this.grmstRepo.create();
                grmst.GR_ID = unidObj.ID;
                grmst.GR_NM = GR_NM;
                grmst.MASTERID = userid;
                grmst.MASTERNM = usernm;
                grmst.ISUR = userid;
                grmst.CDT = unidObj.DT;
                grmst.MODR = userid;
                grmst.UDT = unidObj.DT;
            }
            if (!GR_NM || GR_NM.trim() == '' || GR_NM.trim().length > 50) {
                hush.setResJson(resJson, '그룹명은 50자까지 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName);
            }
            await this.grmstRepo.save(grmst);
            if (GR_ID == 'new') {
                const grdtl = this.grdtlRepo.create();
                grdtl.GR_ID = unidObj.ID;
                grdtl.USERID = userid;
                grdtl.USERNM = usernm;
                grdtl.KIND = 'admin';
                grdtl.SYNC = 'Y';
                grdtl.ISUR = userid;
                grdtl.CDT = unidObj.DT;
                grdtl.MODR = userid;
                grdtl.UDT = unidObj.DT;
                await this.grdtlRepo.save(grdtl);
                resJson.data.grid = unidObj.ID;
            }
            const logObj = {
                cdt: unidObj.DT, msgid: '', replyto: '', chanid: (GR_ID == 'new') ? unidObj.ID : GR_ID, userid: userid, usernm: usernm,
                cud: (GR_ID == 'new') ? 'C' : 'U', kind: 'mst', typ: 'group', bodytext: '', subkind: ''
            };
            const ret = await hush.insertDataLog(this.dataSource, logObj);
            if (ret != '')
                throw new Error(ret);
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async deleteGroup(dto) {
        const methodName = 'user>deleteGroup';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { GR_ID } = dto;
            const [grmst, retStr] = await this.chkUserRightForGroup(GR_ID, userid);
            if (retStr != '')
                return hush.setResJson(resJson, retStr, hush.Code.NOT_OK, null, methodName);
            let sql = "SELECT COUNT(*) CNT FROM S_CHANMST_TBL WHERE GR_ID = ? ";
            const chanmst = await this.dataSource.query(sql, [GR_ID]);
            if (chanmst[0].CNT > 0) {
                return hush.setResJson(resJson, '해당 그룹에서 생성된 채널이 있습니다.' + fv, hush.Code.NOT_OK, null, methodName);
            }
            if (grmst.MASTERID != userid) {
                return hush.setResJson(resJson, '그룹삭제는 해당 그룹 마스터만 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName);
            }
            await this.dataSource.query("DELETE FROM S_GRDTL_TBL WHERE GR_ID = ? ", [GR_ID]);
            await this.dataSource.query("DELETE FROM S_GRMST_TBL WHERE GR_ID = ? ", [GR_ID]);
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            const logObj = {
                cdt: curdtObj.DT, msgid: '', replyto: '', chanid: GR_ID, userid: userid, usernm: usernm,
                cud: 'D', kind: 'mst', typ: 'group', bodytext: '', subkind: ''
            };
            const ret = await hush.insertDataLog(this.dataSource, logObj);
            if (ret != '')
                throw new Error(ret);
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
};
exports.UserService = UserService;
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserService.prototype, "setVip", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserService.prototype, "saveMember", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserService.prototype, "deleteMember", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserService.prototype, "saveGroup", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserService.prototype, "deleteGroup", null);
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)({ scope: common_1.Scope.REQUEST }),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.UserCode)),
    __param(2, (0, typeorm_1.InjectRepository)(chanmsg_entity_1.GrMst)),
    __param(3, (0, typeorm_1.InjectRepository)(chanmsg_entity_1.GrDtl)),
    __param(5, (0, common_1.Inject)(core_1.REQUEST)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource, Object])
], UserService);
//# sourceMappingURL=user.service.js.map