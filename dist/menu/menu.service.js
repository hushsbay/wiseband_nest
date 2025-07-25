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
exports.MenuService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("typeorm");
const hush = require("../common/common");
const resjson_1 = require("../common/resjson");
let MenuService = class MenuService {
    constructor(dataSource, req) {
        this.dataSource = dataSource;
        this.req = req;
    }
    async qryMembersWithPic(chanid, userid, pictureCount) {
        const retObj = { memcnt: null, picCnt: null, memnm: null, memid: null, picture: null, url: null };
        let sql = "SELECT A.USERID, A.USERNM, B.PICTURE ";
        sql += "     FROM S_CHANDTL_TBL A ";
        sql += "     LEFT OUTER JOIN S_USER_TBL B ON A.USERID = B.USERID ";
        sql += "    WHERE A.CHANID = ? ";
        sql += "    ORDER BY A.USERNM ";
        const listChan = await this.dataSource.query(sql, [chanid]);
        const arr = [], brr = [], crr = [], drr = [];
        let picCnt = 0, me = null;
        for (let j = 0; j < listChan.length; j++) {
            if (listChan[j].USERID == userid) {
                me = listChan[j];
                continue;
            }
            arr.push(listChan[j].USERNM);
            brr.push(listChan[j].USERID);
            crr.push(listChan[j].PICTURE);
            drr.push('');
            picCnt += 1;
            if (pictureCount > -1 && picCnt >= pictureCount)
                break;
        }
        if (picCnt == 0 && me) {
            arr.push(me.USERNM);
            brr.push(me.USERID);
            crr.push(me.PICTURE);
            drr.push('');
            picCnt = 1;
        }
        retObj.memcnt = listChan.length;
        retObj.memnm = arr;
        retObj.memid = brr;
        retObj.picCnt = picCnt;
        retObj.picture = crr;
        retObj.url = drr;
        return retObj;
    }
    async qryKindCntForUser(chanid, userid, kind) {
        let sql = "SELECT COUNT(*) CNT FROM S_MSGDTL_TBL WHERE CHANID = ? AND USERID = ? AND KIND = ? ";
        const list = await this.dataSource.query(sql, [chanid, userid, kind]);
        return list[0].CNT;
    }
    async qry(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        try {
            const { kind } = dto;
            const curdtObj = await hush.getMysqlCurdt(this.dataSource);
            let sqlChk = "SELECT COUNT(*) CNT FROM S_MENUPER_TBL WHERE USERID = ? AND KIND = ? ";
            const menuList = await this.dataSource.query(sqlChk, [userid, kind]);
            if (menuList[0].CNT == 0) {
                sqlChk = "INSERT INTO S_MENUPER_TBL (USERID, KIND, ID) ";
                sqlChk += "SELECT ?, ?, ID FROM S_MENU_TBL WHERE INUSE = 'Y' ";
                await this.dataSource.query(sqlChk, [userid, kind]);
            }
            let sql = "SELECT A.ID, A.NM, A.SEQ, A.IMG, A.POPUP, A.RMKS, B.USERID ";
            sql += "     FROM S_MENU_TBL A ";
            sql += "     LEFT OUTER JOIN (SELECT USERID, KIND, ID FROM S_MENUPER_TBL WHERE USERID = ? AND KIND = ?) B ";
            sql += "       ON A.KIND = B.KIND AND A.ID = B.ID ";
            sql += "    WHERE A.KIND = ? ";
            sql += "      AND A.INUSE = 'Y' ";
            sql += "    ORDER BY A.SEQ ";
            const list = await this.dataSource.query(sql, [userid, kind, kind]);
            resJson.list = list;
            resJson.data.dbdt = curdtObj.DT;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req);
        }
    }
    async qryChan(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { kind } = dto;
            let sql = "SELECT Z.DEPTH, Z.GR_ID, Z.GR_NM, Z.GRMST_UDT, Z.CHANID, Z.CHANNM, Z.MASTERID, Z.MASTERNM, Z.STATE, Z.CHANMST_UDT, Z.KIND, Z.NOTI, Z.BOOKMARK, Z.OTHER ";
            sql += "     FROM ( ";
            sql += "SELECT 1 DEPTH, A.GR_ID, A.GR_NM, A.UDT GRMST_UDT, '' CHANID, '' CHANNM, '' MASTERID, '' MASTERNM, '' STATE, '' CHANMST_UDT, '' KIND, '' NOTI, '' BOOKMARK, '' OTHER ";
            sql += "     FROM S_GRMST_TBL A ";
            sql += "    INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID ";
            sql += "    WHERE B.USERID = '" + userid + "' ";
            sql += "    UNION ALL ";
            sql += "   SELECT X.DEPTH, X.GR_ID, X.GR_NM, X.GRMST_UDT, Y.CHANID, Y.CHANNM, Y.MASTERID, Y.MASTERNM, Y.STATE, Y.CHANMST_UDT, Y.KIND, Y.NOTI, Y.BOOKMARK, Y.OTHER ";
            sql += "     FROM (SELECT 2 DEPTH, A.GR_ID, A.GR_NM, A.UDT GRMST_UDT ";
            sql += "             FROM S_GRMST_TBL A ";
            sql += "            INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID ";
            sql += "            WHERE B.USERID = '" + userid + "') X ";
            if (kind == 'my') {
                sql += " LEFT OUTER JOIN (SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT, B.KIND, B.NOTI, B.BOOKMARK, '' OTHER ";
                sql += "                    FROM S_CHANMST_TBL A ";
                sql += "                   INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID ";
                sql += "                   WHERE B.USERID = '" + userid + "' ";
                sql += "                     AND A.TYP = 'WS') Y ";
            }
            else if (kind == 'other') {
                sql += " LEFT OUTER JOIN (SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT, '' KIND, '' NOTI, '' BOOKMARK, 'other' OTHER ";
                sql += "                    FROM S_CHANMST_TBL A ";
                sql += "                   WHERE A.CHANID NOT IN (SELECT CHANID FROM S_CHANDTL_TBL WHERE USERID = '" + userid + "') ";
                sql += "                     AND A.TYP = 'WS' AND A.STATE = 'A') Y ";
            }
            else {
                sql += " LEFT OUTER JOIN (SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT, B.KIND, B.NOTI, B.BOOKMARK, '' OTHER ";
                sql += "                    FROM S_CHANMST_TBL A ";
                sql += "                   INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID ";
                sql += "                   WHERE B.USERID = '" + userid + "' ";
                sql += "                   UNION ALL ";
                sql += "                  SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT, '' KIND, '' NOTI, '' BOOKMARK, 'other' OTHER ";
                sql += "                    FROM S_CHANMST_TBL A ";
                sql += "                   WHERE A.CHANID NOT IN (SELECT CHANID FROM S_CHANDTL_TBL WHERE USERID = '" + userid + "') ";
                sql += "                     AND A.TYP = 'WS' AND A.STATE = 'A') Y ";
            }
            sql += "      ON X.GR_ID = Y.GR_ID) Z ";
            sql += "   ORDER BY Z.GR_NM, Z.GR_ID, Z.DEPTH, Z.CHANNM, Z.CHANID ";
            const list = await this.dataSource.query(sql, null);
            for (let i = 0; i < list.length; i++) {
                if (list[i].DEPTH == 2)
                    list[i].mynotyetCnt = await this.qryKindCntForUser(list[i].CHANID, userid, 'notyet');
            }
            resJson.list = list;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryKindCnt(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { chanid, kind } = dto;
            resJson.data.kindCnt = await this.qryKindCntForUser(chanid, userid, kind);
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryDm(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { kind, search, prevMsgMstCdt, chanid, oldestMsgDt, key } = dto;
            const memField = search ? ', Z.MEMBERS ' : '';
            let sql = "SELECT Z.CHANID, Z.CHANNM, Z.BOOKMARK, Z.NOTI, Z.STATE, Z.MASTERID, Z.CDT, Z.LASTMSGDT, Z.CHANDTL_UDT, Z.CHANMST_UDT  " + memField;
            sql += "     FROM (SELECT B.CHANID, B.CHANNM, B.STATE, B.MASTERID, A.BOOKMARK, A.NOTI, A.CDT, B.UDT CHANMST_UDT, ";
            sql += "                  (SELECT MAX(UDT) FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) CHANDTL_UDT, ";
            sql += "                  IFNULL((SELECT MAX(CDT) FROM S_MSGMST_TBL WHERE CHANID = B.CHANID), '9999-99-98') LASTMSGDT ";
            if (search) {
                sql += "              ,(SELECT GROUP_CONCAT(USERNM SEPARATOR ', ') FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) MEMBERS ";
            }
            sql += "             FROM S_CHANDTL_TBL A ";
            sql += "            INNER JOIN S_CHANMST_TBL B ON A.CHANID = B.CHANID ";
            if (kind == 'notyet') {
                sql += "        INNER JOIN (SELECT DISTINCT CHANID FROM S_MSGDTL_TBL WHERE USERID = '" + userid + "' AND KIND = 'notyet') D ON A.CHANID = D.CHANID ";
            }
            sql += "            WHERE A.USERID = ? ";
            if (chanid) {
                sql += "          AND A.CHANID = '" + chanid + "' ";
            }
            sql += "              AND B.TYP = 'GS' ";
            sql += "           ) Z ";
            if (key) {
                sql += "    WHERE Z.CHANID = '" + key + "' ";
            }
            else if (oldestMsgDt) {
                sql += "    WHERE Z.LASTMSGDT >= '" + oldestMsgDt + "' ";
            }
            else {
                sql += "    WHERE Z.LASTMSGDT < '" + prevMsgMstCdt + "' ";
            }
            if (search) {
                sql += "  AND LOWER(Z.MEMBERS) LIKE '%" + search.toLowerCase() + "%' ";
            }
            sql += "ORDER BY Z.LASTMSGDT DESC, Z.CDT DESC ";
            if (!oldestMsgDt)
                sql += "LIMIT " + hush.cons.rowsCnt;
            const arr = [];
            const list = await this.dataSource.query(sql, [userid]);
            for (let i = 0; i < list.length; i++) {
                const row = list[i];
                if (row.STATE == 'M') {
                    if (row.MASTERID != userid)
                        continue;
                }
                sql = "SELECT MSGID, BODYTEXT, REPLYTO FROM S_MSGMST_TBL WHERE CHANID = ? ORDER BY CDT DESC LIMIT 1 ";
                const listMst = await this.dataSource.query(sql, [row.CHANID]);
                if (listMst.length == 0) {
                    row.MSGID = '';
                    row.BODYTEXT = '';
                    row.REPLYTO = '';
                }
                else {
                    row.MSGID = listMst[0].MSGID;
                    row.BODYTEXT = listMst[0].BODYTEXT;
                    row.REPLYTO = listMst[0].REPLYTO;
                }
                const obj = await this.qryMembersWithPic(row.CHANID, userid, hush.cons.picCnt);
                row.memcnt = obj.memcnt;
                row.memnm = obj.memnm;
                row.memid = obj.memid;
                row.picCnt = obj.picCnt;
                row.picture = obj.picture;
                row.url = obj.url;
                row.mynotyetCnt = await this.qryKindCntForUser(row.CHANID, userid, 'notyet');
                arr.push(row);
            }
            resJson.list = arr;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryDmChkExist(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            let { member } = dto;
            if (!member.includes(userid))
                member.push(userid);
            member.sort((a, b) => a.localeCompare(b));
            let sql = "SELECT CHANID, CNT, MEM ";
            sql += "     FROM (SELECT A.CHANID, ";
            sql += "                  (SELECT COUNT(*) FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) CNT, ";
            sql += "                  (SELECT GROUP_CONCAT(USERID ORDER BY USERID) FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) MEM ";
            sql += "             FROM S_CHANDTL_TBL A ";
            sql += "            INNER JOIN S_CHANMST_TBL B ON A.CHANID = B.CHANID ";
            sql += "            WHERE A.USERID = ? AND B.TYP = 'GS' ORDER BY A.UDT DESC) Z ";
            sql += "    WHERE CNT = ? AND MEM = ? ";
            const list = await this.dataSource.query(sql, [userid, member.length, member.join(',')]);
            if (list.length > 0)
                resJson.data.chanid = list[0].CHANID;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryPanel(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { kind, prevMsgMstCdt, msgid, oldestMsgDt, key } = dto;
            let sql = "SELECT A.MSGID, A.AUTHORID, A.AUTHORNM, A.BODYTEXT, A.KIND, A.CDT, A.UDT, A.REPLYTO, ";
            sql += "          B.CHANID, B.TYP, B.CHANNM, B.STATE, D.KIND, E.PICTURE ";
            sql += "     FROM S_MSGMST_TBL A ";
            sql += "    INNER JOIN S_CHANMST_TBL B ON A.CHANID = B.CHANID ";
            sql += "     LEFT OUTER JOIN S_MSGDTL_TBL D ON A.MSGID = D.MSGID AND A.CHANID = D.CHANID ";
            sql += "     LEFT OUTER JOIN S_USER_TBL E ON A.AUTHORID = E.USERID ";
            if (msgid) {
                sql += "WHERE A.MSGID = '" + msgid + "' AND D.USERID = ? ";
            }
            else {
                if (key) {
                    sql += "WHERE D.USERID = ? AND D.KIND = ? AND A.MSGID = '" + key + "' ";
                }
                else if (oldestMsgDt) {
                    sql += "WHERE D.USERID = ? AND D.KIND = ? AND A.CDT >= '" + oldestMsgDt + "' ";
                }
                else {
                    sql += "WHERE D.USERID = ? AND D.KIND = ? AND A.CDT < '" + prevMsgMstCdt + "' ";
                }
            }
            sql += "    ORDER BY A.CDT DESC ";
            if (!oldestMsgDt)
                sql += "    LIMIT " + hush.cons.rowsCnt;
            const list = await this.dataSource.query(sql, [userid, kind]);
            for (let i = 0; i < list.length; i++) {
                const row = list[i];
                if (row.TYP == 'GS') {
                    const obj = await this.qryMembersWithPic(row.CHANID, userid, hush.cons.picCnt);
                    row.memcnt = obj.memcnt;
                    row.memnm = obj.memnm;
                    row.memid = obj.memid;
                    row.picCnt = obj.picCnt;
                    row.picture = obj.picture;
                    row.url = obj.url;
                }
            }
            resJson.list = list;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryPanelCount(dto) {
        try {
            const resJson = new resjson_1.ResJson();
            const userid = this.req['user'].userid;
            const { kind } = dto;
            let sql = "SELECT COUNT(*) CNT ";
            sql += "     FROM S_MSGMST_TBL A ";
            sql += "     LEFT OUTER JOIN S_MSGDTL_TBL B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID ";
            sql += "    WHERE B.USERID = ? AND B.KIND = ? ";
            const list = await this.dataSource.query(sql, [userid, kind]);
            resJson.list = list;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req);
        }
    }
    async qryActivity(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            const { kind, notyet, prevMsgMstCdt, oldestMsgDt, key1, key2 } = dto;
            let sqlHeaderStart = "SELECT Y.MSGID, Y.CHANID, Z.CHANNM, Y.AUTHORID, Y.AUTHORNM, Y.REPLYTO, Y.BODYTEXT, Y.SUBKIND, Y.TITLE, Y.DT, E.PICTURE FROM ( ";
            let sqlHeaderEnd = ") Y ";
            let sqlBasicAcl = hush.getBasicAclSql(userid, "ALL");
            let sqlVip = "SELECT '' MSGID, A.CHANID, AUTHORID, AUTHORNM, '' REPLYTO, '' BODYTEXT, '' SUBKIND, 'vip' TITLE, MAX(A.CDT) DT ";
            sqlVip += "     FROM S_MSGMST_TBL A ";
            if (notyet == 'Y') {
                sqlVip += "INNER JOIN S_MSGDTL_TBL B ON A.MSGID = B.MSGID AND B.USERID = '" + userid + "' AND B.KIND = 'notyet' ";
            }
            sqlVip += "    WHERE AUTHORID IN (SELECT UID FROM S_USERCODE_TBL WHERE KIND = 'vip' AND USERID = '" + userid + "') ";
            sqlVip += "    GROUP BY CHANID, AUTHORID, AUTHORNM ";
            let sqlThread = "SELECT Z.MSGID, Z.CHANID, Z.AUTHORID, Z.AUTHORNM, Z.REPLYTO, (SELECT BODYTEXT FROM S_MSGMST_TBL WHERE MSGID = Z.MSGID) BODYTEXT, ";
            sqlThread += "          '' SUBKIND, 'thread' TITLE, MAX(CDT) DT ";
            sqlThread += "     FROM (SELECT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, CDT ";
            sqlThread += "             FROM S_MSGMST_TBL A ";
            sqlThread += "            WHERE A.AUTHORID = '" + userid + "' ";
            if (notyet == 'Y') {
                sqlThread += "          AND (SELECT COUNT(*) FROM S_MSGMST_TBL K INNER JOIN S_MSGDTL_TBL J ON K.MSGID = J.MSGID AND J.USERID = '" + userid + "' AND J.KIND = 'notyet' ";
                sqlThread += "                WHERE K.REPLYTO = A.MSGID ) > 0 ";
            }
            else {
                sqlThread += "          AND (SELECT COUNT(*) FROM S_MSGMST_TBL WHERE REPLYTO = A.MSGID) > 0 ";
            }
            if (notyet == 'Y') {
                sqlThread += " ) Z ";
            }
            else {
                sqlThread += "        UNION ALL ";
                sqlThread += "       SELECT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, B.CDT ";
                sqlThread += "         FROM S_MSGMST_TBL A ";
                sqlThread += "        INNER JOIN (SELECT REPLYTO, MSGID, CHANID, BODYTEXT, AUTHORID, AUTHORNM, CDT ";
                sqlThread += "                      FROM S_MSGMST_TBL ";
                sqlThread += "                     WHERE AUTHORID = '" + userid + "' AND REPLYTO <> '') B ON A.MSGID = B.REPLYTO) Z ";
            }
            sqlThread += "   GROUP BY Z.MSGID, Z.CHANID, Z.AUTHORID, Z.AUTHORNM, Z.REPLYTO ";
            let sqlReact = '';
            if (notyet == 'Y') {
                sqlReact = "SELECT DISTINCT MSGID, CHANID, AUTHORID, AUTHORNM, REPLYTO, BODYTEXT, '' SUBKIND, 'react' TITLE, CDT DT ";
                sqlReact += " FROM S_MSGMST_TBL ";
                sqlReact += "WHERE AUTHORID = 'dummy' ";
            }
            else {
                sqlReact = " SELECT Z.MSGID, Z.CHANID, Z.AUTHORID, Z.AUTHORNM, Z.REPLYTO, (SELECT BODYTEXT FROM S_MSGMST_TBL WHERE MSGID = Z.MSGID) BODYTEXT, '' SUBKIND, 'react' TITLE, MAX(CDT) DT ";
                sqlReact += "  FROM (SELECT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, A.CDT ";
                sqlReact += "          FROM S_MSGMST_TBL A ";
                sqlReact += "         INNER JOIN S_MSGDTL_TBL B ON A.MSGID = B.MSGID ";
                sqlReact += "         WHERE A.AUTHORID = '" + userid + "' AND B.TYP = 'react' ";
                sqlReact += "         UNION ALL ";
                sqlReact += "        SELECT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, A.CDT ";
                sqlReact += "          FROM S_MSGMST_TBL A ";
                sqlReact += "         INNER JOIN S_MSGDTL_TBL B ON A.MSGID = B.MSGID ";
                sqlReact += "         WHERE B.USERID = '" + userid + "' AND B.TYP = 'react') Z ";
                sqlReact += " GROUP BY Z.MSGID, Z.CHANID, Z.AUTHORID, Z.AUTHORNM, Z.REPLYTO ";
            }
            let sql = '';
            if (kind == 'mention') {
            }
            else if (kind == 'vip') {
                sql = sqlHeaderStart + sqlVip + sqlHeaderEnd;
            }
            else if (kind == 'thread') {
                sql = sqlHeaderStart + sqlThread + sqlHeaderEnd;
            }
            else if (kind == 'react') {
                sql = sqlHeaderStart + sqlReact + sqlHeaderEnd;
            }
            else {
                sql = sqlHeaderStart;
                sql += sqlVip + "UNION ALL ";
                sql += sqlThread + "UNION ALL ";
                sql += sqlReact;
                sql += sqlHeaderEnd;
            }
            sql += "INNER JOIN (" + sqlBasicAcl + ") Z ON Y.CHANID = Z.CHANID ";
            sql += " LEFT OUTER JOIN S_USER_TBL E ON Y.AUTHORID = E.USERID ";
            if (key1 && key2) {
                if (key2 == 'vip') {
                    sql += "WHERE Y.CHANID = '" + key1 + "' AND Y.TITLE = '" + key2 + "' ";
                }
                else {
                    sql += "WHERE Y.MSGID = '" + key1 + "' AND Y.TITLE = '" + key2 + "' ";
                }
            }
            else if (oldestMsgDt) {
                sql += "WHERE Y.DT >= '" + oldestMsgDt + "' ";
            }
            else {
                sql += "WHERE Y.DT < '" + prevMsgMstCdt + "' ";
            }
            sql += "ORDER BY Y.DT DESC ";
            if (!oldestMsgDt)
                sql += "LIMIT " + hush.cons.rowsCnt;
            console.log(sql);
            const list = await this.dataSource.query(sql, null);
            for (let i = 0; i < list.length; i++) {
                const row = list[i];
                if (row.TITLE == 'vip') {
                    let sql = "SELECT MSGID, BODYTEXT, REPLYTO, UDT CHKDT FROM S_MSGMST_TBL WHERE CHANID = ? AND AUTHORID = ? ORDER BY CDT DESC LIMIT 1 ";
                    const listSub = await this.dataSource.query(sql, [row.CHANID, row.AUTHORID]);
                    if (listSub.length == 0) {
                        row.LASTMSG = '없음';
                    }
                    else {
                        row.LASTMSG = listSub[0].BODYTEXT;
                    }
                    row.MSGID = listSub[0].MSGID;
                    row.REPLYTO = listSub[0].REPLYTO;
                    row.CHKDT = listSub[0].CHKDT;
                }
                else if (row.TITLE == 'thread') {
                    let sql = "SELECT BODYTEXT, UDT CHKDT FROM S_MSGMST_TBL WHERE REPLYTO = ? AND CHANID = ? ORDER BY CDT DESC LIMIT 1 ";
                    const listSub = await this.dataSource.query(sql, [row.MSGID, row.CHANID]);
                    if (listSub.length == 0) {
                        row.LASTMSG = '없음';
                        row.CHKDT = '';
                    }
                    else {
                        row.LASTMSG = listSub[0].BODYTEXT;
                        row.CHKDT = listSub[0].CHKDT;
                    }
                }
                else if (row.TITLE == 'react') {
                    row.LASTMSG = '';
                    let sql = "SELECT KIND, COUNT(KIND) CNT, GROUP_CONCAT(USERNM ORDER BY USERNM SEPARATOR \", \") NM, ";
                    sql += "          GROUP_CONCAT(USERID ORDER BY USERID SEPARATOR \", \") ID, MAX(UDT) CHKDT ";
                    sql += "     FROM S_MSGDTL_TBL ";
                    sql += "    WHERE MSGID = ? AND CHANID = ? AND TYP = 'react' ";
                    sql += "    GROUP BY KIND ";
                    sql += "    ORDER BY KIND ";
                    const listSub = await this.dataSource.query(sql, [row.MSGID, row.CHANID]);
                    if (listSub.length == 0) {
                        row.msgdtl = null;
                        row.CHKDT = '';
                    }
                    else {
                        row.msgdtl = listSub;
                        row.CHKDT = listSub[0].CHKDT;
                    }
                }
                let sql = "SELECT TYP FROM S_CHANMST_TBL WHERE CHANID = ? ";
                const listSub = await this.dataSource.query(sql, [row.CHANID]);
                if (listSub.length == 0) {
                    row.TYP = 'WS';
                }
                else {
                    row.TYP = listSub[0].TYP;
                }
                if (row.TYP == 'GS') {
                    const obj = await this.qryMembersWithPic(row.CHANID, userid, hush.cons.picCnt);
                    row.memcnt = obj.memcnt;
                    row.memnm = obj.memnm;
                    row.memid = obj.memid;
                    row.picCnt = obj.picCnt;
                    row.picture = obj.picture;
                    row.url = obj.url;
                }
            }
            resJson.list = list;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
    async qryGroup(dto) {
        const resJson = new resjson_1.ResJson();
        const userid = this.req['user'].userid;
        let fv = hush.addFieldValue(dto, null, [userid]);
        try {
            let sql = "SELECT A.GR_ID, A.GR_NM, A.MASTERID, A.MASTERNM, B.KIND, B.SYNC, CASE WHEN A.MASTERID = ? THEN '' ELSE 'other' END OTHER ";
            sql += "     FROM S_GRMST_TBL A ";
            sql += "    INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID ";
            sql += "    WHERE B.USERID = ? AND B.KIND = 'admin' ";
            sql += "    ORDER BY A.GR_NM, A.GR_ID ";
            const list = await this.dataSource.query(sql, [userid, userid]);
            if (list.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'menu>qryGroup');
            }
            resJson.list = list;
            return resJson;
        }
        catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv);
        }
    }
};
exports.MenuService = MenuService;
exports.MenuService = MenuService = __decorate([
    (0, common_1.Injectable)({ scope: common_1.Scope.REQUEST }),
    __param(1, (0, common_1.Inject)(core_1.REQUEST)),
    __metadata("design:paramtypes", [typeorm_1.DataSource, Object])
], MenuService);
//# sourceMappingURL=menu.service.js.map