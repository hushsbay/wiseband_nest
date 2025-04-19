import { Inject, Injectable, Scope, UploadedFile } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm'
import { Propagation, Transactional } from 'typeorm-transactional'

import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { MsgMst, MsgSub, MsgDtl, ChanMst, ChanDtl, GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity'

@Injectable({ scope: Scope.REQUEST })
export class ChanmsgService {
    
    constructor(
        @InjectRepository(MsgMst) private msgmstRepo: Repository<MsgMst>, 
        @InjectRepository(MsgSub) private msgsubRepo: Repository<MsgSub>, 
        @InjectRepository(MsgDtl) private msgdtlRepo: Repository<MsgDtl>, 
        @InjectRepository(ChanMst) private chanmstRepo: Repository<ChanMst>, 
        @InjectRepository(ChanDtl) private chandtlRepo: Repository<ChanDtl>, 
        @InjectRepository(GrMst) private grmstRepo: Repository<GrMst>, 
        @InjectRepository(GrDtl) private grdtlRepo: Repository<GrDtl>, 
        private dataSource : DataSource,
        @Inject(REQUEST) private readonly req: Request
    ) {}

    async chkAcl(dto: Record<string, any>): Promise<any> { //1) 각종 권한 체크 2) 각종 공통데이터 읽어 오기
        try {
            let data = { chanmst: null, chandtl: [], msgmst: null }
            const resJson = new ResJson()
            const { userid, chanid, msgid, includeBlob, chkAuthor } = dto //보통은 grid 없어도 chanid로 grid 가져와서 체크함 //grid, 
            console.log('chkAcl', userid, chanid, msgid, includeBlob, chkAuthor) //grid, 
            let fv = hush.addFieldValue([userid, chanid, msgid, includeBlob, chkAuthor], 'userid/chanid/msgid/includeBlob/chkAuthor') //grid, grid/
            //////////a) S_CHANMST_TBL + S_GRMST_TBL => TYP : WS(WorkSpace)/GS(GeneralSapce-S_GRMST_TBL비연동), STATE : 공개(A)/비공개(P)
            const chanmst = await this.chanmstRepo.createQueryBuilder('A')
            .select(['A.CHANNM', 'A.TYP', 'A.GR_ID', 'A.MASTERID', 'A.MASTERNM', 'A.STATE', 'A.RMKS'])
            .where("A.CHANID = :chanid and A.INUSE = 'Y' ", { 
                chanid: chanid 
            }).getOne()
            if (!chanmst) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkAcl>chanmst')
            }
            let grnm = ''
            if (chanmst.TYP == 'GS') {
                //S_GRMST_TBL 체크할 필요없음 (예: DM은 GR_ID 필요없는 GS 타입)
            } else {
                // if (grid) {
                //     if (grid != chanmst.GR_ID) {
                //         return hush.setResJson(resJson, '요청한 grid와 chanid가 속한 grid가 다릅니다.' + fv, hush.Code.NOT_OK, null, 'chanmsg>chkAcl>grid')
                //     }
                // }
                const gr = await this.grmstRepo.createQueryBuilder('A')
                .select(['A.GR_NM'])
                .innerJoin('A.dtl', 'B', 'A.GR_ID = B.GR_ID') 
                .where("A.GR_ID = :grid and A.INUSE = 'Y' and B.USERID = :userid ", { 
                    grid: chanmst.GR_ID, userid: userid 
                }).getOne()
                if (!gr) {
                    return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (이 채널의 그룹에 사용자가 없습니다)' + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkAcl>gr')
                }
                grnm = gr.GR_NM
            }
            data.chanmst = chanmst
            data.chanmst.GR_NM = grnm
            //////////b) S_CHANDTL_TBL 
            /* (지우지 말 것) 아래 TYPEORM으로 처리시 이미지 담기에 노력(****)이 들어가므로 간단히 그 아래 SQL로 처리함
            const chandtl = await this.chandtlRepo.createQueryBuilder('A')
            .select(['A.USERID', 'A.USERNM', 'A.STATE', 'A.KIND'])
            .where("A.CHANID = :chanid ", { 
                chanid: chanid 
            }).orderBy('A.USERNM', 'ASC').getMany()
            if (chandtl.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'chanmsg>qry>chandtl')
            }
            const userqb = this.userRepo.createQueryBuilder('A')
            for (let item of chandtl) {
                const user = await userqb
                .select(['A.PICTURE'])
                .where("A.USER_ID = :userid ", { 
                    userid: userid 
                }).getOne()
                if (user) { //(사진)이미지 없으면 그냥 넘어가면 됨
                    item.buffer = user.PICTURE //item.buffer이 entity에 없으므로 오류 발생 ****
                }
                if (item.USERID == userid) {
                    data.chanmst.USERID = item.USERID
                    data.chanmst.KIND = item.KIND
                    data.chanmst.STATE1 = item.STATE //STATE(공용,비밀)가 이미 S_CHANMST_TBL에 존재함 (여기는 S_CHANDTL_TBL의 STATE임=STATE1=매니저(M)/참여대기(W)/퇴장(X)/강제퇴장(Z))
                    break
                }
            } */
            const picFld = includeBlob ? ", B.PICTURE" : ""
            let sql = "SELECT A.USERID, A.USERNM, A.STATE, A.KIND " + picFld
            sql += "     FROM S_CHANDTL_TBL A "
            sql += "    INNER JOIN S_USER_TBL B ON A.USERID = B.USER_ID "
            sql += "    WHERE A.CHANID = ? "
            sql += "      AND A.STATE IN ('', 'M') " //사용중(빈칸)/매니저(M)/참여대기(W)/퇴장(X)/강제퇴장(Z)
            sql += "    ORDER BY A.USERNM "
            const chandtl = await this.dataSource.query(sql, [chanid])
            if (chandtl.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkAcl>chandtl')
            }
            for (let item of chandtl) {
                if (item.USERID == userid) {
                    data.chanmst.USERID = item.USERID
                    data.chanmst.KIND = item.KIND //R(읽기전용)
                    data.chanmst.STATE1 = item.STATE //S_CHANDTL_TBL의 STATE=STATE1임 : 매니저(M)/참여대기(W)/퇴장(X)/강제퇴장(Z)
                    break
                }
            }
            if (data.chanmst.STATE == 'A') {
                //공개(All)된 채널이므로 채널멤버가 아니어도 읽을 수 있음
            } else { //비공개(Private)
                if (!data.chanmst.USERID) {
                    return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (비공개 채널)' + fv, hush.Code.NOT_AUTHORIZED, null, 'chanmsg>chkAcl>private')
                }
            }
            if (data.chanmst.STATE1 == 'X' || data.chanmst.STATE1 == 'Z') { //퇴장 or 강제퇴장
                return hush.setResJson(resJson, '퇴장처리된 채널입니다.' + fv, hush.Code.NOT_AUTHORIZED, null, 'chanmsg>chkAcl>out')
            }
            data.chandtl = chandtl
            if (data.chanmst.STATE1 == 'W') { //초청받고 참여대기시엔 메시지는 안보여주기
                resJson.data = data
                return resJson
            } //data.chanmst.STATE1(M)=채널매니저,data.chanmst.KIND(R)=읽기전용은 클라이언트든 서버든 로직 추가될 수 있음
            //////////c) S_MSGMST_TBL
            if (msgid && msgid != userid) { //temp가 userid로 바뀌는 경우는 작성중인 파일,이미지,링크임
                let msgmst = await this.msgmstRepo.createQueryBuilder('A')
                .select(['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.KIND', 'A.REPLYTO', 'A.CDT', 'A.UDT'])
                .where("A.MSGID = :msgid and A.CHANID = :chanid ", { 
                    msgid: msgid, chanid: chanid
                }).getOne()
                if (!msgmst) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkAcl>msgmst')
                } //console.log(chkAuthor, userid, msgmst.AUTHORID)
                if (chkAuthor && userid != msgmst.AUTHORID) { //편집저장삭제 등의 경우임
                    return hush.setResJson(resJson, '작성자가 다릅니다.' + fv, hush.Code.NOT_OK, null, 'chanmsg>chkAcl>chkAuthor')
                }
                data.msgmst = msgmst
            }
            resJson.data = data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryMsgDtlForUser(qb: SelectQueryBuilder<MsgDtl>, msgid: string, chanid: string, userid: string): Promise<any> { //d-0) S_MSGDTL_TBL
        const retObj = { act_later: null, act_fixed: null }
        const msgdtlforuser = await qb //예) "later","stored","finished"는 한몸으로서 해당 사용자만 조회해 보여줘야 하는 데이터임. 필요할 경우 CASE WHEN으로 추가해 관리해야 함
        .select([
            'B.KIND KIND', 
            'CASE WHEN KIND in ("later","stored","finished") THEN "act_later" ' +
                 'WHEN KIND in ("fixed") THEN "act_fixed" ' +
                 'else "" end KIND_ACTION'
        ])
        .where("B.MSGID = :msgid and B.CHANID = :chanid and B.USERID = :userid and B.TYP = 'user' ", { 
            msgid: msgid, chanid: chanid, userid: userid
        }).getRawMany()
        for (let j = 0; j < msgdtlforuser.length; j++) {
            if (msgdtlforuser[j].KIND_ACTION == 'act_later') {
                retObj.act_later = msgdtlforuser[j].KIND //later or stored or finished
            } else if (msgdtlforuser[j].KIND_ACTION == 'act_fixed') {
                retObj.act_fixed = msgdtlforuser[j].KIND //현재는 fixed 한개임
            }
        }
        return retObj
    }

    async qryMsgDtl(qb: SelectQueryBuilder<MsgDtl>, msgid: string, chanid: string): Promise<any> { //d-1) S_MSGDTL_TBL
        const msgdtl = await qb
        .select(['B.KIND KIND', 'COUNT(B.KIND) CNT', 'GROUP_CONCAT(B.USERNM ORDER BY B.USERNM SEPARATOR ", ") NM', 'GROUP_CONCAT(B.USERID ORDER BY B.USERID SEPARATOR ", ") ID'])
        .where("B.MSGID = :msgid and B.CHANID = :chanid and B.TYP = '' ", { //and B.KIND not in ('read', 'unread') 화면에는 notyet만 보여주면 read, unread는 안보여줘도 알 수 있음
            msgid: msgid, chanid: chanid
        }).groupBy('B.KIND').orderBy('B.KIND', 'ASC').getRawMany()
        return (msgdtl.length > 0) ? msgdtl : []
    }

    async qryMsgSub(qb: SelectQueryBuilder<MsgSub>, msgid: string, chanid: string): Promise<any> { //d-2) S_MSGSUB_TBL
        const msgsub = await qb
        .select(['C.KIND', 'C.CDT', 'C.BODY', 'C.BUFFER', 'C.FILESIZE'])
        .where("C.MSGID = :msgid and C.CHANID = :chanid ", { 
            msgid: msgid, chanid: chanid
        }).orderBy('C.KIND', 'ASC').addOrderBy('C.CDT', 'ASC').getMany()
        if (msgsub.length > 0) {
            const msgfile = msgsub.filter((val) => val.KIND == 'F' || val.KIND == 'f')
            const msgimg = msgsub.filter((val) => val.KIND == 'I' || val.KIND == 'i')
            const msglink = msgsub.filter((val) => val.KIND == 'L')
            return { msgfile: msgfile, msgimg: msgimg, msglink: msglink }
        } else {
            return { msgfile: [], msgimg: [], msglink: [] }
        }
    }

    async qryReply(qb: SelectQueryBuilder<MsgMst>, msgid: string, chanid: string): Promise<any> { //d-3) S_MSGMST_TBL
        // const reply = await qb.select(['A.MSGID MSGID', 'A.AUTHORID AUTHORID', 'A.AUTHORNM AUTHORNM', '(CASE WHEN A.CDT > A.UDT THEN A.CDT ELSE A.UDT END) DT']) //3) 댓글
        // .where("A.CHANID = :chanid and A.REPLYTO = :msgid ", { 
        //     chanid: chanid, msgid: item.MSGID 
        // }).orderBy('DT', 'DESC').getRawMany()
        const reply = await qb
        .select('AUTHORID').addSelect('AUTHORNM')
        .distinct(true)
        .where("CHANID = :chanid and REPLYTO = :msgid ", { 
            chanid: chanid, msgid: msgid
        }).groupBy('AUTHORID').addGroupBy('AUTHORNM')
        .orderBy('AUTHORNM', 'ASC').limit(hush.cons.replyCntLimit).getRawMany()
        return (reply.length > 0) ? reply : []
    }

    async qryReplyInfo(msgid: string, chanid: string, userid: string): Promise<any> { //d-4) S_MSGMST_TBL
        let sql = "SELECT SUM(CNT) CNT_BY_USER, "
        sql += "          (SELECT COUNT(*) FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = ?) CNT_EACH, "
        sql += "          (SELECT MAX(CDT) FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = ?) CDT_MAX "
        sql += "     FROM (SELECT 1 CNT "
        sql += "             FROM S_MSGMST_TBL "
        sql += "            WHERE CHANID = ? AND REPLYTO = ? "
        sql += "            GROUP BY AUTHORID) Z "
        const replyInfo = await this.dataSource.query(sql, [chanid, msgid, chanid, msgid, chanid, msgid])
        // if (replyInfo.length == 0) { //함수 밖에서 체크해야 하나 일단 막음
        //     let fv = hush.addFieldValue([chanid, item.MSGID], 'chanid/item.MSGID')
        //     return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>qry>replyInfo')
        // }
        sql = "SELECT COUNT(*) MYNOTYETCNT " //내가 아직 안읽은 댓글 갯수가 스레드를 열지 않으면 안보이므로 표시하도록 함
        sql += " FROM S_MSGDTL_TBL "
        sql += "WHERE MSGID IN (SELECT MSGID FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = ?) "
        sql += "  AND CHANID = ? AND USERID = ? AND KIND = 'notyet'  "
        const replyUnread = await this.dataSource.query(sql, [chanid, msgid, chanid, userid])
        replyInfo.MYNOTYETCNT = replyUnread[0].MYNOTYETCNT
        return replyInfo
    }

    ///////////////////////////////////////////////////////////////////////////////위는 서비스내 공통 모듈

    async qry(dto: Record<string, any>): Promise<any> {
        try { //어차피 권한체크때문이라도 chanmst,chandtl를 읽어야 하므로 읽는 김에 데이터 가져와서 사용하기로 함
            let data = { 
                chanmst: null, chandtl: [], msglist: [], tempfilelist: [], tempimagelist: [], templinklist: [], 
                msgidParent: '', msgidChild: '' 
            }
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { chanid, lastMsgMstCdt, firstMsgMstCdt, msgid, kind } = dto //grid, 
            //console.log("qry", lastMsgMstCdt, firstMsgMstCdt, msgid, kind)
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, includeBlob: true }) //a),b),c) 가져옴 //msgid 들어가면 안됨 //grid: grid, 
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>qry')
            data.chanmst = rs.data.chanmst
            data.chandtl = rs.data.chandtl
            const qb = this.msgmstRepo.createQueryBuilder('A')
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B')
            const qbSub = this.msgsubRepo.createQueryBuilder('C')
            ///////////////////////////////////////////////////////////d) S_MSGMST_TBL (목록 읽어옴 - 댓글 및 S_MSGDTL_TBL, S_MSGSUB_TBL 포함)
            const fldArr = ['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.KIND', 'A.CDT', 'A.UDT']
            let msglist: MsgMst[]
            if (firstMsgMstCdt) { //ASC임을 유의
                if (kind == 'scrollToBottom') {
                    msglist = await qb.select(fldArr)
                    .where("A.CHANID = :chanid and A.CDT > :firstcdt and A.REPLYTO = '' ", { 
                        chanid: chanid, firstcdt: firstMsgMstCdt
                    }).orderBy('A.CDT', 'ASC').getMany()
                } else {
                    msglist = await qb.select(fldArr)
                    .where("A.CHANID = :chanid and A.CDT > :firstcdt and A.REPLYTO = '' ", { 
                        chanid: chanid, firstcdt: firstMsgMstCdt
                    }).orderBy('A.CDT', 'ASC').limit(hush.cons.rowsCnt).getMany()
                }
                //console.log("firstMsgMstCdt", firstMsgMstCdt, msglist.length)
            } else if (lastMsgMstCdt) {
                msglist = await qb.select(fldArr)
                .where("A.CHANID = :chanid and A.CDT < :lastcdt and A.REPLYTO = '' ", { 
                    chanid: chanid, lastcdt: lastMsgMstCdt
                }).orderBy('A.CDT', 'DESC').limit(hush.cons.rowsCnt).getMany()
                //console.log("lastMsgMstCdt", lastMsgMstCdt, msglist.length)
            } else if (msgid && kind == 'atHome') { 
                //댓글에 들어 있으면 그 댓글의 부모를 기준으로 데이터 가져오기. 클라이언트에서 넘어와도 되지만 복잡해서 서버에서 처리함
                let msgmst = await this.msgmstRepo.createQueryBuilder('A')
                .select(['A.REPLYTO'])
                .where("A.MSGID = :msgid and A.CHANID = :chanid ", { 
                    msgid: msgid, chanid: chanid
                }).getOne()
                if (!msgmst) {
                    let fv = hush.addFieldValue([userid, chanid, msgid], 'userid/chanid/msgid')
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>qry>atHome>MsgMst')
                } 
                const msgidParent = msgmst.REPLYTO ? msgmst.REPLYTO : msgid
                const fields = fldArr.join(", ").replace(/A\./g, "") + " " 
                const tbl = "FROM S_MSGMST_TBL "
                const where = "WHERE CHANID = '" + chanid + "' AND REPLYTO = '' "
                const cnt = Math.floor(hush.cons.rowsCnt / 2)
                let sql = "SELECT " + fields
                sql += "     FROM ((SELECT " + fields + tbl + where
                sql += "               AND MSGID < ? "
                sql += "             ORDER BY CDT DESC LIMIT " + cnt + ") "
                sql += "             UNION ALL "
                sql += "           (SELECT " + fields + tbl + where
                sql += "               AND MSGID = ?) "
                sql += "             UNION ALL "
                sql += "           (SELECT " + fields + tbl + where
                sql += "               AND MSGID > ? "
                sql += "             ORDER BY CDT ASC LIMIT " + cnt + ")) Z "
                sql += "    ORDER BY CDT DESC " //console.log(sql, "####")
                msglist = await this.dataSource.query(sql, [msgidParent, msgidParent, msgidParent])
                if (msglist.length == 0) { //atHome(홈에서 열기)이므로 데이터가 반드시 있어야 함
                    let fv = hush.addFieldValue([chanid, msgid, msgidParent, kind], 'chanid/msgid/msgidParent/kind') //grid, grid/
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'chanmsg>qry>atHome')
                } //위의 msgid는 부모글일 수도 댓글일 수도 있지만 아래 2행은 무조건 부모글과 자식글로 구분해서 전달함
                data.msgidParent = msgidParent //HomeBody.vue의 getList()에서 사용
                data.msgidChild = msgid //HomeBody.vue의 getList()에서 사용. msgidParent와 다르면 이건 댓글의 msgid임
            } else if (msgid && kind == 'withReply') { //ASC임을 유의
                const fields = fldArr.join(", ").replace(/A\./g, "") + " " 
                const tbl = "FROM S_MSGMST_TBL "
                let sql = "SELECT " + fields + tbl + " WHERE MSGID = ? AND CHANID = ? "
                sql += "    UNION ALL "
                sql += "   SELECT " + fields + tbl + " WHERE REPLYTO = ? AND CHANID = ? "    
                sql += "    ORDER BY CDT ASC "
                msglist = await this.dataSource.query(sql, [msgid, chanid, msgid, chanid])
                if (msglist.length == 0) { //사용자가 마스터 선택했으므로 데이터가 반드시 있어야 함
                    let fv = hush.addFieldValue([chanid, msgid, kind], 'chanid/msgid/kind') //grid, grid/
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'menu>qry>withReply')
                }
            } else if (kind == 'notyet' || kind == 'unread') {
                const fields = fldArr.join(", ") + " " 
                let sql = "SELECT " + fields
                sql += "     FROM S_MSGMST_TBL A "
                sql += "     LEFT OUTER JOIN S_MSGDTL_tbl B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID "
                sql += "    WHERE B.CHANID = ? AND B.USERID = ? AND B.KIND = ? "
                sql += "    ORDER BY A.CDT DESC "
                sql += "    LIMIT 1000 "
                msglist = await this.dataSource.query(sql, [chanid, userid, kind])
            }
            if (msglist.length > 0) data.msglist = msglist
            ///////////////////////////////////////////////////////////d-1),d-2),d-3),d-4)
            for (let i = 0; i < data.msglist.length; i++) {
                const item = data.msglist[i]
                const msgdtlforuser = await this.qryMsgDtlForUser(qbDtl, item.MSGID, chanid, userid) //d-0) S_MSGDTL_TBL (본인액션만 가져오기)
                item.act_later = msgdtlforuser.act_later
                item.act_fixed = msgdtlforuser.act_fixed
                const msgdtl = await this.qryMsgDtl(qbDtl, item.MSGID, chanid) //d-1) S_MSGDTL_TBL (각종 이모티콘)
                item.msgdtl = (msgdtl.length > 0) ? msgdtl : []
                const msgsub = await this.qryMsgSub(qbSub, item.MSGID, chanid) //d-2) S_MSGSUB_TBL (파일, 이미지, 링크 등)
                item.msgfile = msgsub.msgfile
                item.msgimg = msgsub.msgimg
                item.msglink = msgsub.msglink
                const reply = await this.qryReply(qb, item.MSGID, chanid) //d-3) S_MSGMST_TBL (댓글-스레드)
                item.reply = (reply.length > 0) ? reply : []
                const replyInfo = await this.qryReplyInfo(item.MSGID, chanid) //d-4) S_MSGMST_TBL (댓글-스레드)
                item.replyinfo = replyInfo
            }
            ///////////////////////////////////////////////////////////e) S_MSGSUB_TBL (메시지에 저장하려고 올렸던 임시 저장된 파일/이미지/링크)
            const arr = ['F', 'I', 'L'] //파일,이미지,링크
            for (let i = 0; i < arr.length; i++) {
                const msgsub = await qbSub
                .select(['C.CDT', 'C.BODY', 'C.BUFFER', 'C.FILESIZE'])
                .where("C.MSGID = :userid and C.CHANID = :chanid and C.KIND = :kind ", { 
                    userid: userid, chanid: chanid, kind: arr[i]
                }).orderBy('C.CDT', 'ASC').getMany()
                if (msgsub.length > 0) {
                    if (i == 0) { //console.log(arr[i], JSON.stringify(msgsub))
                        data.tempfilelist = msgsub
                    } else if (i == 1) {
                        data.tempimagelist = msgsub
                    } else {
                        data.templinklist = msgsub
                    }
                }
            }            
            resJson.data = data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryMsg(dto: Record<string, any>): Promise<any> {
        try {
            let data = { msgmst: null, act_later: null, act_fixed: null, msgdtl: null, msgfile: null, msgimg: null, msglink: null, reply: null, replyinfo: null }
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { chanid, msgid } = dto //let fv = hush.addFieldValue([chanid, msgid], 'chanid/msgid')
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, includeBlob: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>qryMsg')
            const qb = this.msgmstRepo.createQueryBuilder('A')
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B')
            const qbSub = this.msgsubRepo.createQueryBuilder('C')
            ///////////////////////////////////////////////////////////d) S_MSGMST_TBL
            const msgmst = await qb.select(['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.KIND', 'A.CDT', 'A.UDT'])
            .where("A.MSGID = :msgid and A.CHANID = :chanid ", { 
                msgid: msgid, chanid: chanid
            }).getOne()
            data.msgmst = msgmst
            ////////////////////////////////////////////////////////////////////////////////////////////
            const msgdtlforuser = await this.qryMsgDtlForUser(qbDtl, msgid, chanid, userid) //d-0) S_MSGDTL_TBL (본인액션만 가져오기)
            data.act_later = msgdtlforuser.act_later
            data.act_fixed = msgdtlforuser.act_fixed
            const msgdtl = await this.qryMsgDtl(qbDtl, msgid, chanid) //d-1) S_MSGDTL_TBL (각종 이모티콘)
            data.msgdtl = (msgdtl.length > 0) ? msgdtl : []
            const msgsub = await this.qryMsgSub(qbSub, msgid, chanid) //d-2) S_MSGSUB_TBL (파일, 이미지, 링크 등)
            data.msgfile = msgsub.msgfile
            data.msgimg = msgsub.msgimg
            data.msglink = msgsub.msglink
            const reply = await this.qryReply(qb, msgid, chanid) //d-3) S_MSGMST_TBL (댓글-스레드)
            data.reply = (reply.length > 0) ? reply : []
            const replyInfo = await this.qryReplyInfo(msgid, chanid) //d-4) S_MSGMST_TBL (댓글-스레드)
            data.replyinfo = replyInfo
            ////////////////////////////////////////////////////////////////////////////////////////////
            resJson.data = data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryActionForUser(dto: Record<string, any>): Promise<any> { //chkAcl()이 없음을 유의 - 권한체크안해도 무방하다고 판단함
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { chanid, msgid } = dto
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B')
            const msgdtlforuser = await this.qryMsgDtlForUser(qbDtl, msgid, chanid, userid) //d-0) S_MSGDTL_TBL (본인액션만 가져오기)
            resJson.data = msgdtlforuser //데이터 없어도 없는대로 넘기기 (안그러면 사용자에게 소켓통신 통해 정보요청이 올 때마다 뜨게됨)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryAction(dto: Record<string, any>): Promise<any> { //chkAcl()이 없음을 유의 - 권한체크안해도 무방하다고 판단함
        try {
            const resJson = new ResJson()
            const { chanid, msgid } = dto
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B')
            const msgdtl = await this.qryMsgDtl(qbDtl, msgid, chanid) //d-1) S_MSGDTL_TBL (각종 이모티콘)
            resJson.data = msgdtl //데이터 없어도 없는대로 넘기기 (안그러면 사용자에게 소켓통신 통해 정보요청이 올 때마다 뜨게됨)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async saveMsg(dto: Record<string, any>): Promise<any> {
        try {            
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const usernm = this.req['user'].usernm
            const { crud, chanid, replyto, body, bodytext, num_file, num_image, num_link } = dto //crud는 C or U만 처리 
            let msgid = dto.msgid //console.log(userid, msgid, chanid, crud, replyto, body, num_file, num_image)
            let fv = hush.addFieldValue([msgid, chanid, replyto, crud, num_file, num_image, num_link], 'msgid/chanid/replyto/crud/num_file/num_image/num_link')
            if (crud == 'C' || crud == 'U') { //replyto(댓글)는 신규 작성일 경우만 존재
                if (!chanid || (!body && num_file == 0 && num_image == 0 && num_link == 0)) {
                    return hush.setResJson(resJson, hush.Msg.BLANK_DATA + fv, hush.Code.BLANK_DATA, this.req, 'chanmsg>saveMsg')    
                }
                let rs: ResJson
                if (crud == 'C') {
                    if (replyto) { //부모메시지 존재 여부만 체크
                        rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: replyto })    
                    } else {
                        rs = await this.chkAcl({ userid: userid, chanid: chanid })
                    }
                } else {
                    rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid, chkAuthor: true })
                }
                if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>saveMsg')
            } else {
                return hush.setResJson(resJson, 'crud값은 C/U중 하나여야 합니다.' + fv, hush.Code.NOT_OK, this.req, 'chanmsg>saveMsg')
            }
            const qbMsgMst = this.msgmstRepo.createQueryBuilder()
            if (crud == 'C') {
                const unidObj = await qbMsgMst.select(hush.cons.unidMySqlStr).getRawOne()
                msgid = unidObj.ID
                await qbMsgMst
                .insert().values({ 
                    MSGID: msgid, CHANID: chanid, AUTHORID: userid, AUTHORNM: usernm, REPLYTO: replyto ? replyto : '', BODY: body, BODYTEXT: bodytext, CDT: unidObj.DT
                }).execute()
                const qbMsgSub = this.msgsubRepo.createQueryBuilder()
                let arr = []
                if (num_file > 0) arr.push('F')
                if (num_image > 0) arr.push('I')
                if (num_link > 0) arr.push('L')
                for (let i = 0; i < arr.length; i++) {
                    const msgsub = await qbMsgSub
                    .select("COUNT(*) CNT")
                    .where("MSGID = :userid and CHANID = :chanid and KIND = :kind ", {
                        userid: userid, chanid: chanid, kind: arr[i]
                    }).getRawOne()
                    if (msgsub.CNT > 0) {
                        await qbMsgSub
                        .update()
                        .set({ MSGID: msgid })
                        .where("MSGID = :userid and CHANID = :chanid and KIND = :kind ", {
                            userid: userid, chanid: chanid, kind: arr[i]
                        }).execute()
                    }
                }
                const qbMsgDtl = this.msgdtlRepo.createQueryBuilder()
                const chandtl = await this.chandtlRepo.createQueryBuilder('A')
                .select(['A.USERID', 'A.USERNM'])
                .where("A.CHANID = :chanid and A.STATE in ('', 'M') ", { 
                    chanid: chanid
                }).getMany()
                chandtl.forEach(async (item) => {
                    const strKind = (item.USERID == userid) ? 'read' : 'notyet'
                    await qbMsgDtl
                    .insert().values({ 
                        MSGID: msgid, CHANID: chanid, USERID: item.USERID, KIND: strKind, TYP: '', CDT: unidObj.DT, USERNM: item.USERNM
                    }).execute()
                })
                resJson.data.msgid = msgid
            } else { //현재 U에서는 S_MSGMST_TBL만 수정하는 것으로 되어 있음 (슬랙도 파일,이미지,링크 편집은 없음)
                const curdtObj = await qbMsgMst.select(hush.cons.curdtMySqlStr).getRawOne()
                await qbMsgMst
                .update()
                .set({ BODY: body, BODYTEXT: bodytext, UDT: curdtObj.DT })
                .where("MSGID = :msgid and CHANID = :chanid ", {
                    msgid: msgid, chanid: chanid
                }).execute()
            }
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async delMsg(dto: Record<string, any>): Promise<any> {        
        try { //메시지 마스터를 삭제하면 거기에 딸려 있는 서브와 디테일 테이블 정보는 소용없으므로 모두 삭제함 (~DEL_TBL로 이동시킴)
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { msgid, chanid } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid, chkAuthor: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>delMsg')            
            let sql = "INSERT INTO S_MSGMSTDEL_TBL (MSGID, CHANID, AUTHORID, AUTHORNM, BODY, REPLYTO, KIND, CDT, UDT) "
            sql += "   SELECT MSGID, CHANID, AUTHORID, AUTHORNM, BODY, REPLYTO, KIND, CDT, UDT "
            sql += "     FROM S_MSGMST_TBL "
            sql += "    WHERE MSGID = ? AND CHANID = ? AND AUTHORID = ? "
            await this.dataSource.query(sql, [msgid, chanid, userid])
            sql = " INSERT INTO S_MSGSUBDEL_TBL (MSGID, CHANID, KIND, BODY, BUFFER, FILESIZE, CDT, UDT) "
            sql += "SELECT MSGID, CHANID, KIND, BODY, BUFFER, FILESIZE, CDT, UDT "
            sql += "     FROM S_MSGSUB_TBL "
            sql += "    WHERE MSGID = ? AND CHANID = ? "
            await this.dataSource.query(sql, [msgid, chanid])
            sql = " INSERT INTO S_MSGDTLDEL_TBL (MSGID, CHANID, USERID, USERNM, KIND, BODY, CDT, UDT) "
            sql += "SELECT MSGID, CHANID, USERID, USERNM, KIND, BODY, CDT, UDT "
            sql += "     FROM S_MSGDTL_TBL "
            sql += "    WHERE MSGID = ? AND CHANID = ? "
            await this.dataSource.query(sql, [msgid, chanid])
            await this.msgmstRepo.createQueryBuilder()
            .delete()
            .where("MSGID = :msgid and CHANID = :chanid ", {
                msgid: msgid, chanid: chanid
            }).execute()
            await this.msgsubRepo.createQueryBuilder()
            .delete()
            .where("MSGID = :msgid and CHANID = :chanid ", {
                msgid: msgid, chanid: chanid
            }).execute()
            await this.msgdtlRepo.createQueryBuilder()
            .delete()
            .where("MSGID = :msgid and CHANID = :chanid ", {
                msgid: msgid, chanid: chanid
            }).execute()
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async updateWithNewKind(dto: Record<string, any>): Promise<any> { //TX 필요없음
        try {            
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { msgid, chanid, oldKind, newKind } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>updateWithNewKind')
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder('B')
            const curdtObj = await qbMsgDtl.select(hush.cons.curdtMySqlStr).getRawOne()
            await qbMsgDtl
            .update()
            .set({ KIND: newKind, UDT: curdtObj.DT })
            .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                msgid: msgid, chanid: chanid, userid: userid, kind: oldKind
            }).execute()
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }
    
    async toggleAction(dto: Record<string, any>): Promise<any> { //TX 필요없음
        try {            
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const usernm = this.req['user'].usernm
            const { msgid, chanid, kind } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>toggleAction')
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder()
            const curdtObj = await qbMsgDtl.select(hush.cons.curdtMySqlStr).getRawOne()
            const msgdtl = await qbMsgDtl
            .select("COUNT(*) CNT")
            .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                msgid: msgid, chanid: chanid, userid: userid, kind: kind
            }).getRawOne()
            if (msgdtl.CNT > 0) {
                await qbMsgDtl
                .delete()
                .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                    msgid: msgid, chanid: chanid, userid: userid, kind: kind
                }).execute()
            } else {                
                await qbMsgDtl
                .insert().values({ 
                    MSGID: msgid, CHANID: chanid, USERID: userid, KIND: kind, CDT: curdtObj.DT, USERNM: usernm, TYP: ''
                }).execute()
            }
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async changeAction(dto: Record<string, any>): Promise<any> { //TX 필요없음
        try {            
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const usernm = this.req['user'].usernm
            const { msgid, chanid, kind, job } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>changeAction')
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder()
            const curdtObj = await qbMsgDtl.select(hush.cons.curdtMySqlStr).getRawOne()
            if (kind == 'later' || kind == 'stored' || kind == 'finished') {
                const msgdtlforuser = await qbMsgDtl
                .select("KIND")
                .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND in ('later', 'stored', 'finished') ", {
                    msgid: msgid, chanid: chanid, userid: userid
                }).getRawOne() //console.log(msgdtl.length, "@@@@@@@@@@")
                if (!msgdtlforuser) {
                    await qbMsgDtl
                    .insert().values({ 
                        MSGID: msgid, CHANID: chanid, USERID: userid, KIND: kind, TYP: 'user', CDT: curdtObj.DT, USERNM: usernm
                    }).execute()
                    resJson.data.work = "create"
                } else {
                    if (job == 'delete') {
                        await qbMsgDtl
                        .delete()
                        .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                            msgid: msgid, chanid: chanid, userid: userid, kind: kind
                        }).execute()
                    } else { //update
                        await qbMsgDtl
                        .update()
                        .set({ KIND: job })
                        .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind and TYP = 'user' ", {
                            msgid: msgid, chanid: chanid, userid: userid, kind: kind
                        }).execute()
                    }
                    resJson.data.work = "delete" //'나중에' 패널에 보이는 행을 제거하기
                }
            } else if (kind == 'fixed') {
                const msgdtlforuser = await qbMsgDtl
                .select("KIND")
                .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                    msgid: msgid, chanid: chanid, userid: userid, kind: kind
                }).getRawOne() //console.log(msgdtl.length, "@@@@@@@@@@")
                if (!msgdtlforuser) {
                    await qbMsgDtl
                    .insert().values({ 
                        MSGID: msgid, CHANID: chanid, USERID: userid, KIND: kind, TYP: 'user', CDT: curdtObj.DT, USERNM: usernm
                    }).execute()
                    resJson.data.work = "create"
                } else {
                    await qbMsgDtl
                    .delete()
                    .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                        msgid: msgid, chanid: chanid, userid: userid, kind: kind
                    }).execute()
                    resJson.data.work = "delete"
                }
            }
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async uploadBlob(dto: Record<string, any>, @UploadedFile() file: Express.Multer.File): Promise<any> {
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { msgid, chanid, kind, body, filesize } = dto 
            console.log(userid, msgid, chanid, kind, body, filesize)
            const rs = await this.chkAcl({ userid: userid, msgid: msgid, chanid: chanid, chkAuthor: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>uploadBlob')
            const qbMsgSub = this.msgsubRepo.createQueryBuilder()
            const curdtObj = await qbMsgSub.select(hush.cons.curdtMySqlStr).getRawOne()
            await qbMsgSub.insert().values({
                MSGID: userid, CHANID: chanid, KIND: kind, BODY: body, FILESIZE: filesize, CDT: curdtObj.DT, 
                BUFFER: (kind != 'L') ? Buffer.from(new Uint8Array(file.buffer)) : null 
            }).execute()
            resJson.data.cdt = curdtObj.DT
            //임시 코딩 - 사진 넣기 시작
            // if (kind == 'I') {
            //     console.log(userid, chanid, kind, body, filesize, "@@@@@@")
            //     let sql = "UPDATE S_USER_TBL set PICTURE = ? WHERE USER_ID = ? "
            //     await this.dataSource.query(sql, [Buffer.from(new Uint8Array(file.buffer)), userid])
            // }
            //임시 코딩 - 사진 넣기 끝
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async delBlob(dto: Record<string, any>): Promise<any> { //temp일 상태와 msgid가 있는 상태 모두 여기서 처리하는 것임        
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const msgid = (dto.msgid == 'temp') ? userid : dto.msgid //temp는 채널별로 사용자가 메시지 저장(발송)전에 미리 업로드한 것임
            const { chanid, kind, cdt } = dto //console.log(userid, msgid, chanid, kind, cdt)
            const rs = await this.chkAcl({ userid: userid, msgid: msgid, chanid: chanid, chkAuthor: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>delBlob')
            await this.msgsubRepo.createQueryBuilder()
            .delete()
            .where("MSGID = :msgid and CHANID = :chanid and KIND = :kind and CDT = :cdt ", {
                msgid: msgid, chanid: chanid, kind: kind, cdt: cdt
            }).execute()
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async readBlob(dto: Record<string, any>): Promise<any> { //파일,이미지 읽어서 다운로드. 파일의 경우 파일시스템이 아닌 db에 저장하는 것을 전제로 한 것임
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const msgid = (dto.msgid == 'temp') ? userid : dto.msgid //temp는 채널별로 사용자가 메시지 저장(발송)전에 미리 업로드한 것임
            const { chanid, kind, cdt, name } = dto //console.log(userid, msgid, chanid, kind, cdt, name)
            let fv = hush.addFieldValue([msgid, chanid, kind, cdt, name], 'msgid/chanid/kind/cdt/name')
            const rs = await this.chkAcl({ userid: userid, chanid: chanid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>readBlob')
            const msgsub = await this.msgsubRepo.createQueryBuilder('A')
            .select(['A.BUFFER'])
            .where("MSGID = :msgid and CHANID = :chanid and KIND = :kind and CDT = :cdt ", { //and BODY = :name ", { //Image도 조회해야 해서 name은 막음
                msgid: msgid, chanid: chanid, kind: kind, cdt: cdt //, name: name //name은 없어도 될 것이나 더 정확한 조회 목적임
            }).getOne()
            if (!msgsub) {                
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'chanmsg>readBlob')
            }
            resJson.data = msgsub
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

}

/*
(1)은 아래 RAW SQL과 동일 : 아래 SQL말고 다른 SQL은 JOIN보다 테이블별로 QUERY 분리해서 짜는 것이 효율적임
SELECT A.GR_NM
  FROM S_GRMST_TBL A 
 INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID
 WHERE A.GR_ID = '20250120084532918913033423' AND A.INUSE = 'Y' AND B.USERID = 'oldclock'
*/