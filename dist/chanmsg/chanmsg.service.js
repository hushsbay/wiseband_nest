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
exports.ChanmsgService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const typeorm_transactional_1 = require("typeorm-transactional");
const hush = require("../common/common");
const resjson_1 = require("../common/resjson");
const user_service_1 = require("../user/user.service");
const mail_service_1 = require("../mail/mail.service");
const chanmsg_entity_1 = require("./chanmsg.entity");
const user_entity_1 = require("../user/user.entity");
let ChanmsgService = class ChanmsgService {
    constructor(msgmstRepo, msgsubRepo, msgdtlRepo, chanmstRepo, chandtlRepo, grmstRepo, grdtlRepo, userRepo, dataSource, userSvc, mailSvc, req) {
        this.msgmstRepo = msgmstRepo;
        this.msgsubRepo = msgsubRepo;
        this.msgdtlRepo = msgdtlRepo;
        this.chanmstRepo = chanmstRepo;
        this.chandtlRepo = chandtlRepo;
        this.grmstRepo = grmstRepo;
        this.grdtlRepo = grdtlRepo;
        this.userRepo = userRepo;
        this.dataSource = dataSource;
        this.userSvc = userSvc;
        this.mailSvc = mailSvc;
        this.req = req;
    }
    async chkAcl(dto) {
        const methodName = 'chanmsg>chkAcl';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            let data = { chanmst: null, chandtl: [], msgmst: null };
            const { userid, grid, chanid, msgid, includeBlob, chkAuthor, chkGuest } = dto;
            const chanmst = await this.chanmstRepo.createQueryBuilder('A')
                .select(['A.CHANNM', 'A.TYP', 'A.GR_ID', 'A.MASTERID', 'A.MASTERNM', 'A.STATE'])
                .where("A.CHANID = :chanid ", {
                chanid: chanid
            }).getOne();
            if (!chanmst) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, methodName + '>chanmst');
            }
            let grnm = '';
            if (chanmst.TYP == 'GS') {
            }
            else {
                if (grid) {
                    if (grid != chanmst.GR_ID) {
                        return hush.setResJson(resJson, '요청한 grid와 chanid가 속한 grid가 다릅니다.' + fv, hush.Code.NOT_OK, null, methodName + '>grid');
                    }
                }
                const gr = await this.grmstRepo.createQueryBuilder('A')
                    .select(['A.GR_NM'])
                    .innerJoin('A.dtl', 'B', 'A.GR_ID = B.GR_ID')
                    .where("A.GR_ID = :grid and B.USERID = :userid ", {
                    grid: chanmst.GR_ID, userid: userid
                }).getOne();
                if (!gr) {
                    return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (이 채널의 그룹에 해당 사용자가 없습니다)' + fv, hush.Code.NOT_FOUND, null, methodName + '>gr');
                }
                grnm = gr.GR_NM;
            }
            data.chanmst = chanmst;
            data.chanmst.GR_NM = grnm;
            let sql = "SELECT USERID, USERNM, STATE, KIND, SYNC ";
            sql += "     FROM S_CHANDTL_TBL ";
            sql += "    WHERE CHANID = ? ";
            sql += "    ORDER BY USERNM ";
            const chandtl = await this.dataSource.query(sql, [chanid]);
            if (chandtl.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, methodName + '>chandtl');
            }
            for (let item of chandtl) {
                if (item.USERID == userid) {
                    data.chanmst.USERID = item.USERID;
                    data.chanmst.KIND = item.KIND;
                }
                if (item.SYNC == 'Y') {
                    const user = await this.userRepo.findOneBy({ USERID: item.USERID });
                    if (user) {
                        item.ORG = user.TOP_ORG_NM + '/' + user.ORG_NM;
                        item.JOB = user.JOB;
                        item.EMAIL = user.EMAIL;
                        item.TELNO = user.TELNO;
                        item.RMKS = '';
                        if (includeBlob)
                            item.PICTURE = user.PICTURE;
                    }
                }
                else {
                    const grdtl = await this.grdtlRepo.findOneBy({ USERID: item.USERID });
                    if (grdtl) {
                        item.ORG = grdtl.ORG;
                        item.JOB = grdtl.JOB;
                        item.EMAIL = grdtl.EMAIL;
                        item.TELNO = grdtl.TELNO;
                        item.RMKS = grdtl.RMKS;
                        item.PICTURE = null;
                    }
                }
            }
            if (data.chanmst.STATE == 'A') {
            }
            else if (data.chanmst.STATE == 'M') {
                if (data.chanmst.MASTERID != userid) {
                    return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (M)' + fv, hush.Code.NOT_AUTHORIZED, null, methodName);
                }
            }
            else {
                if (!data.chanmst.USERID) {
                    return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (P)' + fv, hush.Code.NOT_AUTHORIZED, null, methodName);
                }
            }
            data.chandtl = chandtl;
            if (msgid && msgid != userid) {
                let msgmst = await this.msgmstRepo.createQueryBuilder('A')
                    .select(['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.KIND', 'A.REPLYTO', 'A.CDT', 'A.UDT'])
                    .where("A.MSGID = :msgid and A.CHANID = :chanid ", {
                    msgid: msgid, chanid: chanid
                }).getOne();
                if (!msgmst) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, methodName + '>msgmst');
                }
                if (chkAuthor && userid != msgmst.AUTHORID) {
                    return hush.setResJson(resJson, '작성자가 다릅니다.' + fv, hush.Code.NOT_OK, null, methodName + 'chkAuthor');
                }
                data.msgmst = msgmst;
            }
            else if (chkGuest) {
                if (data.chanmst.KIND != 'admin' && data.chanmst.KIND != 'member') {
                    return hush.setResJson(resJson, '게스트(사용자)는 열람만 가능합니다.' + fv, hush.Code.NOT_OK, this.req, methodName + 'chkGuest');
                }
            }
            resJson.data = data;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryMsgDtlForUser(qb, msgid, chanid, userid) {
        const retObj = { act_later: null, act_fixed: null };
        const msgdtlforuser = await qb
            .select([
            'B.KIND KIND',
            'CASE WHEN KIND in ("later", "stored", "finished") THEN "act_later" ' +
                'WHEN KIND in ("fixed") THEN "act_fixed" ' +
                'else "" end KIND_ACTION'
        ])
            .where("B.MSGID = :msgid and B.CHANID = :chanid and B.USERID = :userid and B.TYP = 'user' ", {
            msgid: msgid, chanid: chanid, userid: userid
        }).getRawMany();
        for (let j = 0; j < msgdtlforuser.length; j++) {
            if (msgdtlforuser[j].KIND_ACTION == 'act_later') {
                retObj.act_later = msgdtlforuser[j].KIND;
            }
            else if (msgdtlforuser[j].KIND_ACTION == 'act_fixed') {
                retObj.act_fixed = msgdtlforuser[j].KIND;
            }
        }
        return retObj;
    }
    async qryMsgDtl(qb, msgid, chanid) {
        const msgdtl = await qb
            .select(['B.KIND KIND', 'COUNT(B.KIND) CNT', 'GROUP_CONCAT(B.USERNM ORDER BY B.USERNM SEPARATOR ", ") NM', 'GROUP_CONCAT(B.USERID ORDER BY B.USERID SEPARATOR ", ") ID'])
            .where("B.MSGID = :msgid and B.CHANID = :chanid and B.TYP in ('read', 'react') ", {
            msgid: msgid, chanid: chanid
        }).groupBy('B.KIND').orderBy('B.KIND', 'ASC').getRawMany();
        return (msgdtl.length > 0) ? msgdtl : [];
    }
    async qryMsgDtlMention(qb, msgid, chanid) {
        let sql = "SELECT USERID, USERNM ";
        sql += "     FROM S_MSGDTL_TBL ";
        sql += "    WHERE MSGID = ? AND CHANID = ? AND KIND = 'mention' ";
        sql += "    ORDER BY USERNM ";
        const msgdtl = await this.dataSource.query(sql, [msgid, chanid]);
        return (msgdtl.length > 0) ? msgdtl : [];
    }
    async qryMsgSub(qb, msgid, chanid) {
        const msgsub = await qb
            .select(['C.KIND', 'C.CDT', 'C.BODY', 'C.BUFFER', 'C.FILESIZE'])
            .where("C.MSGID = :msgid and C.CHANID = :chanid ", {
            msgid: msgid, chanid: chanid
        }).orderBy('C.KIND', 'ASC').addOrderBy('C.CDT', 'ASC').getMany();
        if (msgsub.length > 0) {
            const msgfile = msgsub.filter((val) => val.KIND == 'F' || val.KIND == 'f');
            const msgimg = msgsub.filter((val) => val.KIND == 'I' || val.KIND == 'i');
            const msglink = msgsub.filter((val) => val.KIND == 'L');
            return { msgfile: msgfile, msgimg: msgimg, msglink: msglink };
        }
        else {
            return { msgfile: [], msgimg: [], msglink: [] };
        }
    }
    async qryReply(qb, msgid, chanid) {
        const reply = await qb
            .select('AUTHORID').addSelect('AUTHORNM')
            .distinct(true)
            .where("CHANID = :chanid and REPLYTO = :msgid ", {
            chanid: chanid, msgid: msgid
        }).groupBy('AUTHORID').addGroupBy('AUTHORNM')
            .orderBy('AUTHORNM', 'ASC').limit(hush.cons.replyCntLimit).getRawMany();
        return (reply.length > 0) ? reply : [];
    }
    async qryReplyInfo(msgid, chanid, userid) {
        let sql = "SELECT SUM(CNT) CNT_BY_USER, ";
        sql += "          (SELECT COUNT(*) FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = ?) CNT_EACH, ";
        sql += "          (SELECT MAX(CDT) FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = ?) CDT_MAX ";
        sql += "     FROM (SELECT 1 CNT ";
        sql += "             FROM S_MSGMST_TBL ";
        sql += "            WHERE CHANID = ? AND REPLYTO = ? ";
        sql += "            GROUP BY AUTHORID) Z ";
        const replyInfo = await this.dataSource.query(sql, [chanid, msgid, chanid, msgid, chanid, msgid]);
        sql = "SELECT COUNT(*) MYNOTYETCNT ";
        sql += " FROM S_MSGDTL_TBL ";
        sql += "WHERE MSGID IN (SELECT MSGID FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = ?) ";
        sql += "  AND CHANID = ? AND USERID = ? AND KIND = 'notyet'  ";
        const replyUnread = await this.dataSource.query(sql, [chanid, msgid, chanid, userid]);
        replyInfo[0].MYNOTYETCNT = replyUnread[0].MYNOTYETCNT;
        return replyInfo;
    }
    getSqlWs(userid) {
        let sqlWs = "SELECT X.GR_ID, X.GR_NM, Y.CHANID, Y.CHANNM ";
        sqlWs += "     FROM (SELECT A.GR_ID, A.GR_NM ";
        sqlWs += "             FROM S_GRMST_TBL A ";
        sqlWs += "            INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID ";
        sqlWs += "            WHERE B.USERID = '" + userid + "') X ";
        sqlWs += "             LEFT OUTER JOIN (SELECT A.CHANID, A.CHANNM, A.GR_ID ";
        sqlWs += "                                FROM S_CHANMST_TBL A ";
        sqlWs += "                               INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID ";
        sqlWs += "                               WHERE B.USERID = '" + userid + "' ";
        sqlWs += "                               UNION ALL ";
        sqlWs += "                              SELECT A.CHANID, A.CHANNM, A.GR_ID ";
        sqlWs += "                                FROM S_CHANMST_TBL A ";
        sqlWs += "                               WHERE A.TYP = 'WS' AND A.STATE = 'A' ";
        sqlWs += "                                 AND A.CHANID NOT IN (SELECT CHANID FROM S_CHANDTL_TBL WHERE USERID = '" + userid + "') ";
        sqlWs += "          ) Y ON X.GR_ID = Y.GR_ID ";
        return sqlWs;
    }
    getSqlGs(userid) {
        let sqlGs = "      SELECT '' GR_ID, '' GR_NM, A.CHANID, A.CHANNM ";
        sqlGs += "           FROM S_CHANMST_TBL A ";
        sqlGs += "          INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID ";
        sqlGs += "          WHERE B.USERID = '" + userid + "' AND A.TYP = 'GS' ";
        return sqlGs;
    }
    async qry(dto) {
        const methodName = 'chanmsg>qry';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            let data = {
                chanmst: null, chandtl: [], msglist: [], tempfilelist: [], tempimagelist: [], templinklist: [],
                msgidParent: '', msgidChild: '', vipStr: null, logdt: null
            };
            const { chanid, prevMsgMstCdt, nextMsgMstCdt, msgid, kind, msgidReply } = dto;
            console.log("qry@@@", prevMsgMstCdt, nextMsgMstCdt, msgid, kind, msgidReply);
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, includeBlob: true });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            data.chanmst = rs.data.chanmst;
            data.chandtl = rs.data.chandtl;
            const viplist = await this.userSvc.getVipList(userid);
            data.vipStr = viplist[0].VIPS;
            const qb = this.msgmstRepo.createQueryBuilder('A');
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B');
            const qbSub = this.msgsubRepo.createQueryBuilder('C');
            const fldArr = ['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.KIND', 'A.CDT', 'A.UDT'];
            let msglist;
            if (nextMsgMstCdt) {
                if (kind == 'scrollToBottom') {
                    if (msgidReply) {
                        msglist = await qb.select(fldArr)
                            .where("A.CHANID = :chanid and A.CDT > :nextcdt and A.REPLYTO = :msgidReply ", {
                            chanid: chanid, nextcdt: nextMsgMstCdt, msgidReply: msgidReply
                        }).orderBy('A.CDT', 'ASC').getMany();
                    }
                    else {
                        msglist = await qb.select(fldArr)
                            .where("A.CHANID = :chanid and A.CDT > :nextcdt and A.REPLYTO = '' ", {
                            chanid: chanid, nextcdt: nextMsgMstCdt
                        }).orderBy('A.CDT', 'ASC').getMany();
                    }
                }
                else {
                    msglist = await qb.select(fldArr)
                        .where("A.CHANID = :chanid and A.CDT > :nextcdt and A.REPLYTO = '' ", {
                        chanid: chanid, nextcdt: nextMsgMstCdt
                    }).orderBy('A.CDT', 'ASC').limit(hush.cons.rowsCnt).getMany();
                }
            }
            else if (prevMsgMstCdt) {
                msglist = await qb.select(fldArr)
                    .where("A.CHANID = :chanid and A.CDT < :prevcdt and A.REPLYTO = '' ", {
                    chanid: chanid, prevcdt: prevMsgMstCdt
                }).orderBy('A.CDT', 'DESC').limit(hush.cons.rowsCnt).getMany();
            }
            else if (msgid && kind == 'atHome') {
                let msgmst = await this.msgmstRepo.createQueryBuilder('A')
                    .select(['A.REPLYTO'])
                    .where("A.MSGID = :msgid and A.CHANID = :chanid ", {
                    msgid: msgid, chanid: chanid
                }).getOne();
                if (!msgmst) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, methodName);
                }
                const msgidParent = msgmst.REPLYTO ? msgmst.REPLYTO : msgid;
                const fields = fldArr.join(", ").replace(/A\./g, "") + " ";
                const tbl = "FROM S_MSGMST_TBL ";
                const where = "WHERE CHANID = '" + chanid + "' AND REPLYTO = '' ";
                const cnt = Math.floor(hush.cons.rowsCnt / 2);
                let sql = "SELECT " + fields;
                sql += "     FROM ((SELECT " + fields + tbl + where;
                sql += "               AND MSGID < ? ";
                sql += "             ORDER BY CDT DESC LIMIT " + cnt + ") ";
                sql += "             UNION ALL ";
                sql += "           (SELECT " + fields + tbl + where;
                sql += "               AND MSGID = ?) ";
                sql += "             UNION ALL ";
                sql += "           (SELECT " + fields + tbl + where;
                sql += "               AND MSGID > ? ";
                sql += "             ORDER BY CDT ASC LIMIT " + cnt + ")) Z ";
                sql += "    ORDER BY CDT DESC ";
                msglist = await this.dataSource.query(sql, [msgidParent, msgidParent, msgidParent]);
                if (msglist.length == 0) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, methodName);
                }
                data.msgidParent = msgidParent;
                data.msgidChild = msgid;
            }
            else if (msgid && kind == 'withReply') {
                const fields = fldArr.join(", ").replace(/A\./g, "") + " ";
                const tbl = "FROM S_MSGMST_TBL ";
                let sql = "";
                sql = "SELECT " + fields + tbl + " WHERE MSGID = ? AND CHANID = ? ";
                sql += "    UNION ALL ";
                sql += "   SELECT " + fields + tbl + " WHERE REPLYTO = ? AND CHANID = ? ";
                sql += "    ORDER BY CDT ASC ";
                msglist = await this.dataSource.query(sql, [msgid, chanid, msgid, chanid]);
                if (msglist.length == 0) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, methodName);
                }
            }
            else if (kind == 'notyet' || kind == 'unread') {
                const curDt = new Date();
                const dtMinus = new Date(curDt.getFullYear() - 1, curDt.getMonth(), curDt.getDate());
                const dtMinusStr = hush.getDateTimeStr(dtMinus, true, false);
                const fields = fldArr.join(", ") + " ";
                const fieldz = fldArr.join(", ").replace(/A\./g, "Z.") + " ";
                let sql = "SELECT DISTINCT " + fieldz;
                sql += "     FROM (SELECT " + fields;
                sql += "             FROM S_MSGMST_TBL A ";
                sql += "             LEFT OUTER JOIN S_MSGDTL_tbl B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID ";
                sql += "            WHERE A.CHANID = ? AND A.REPLYTO = '' AND B.USERID = ? AND B.KIND = ? AND A.CDT >= ? ";
                sql += "            UNION ALL ";
                sql += "           SELECT " + fields;
                sql += "             FROM S_MSGMST_TBL A ";
                sql += "            WHERE A.MSGID IN (SELECT A.REPLYTO ";
                sql += "                                FROM S_MSGMST_TBL A ";
                sql += "                                LEFT OUTER JOIN S_MSGDTL_tbl B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID ";
                sql += "                               WHERE A.CHANID = ? AND A.REPLYTO <> '' AND B.USERID = ? AND B.KIND = ? AND A.CDT >= ?) ";
                sql += "              AND A.CHANID = ?) Z ";
                sql += "    ORDER BY Z.CDT DESC ";
                sql += "    LIMIT " + hush.cons.rowsCntForNotyet;
                msglist = await this.dataSource.query(sql, [chanid, userid, kind, dtMinusStr, chanid, userid, kind, dtMinusStr, chanid]);
            }
            let sqlLast = "SELECT MSGID, CDT FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = '' ORDER BY CDT DESC LIMIT 1 ";
            const realLastList = await this.dataSource.query(sqlLast, [chanid]);
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            if (msglist && msglist.length > 0)
                data.msglist = msglist;
            for (let i = 0; i < data.msglist.length; i++) {
                const item = data.msglist[i];
                const msgdtlforuser = await this.qryMsgDtlForUser(qbDtl, item.MSGID, chanid, userid);
                item.act_later = msgdtlforuser.act_later;
                item.act_fixed = msgdtlforuser.act_fixed;
                const msgdtl = await this.qryMsgDtl(qbDtl, item.MSGID, chanid);
                item.msgdtl = (msgdtl.length > 0) ? msgdtl : [];
                const msgdtlmention = await this.qryMsgDtlMention(qbDtl, item.MSGID, chanid);
                item.msgdtlmention = (msgdtlmention.length > 0) ? msgdtlmention : [];
                const msgsub = await this.qryMsgSub(qbSub, item.MSGID, chanid);
                item.msgfile = msgsub.msgfile;
                item.msgimg = msgsub.msgimg;
                item.msglink = msgsub.msglink;
                const reply = await this.qryReply(qb, item.MSGID, chanid);
                item.reply = (reply.length > 0) ? reply : [];
                const replyInfo = await this.qryReplyInfo(item.MSGID, chanid, userid);
                item.replyinfo = replyInfo;
                if (kind == 'scrollToBottom') {
                    const logObj = {
                        cdt: curdtObj.DT.replace('2025-', '1111-'), msgid: item.MSGID, replyto: '', chanid: chanid,
                        userid: userid, usernm: '', cud: 'Z', kind: '', typ: '', bodytext: ''
                    };
                    const ret = await hush.insertDataLog(this.dataSource, logObj);
                    if (ret != '')
                        throw new Error(ret);
                }
            }
            const arr = ['F', 'I', 'L'];
            for (let i = 0; i < arr.length; i++) {
                const msgsub = await qbSub
                    .select(['C.CDT', 'C.BODY', 'C.BUFFER', 'C.FILESIZE'])
                    .where("C.MSGID = :userid and C.CHANID = :chanid and C.KIND = :kind ", {
                    userid: userid, chanid: chanid, kind: arr[i]
                }).orderBy('C.CDT', 'ASC').getMany();
                if (msgsub.length > 0) {
                    if (i == 0) {
                        data.tempfilelist = msgsub;
                    }
                    else if (i == 1) {
                        data.tempimagelist = msgsub;
                    }
                    else {
                        data.templinklist = msgsub;
                    }
                }
            }
            data.logdt = curdtObj.DT;
            resJson.list = realLastList;
            resJson.data = data;
            console.log("qry!!!", prevMsgMstCdt, nextMsgMstCdt, msgid, kind, msgidReply);
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryChanMstDtl(dto) {
        const methodName = 'chanmsg>qryChanMstDtl';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { chanid, state } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, includeBlob: true });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            resJson.data.chanmst = rs.data.chanmst;
            resJson.data.chandtl = rs.data.chandtl;
            if (rs.data.chanmst.TYP == "GS") {
                let sql = "SELECT (SELECT COUNT(*) FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) CNT, (SELECT GROUP_CONCAT(USERID) FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) MEM ";
                sql += "     FROM S_CHANDTL_TBL A ";
                sql += "    WHERE CHANID = ? AND USERID = ? ";
                sql += "    ORDER BY USERID ";
                const mychan = await this.dataSource.query(sql, [chanid, userid]);
                if (mychan.length > 0) {
                    sql = "SELECT Y.CHANID, Y.CNT, Y.MEM ";
                    sql += " FROM (SELECT Z.CHANID, Z.CNT, (SELECT GROUP_CONCAT(USERID) FROM S_CHANDTL_TBL WHERE CHANID = Z.CHANID) MEM ";
                    sql += "         FROM (SELECT A.CHANID, (SELECT COUNT(*) GTOM FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) CNT ";
                    sql += "                 FROM S_CHANDTL_TBL A ";
                    sql += "                INNER JOIN S_CHANMST_TBL B ON A.CHANID = B.CHANID ";
                    sql += "                WHERE A.USERID = ? AND B.GR_ID = 'GS' ";
                    sql += "                ORDER BY USERID) Z ";
                    sql += "         WHERE Z.CNT = ?) Y ";
                    sql += " WHERE Y.MEM = ? ";
                    sql += "   AND Y.CHANID <> ? ";
                    const otherchan = await this.dataSource.query(sql, [userid, mychan[0].CNT, mychan[0].MEM, chanid]);
                    if (otherchan.length > 0)
                        resJson.data.chanidAlready = otherchan[0].CHANID;
                }
            }
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryOneMsgNotYet(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { chanid } = dto;
            let sql = "SELECT A.MSGID, CASE WHEN B.REPLYTO <> '' THEN B.REPLYTO ELSE A.MSGID END MSGIDOLD ";
            sql += "     FROM S_MSGDTL_TBL A ";
            sql += "    INNER JOIN S_MSGMST_TBL B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID ";
            sql += "    WHERE A.CHANID = ? AND A.USERID = ? AND A.KIND = 'notyet' ";
            sql += "    ORDER BY MSGIDOLD ASC ";
            sql += "    LIMIT 1 ";
            const list = await this.dataSource.query(sql, [chanid, userid]);
            resJson.list = list;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async searchMedia(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { chanid, prevMsgMstCdt, rdoOpt, kind, fileName, fileExt, frYm, toYm, authorNm, searchText } = dto;
            const kindStr = kind.substr(0, 1).toUpperCase();
            let frDash = hush.cons.cdtAtFirst, toDash = hush.cons.cdtAtLast;
            if (frYm.length == 6)
                frDash = frYm.substr(0, 4) + '-' + frYm.substr(4, 2);
            if (toYm.length == 6)
                toDash = toYm.substr(0, 4) + '-' + toYm.substr(4, 2) + '-99';
            const bufferFieldA = kind == 'image' ? ', A.BUFFER ' : '';
            const bufferField = kind == 'image' ? ', BUFFER ' : '';
            const bufferFieldR = kind == 'image' ? ', R.BUFFER ' : '';
            const sqlWs = this.getSqlWs(userid);
            const sqlGs = this.getSqlGs(userid);
            let sql = "SELECT P.GR_ID, P.GR_NM, P.CHANID, P.CHANNM, R.MSGID, R.CHANID, R.KIND, R.CDTSUB, R.BODY, R.CDT, R.UDT, R.FILESIZE, R.AUTHORID, R.AUTHORNM, R.REPLYTO, R.BODYTEXT, R.TYP, R.STATE " + bufferFieldR;
            sql += "     FROM ( ";
            if (rdoOpt == 'chan') {
                sql += sqlWs;
            }
            else if (rdoOpt == 'dm') {
                sql += sqlGs;
            }
            else {
                sql += sqlWs + " UNION ALL " + sqlGs;
            }
            sql += "           ) P ";
            sql += "    INNER JOIN ( ";
            sql += "   SELECT MSGID, CHANID, KIND, CDTSUB, BODY, CDT, UDT, FILESIZE, AUTHORID, AUTHORNM, REPLYTO, BODYTEXT, TYP, STATE " + bufferField;
            sql += "     FROM (SELECT A.MSGID, B.CHANID, A.KIND, A.CDT CDTSUB, A.BODY, B.CDT, B.UDT, A.FILESIZE, B.AUTHORID, B.AUTHORNM, B.REPLYTO, B.BODYTEXT, C.TYP, C.STATE " + bufferFieldA;
            sql += "             FROM S_MSGSUB_TBL A ";
            sql += "            INNER JOIN S_MSGMST_TBL B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID ";
            sql += "            INNER JOIN S_CHANMST_TBL C ON A.CHANID = C.CHANID ";
            sql += "            WHERE B.CDT >= '" + frDash + "' AND B.CDT <= '" + toDash + "' ";
            if (chanid)
                sql += "  AND B.CHANID = '" + chanid + "' ";
            if (rdoOpt == 'chan') {
                sql += "          AND C.TYP = 'WS' ";
            }
            else if (rdoOpt == 'dm') {
                sql += "          AND C.TYP = 'GS' ";
            }
            sql += "              AND A.KIND = '" + kindStr + "' ";
            if (kindStr == 'F' && fileExt != '')
                sql += " AND A.FILEEXT = '" + fileExt + "' ";
            if (authorNm != '')
                sql += " AND LOWER(B.AUTHORNM) LIKE '%" + authorNm.toLowerCase() + "%' ";
            if (searchText != '')
                sql += " AND (LOWER(B.BODYTEXT) LIKE '%" + searchText + "%' OR LOWER(A.BODY) LIKE '%" + searchText.toLowerCase() + "%') ";
            sql += "    ) Q ) R ON P.CHANID = R.CHANID ";
            sql += "    WHERE R.CDT < ? ";
            sql += "    ORDER BY R.CDT DESC ";
            sql += "    LIMIT " + hush.cons.rowsCnt;
            const list = await this.dataSource.query(sql, [prevMsgMstCdt]);
            resJson.list = list;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async searchMsg(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { chanid, prevMsgMstCdt, rdoOpt, frYm, toYm, authorNm, searchText } = dto;
            let frDash = hush.cons.cdtAtFirst, toDash = hush.cons.cdtAtLast;
            if (frYm.length == 6)
                frDash = frYm.substr(0, 4) + '-' + frYm.substr(4, 2);
            if (toYm.length == 6)
                toDash = toYm.substr(0, 4) + '-' + toYm.substr(4, 2) + '-99';
            const sqlWs = this.getSqlWs(userid);
            const sqlGs = this.getSqlGs(userid);
            let sql = "SELECT P.GR_ID, P.GR_NM, P.CHANID, P.CHANNM, R.MSGID, R.AUTHORID, R.AUTHORNM, R.REPLYTO, R.BODYTEXT, R.CDT, R.UDT, R.TYP, R.STATE ";
            sql += "     FROM ( ";
            if (rdoOpt == 'chan') {
                sql += sqlWs;
            }
            else if (rdoOpt == 'dm') {
                sql += sqlGs;
            }
            else {
                sql += sqlWs + " UNION ALL " + sqlGs;
            }
            sql += "           ) P ";
            sql += "    INNER JOIN ( ";
            sql += "   SELECT MSGID, CHANID, AUTHORID, AUTHORNM, REPLYTO, BODYTEXT, CDT, UDT, TYP, STATE ";
            sql += "     FROM (SELECT DISTINCT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, A.CDT, A.UDT, C.TYP, C.STATE ";
            sql += "             FROM S_MSGMST_TBL A ";
            sql += "            INNER JOIN S_CHANMST_TBL C ON A.CHANID = C.CHANID ";
            sql += "             LEFT OUTER JOIN S_MSGSUB_TBL B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID ";
            sql += "            WHERE A.CDT >= '" + frDash + "' AND A.CDT <= '" + toDash + "' ";
            if (chanid)
                sql += "  AND A.CHANID = '" + chanid + "' ";
            if (rdoOpt == 'chan') {
                sql += "          AND C.TYP = 'WS' ";
            }
            else if (rdoOpt == 'dm') {
                sql += "          AND C.TYP = 'GS' ";
            }
            if (authorNm != '')
                sql += " AND LOWER(A.AUTHORNM) LIKE '%" + authorNm.toLowerCase() + "%' ";
            if (searchText != '')
                sql += " AND (LOWER(A.BODYTEXT) LIKE '%" + searchText + "%' OR LOWER(B.BODY) LIKE '%" + searchText.toLowerCase() + "%') ";
            sql += "    ) Q ) R ON P.CHANID = R.CHANID ";
            sql += " WHERE R.CDT < ? ";
            sql += " ORDER BY R.CDT DESC ";
            sql += " LIMIT " + hush.cons.rowsCnt;
            const list = await this.dataSource.query(sql, [prevMsgMstCdt]);
            const qbSub = this.msgsubRepo.createQueryBuilder('C');
            for (let i = 0; i < list.length; i++) {
                const item = list[i];
                const msgsub = await this.qryMsgSub(qbSub, item.MSGID, item.CHANID);
                item.msgfile = msgsub.msgfile;
                item.msgimg = msgsub.msgimg;
                item.msglink = msgsub.msglink;
            }
            resJson.list = list;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryMsg(dto) {
        const methodName = 'chanmsg>qryMsg';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            let data = {
                chanmst: null, chandtl: [], msgmst: null, act_later: null, act_fixed: null, msgdtl: null, msgdtlmention: null,
                msgfile: null, msgimg: null, msglink: null, reply: null, replyinfo: null
            };
            const { chanid, msgid } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, includeBlob: true });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            data.chanmst = rs.data.chanmst;
            data.chandtl = rs.data.chandtl;
            const qb = this.msgmstRepo.createQueryBuilder('A');
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B');
            const qbSub = this.msgsubRepo.createQueryBuilder('C');
            const msgmst = await qb.select(['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.KIND', 'A.CDT', 'A.UDT'])
                .where("A.MSGID = :msgid and A.CHANID = :chanid ", {
                msgid: msgid, chanid: chanid
            }).getOne();
            data.msgmst = msgmst;
            const msgdtlforuser = await this.qryMsgDtlForUser(qbDtl, msgid, chanid, userid);
            data.act_later = msgdtlforuser.act_later;
            data.act_fixed = msgdtlforuser.act_fixed;
            const msgdtl = await this.qryMsgDtl(qbDtl, msgid, chanid);
            data.msgdtl = (msgdtl.length > 0) ? msgdtl : [];
            const msgdtlmention = await this.qryMsgDtlMention(qbDtl, msgid, chanid);
            data.msgdtlmention = (msgdtlmention.length > 0) ? msgdtlmention : [];
            const msgsub = await this.qryMsgSub(qbSub, msgid, chanid);
            data.msgfile = msgsub.msgfile;
            data.msgimg = msgsub.msgimg;
            data.msglink = msgsub.msglink;
            const reply = await this.qryReply(qb, msgid, chanid);
            data.reply = (reply.length > 0) ? reply : [];
            const replyInfo = await this.qryReplyInfo(msgid, chanid, userid);
            data.replyinfo = replyInfo;
            resJson.data = data;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryActionForUser(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { chanid, msgid } = dto;
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B');
            const msgdtlforuser = await this.qryMsgDtlForUser(qbDtl, msgid, chanid, userid);
            resJson.data = msgdtlforuser;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryAction(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { chanid, msgid } = dto;
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B');
            const msgdtl = await this.qryMsgDtl(qbDtl, msgid, chanid);
            resJson.list = msgdtl;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async saveMsg(dto) {
        const methodName = 'chanmsg>saveMsg';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            let { crud, chanid, replyto, body, bodytext, num_file, num_image, num_link } = dto;
            let msgid = dto.msgid;
            const bodyForLog = (bodytext.length > hush.cons.bodyLenForLog) ? bodytext.substring(0, hush.cons.bodyLenForLog) : bodytext;
            let subkind = '';
            if (crud == 'C' || crud == 'U') {
                if (!chanid || (!body && num_file == 0 && num_image == 0 && num_link == 0)) {
                    return hush.setResJson(resJson, hush.Msg.BLANK_DATA + fv, hush.Code.BLANK_DATA, this.req, methodName);
                }
                let rs;
                if (crud == 'C') {
                    if (replyto) {
                        rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: replyto, chkGuest: true });
                    }
                    else {
                        rs = await this.chkAcl({ userid: userid, chanid: chanid, chkGuest: true });
                    }
                }
                else {
                    rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid, chkAuthor: true });
                }
                if (rs.code != hush.Code.OK)
                    return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
                if (rs.data.chanmst.STATE == 'M') {
                    await this.chanmstRepo.createQueryBuilder()
                        .update()
                        .set({ STATE: 'P' })
                        .where("CHANID = :chanid ", {
                        chanid: chanid
                    }).execute();
                }
                subkind = rs.data.chanmst.TYP;
            }
            else {
                return hush.setResJson(resJson, 'crud값은 C/U중 하나여야 합니다.' + fv, hush.Code.NOT_OK, this.req, methodName);
            }
            const unidObj = await hush.getMysqlUnid(this.dataSource);
            const qbMsgMst = this.msgmstRepo.createQueryBuilder();
            if (crud == 'C') {
                msgid = unidObj.ID;
                await qbMsgMst
                    .insert().values({
                    MSGID: msgid, CHANID: chanid, AUTHORID: userid, AUTHORNM: usernm, REPLYTO: replyto ? replyto : '', BODY: body, BODYTEXT: bodytext,
                    CDT: unidObj.DT, UDT: unidObj.DT
                }).execute();
                const qbMsgSub = this.msgsubRepo.createQueryBuilder();
                let arr = [];
                if (num_file > 0)
                    arr.push('F');
                if (num_image > 0)
                    arr.push('I');
                if (num_link > 0)
                    arr.push('L');
                for (let i = 0; i < arr.length; i++) {
                    const msgsub = await qbMsgSub
                        .select("COUNT(*) CNT")
                        .where("MSGID = :userid and CHANID = :chanid and KIND = :kind ", {
                        userid: userid, chanid: chanid, kind: arr[i]
                    }).getRawOne();
                    if (msgsub.CNT > 0) {
                        await qbMsgSub
                            .update()
                            .set({ MSGID: msgid })
                            .where("MSGID = :userid and CHANID = :chanid and KIND = :kind ", {
                            userid: userid, chanid: chanid, kind: arr[i]
                        }).execute();
                    }
                }
                resJson.data.msgid = msgid;
                resJson.data.replyto = replyto;
            }
            else {
                await qbMsgMst
                    .update()
                    .set({ BODY: body, BODYTEXT: bodytext, UDT: unidObj.DT })
                    .where("MSGID = :msgid and CHANID = :chanid ", {
                    msgid: msgid, chanid: chanid
                }).execute();
                let sql = "DELETE FROM S_MSGDTL_TBL WHERE MSGID = ? AND CHANID = ? AND KIND IN ('notyet', 'read', 'unread') ";
                await this.dataSource.query(sql, [msgid, chanid]);
            }
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder();
            const chandtl = await this.chandtlRepo.createQueryBuilder('A')
                .select(['A.USERID', 'A.USERNM'])
                .where("A.CHANID = :chanid ", {
                chanid: chanid
            }).getMany();
            chandtl.forEach(async (item) => {
                const strKind = (item.USERID == userid) ? 'read' : 'notyet';
                const typ = hush.getTypeForMsgDtl(strKind);
                await qbMsgDtl
                    .insert().values({
                    MSGID: msgid, CHANID: chanid, USERID: item.USERID, KIND: strKind, TYP: typ, CDT: unidObj.DT, UDT: unidObj.DT, USERNM: item.USERNM
                }).execute();
            });
            let cud = crud;
            const kind = replyto ? 'child' : 'parent';
            let typ = hush.getTypeForMsgDtl(kind);
            const logObj = {
                cdt: unidObj.DT, msgid: msgid, replyto: replyto ? replyto : '', chanid: chanid,
                userid: userid, usernm: usernm, cud: cud, kind: kind, typ: typ, bodytext: bodyForLog, subkind: subkind
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
    async forwardToChan(dto) {
        const methodName = 'chanmsg>forwardToChan';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { kind, chanid, msgid, targetChanid } = dto;
            let rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            rs = await this.chkAcl({ userid: userid, chanid: targetChanid, chkGuest: true });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            const unidObj = await hush.getMysqlUnid(this.dataSource);
            let sql = "INSERT INTO S_MSGMST_TBL (MSGID, CHANID, AUTHORID, AUTHORNM, BODY, BODYTEXT, KIND, CDT, UDT) ";
            sql += "   SELECT ?, ?, ?, ?, BODY, BODYTEXT, KIND, ?, '' ";
            sql += "     FROM S_MSGMST_TBL ";
            sql += "    WHERE MSGID = ? AND CHANID = ? ";
            await this.dataSource.query(sql, [unidObj.ID, targetChanid, userid, usernm, unidObj.DT, msgid, chanid]);
            resJson.data.newMsgid = unidObj.ID;
            sql = "INSERT INTO S_MSGSUB_TBL (MSGID, CHANID, KIND, BODY, FILESIZE, FILEEXT, BUFFER, CDT, UDT) ";
            sql += "SELECT ?, ?, KIND, BODY, FILESIZE, FILEEXT, BUFFER, ?, ? ";
            sql += "  FROM S_MSGSUB_TBL ";
            sql += " WHERE MSGID = ? AND CHANID = ? ";
            await this.dataSource.query(sql, [unidObj.ID, targetChanid, unidObj.DT, unidObj.DT, msgid, chanid]);
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder();
            const chandtl = await this.chandtlRepo.createQueryBuilder('A')
                .select(['A.USERID', 'A.USERNM'])
                .where("A.CHANID = :chanid ", {
                chanid: targetChanid
            }).getMany();
            chandtl.forEach(async (item) => {
                const strKind = (item.USERID == userid) ? 'read' : 'notyet';
                const typ = hush.getTypeForMsgDtl(strKind);
                await qbMsgDtl
                    .insert().values({
                    MSGID: unidObj.ID, CHANID: targetChanid, USERID: item.USERID, KIND: strKind, TYP: typ, CDT: unidObj.DT, UDT: unidObj.DT, USERNM: item.USERNM
                }).execute();
            });
            const kind1 = 'parent';
            let typ = hush.getTypeForMsgDtl(kind1);
            const logObj = {
                cdt: unidObj.DT, msgid: unidObj.ID, replyto: '', chanid: targetChanid,
                userid: userid, usernm: usernm, cud: 'C', kind: kind1, typ: typ, bodytext: msgid, subkind: kind == 'home' ? 'WS' : 'GS'
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
    async delMsg(dto) {
        const methodName = 'chanmsg>delMsg';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { msgid, chanid } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid, chkAuthor: true });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            const msgReply = await this.msgmstRepo.findOneBy({ REPLYTO: msgid, CHANID: chanid });
            if (msgReply)
                return hush.setResJson(resJson, '댓글이 있습니다.', hush.Code.NOT_OK, this.req, methodName);
            let msgidParent = '';
            let msgmst = await this.msgmstRepo.createQueryBuilder('A')
                .select(['A.REPLYTO'])
                .where("A.MSGID = :msgid and A.CHANID = :chanid ", {
                msgid: msgid, chanid: chanid
            }).getOne();
            if (msgmst)
                msgidParent = msgmst.REPLYTO ? msgmst.REPLYTO : msgid;
            let sql = "INSERT INTO S_MSGMSTDEL_TBL (MSGID, CHANID, AUTHORID, AUTHORNM, BODY, BODYTEXT, REPLYTO, KIND, CDT, UDT) ";
            sql += "   SELECT MSGID, CHANID, AUTHORID, AUTHORNM, BODY, BODYTEXT, REPLYTO, KIND, CDT, UDT ";
            sql += "     FROM S_MSGMST_TBL ";
            sql += "    WHERE MSGID = ? AND CHANID = ? AND AUTHORID = ? ";
            await this.dataSource.query(sql, [msgid, chanid, userid]);
            sql = " INSERT INTO S_MSGSUBDEL_TBL (MSGID, CHANID, KIND, BODY, BUFFER, FILESIZE, CDT, UDT) ";
            sql += "SELECT MSGID, CHANID, KIND, BODY, BUFFER, FILESIZE, CDT, UDT ";
            sql += "     FROM S_MSGSUB_TBL ";
            sql += "    WHERE MSGID = ? AND CHANID = ? ";
            await this.dataSource.query(sql, [msgid, chanid]);
            sql = " INSERT INTO S_MSGDTLDEL_TBL (MSGID, CHANID, USERID, USERNM, KIND, BODY, CDT, UDT) ";
            sql += "SELECT MSGID, CHANID, USERID, USERNM, KIND, BODY, CDT, UDT ";
            sql += "     FROM S_MSGDTL_TBL ";
            sql += "    WHERE MSGID = ? AND CHANID = ? ";
            await this.dataSource.query(sql, [msgid, chanid]);
            await this.msgmstRepo.createQueryBuilder()
                .delete().where("MSGID = :msgid and CHANID = :chanid ", {
                msgid: msgid, chanid: chanid
            }).execute();
            await this.msgsubRepo.createQueryBuilder()
                .delete().where("MSGID = :msgid and CHANID = :chanid ", {
                msgid: msgid, chanid: chanid
            }).execute();
            await this.msgdtlRepo.createQueryBuilder()
                .delete().where("MSGID = :msgid and CHANID = :chanid ", {
                msgid: msgid, chanid: chanid
            }).execute();
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            const kind = msgmst.REPLYTO ? 'child' : 'parent';
            const typ = hush.getTypeForMsgDtl(kind);
            const logObj = {
                cdt: curdtObj.DT, msgid: msgid, replyto: msgmst.REPLYTO ? msgmst.REPLYTO : '', chanid: chanid,
                userid: userid, usernm: usernm, cud: 'D', kind: kind, typ: typ, bodytext: ''
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
    async toggleChanOption(dto) {
        const methodName = 'chanmsg>toggleChanOption';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { chanid, kind, job } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: chanid });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            const qbChanDtl = this.chandtlRepo.createQueryBuilder();
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            const chandtl = await qbChanDtl
                .select("COUNT(*) CNT")
                .where("CHANID = :chanid and USERID = :userid ", {
                chanid: chanid, userid: userid
            }).getRawOne();
            if (chandtl.CNT == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, methodName);
            }
            else {
                let obj = { MODR: userid, UDT: curdtObj.DT };
                if (kind == "noti") {
                    Object.assign(obj, { NOTI: job });
                }
                else if (kind == "bookmark") {
                    Object.assign(obj, { BOOKMARK: job });
                }
                else {
                    return hush.setResJson(resJson, 'kind값이 잘못되었습니다.' + fv, hush.Code.NOT_OK, this.req, methodName);
                }
                await qbChanDtl
                    .update()
                    .set(obj)
                    .where("CHANID = :chanid and USERID = :userid ", {
                    chanid: chanid, userid: userid
                }).execute();
            }
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async updateWithNewKind(dto) {
        const methodName = 'chanmsg>updateWithNewKind';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { msgid, chanid, oldKind, newKind } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder('B');
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            let sql = " SELECT COUNT(*) CNT FROM S_MSGDTL_TBL WHERE MSGID = ? AND CHANID = ? AND USERID = ? AND KIND = ? ";
            const ret = await this.dataSource.query(sql, [msgid, chanid, userid, newKind]);
            if (ret[0].CNT > 0) {
                sql = " DELETE FROM S_MSGDTL_TBL WHERE MSGID = ? AND CHANID = ? AND USERID = ? AND KIND = ? ";
                await this.dataSource.query(sql, [msgid, chanid, userid, newKind]);
            }
            let msgdtl = await this.msgdtlRepo.findOneBy({ MSGID: msgid, CHANID: chanid, USERID: userid, KIND: oldKind });
            if (msgdtl) {
                await qbMsgDtl.update()
                    .set({ KIND: newKind, UDT: curdtObj.DT })
                    .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                    msgid: msgid, chanid: chanid, userid: userid, kind: oldKind
                }).execute();
            }
            else {
                await qbMsgDtl.insert().values({
                    MSGID: msgid, CHANID: chanid, USERID: userid, KIND: newKind, USERNM: usernm, TYP: '', CDT: curdtObj.DT, UDT: curdtObj.DT
                }).execute();
            }
            msgdtl = await this.qryMsgDtl(qbMsgDtl, msgid, chanid);
            resJson.data.msgdtl = msgdtl;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async updateNotyetToRead(dto) {
        const methodName = 'chanmsg>updateNotyetToRead';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { msgid, chanid } = dto;
            const oldKind = 'notyet';
            const newKind = 'read';
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder('B');
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            let sql = " SELECT COUNT(*) CNT FROM S_MSGDTL_TBL WHERE MSGID = ? AND CHANID = ? AND USERID = ? AND KIND = ? ";
            const ret = await this.dataSource.query(sql, [msgid, chanid, userid, newKind]);
            if (ret[0].CNT > 0) {
            }
            else {
                let msgdtl = await this.msgdtlRepo.findOneBy({ MSGID: msgid, CHANID: chanid, USERID: userid, KIND: oldKind });
                if (msgdtl) {
                    await qbMsgDtl.update()
                        .set({ KIND: newKind, UDT: curdtObj.DT })
                        .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                        msgid: msgid, chanid: chanid, userid: userid, kind: oldKind
                    }).execute();
                    const replyto = rs.data.msgmst.REPLYTO;
                    const kind = newKind;
                    const typ = hush.getTypeForMsgDtl(kind);
                    const logObj = {
                        cdt: curdtObj.DT, msgid: msgid, replyto: replyto ? replyto : '', chanid: chanid,
                        userid: userid, usernm: usernm, cud: 'D', kind: newKind, typ: typ, bodytext: ''
                    };
                    const ret = await hush.insertDataLog(this.dataSource, logObj);
                    if (ret != '')
                        throw new Error(ret);
                }
                else {
                    await qbMsgDtl.insert().values({
                        MSGID: msgid, CHANID: chanid, USERID: userid, KIND: newKind, USERNM: usernm, TYP: 'read', CDT: curdtObj.DT, UDT: curdtObj.DT
                    }).execute();
                }
            }
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async updateAllWithNewKind(dto) {
        const methodName = 'chanmsg>updateAllWithNewKind';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { chanid, oldKind, newKind } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: chanid });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder('B');
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            await qbMsgDtl
                .update()
                .set({ KIND: newKind, SUBKIND: 'readall', UDT: curdtObj.DT })
                .where("CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                chanid: chanid, userid: userid, kind: oldKind
            }).execute();
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async toggleReaction(dto) {
        const methodName = 'chanmsg>toggleReaction';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { msgid, chanid, kind } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            let qbMsgDtl = this.msgdtlRepo.createQueryBuilder();
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            let cud = '';
            let msgdtl = await qbMsgDtl
                .select("COUNT(*) CNT")
                .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                msgid: msgid, chanid: chanid, userid: userid, kind: kind
            }).getRawOne();
            if (msgdtl.CNT > 0) {
                await qbMsgDtl
                    .delete()
                    .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                    msgid: msgid, chanid: chanid, userid: userid, kind: kind
                }).execute();
                cud = 'D';
            }
            else {
                await qbMsgDtl
                    .insert().values({
                    MSGID: msgid, CHANID: chanid, USERID: userid, KIND: kind, CDT: curdtObj.DT, UDT: curdtObj.DT, USERNM: usernm, TYP: 'react'
                }).execute();
                cud = 'C';
            }
            const logObj = {
                cdt: curdtObj.DT, msgid: msgid, replyto: rs.data.msgmst.REPLYTO ? rs.data.msgmst.REPLYTO : '', chanid: chanid,
                userid: userid, usernm: usernm, cud: cud, kind: kind, typ: hush.getTypeForMsgDtl(kind), bodytext: ''
            };
            const ret = await hush.insertDataLog(this.dataSource, logObj);
            if (ret != '')
                throw new Error(ret);
            qbMsgDtl = this.msgdtlRepo.createQueryBuilder('B');
            msgdtl = await this.qryMsgDtl(qbMsgDtl, msgid, chanid);
            resJson.data.msgdtl = msgdtl;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async changeAction(dto) {
        const methodName = 'chanmsg>changeAction';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { msgid, chanid, kind, job } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder();
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            let cud = '';
            if (kind == 'later' || kind == 'stored' || kind == 'finished') {
                const msgdtlforuser = await qbMsgDtl
                    .select("KIND")
                    .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND in ('later', 'stored', 'finished') ", {
                    msgid: msgid, chanid: chanid, userid: userid
                }).getRawOne();
                if (!msgdtlforuser) {
                    await qbMsgDtl
                        .insert().values({
                        MSGID: msgid, CHANID: chanid, USERID: userid, KIND: kind, TYP: 'user', CDT: curdtObj.DT, UDT: curdtObj.DT, USERNM: usernm
                    }).execute();
                    cud = 'C';
                }
                else {
                    if (job == 'delete') {
                        await qbMsgDtl
                            .delete()
                            .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                            msgid: msgid, chanid: chanid, userid: userid, kind: kind
                        }).execute();
                    }
                    else {
                        await qbMsgDtl
                            .update()
                            .set({ KIND: job })
                            .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind and TYP = 'user' ", {
                            msgid: msgid, chanid: chanid, userid: userid, kind: kind
                        }).execute();
                    }
                    cud = 'D';
                }
            }
            else if (kind == 'fixed' || kind == 'delfixed') {
                const msgdtlforuser = await qbMsgDtl
                    .select("KIND")
                    .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND IN ('fixed', 'delfixed') ", {
                    msgid: msgid, chanid: chanid, userid: userid
                }).getRawOne();
                if (!msgdtlforuser) {
                    await qbMsgDtl
                        .insert().values({
                        MSGID: msgid, CHANID: chanid, USERID: userid, KIND: 'fixed', TYP: 'user', CDT: curdtObj.DT, UDT: curdtObj.DT, USERNM: usernm
                    }).execute();
                    cud = 'C';
                }
                else {
                    const newKInd = (msgdtlforuser.KIND == 'fixed') ? 'delfixed' : 'fixed';
                    cud = (msgdtlforuser.KIND == 'fixed') ? 'D' : 'C';
                    await qbMsgDtl
                        .update()
                        .set({ KIND: newKInd })
                        .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND IN ('fixed', 'delfixed') ", {
                        msgid: msgid, chanid: chanid, userid: userid
                    }).execute();
                }
            }
            const logObj = {
                cdt: curdtObj.DT, msgid: msgid, replyto: rs.data.msgmst.REPLYTO ? rs.data.msgmst.REPLYTO : '', chanid: chanid,
                userid: userid, usernm: usernm, cud: cud, kind: kind, typ: hush.getTypeForMsgDtl(kind), bodytext: ''
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
    async uploadBlob(dto, file) {
        const methodName = 'chanmsg>uploadBlob';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { msgid, chanid, kind, body, filesize } = dto;
            const rs = await this.chkAcl({ userid: userid, msgid: msgid, chanid: chanid, chkAuthor: true, chkGuest: true });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            let fileExt = '';
            if (kind == 'F') {
                const arr = body.split('.');
                if (arr.length > 1)
                    fileExt = arr[arr.length - 1].toLowerCase();
            }
            const qbMsgSub = this.msgsubRepo.createQueryBuilder();
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            await qbMsgSub.insert().values({
                MSGID: userid, CHANID: chanid, KIND: kind, BODY: body, FILESIZE: filesize, FILEEXT: fileExt, CDT: curdtObj.DT, UDT: curdtObj.DT,
                BUFFER: (kind != 'L') ? Buffer.from(new Uint8Array(file.buffer)) : null
            }).execute();
            resJson.data.cdt = curdtObj.DT;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async delBlob(dto) {
        const methodName = 'chanmsg>delBlob';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const msgid = (dto.msgid == 'temp') ? userid : dto.msgid;
            const { chanid, kind, cdt } = dto;
            const rs = await this.chkAcl({ userid: userid, msgid: msgid, chanid: chanid, chkAuthor: true });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            await this.msgsubRepo.createQueryBuilder()
                .delete()
                .where("MSGID = :msgid and CHANID = :chanid and KIND = :kind and CDT = :cdt ", {
                msgid: msgid, chanid: chanid, kind: kind, cdt: cdt
            }).execute();
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async readBlob(dto) {
        const methodName = 'chanmsg>readBlob';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const msgid = (dto.msgid == 'temp') ? userid : dto.msgid;
            const { chanid, kind, cdt, name } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: chanid });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            const msgsub = await this.msgsubRepo.createQueryBuilder('A')
                .select(['A.BUFFER'])
                .where("MSGID = :msgid and CHANID = :chanid and KIND = :kind and CDT = :cdt ", {
                msgid: msgid, chanid: chanid, kind: kind, cdt: cdt
            }).getOne();
            if (!msgsub) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, methodName);
            }
            resJson.data = msgsub;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async saveChan(dto) {
        const methodName = 'chanmsg>saveChan';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { GR_ID, CHANID, CHANNM, STATE, MEMBER } = dto;
            const unidObj = await hush.getMysqlUnid(this.dataSource);
            let chanmst;
            let kind = '';
            if (CHANID != 'new') {
                const rs = await this.chkAcl({ userid: userid, chanid: CHANID });
                if (rs.code != hush.Code.OK)
                    return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
                if (rs.data.chanmst.KIND != 'admin') {
                    return hush.setResJson(resJson, '해당 관리자만 저장 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName);
                }
                kind = 'mst';
                if (rs.data.chanmst.TYP != 'WS')
                    return;
                chanmst = await this.chanmstRepo.findOneBy({ CHANID: CHANID });
                chanmst.CHANNM = CHANNM;
                chanmst.STATE = STATE;
                chanmst.MODR = userid;
                chanmst.UDT = unidObj.DT;
            }
            else {
                if (GR_ID) {
                    const gr = await this.grmstRepo.createQueryBuilder('A')
                        .select(['A.GR_NM', 'B.SYNC'])
                        .innerJoin('A.dtl', 'B', 'A.GR_ID = B.GR_ID')
                        .where("A.GR_ID = :grid and B.USERID = :userid ", {
                        grid: GR_ID, userid: userid
                    }).getOne();
                    if (!gr) {
                        return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (이 채널의 그룹에 해당 사용자가 없습니다)' + fv, hush.Code.NOT_FOUND, null, methodName);
                    }
                }
                chanmst = this.chanmstRepo.create();
                chanmst.CHANID = unidObj.ID;
                chanmst.CHANNM = GR_ID ? CHANNM : 'DM';
                chanmst.TYP = GR_ID ? 'WS' : 'GS';
                chanmst.GR_ID = GR_ID ? GR_ID : 'GS';
                chanmst.MASTERID = userid;
                chanmst.MASTERNM = usernm;
                chanmst.STATE = GR_ID ? STATE : 'M';
                chanmst.ISUR = userid;
                chanmst.CDT = unidObj.DT;
                chanmst.MODR = userid;
                chanmst.UDT = unidObj.DT;
            }
            if (GR_ID) {
                if (!CHANNM || CHANNM.trim() == '' || CHANNM.trim().length > 50) {
                    return hush.setResJson(resJson, '채널명은 공란없이 50자까지 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName);
                }
            }
            await this.chanmstRepo.save(chanmst);
            if (CHANID == 'new') {
                const chandtl = this.chandtlRepo.create();
                chandtl.CHANID = unidObj.ID;
                chandtl.USERID = userid;
                chandtl.USERNM = usernm;
                chandtl.KIND = 'admin';
                chandtl.SYNC = 'Y';
                chandtl.ISUR = userid;
                chandtl.CDT = unidObj.DT;
                chandtl.MODR = userid;
                chandtl.UDT = unidObj.DT;
                await this.chandtlRepo.save(chandtl);
                if (MEMBER && Array.isArray(MEMBER) && MEMBER.length > 0) {
                    for (let i = 0; i < MEMBER.length; i++) {
                        if (MEMBER[i].USERID == userid)
                            continue;
                        const chandtl = this.chandtlRepo.create();
                        chandtl.CHANID = unidObj.ID;
                        chandtl.USERID = MEMBER[i].USERID;
                        chandtl.USERNM = MEMBER[i].USERNM;
                        chandtl.KIND = 'member';
                        chandtl.SYNC = MEMBER[i].SYNC;
                        chandtl.ISUR = userid;
                        chandtl.CDT = unidObj.DT;
                        chandtl.MODR = userid;
                        chandtl.UDT = unidObj.DT;
                        await this.chandtlRepo.save(chandtl);
                    }
                }
                resJson.data.chanid = unidObj.ID;
                kind = 'new';
            }
            const logObj = {
                cdt: unidObj.DT, msgid: '', replyto: '', chanid: (CHANID != 'new') ? CHANID : unidObj.ID,
                userid: userid, usernm: usernm, cud: (CHANID != 'new') ? 'U' : 'C', kind: kind, typ: 'chan', bodytext: '', subkind: chanmst.TYP
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
    async deleteChan(dto) {
        const methodName = 'chanmsg>deleteChan';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { CHANID } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            let sql = "SELECT COUNT(*) CNT FROM S_MSGMST_TBL WHERE CHANID = ? ";
            const msgmst = await this.dataSource.query(sql, [CHANID]);
            if (msgmst[0].CNT > 0) {
                return hush.setResJson(resJson, '해당 채널(또는 DM)에서 생성된 메시지가 있습니다.' + fv, hush.Code.NOT_OK, null, methodName);
            }
            const chanmst = rs.data.chanmst;
            if (chanmst.MASTERID != userid) {
                return hush.setResJson(resJson, '마스터만 삭제 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName);
            }
            await this.dataSource.query("DELETE FROM S_CHANDTL_TBL WHERE CHANID = ? ", [CHANID]);
            await this.dataSource.query("DELETE FROM S_CHANMST_TBL WHERE CHANID = ? ", [CHANID]);
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            const logObj = {
                cdt: curdtObj.DT, msgid: '', replyto: '', chanid: CHANID,
                userid: userid, usernm: usernm, cud: 'D', kind: 'mst', typ: 'chan', bodytext: '', subkind: chanmst.TYP
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
    async saveChanMember(dto) {
        const methodName = 'chanmsg>saveChanMember';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { crud, CHANID, USERID, USERNM, KIND, SYNC, chkOnly } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            const chanmst = rs.data.chanmst;
            if (chanmst.KIND != 'admin') {
                return hush.setResJson(resJson, '해당 채널 관리자만 멤버저장 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName);
            }
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            let chandtl = await this.chandtlRepo.findOneBy({ CHANID: CHANID, USERID: USERID });
            if (crud == 'U') {
                if (!chandtl) {
                    return hush.setResJson(resJson, '해당 채널에 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName);
                }
                if (KIND != 'admin' && chanmst.MASTERID == USERID) {
                    return hush.setResJson(resJson, '해당 채널 생성자는 항상 admin이어야 합니다.' + fv, hush.Code.NOT_OK, null, methodName);
                }
                chandtl.USERNM = USERNM;
                chandtl.KIND = KIND;
                chandtl.MODR = userid;
                chandtl.UDT = curdtObj.DT;
            }
            else {
                if (chandtl) {
                    return hush.setResJson(resJson, '해당 채널에 사용자가 이미 있습니다.' + fv, hush.Code.NOT_OK, null, methodName);
                }
                chandtl = this.chandtlRepo.create();
                chandtl.CHANID = CHANID;
                chandtl.USERID = USERID;
                chandtl.USERNM = USERNM;
                chandtl.KIND = KIND;
                chandtl.STATE = 'C';
                chandtl.SYNC = SYNC;
                chandtl.ISUR = userid;
                chandtl.CDT = curdtObj.DT;
                chandtl.MODR = userid;
                chandtl.UDT = curdtObj.DT;
            }
            if (!chkOnly) {
                await this.chandtlRepo.save(chandtl);
                const logObj = {
                    cdt: curdtObj.DT, msgid: '', replyto: '', chanid: CHANID,
                    userid: userid, usernm: usernm, cud: crud, kind: 'mem', typ: 'chan', bodytext: '', subkind: chanmst.TYP
                };
                const ret = await hush.insertDataLog(this.dataSource, logObj);
                if (ret != '')
                    throw new Error(ret);
            }
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async deleteChanMember(dto) {
        const methodName = 'chanmsg>deleteChanMember';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { CHANID, USERID, chkOnly } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            const chanmst = rs.data.chanmst;
            if (chanmst.KIND != 'admin') {
                if (USERID == userid) {
                }
                else {
                    return hush.setResJson(resJson, '해당 관리자만 멤버삭제 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName);
                }
            }
            if (chanmst.MASTERID == USERID) {
                return hush.setResJson(resJson, '해당 채널 생성자는 삭제할 수 없습니다.' + fv, hush.Code.NOT_OK, null, methodName);
            }
            let chandtl = await this.chandtlRepo.findOneBy({ CHANID: CHANID, USERID: USERID });
            if (!chandtl) {
                return hush.setResJson(resJson, '해당 채널에 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName);
            }
            if (chkOnly) {
            }
            else {
                await this.chandtlRepo.delete(chandtl);
                const curdtObj = await hush.getMysqlCurdt(this.dataSource);
                const logObj = {
                    cdt: curdtObj.DT, msgid: '', replyto: '', chanid: CHANID,
                    userid: userid, usernm: usernm, cud: 'D', kind: 'mem', typ: 'chan', bodytext: '', subkind: chanmst.TYP
                };
                const ret = await hush.insertDataLog(this.dataSource, logObj);
                if (ret != '')
                    throw new Error(ret);
            }
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async inviteToMember(dto) {
        const methodName = 'chanmsg>inviteToMember';
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        const usernm = this.req['user'].usernm;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { CHANID, CHANNM, USERIDS } = dto;
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID });
            if (rs.code != hush.Code.OK)
                return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName);
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            const chanmst = rs.data.chanmst;
            const grid = chanmst.GR_ID;
            const mailTo = [], nmTo = [];
            const link = '<p><a href="http://localhost:5173/login" target="_blank" style="margin:10px">WiSEBand 열기</a></p>';
            const mailTitle = '[' + hush.cons.appName + ']로 조대합니다 - ' + usernm;
            let mailBody = '<p style="margin:10px">방명 : <b>' + CHANNM + '</b></p>' + link;
            for (let i = 0; i < USERIDS.length; i++) {
                const useridMem = USERIDS[i];
                const chandtl = await this.chandtlRepo.findOneBy({ CHANID: CHANID, USERID: useridMem });
                if (!chandtl) {
                    return hush.setResJson(resJson, '해당 사용자의 채널 멤버 정보가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName);
                }
                let rec;
                if (chandtl.SYNC == 'Y') {
                    rec = await this.userRepo.findOneBy({ USERID: useridMem });
                }
                else {
                    rec = await this.grdtlRepo.findOneBy({ GR_ID: grid, USERID: useridMem });
                }
                if (!rec) {
                    return hush.setResJson(resJson, '해당 사용자의 정보가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName);
                }
                if (!rec.EMAIL.includes('@')) {
                    return hush.setResJson(resJson, '해당 사용자의 이메일 주소에 문제가 있습니다.' + fv, hush.Code.NOT_OK, null, methodName);
                }
                mailTo.push(rec.EMAIL);
                if (chandtl.SYNC == 'Y') {
                    nmTo.push(rec.USERNM + '/' + rec.ORG_NM + '/' + rec.TOP_ORG_NM);
                }
                else {
                    nmTo.push(rec.USERNM + '/' + rec.ORG);
                }
                chandtl.STATE = '';
                chandtl.MODR = userid;
                chandtl.UDT = curdtObj.DT;
                await this.chandtlRepo.save(chandtl);
            }
            mailBody += '<p style="margin:10px">대상 : ' + nmTo.join(', ') + '</p>';
            this.mailSvc.sendMail(mailTo, mailTitle, mailBody);
            const str = '초대합니다.<br><br>' + nmTo.join(', ');
            await this.saveMsg({
                crud: 'C', chanid: CHANID, body: str, bodytext: str.replaceAll('<br>', '\n')
            });
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryDataLogEach(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { logdt } = dto;
            let sql = "SELECT MSGID, X.CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND ";
            sql += "  FROM ( ";
            sql += "SELECT MSGID, CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND ";
            sql += "  FROM S_DATALOG_TBL ";
            sql += " WHERE CDT > ? AND TYP = 'chan' AND NOT (KIND = 'mst' AND CUD = 'D') ";
            sql += " UNION ALL ";
            sql += "SELECT MSGID, CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND ";
            sql += "  FROM S_DATALOG_TBL ";
            sql += " WHERE CDT > ? AND TYP IN ('msg', 'react') ";
            sql += " UNION ALL ";
            sql += "SELECT MSGID, CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND ";
            sql += "  FROM S_DATALOG_TBL ";
            sql += " WHERE CDT > ? AND TYP IN ('user', 'read') AND USERID = ? ";
            sql += " UNION ALL ";
            sql += "SELECT MSGID, CHANID, MAX(UDT) CDT, (SELECT REPLYTO FROM S_MSGMST_TBL WHERE MSGID = A.MSGID AND A.CHANID) REPLYTO, ";
            sql += "       '' USERID, '' USERNM, 'T' CUD, '' KIND, TYP, '' BODYTEXT, '' SUBKIND ";
            sql += "  FROM S_MSGDTL_TBL A ";
            sql += " WHERE UDT > ? AND TYP = 'read' AND SUBKIND = '' ";
            sql += " GROUP BY MSGID, CHANID ";
            sql += " UNION ALL ";
            sql += "SELECT '' MSGID, CHANID, UDT AS CDT, '' REPLYTO, '' USERID, '' USERNM, 'T' CUD, '' KIND, TYP, '' BODYTEXT, SUBKIND ";
            sql += "  FROM S_MSGDTL_TBL ";
            sql += " WHERE UDT > ? AND TYP = 'read' AND SUBKIND = 'readall' ";
            sql += " GROUP BY CHANID, UDT ";
            sql += ") X INNER JOIN (SELECT CHANID FROM S_CHANDTL_TBL WHERE USERID = ?) Y ON X.CHANID = Y.CHANID ";
            sql += " UNION ALL ";
            sql += "SELECT MSGID, CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND ";
            sql += "  FROM S_DATALOG_TBL ";
            sql += " WHERE CDT > ? AND TYP = 'chan' AND KIND = 'mst' AND CUD = 'D' ";
            sql += " UNION ALL ";
            sql += "SELECT MSGID, CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND ";
            sql += "  FROM S_DATALOG_TBL ";
            sql += " WHERE CDT > ? AND TYP = 'group' AND KIND = 'mst' ";
            sql += " ORDER BY CDT ";
            const list = await this.dataSource.query(sql, [logdt, logdt, logdt, userid, logdt, logdt, userid, logdt, logdt]);
            const len = list.length;
            for (let i = 0; i < len; i++) {
                const row = list[i];
                if (row.SUBKIND == 'readall') {
                }
                else if (row.TYP == 'chan') {
                    if (row.KIND == 'mst' && row.CUD == 'D') {
                    }
                    else {
                        const rs = await this.chkAcl({ userid: userid, chanid: row.CHANID, includeBlob: true });
                        row.chanmst = rs.data.chanmst;
                        row.chandtl = rs.data.chandtl;
                    }
                }
                else if (row.TYP == 'group') {
                    if (row.KIND == 'mst' && row.CUD == 'D') {
                    }
                    else {
                        const sqlGr = "SELECT GR_NM FROM S_GRMST_TBL WHERE GR_ID = ? ";
                        const grData = await this.dataSource.query(sqlGr, [row.CHANID]);
                        row.grnm = (grData.length > 0) ? grData[0].GR_NM : '';
                    }
                }
                else if (row.CUD == 'C' && row.KIND == 'parent') {
                }
                else {
                    const parentMsgid = (row.REPLYTO != '') ? row.REPLYTO : row.MSGID;
                    row.msgItem = await this.qryMsg({ chanid: row.CHANID, msgid: parentMsgid });
                }
            }
            sql = "SELECT Z.TYP, SUM(Y.CNT) SUM ";
            sql += " FROM (SELECT CHANID, COUNT(*) CNT FROM S_MSGDTL_TBL WHERE USERID = ? AND KIND = 'notyet' GROUP BY CHANID) Y ";
            sql += "INNER JOIN (SELECT A.CHANID, A.TYP FROM S_CHANMST_TBL A ";
            sql += "             INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID WHERE B.USERID = ?) Z ";
            sql += "   ON Y.CHANID = Z.CHANID ";
            sql += "GROUP BY Z.TYP ";
            sql += "ORDER BY Z.TYP ";
            const listByMenu = await this.dataSource.query(sql, [userid, userid]);
            resJson.data.logdt = (len == 0) ? logdt : list[len - 1].CDT;
            resJson.list = list;
            resJson.data.listByMenu = listByMenu;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
};
exports.ChanmsgService = ChanmsgService;
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "saveMsg", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "forwardToChan", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "delMsg", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "updateWithNewKind", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "updateNotyetToRead", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "toggleReaction", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "changeAction", null);
__decorate([
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "uploadBlob", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "saveChan", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "deleteChan", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "deleteChanMember", null);
__decorate([
    (0, typeorm_transactional_1.Transactional)({ propagation: typeorm_transactional_1.Propagation.REQUIRED }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChanmsgService.prototype, "inviteToMember", null);
exports.ChanmsgService = ChanmsgService = __decorate([
    (0, common_1.Injectable)({ scope: common_1.Scope.REQUEST }),
    __param(0, (0, typeorm_1.InjectRepository)(chanmsg_entity_1.MsgMst)),
    __param(1, (0, typeorm_1.InjectRepository)(chanmsg_entity_1.MsgSub)),
    __param(2, (0, typeorm_1.InjectRepository)(chanmsg_entity_1.MsgDtl)),
    __param(3, (0, typeorm_1.InjectRepository)(chanmsg_entity_1.ChanMst)),
    __param(4, (0, typeorm_1.InjectRepository)(chanmsg_entity_1.ChanDtl)),
    __param(5, (0, typeorm_1.InjectRepository)(chanmsg_entity_1.GrMst)),
    __param(6, (0, typeorm_1.InjectRepository)(chanmsg_entity_1.GrDtl)),
    __param(7, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(11, (0, common_1.Inject)(core_1.REQUEST)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        user_service_1.UserService,
        mail_service_1.MailService, Object])
], ChanmsgService);
//# sourceMappingURL=chanmsg.service.js.map