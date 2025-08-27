import { Inject, Injectable, Scope, UploadedFile } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, SelectQueryBuilder, Brackets } from 'typeorm'
import { Propagation, Transactional } from 'typeorm-transactional'
import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { UserService } from 'src/user/user.service'
import { MailService } from 'src/mail/mail.service'
import { MsgMst, MsgSub, MsgDtl, ChanMst, ChanDtl, GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity'
import { User } from 'src/user/user.entity'

// interface IDataLog {
//     MSGID: string, 
//     REPLYTO: string, 
//     CUD: string, 
//     MAX_CDT: string, 
//     msgItem: any,
//     SKIP: boolean //~Each로 정해지면 이건 막기로 함 (필요없어짐)
// }

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
        @InjectRepository(User) private userRepo: Repository<User>, 
        private dataSource : DataSource,
        private userSvc: UserService,
        private mailSvc: MailService, 
        @Inject(REQUEST) private readonly req: Request
    ) {}

    async chkAcl(dto: Record<string, any>): Promise<any> { //1) 각종 권한 체크 2) 각종 공통데이터 읽어 오기
        const methodName = 'chanmsg>chkAcl'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            let data = { chanmst: null, chandtl: [], msgmst: null }
            const { userid, grid, chanid, msgid, includeBlob, chkAuthor, chkGuest } = dto //보통은 grid 없어도 chanid로 grid 가져와서 체크
            //////////a) S_CHANMST_TBL + S_GRMST_TBL => TYP : WS(WorkSpace)/GS(GeneralSapce-S_GRMST_TBL비연동), STATE : 공개(A)/비공개(P)
            const chanmst = await this.chanmstRepo.createQueryBuilder('A')
            .select(['A.CHANNM', 'A.TYP', 'A.GR_ID', 'A.MASTERID', 'A.MASTERNM', 'A.STATE'])
            .where("A.CHANID = :chanid ", { 
                chanid: chanid 
            }).getOne()
            //let sql = "SELECT CHANNM, TYP, GR_ID, MASTERID, MASTERNM, STATE FROM S_CHANMST_TBL WHERE CHANID = ? "
            //const list = await this.dataSource.query(sql, [chanid])
            //const chanmst = list[0] //chanmst를 typeorm으로 가져 오니 느린 적 있어 전환한 것임
            if (!chanmst) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, methodName + '>chanmst')
            }
            let grnm = ''
            if (chanmst.TYP == 'GS') {
                //S_GRMST_TBL 체크할 필요없음 (예: DM은 GR_ID 필요없는 GS 타입)
            } else {
                if (grid) {
                    if (grid != chanmst.GR_ID) {
                        return hush.setResJson(resJson, '요청한 grid와 chanid가 속한 grid가 다릅니다.' + fv, hush.Code.NOT_OK, null, methodName + '>grid')
                    }
                } //속도가 느려 그 아래 sql문으로 대체함
                // const gr = await this.grmstRepo.createQueryBuilder('A')
                // .select(['A.GR_NM'])
                // .innerJoin('A.dtl', 'B', 'A.GR_ID = B.GR_ID') 
                // .where("A.GR_ID = :grid and B.USERID = :userid ", { 
                //     grid: chanmst.GR_ID, userid: userid 
                // }).getOne()
                // if (!gr) {
                //     return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (이 채널의 그룹에 해당 사용자가 없습니다)' + fv, hush.Code.NOT_FOUND, null, methodName + '>gr')
                // }
                //grnm = gr.GR_NM
                let sql = "SELECT A.GR_NM "
                sql += "     FROM S_GRMST_TBL A "
                sql += "    INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID "
                sql += "    WHERE A.GR_ID = ? AND B.USERID = ? "
                const list = await this.dataSource.query(sql, [chanmst.GR_ID, userid])
                if (list.length == 0) {
                    return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (이 채널의 그룹에 해당 사용자가 없습니다)' + fv, hush.Code.NOT_FOUND, null, methodName)
                }
                grnm = list[0].GR_NM
            }
            data.chanmst = chanmst
            data.chanmst.GR_NM = grnm
            //////////b) S_CHANDTL_TBL 
            let sql = "SELECT USERID, USERNM, STATE, KIND, SYNC "
            sql += "     FROM S_CHANDTL_TBL "
            sql += "    WHERE CHANID = ? "
            sql += "    ORDER BY USERNM "
            const chandtl = await this.dataSource.query(sql, [chanid])
            if (chandtl.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, methodName + '>chandtl')
            }
            for (let item of chandtl) {
                if (item.USERID == userid) { //현재 사용자와 같으면 현재 사용자의 정보를 CHANMST에 표시
                    data.chanmst.USERID = item.USERID //아래 사용
                    data.chanmst.KIND = item.KIND //admin/member/guest
                }
                if (item.SYNC == 'Y') { //기타 정보를 S_USER_TBL에서 읽어와야 함
                    const user = await this.userRepo.findOneBy({ USERID: item.USERID })
                    if (user) {
                        item.ORG = user.TOP_ORG_NM + '/' + user.ORG_NM
                        item.JOB = user.JOB
                        item.EMAIL = user.EMAIL
                        item.TELNO = user.TELNO
                        item.RMKS = ''
                        if (includeBlob) item.PICTURE = user.PICTURE
                    }
                } else { //기타 정보를 S_GRDTL_TBL에서 읽어와야 함
                    const grdtl = await this.grdtlRepo.findOneBy({ USERID: item.USERID })
                    if (grdtl) {
                        item.ORG = grdtl.ORG
                        item.JOB = grdtl.JOB
                        item.EMAIL = grdtl.EMAIL
                        item.TELNO = grdtl.TELNO
                        item.RMKS = grdtl.RMKS
                        item.PICTURE = null
                    }
                }
            }
            if (data.chanmst.STATE == 'A') {
                //공개(All)된 채널이므로 채널멤버가 아니어도 읽을 수 있음 (DM은 무조건 M,P이므로 여기에 해당안됨)
            } else if (data.chanmst.STATE == 'M') { //DM방이 맨 처음 만들어지고 아직 메시지가 없을 때는 방을 만든 마스터에게만 보이기로 함
                if (data.chanmst.MASTERID != userid) {
                    return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (M)' + fv, hush.Code.NOT_AUTHORIZED, null, methodName)
                }
            } else { //비공개(Private)
                if (!data.chanmst.USERID) {
                    return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (P)' + fv, hush.Code.NOT_AUTHORIZED, null, methodName)
                }
            }
            data.chandtl = chandtl            
            //////////c) S_MSGMST_TBL
            if (msgid && msgid != userid) { //temp가 userid로 바뀌는 경우는 작성중인 파일,이미지,링크임
                let msgmst = await this.msgmstRepo.createQueryBuilder('A')
                .select(['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.KIND', 'A.REPLYTO', 'A.CDT', 'A.UDT'])
                .where("A.MSGID = :msgid and A.CHANID = :chanid ", { 
                    msgid: msgid, chanid: chanid
                }).getOne()
                if (!msgmst) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, methodName + '>msgmst')
                } 
                if (chkAuthor && userid != msgmst.AUTHORID) { //편집저장삭제 등의 경우임
                    return hush.setResJson(resJson, '작성자가 다릅니다.' + fv, hush.Code.NOT_OK, null, methodName + 'chkAuthor')
                }
                data.msgmst = msgmst
            } else if (chkGuest) {
                if (data.chanmst.KIND != 'admin' && data.chanmst.KIND != 'member') {
                    return hush.setResJson(resJson, '게스트(사용자)는 열람만 가능합니다.' + fv, hush.Code.NOT_OK, this.req, methodName + 'chkGuest')    
                }                
            }
            resJson.data = data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryMsgDtlForUser(qb: SelectQueryBuilder<MsgDtl>, msgid: string, chanid: string, userid: string): Promise<any> { //d-0) S_MSGDTL_TBL 본인 액션만 가져오기
        const retObj = { act_later: null, act_fixed: null }
        const msgdtlforuser = await qb //예) "later","stored","finished"는 한몸으로서 해당 사용자만 조회해 보여줘야 하는 데이터임. 필요할 경우 CASE WHEN으로 추가해 관리해야 함
        .select([
            'B.KIND KIND', 
            'CASE WHEN KIND in ("later", "stored", "finished") THEN "act_later" ' +
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

    async qryMsgDtl(qb: SelectQueryBuilder<MsgDtl>, msgid: string, chanid: string): Promise<any> { //d-1) S_MSGDTL_TBL 다른 사용자가 처리한 것도 가져오기
        const msgdtl = await qb
        .select(['B.KIND KIND', 'COUNT(B.KIND) CNT', 'GROUP_CONCAT(B.USERNM ORDER BY B.USERNM SEPARATOR ", ") NM', 'GROUP_CONCAT(B.USERID ORDER BY B.USERID SEPARATOR ", ") ID'])
        .where("B.MSGID = :msgid and B.CHANID = :chanid and B.TYP in ('read', 'react') ", { //and B.KIND not in ('read', 'unread') 화면에는 notyet만 보여주면 read, unread는 안보여줘도 알 수 있음
            msgid: msgid, chanid: chanid
        }).groupBy('B.KIND').orderBy('B.KIND', 'ASC').getRawMany()
        return (msgdtl.length > 0) ? msgdtl : []
    }

    async qryMsgDtlMention(qb: SelectQueryBuilder<MsgDtl>, msgid: string, chanid: string): Promise<any> { //d-1) S_MSGDTL_TBL
        let sql = "SELECT USERID, USERNM "
        sql += "     FROM S_MSGDTL_TBL "
        sql += "    WHERE MSGID = ? AND CHANID = ? AND KIND = 'mention' "
        sql += "    ORDER BY USERNM "
        const msgdtl = await this.dataSource.query(sql, [msgid, chanid])
        return (msgdtl.length > 0) ? msgdtl : []
    }

    async qryMsgSub(qb: SelectQueryBuilder<MsgSub>, msgid: string, chanid: string): Promise<any> { //d-2) S_MSGSUB_TBL
        const msgsub = await qb
        .select(['C.KIND', 'C.CDT', 'C.BODY', 'C.BUFFER', 'C.FILESIZE'])
        .where("C.MSGID = :msgid and C.CHANID = :chanid ", { 
            msgid: msgid, chanid: chanid
        }).orderBy('C.KIND', 'ASC').addOrderBy('C.CDT', 'ASC').getMany()
        if (msgsub.length > 0) {
            const msgfile = msgsub.filter((val) => val.KIND == 'F' || val.KIND == 'f') //소문자는 예비용(파일링크?)
            const msgimg = msgsub.filter((val) => val.KIND == 'I' || val.KIND == 'i') //소문자는 예비용(이미지링크?)
            const msglink = msgsub.filter((val) => val.KIND == 'L')
            return { msgfile: msgfile, msgimg: msgimg, msglink: msglink }
        } else {
            return { msgfile: [], msgimg: [], msglink: [] }
        }
    }

    async qryReply(qb: SelectQueryBuilder<MsgMst>, msgid: string, chanid: string): Promise<any> { //d-3) S_MSGMST_TBL 사용자별 정보
        const reply = await qb
        .select('AUTHORID').addSelect('AUTHORNM')
        .distinct(true)
        .where("CHANID = :chanid and REPLYTO = :msgid ", { 
            chanid: chanid, msgid: msgid
        }).groupBy('AUTHORID').addGroupBy('AUTHORNM')
        .orderBy('AUTHORNM', 'ASC').limit(hush.cons.replyCntLimit).getRawMany()
        return (reply.length > 0) ? reply : []
    }

    async qryReplyInfo(msgid: string, chanid: string, userid: string): Promise<any> { //d-4) S_MSGMST_TBL 댓글 갯수, 안읽은갯수, 최종업데이트일시
        let sql = "SELECT SUM(CNT) CNT_BY_USER, "
        sql += "          (SELECT COUNT(*) FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = ?) CNT_EACH, "
        sql += "          (SELECT MAX(CDT) FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = ?) CDT_MAX "
        sql += "     FROM (SELECT 1 CNT "
        sql += "             FROM S_MSGMST_TBL "
        sql += "            WHERE CHANID = ? AND REPLYTO = ? "
        sql += "            GROUP BY AUTHORID) Z "
        const replyInfo = await this.dataSource.query(sql, [chanid, msgid, chanid, msgid, chanid, msgid])
        sql = "SELECT COUNT(*) MYNOTYETCNT " //내가 아직 안읽은 댓글 갯수가 스레드를 열지 않으면 안보이므로 표시하도록 함
        sql += " FROM S_MSGDTL_TBL "
        sql += "WHERE MSGID IN (SELECT MSGID FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = ?) "
        sql += "  AND CHANID = ? AND USERID = ? AND KIND = 'notyet'  "
        const replyUnread = await this.dataSource.query(sql, [chanid, msgid, chanid, userid])
        replyInfo[0].MYNOTYETCNT = replyUnread[0].MYNOTYETCNT
        return replyInfo
    }

    // async qryVipList(userid: string): Promise<any> {
    //     let sql = "SELECT GROUP_CONCAT(UID) UID FROM S_USERCODE_TBL WHERE KIND = 'vip' AND USERID = ? "
    //     return await this.dataSource.query(sql, [userid])
    // }

    getSqlWs(userid: string): string { //common.ts의 getBasicAclSql() 참조
        let sqlWs = "SELECT X.GR_ID, X.GR_NM, Y.CHANID, Y.CHANNM " //이 부분은 채널트리에서도 동일한 로직으로 구성됨
        sqlWs += "     FROM (SELECT A.GR_ID, A.GR_NM "
        sqlWs += "             FROM S_GRMST_TBL A "
        sqlWs += "            INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID " //1) 바로 아래 채널이 그 채널의 사용자그룹에 내가 등록되어 있어야 권한이 있는 것임
        sqlWs += "            WHERE B.USERID = '" + userid + "') X " //사용자그룹에서 빠지면 채널 참여자라도 권한 없어짐
        sqlWs += "             LEFT OUTER JOIN (SELECT A.CHANID, A.CHANNM, A.GR_ID "
        sqlWs += "                                FROM S_CHANMST_TBL A "
        sqlWs += "                               INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID "
        sqlWs += "                               WHERE B.USERID = '" + userid + "' " //a. 내가 참여하고 있는 채널
        sqlWs += "                               UNION ALL "
        sqlWs += "                              SELECT A.CHANID, A.CHANNM, A.GR_ID "
        sqlWs += "                                FROM S_CHANMST_TBL A "
        sqlWs += "                               WHERE A.TYP = 'WS' AND A.STATE = 'A' " //b. 내가 참여하고 있지 않지만 공개(A)된 채널
        sqlWs += "                                 AND A.CHANID NOT IN (SELECT CHANID FROM S_CHANDTL_TBL WHERE USERID = '" + userid + "') "
        sqlWs += "          ) Y ON X.GR_ID = Y.GR_ID "
        return sqlWs
    }

    getSqlGs(userid: string): string { //common.ts의 getBasicAclSql() 참조
        let sqlGs = "      SELECT '' GR_ID, '' GR_NM, A.CHANID, A.CHANNM " //2) DM은 사용자그룹 등록없이 채널멤버만으로도 사용되므로 바로 여기처럼 가져옴
        sqlGs += "           FROM S_CHANMST_TBL A "
        sqlGs += "          INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID "
        sqlGs += "          WHERE B.USERID = '" + userid + "' AND A.TYP = 'GS' "
        return sqlGs
    }

    ///////////////////////////////////////////////////////////////////////////////위는 서비스내 공통 모듈

    async qry(dto: Record<string, any>): Promise<any> { //채널내 메시지 리스트를 무한스크롤로 가져 오는 경우에도 마스터 정보는 어차피 ACL때문이라도 읽어야 함
        const methodName = 'chanmsg>qry'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try { //어차피 권한체크때문이라도 chanmst,chandtl를 읽어야 하므로 읽는 김에 데이터 가져와서 사용하기로 함
            let data = { 
                chanmst: null, chandtl: [], msglist: [], tempfilelist: [], tempimagelist: [], templinklist: [], 
                msgidParent: '', msgidChild: '', vipStr: null, logdt: null
            }
            const { chanid, prevMsgMstCdt, nextMsgMstCdt, msgid, kind, msgidReply } = dto 
            console.log("qry###", prevMsgMstCdt, nextMsgMstCdt, msgid, kind, msgidReply)
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, includeBlob: true }) //a),b),c) 가져옴 //msgid 들어가면 안됨
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            data.chanmst = rs.data.chanmst
            data.chandtl = rs.data.chandtl
            const viplist = await this.userSvc.getVipList(userid)
            data.vipStr = viplist[0].VIPS
            const qb = this.msgmstRepo.createQueryBuilder('A')
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B')
            const qbSub = this.msgsubRepo.createQueryBuilder('C')
            ///////////////////////////////////////////////////////////d) S_MSGMST_TBL (목록 읽어옴 - 댓글 및 S_MSGDTL_TBL, S_MSGSUB_TBL 포함)
            const fldArr = ['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.KIND', 'A.CDT', 'A.UDT'] //qryMsg()와 동일한 필드값이여야 함
            let msglist: MsgMst[]
            if (nextMsgMstCdt) { //ASC임을 유의
                if (kind == 'scrollToBottom') { //limit없이 마지막까지 모두 가져오므로 큰 데이터를 가져오는지 미리 체크 필요
                    //다만, 클라이언트가 메시지를 보내면 바로 scrollToBottom을 호출하는데 이때 큰 데이터가 있으면 어찌할 지 고민해야 함
                    if (msgidReply) {
                        msglist = await qb.select(fldArr)
                        .where("A.CHANID = :chanid and A.CDT > :nextcdt and A.REPLYTO = :msgidReply ", { 
                            chanid: chanid, nextcdt: nextMsgMstCdt, msgidReply: msgidReply
                        }).orderBy('A.CDT', 'ASC').getMany()
                    } else {
                        msglist = await qb.select(fldArr)
                        .where("A.CHANID = :chanid and A.CDT > :nextcdt and A.REPLYTO = '' ", { 
                            chanid: chanid, nextcdt: nextMsgMstCdt
                        }).orderBy('A.CDT', 'ASC').getMany()
                    }
                } else {
                    msglist = await qb.select(fldArr)
                    .where("A.CHANID = :chanid and A.CDT > :nextcdt and A.REPLYTO = '' ", { 
                        chanid: chanid, nextcdt: nextMsgMstCdt
                    }).orderBy('A.CDT', 'ASC').limit(hush.cons.rowsCnt).getMany()
                } //console.log("nextMsgMstCdt", nextMsgMstCdt, msglist.length)
            } else if (prevMsgMstCdt) {
                msglist = await qb.select(fldArr)
                .where("A.CHANID = :chanid and A.CDT < :prevcdt and A.REPLYTO = '' ", { 
                    chanid: chanid, prevcdt: prevMsgMstCdt
                }).orderBy('A.CDT', 'DESC').limit(hush.cons.rowsCnt).getMany() //console.log("prevMsgMstCdt", prevMsgMstCdt, msglist.length)
            } else if (msgid && kind == 'atHome') { 
                //댓글에 들어 있으면 그 댓글의 부모를 기준으로 데이터 가져오기. 클라이언트에서 넘어와도 되지만 복잡해서 서버에서 처리함
                let msgmst = await this.msgmstRepo.createQueryBuilder('A')
                .select(['A.REPLYTO'])
                .where("A.MSGID = :msgid and A.CHANID = :chanid ", { 
                    msgid: msgid, chanid: chanid
                }).getOne()
                if (!msgmst) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, methodName)
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
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, methodName)
                } //위의 msgid는 부모글일 수도 댓글일 수도 있지만 아래 2행은 무조건 부모글과 자식글로 구분해서 전달함
                data.msgidParent = msgidParent //MsgList.vue의 getList()에서 사용
                data.msgidChild = msgid //MsgList.vue의 getList()에서 사용. msgidParent와 다르면 이건 댓글의 msgid임
            } else if (msgid && kind == 'withReply') { //ASC임을 유의. menu>qryChan의 QueryFailedError: read ECONNRESET 문제 발생 소지 있음
                const fields = fldArr.join(", ").replace(/A\./g, "") + " " 
                const tbl = "FROM S_MSGMST_TBL "
                let sql = ""
                sql = "SELECT " + fields + tbl + " WHERE MSGID = ? AND CHANID = ? "
                sql += "    UNION ALL "
                sql += "   SELECT " + fields + tbl + " WHERE REPLYTO = ? AND CHANID = ? "    
                sql += "    ORDER BY CDT ASC "
                msglist = await this.dataSource.query(sql, [msgid, chanid, msgid, chanid])
                if (msglist.length == 0) { //사용자가 마스터 선택했으므로 데이터가 반드시 있어야 함
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, methodName)
                }
            } else if (kind == 'notyet' || kind == 'unread') { //안읽은 댓글의 경우, 댓글이 아닌 부모글을 보여줘야 하는데 부모글도 댓글도 모두 안읽은 경우는 한개만 보여줘야 함
                const curDt = new Date()
                const dtMinus = new Date(curDt.getFullYear() - 1, curDt.getMonth(), curDt.getDate())
                const dtMinusStr = hush.getDateTimeStr(dtMinus, true, false)
                const fields = fldArr.join(", ") + " " 
                const fieldz = fldArr.join(", ").replace(/A\./g, "Z.") + " " 
                let sql = "SELECT DISTINCT " + fieldz
                sql += "     FROM (SELECT " + fields
                sql += "             FROM S_MSGMST_TBL A "
                sql += "             LEFT OUTER JOIN S_MSGDTL_tbl B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID "
                sql += "            WHERE A.CHANID = ? AND A.REPLYTO = '' AND B.USERID = ? AND B.KIND = ? AND A.CDT >= ? "
                sql += "            UNION ALL "
                sql += "           SELECT " + fields //아직안읽은 자식댓글은 부모글을 찾아서 보여주기
                sql += "             FROM S_MSGMST_TBL A "
                sql += "            WHERE A.MSGID IN (SELECT A.REPLYTO "
                sql += "                                FROM S_MSGMST_TBL A "
                sql += "                                LEFT OUTER JOIN S_MSGDTL_tbl B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID "
                sql += "                               WHERE A.CHANID = ? AND A.REPLYTO <> '' AND B.USERID = ? AND B.KIND = ? AND A.CDT >= ?) "
                sql += "              AND A.CHANID = ?) Z "
                sql += "    ORDER BY Z.CDT DESC "
                sql += "    LIMIT " + hush.cons.rowsCntForNotyet //1년치만 조회하는 것으로 했으나 혹시 몰라서 LIMIT도 설정 (처음 못읽은 것은 두번째 클릭하면 읽힘)
                msglist = await this.dataSource.query(sql, [chanid, userid, kind, dtMinusStr, chanid, userid, kind, dtMinusStr, chanid])
            }
            let sqlLast = "SELECT MSGID, CDT FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = '' ORDER BY CDT DESC LIMIT 1 "
            const realLastList = await this.dataSource.query(sqlLast, [chanid]) //데이터가 있으면 1개임
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) //sql로 읽고 난 직후 시각을 리얼타임 반영의 기준으로 보기
            if (msglist && msglist.length > 0) data.msglist = msglist  
            ///////////////////////////////////////////////////////////d-1),d-2),d-3),d-4) => qry()의 메시지 콘텐츠와 동일 : msgmst가 msglist 루트에 붙는 경우만 다르나 역시 유사함
            for (let i = 0; i < data.msglist.length; i++) {
                const item = data.msglist[i] //item.isVip = vipStr.includes(item.AUTHORID) ? true : false
                const msgdtlforuser = await this.qryMsgDtlForUser(qbDtl, item.MSGID, chanid, userid) //user
                item.act_later = msgdtlforuser.act_later
                item.act_fixed = msgdtlforuser.act_fixed
                const msgdtl = await this.qryMsgDtl(qbDtl, item.MSGID, chanid) //read, react
                item.msgdtl = (msgdtl.length > 0) ? msgdtl : []                
                const msgdtlmention = await this.qryMsgDtlMention(qbDtl, item.MSGID, chanid) //mention
                item.msgdtlmention = (msgdtlmention.length > 0) ? msgdtlmention : []
                const msgsub = await this.qryMsgSub(qbSub, item.MSGID, chanid) //파일, 이미지, 링크
                item.msgfile = msgsub.msgfile
                item.msgimg = msgsub.msgimg
                item.msglink = msgsub.msglink
                const reply = await this.qryReply(qb, item.MSGID, chanid) //S_MSGMST_TBL (댓글-스레드) - 사용자별 정보
                item.reply = (reply.length > 0) ? reply : []
                const replyInfo = await this.qryReplyInfo(item.MSGID, chanid, userid) //S_MSGMST_TBL (댓글-스레드) - 댓글 갯수, 안읽은댓글갯수, 최종업데이트일시
                item.replyinfo = replyInfo
                //1밀리섹(1000분의1초)간격으로 양쪽에서 saveMsg()해서 순서가 흐트러지지 않고 잘 가져오는지 테스트함 : OK
                //처음엔 한행이 n x 순서 횟수만큼 조회되는 오류 발생 - scrollToBottom을 나중에 모아서 한번에 해야 하고 그 한번이 완료될 때까지 또 그대로 조회(실행)되면 안되게 막고 있어야 함
                if (kind == 'scrollToBottom') { //운영 적용전까지는 막지 말기
                    const logObj = { 
                        cdt: curdtObj.DT.replace('2025-', '1111-'), msgid: item.MSGID, replyto: '', chanid: chanid, 
                        userid: userid, usernm: '', cud: 'Z', kind: '', typ: '', bodytext: ''
                    }
                    const ret = await hush.insertDataLog(this.dataSource, logObj)
                    if (ret != '') throw new Error(ret)
                }
            }
            ///////////////////////////////////////////////////////////e) S_MSGSUB_TBL (메시지에 저장하려고 올렸던 임시 저장된 파일/이미지/링크)
            const arr = ['F', 'I', 'L'] //파일,이미지,링크
            for (let i = 0; i < arr.length; i++) {
                const msgsub = await qbSub
                .select(['C.CDT', 'C.BODY', 'C.BUFFER', 'C.FILESIZE'])
                .where("C.MSGID = :userid and C.CHANID = :chanid and C.KIND = :kind ", { //MSGID에 userid 조회하고 있음
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
            data.logdt = curdtObj.DT //실시간반영 폴링을 위한 로그일시 (데이터 가져올후록 커짐) => 무조건 내려주긴 하되, 클라이언트에서 받아서 한번만 사용함
            resJson.list = realLastList //실제로 제일 최근인 일시. atHome 등에서 조회시는 그 채널의 마지막 메시지는 가져오지 않는 경우도 많을텐데 
            //이 때 realLastList처럼 마지막 메시지를 별도로 가져와서, 리얼타임 반영시 그 이전 메시지는 화면에 표시하지 않고 사용자에게 보이도록 정보만 쌓아 두고 있다가 
            //사용자가 클릭하거나 스크롤이 갈 때마다 해당 표시를 업데이트만 하기. realLastList의 메시지정보가 실제 마지막에 뿌린 메시지와 같으면 리얼타임 반영시 그냥 추가분을 배열에 추가해 화면에 뿌리면 됨
            resJson.data = data
            console.log("qry!!!", prevMsgMstCdt, nextMsgMstCdt, msgid, kind, msgidReply)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }
    
    async qryChanMstDtl(dto: Record<string, any>): Promise<any> { //1) MemberList에서 사용 2) MsgList에서 채널 정보만 읽어서 새로고침 용도로 사용
        const methodName = 'chanmsg>qryChanMstDtl'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try { //DM아닌 채널인 경우 그룹도 체크하는데 내가 멤버로 들어가 있는 그룹만 조회 가능. 비공개채널은 채널멤버로 들어가 있어야만 열람 가능
            const { chanid, state } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, includeBlob: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            resJson.data.chanmst = rs.data.chanmst
            resJson.data.chandtl = rs.data.chandtl 
            if (rs.data.chanmst.TYP == "GS") { //멤버중복 체크하는 루틴 (DM방에 대해서만. 미리 체크해 방지하면 최선이나 멤버추가시 마다 체크하는 루틴이므로 쉽지 않아 일단 사후경고만 하고 있음)
                let sql = "SELECT (SELECT COUNT(*) FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) CNT, (SELECT GROUP_CONCAT(USERID) FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) MEM "
                sql += "     FROM S_CHANDTL_TBL A "
                sql += "    WHERE CHANID = ? AND USERID = ? "
                sql += "    ORDER BY USERID "
                const mychan = await this.dataSource.query(sql, [chanid, userid]) //console.log(userid, mychan[0].CNT, mychan[0].MEM, chanid)
                if (mychan.length > 0) {
                    sql = "SELECT Y.CHANID, Y.CNT, Y.MEM "
                    sql += " FROM (SELECT Z.CHANID, Z.CNT, (SELECT GROUP_CONCAT(USERID) FROM S_CHANDTL_TBL WHERE CHANID = Z.CHANID) MEM "
                    sql += "         FROM (SELECT A.CHANID, (SELECT COUNT(*) GTOM FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) CNT "
                    sql += "                 FROM S_CHANDTL_TBL A "
                    sql += "                INNER JOIN S_CHANMST_TBL B ON A.CHANID = B.CHANID "
                    sql += "                WHERE A.USERID = ? AND B.GR_ID = 'GS' "
                    sql += "                ORDER BY USERID) Z "
                    sql += "         WHERE Z.CNT = ?) Y "                
                    sql += " WHERE Y.MEM = ? "
                    sql += "   AND Y.CHANID <> ? "
                    const otherchan = await this.dataSource.query(sql, [userid, mychan[0].CNT, mychan[0].MEM, chanid])
                    if (otherchan.length > 0) resJson.data.chanidAlready = otherchan[0].CHANID
                }
            }
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv) 
        }
    }

    async qryOneMsgNotYet(dto: Record<string, any>): Promise<any> { //chkAcl()이 없음 - 권한체크안해도 무방하다고 판단
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try { //채널 열 때 내가 아직 읽지 않은 최초의 메시지를 볼 수 있도록 함 (댓글이 최초라면 그 댓글의 부모글을 보여줘야 함)
            const { chanid } = dto
            let sql = "SELECT A.MSGID, CASE WHEN B.REPLYTO <> '' THEN B.REPLYTO ELSE A.MSGID END MSGIDOLD "
            sql += "     FROM S_MSGDTL_TBL A "
            sql += "    INNER JOIN S_MSGMST_TBL B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID "
            sql += "    WHERE A.CHANID = ? AND A.USERID = ? AND A.KIND = 'notyet' "
            sql += "    ORDER BY MSGIDOLD ASC " //CDT가 아님 (제일 오래된 메시지). MSGIDOLD는 소팅에만 관여하고 내려받는 것은 MSGID
            sql += "    LIMIT 1 " //결국, MSGID는 댓글의 MSGID일 수도 있으며 실제 쓰이는 곳에서는 MSGID의 부모 아이디를 구해서 처리됨
            const list = await this.dataSource.query(sql, [chanid, userid])
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async searchMedia(dto: Record<string, any>): Promise<any> { //아래 sql에서 먼저 권한있는 채널만 필터링됨
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { chanid, prevMsgMstCdt, rdoOpt, kind, fileName, fileExt, frYm, toYm, authorNm, searchText } = dto
            const kindStr = kind.substr(0, 1).toUpperCase() //console.log("searchMedia", chanid, prevMsgMstCdt, rdoOpt, kindStr, fileName, fileExt, frYm, toYm, authorNm, searchText)
            let frDash = hush.cons.cdtAtFirst, toDash = hush.cons.cdtAtLast
            if (frYm.length == 6) frDash = frYm.substr(0, 4) + '-' + frYm.substr(4, 2)
            if (toYm.length == 6) toDash = toYm.substr(0, 4) + '-' + toYm.substr(4, 2) + '-99'            
            const bufferFieldA = kind == 'image' ? ', A.BUFFER ' : ''
            const bufferField = kind == 'image' ? ', BUFFER ' : ''
            const bufferFieldR = kind == 'image' ? ', R.BUFFER ' : ''
            const sqlWs = this.getSqlWs(userid)
            const sqlGs = this.getSqlGs(userid)
            let sql = "SELECT P.GR_ID, P.GR_NM, P.CHANID, P.CHANNM, R.MSGID, R.CHANID, R.KIND, R.CDTSUB, R.BODY, R.CDT, R.UDT, R.FILESIZE, R.AUTHORID, R.AUTHORNM, R.REPLYTO, R.BODYTEXT, R.TYP, R.STATE " + bufferFieldR
            sql += "     FROM ( "
            if (rdoOpt == 'chan') {
                sql += sqlWs
            } else if (rdoOpt == 'dm') {
                sql += sqlGs
            } else {
                sql += sqlWs + " UNION ALL " + sqlGs
            }
            sql += "           ) P "
            sql += "    INNER JOIN ( " //위 1), 2)에서 읽어온 내가 권한있는 채널아이디만으로 아래 검색 결과를 inner join해서 결국은 "내가 권한있는 채널에 대해서만 검색한 것이 됨"
            sql += "   SELECT MSGID, CHANID, KIND, CDTSUB, BODY, CDT, UDT, FILESIZE, AUTHORID, AUTHORNM, REPLYTO, BODYTEXT, TYP, STATE " + bufferField
            sql += "     FROM (SELECT A.MSGID, B.CHANID, A.KIND, A.CDT CDTSUB, A.BODY, B.CDT, B.UDT, A.FILESIZE, B.AUTHORID, B.AUTHORNM, B.REPLYTO, B.BODYTEXT, C.TYP, C.STATE " + bufferFieldA
            sql += "             FROM S_MSGSUB_TBL A " //메시지는 있는데 파일,이미지 데이터가 없는 경우는 제외되어야 함
            sql += "            INNER JOIN S_MSGMST_TBL B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID "
            sql += "            INNER JOIN S_CHANMST_TBL C ON A.CHANID = C.CHANID "
            sql += "            WHERE B.CDT >= '" + frDash + "' AND B.CDT <= '" + toDash + "' "
            if (chanid) sql += "  AND B.CHANID = '" + chanid + "' "
            if (rdoOpt == 'chan') {
                sql += "          AND C.TYP = 'WS' "
            } else if (rdoOpt == 'dm') {
                sql += "          AND C.TYP = 'GS' "
            }
            sql += "              AND A.KIND = '" + kindStr + "' "
            if (kindStr == 'F' && fileExt != '') sql += " AND A.FILEEXT = '" + fileExt + "' "
            if (authorNm != '') sql += " AND LOWER(B.AUTHORNM) LIKE '%" + authorNm.toLowerCase() + "%' "
            if (searchText != '') sql += " AND (LOWER(B.BODYTEXT) LIKE '%" + searchText + "%' OR LOWER(A.BODY) LIKE '%" + searchText.toLowerCase() + "%') "
            sql += "    ) Q ) R ON P.CHANID = R.CHANID "
            sql += "    WHERE R.CDT < ? "
            sql += "    ORDER BY R.CDT DESC "
            sql += "    LIMIT " + hush.cons.rowsCnt
            const list = await this.dataSource.query(sql, [prevMsgMstCdt])
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async searchMsg(dto: Record<string, any>): Promise<any> { //아래 sql에서 먼저 권한있는 채널만 필터링됨
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { chanid, prevMsgMstCdt, rdoOpt, frYm, toYm, authorNm, searchText } = dto //console.log("searchMsg", chanid, prevMsgMstCdt, rdoOpt, frYm, toYm, authorNm, searchText)
            let frDash = hush.cons.cdtAtFirst, toDash = hush.cons.cdtAtLast
            if (frYm.length == 6) frDash = frYm.substr(0, 4) + '-' + frYm.substr(4, 2)
            if (toYm.length == 6) toDash = toYm.substr(0, 4) + '-' + toYm.substr(4, 2) + '-99'
            const sqlWs = this.getSqlWs(userid)
            const sqlGs = this.getSqlGs(userid)
            let sql = "SELECT P.GR_ID, P.GR_NM, P.CHANID, P.CHANNM, R.MSGID, R.AUTHORID, R.AUTHORNM, R.REPLYTO, R.BODYTEXT, R.CDT, R.UDT, R.TYP, R.STATE "
            sql += "     FROM ( "
            if (rdoOpt == 'chan') {
                sql += sqlWs
            } else if (rdoOpt == 'dm') {
                sql += sqlGs
            } else {
                sql += sqlWs + " UNION ALL " + sqlGs
            }
            sql += "           ) P "
            sql += "    INNER JOIN ( " //위 1), 2)에서 읽어온 내가 권한있는 채널아이디만으로 아래 검색 결과를 inner join해서 결국은 "내가 권한있는 채널에 대해서만 검색한 것이 됨"
            sql += "   SELECT MSGID, CHANID, AUTHORID, AUTHORNM, REPLYTO, BODYTEXT, CDT, UDT, TYP, STATE "
            sql += "     FROM (SELECT DISTINCT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, A.CDT, A.UDT, C.TYP, C.STATE "
            sql += "             FROM S_MSGMST_TBL A "
            sql += "            INNER JOIN S_CHANMST_TBL C ON A.CHANID = C.CHANID "
            sql += "             LEFT OUTER JOIN S_MSGSUB_TBL B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID "
            sql += "            WHERE A.CDT >= '" + frDash + "' AND A.CDT <= '" + toDash + "' "
            if (chanid) sql += "  AND A.CHANID = '" + chanid + "' "
            if (rdoOpt == 'chan') {
                sql += "          AND C.TYP = 'WS' "
            } else if (rdoOpt == 'dm') {
                sql += "          AND C.TYP = 'GS' "
            }
            if (authorNm != '') sql += " AND LOWER(A.AUTHORNM) LIKE '%" + authorNm.toLowerCase() + "%' "
            if (searchText != '') sql += " AND (LOWER(A.BODYTEXT) LIKE '%" + searchText + "%' OR LOWER(B.BODY) LIKE '%" + searchText.toLowerCase() + "%') "
            sql += "    ) Q ) R ON P.CHANID = R.CHANID "
            sql += " WHERE R.CDT < ? " //무한 스크롤
            sql += " ORDER BY R.CDT DESC "
            sql += " LIMIT " + hush.cons.rowsCnt
            const list = await this.dataSource.query(sql, [prevMsgMstCdt])
            const qbSub = this.msgsubRepo.createQueryBuilder('C')
            for (let i = 0; i < list.length; i++) {
                const item = list[i]
                const msgsub = await this.qryMsgSub(qbSub, item.MSGID, item.CHANID) //d-2) S_MSGSUB_TBL (파일, 이미지, 링크 등)
                item.msgfile = msgsub.msgfile
                item.msgimg = msgsub.msgimg
                item.msglink = msgsub.msglink
            }
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryMsg(dto: Record<string, any>): Promise<any> { //리얼타임 반영시에도 사용됨
        const methodName = 'chanmsg>qryMsg'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            let data = { 
                chanmst: null, chandtl: [], msgmst: null, act_later: null, act_fixed: null, msgdtl: null, msgdtlmention: null,
                msgfile: null, msgimg: null, msglink: null, reply: null, replyinfo: null 
            }
            //excludeMsgSub은 리얼타임 반영등에서 polling 부담을 조금이라도 줄이기 위해 본문 업데이트가 아니면 이미지는 빼고 내리는 옵션을 개발자에게 부여함
            //원래는 qryMsg() 간단 버전으로 qryDtlRealTime() 만들어 이미지, 댓글정보 등을 제외하고 가져왔는데 댓글정보는 쓰임이 많은 등 이미지 등 제외하고는 모두 가져와도 되서 걍 qryDtlRealTime() 안쓰고 여기 옵션으로 해결함
            const { chanid, msgid } = dto //const { chanid, msgid, excludeMsgSub } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, includeBlob: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            data.chanmst = rs.data.chanmst
            data.chandtl = rs.data.chandtl
            const qb = this.msgmstRepo.createQueryBuilder('A')
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B')
            const qbSub = this.msgsubRepo.createQueryBuilder('C')
            ///////////////////////////////////////////////////////////d) S_MSGMST_TBL
            const msgmst = await qb.select(['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.KIND', 'A.CDT', 'A.UDT']) //qry()와 동일한 필드값이여야 함
            .where("A.MSGID = :msgid and A.CHANID = :chanid ", { 
                msgid: msgid, chanid: chanid
            }).getOne()
            data.msgmst = msgmst
            //////////////////////////////////////////////////////////////////////////////////////////// => qryMsg()의 메시지 콘텐츠와 동일 : msgmst가 msglist 루트에 붙는 경우만 다르나 역시 유사함
            const msgdtlforuser = await this.qryMsgDtlForUser(qbDtl, msgid, chanid, userid) //user
            data.act_later = msgdtlforuser.act_later
            data.act_fixed = msgdtlforuser.act_fixed
            const msgdtl = await this.qryMsgDtl(qbDtl, msgid, chanid) //read, react
            data.msgdtl = (msgdtl.length > 0) ? msgdtl : []
            const msgdtlmention = await this.qryMsgDtlMention(qbDtl, msgid, chanid) //mention
            data.msgdtlmention = (msgdtlmention.length > 0) ? msgdtlmention : []
            const msgsub = await this.qryMsgSub(qbSub, msgid, chanid) //파일, 이미지, 링크
            data.msgfile = msgsub.msgfile
            data.msgimg = msgsub.msgimg
            data.msglink = msgsub.msglink
            const reply = await this.qryReply(qb, msgid, chanid) //S_MSGMST_TBL (댓글-스레드) - 사용자별 정보
            data.reply = (reply.length > 0) ? reply : []
            const replyInfo = await this.qryReplyInfo(msgid, chanid, userid) //S_MSGMST_TBL (댓글-스레드) - 댓글 갯수, 안읽은댓글갯수, 최종업데이트일시
            data.replyinfo = replyInfo
            ////////////////////////////////////////////////////////////////////////////////////////////
            resJson.data = data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryActionForUser(dto: Record<string, any>): Promise<any> { //chkAcl()이 없음을 유의 - 권한체크안해도 무방하다고 판단함
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { chanid, msgid } = dto
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B')
            const msgdtlforuser = await this.qryMsgDtlForUser(qbDtl, msgid, chanid, userid) //d-0) S_MSGDTL_TBL (본인액션만 가져오기)
            resJson.data = msgdtlforuser //데이터 없어도 없는대로 넘기기 (안그러면 사용자에게 소켓통신 통해 정보요청이 올 때마다 뜨게됨)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryAction(dto: Record<string, any>): Promise<any> { //chkAcl()이 없음을 유의 - 권한체크안해도 무방하다고 판단함
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { chanid, msgid } = dto
            const qbDtl = this.msgdtlRepo.createQueryBuilder('B')
            const msgdtl = await this.qryMsgDtl(qbDtl, msgid, chanid) //d-1) S_MSGDTL_TBL (각종 이모티콘)
            resJson.list = msgdtl //데이터 없어도 없는대로 넘기기 (안그러면 사용자에게 소켓통신 통해 정보요청이 올 때마다 뜨게됨)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async saveMsg(dto: Record<string, any>): Promise<any> {
        const methodName = 'chanmsg>saveMsg'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            let { crud, chanid, replyto, body, bodytext, num_file, num_image, num_link } = dto //crud는 C or U만 처리 
            let msgid = dto.msgid //console.log(userid, msgid, chanid, crud, replyto, body, num_file, num_image)
            const bodyForLog = (bodytext.length > hush.cons.bodyLenForLog) ? bodytext.substring(0, hush.cons.bodyLenForLog) : bodytext
            let subkind = ''
            if (crud == 'C' || crud == 'U') { //replyto(댓글)는 신규 작성일 경우만 존재
                if (!chanid || (!body && num_file == 0 && num_image == 0 && num_link == 0)) {
                    return hush.setResJson(resJson, hush.Msg.BLANK_DATA + fv, hush.Code.BLANK_DATA, this.req, methodName)
                }
                let rs: ResJson
                if (crud == 'C') {
                    if (replyto) { //부모메시지 존재 여부만 체크
                        rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: replyto, chkGuest: true })    
                    } else {
                        rs = await this.chkAcl({ userid: userid, chanid: chanid, chkGuest: true })
                    }                    
                } else {
                    rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid, chkAuthor: true })
                }
                if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
                if (rs.data.chanmst.STATE == 'M') { //DM의 경우에 한해 메시지가 보내지기 직전에 방이 M상태가 되고 처음 보낸 후엔 P상태가 됨
                    await this.chanmstRepo.createQueryBuilder()
                    .update()
                    .set({ STATE: 'P' })
                    .where("CHANID = :chanid ", { 
                        chanid: chanid
                    }).execute()
                }
                subkind = rs.data.chanmst.TYP
            } else {
                return hush.setResJson(resJson, 'crud값은 C/U중 하나여야 합니다.' + fv, hush.Code.NOT_OK, this.req, methodName)
            }
            const unidObj = await hush.getMysqlUnid(this.dataSource)
            const qbMsgMst = this.msgmstRepo.createQueryBuilder()
            if (crud == 'C') {                
                msgid = unidObj.ID
                await qbMsgMst
                .insert().values({ 
                    MSGID: msgid, CHANID: chanid, AUTHORID: userid, AUTHORNM: usernm, REPLYTO: replyto ? replyto : '', BODY: body, BODYTEXT: bodytext, 
                    CDT: unidObj.DT, UDT: unidObj.DT
                }).execute()
                const qbMsgSub = this.msgsubRepo.createQueryBuilder()
                let arr = []
                if (num_file > 0) arr.push('F') //사용자가 같은 두개의 화면에서 한쪽은 파일 올리고 다른 쪽은 안올린 상태에서 보내면 파일은 전송안되고 그 다음에 표시됨
                if (num_image > 0) arr.push('I') //상동
                if (num_link > 0) arr.push('L') //상동
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
                resJson.data.msgid = msgid
                resJson.data.replyto = replyto
            } else { //현재 U에서는 S_MSGMST_TBL만 수정하는 것으로 되어 있음 (슬랙도 파일,이미지,링크 편집은 없음)
                await qbMsgMst
                .update()
                .set({ BODY: body, BODYTEXT: bodytext, UDT: unidObj.DT })
                .where("MSGID = :msgid and CHANID = :chanid ", {
                    msgid: msgid, chanid: chanid
                }).execute()
                let sql = "DELETE FROM S_MSGDTL_TBL WHERE MSGID = ? AND CHANID = ? AND KIND IN ('notyet', 'read', 'unread') "
                await this.dataSource.query(sql, [msgid, chanid]) //편집저장후엔 멤버들이 새로 읽어야 함
            } 
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder()
            const chandtl = await this.chandtlRepo.createQueryBuilder('A')
            .select(['A.USERID', 'A.USERNM'])
            .where("A.CHANID = :chanid ", { 
                chanid: chanid
            }).getMany()
            chandtl.forEach(async (item) => { //INSERT 한번에 할 수도 있으나 일단 그래도 둠
                const strKind = (item.USERID == userid) ? 'read' : 'notyet'
                const typ = hush.getTypeForMsgDtl(strKind)
                await qbMsgDtl
                .insert().values({ 
                    MSGID: msgid, CHANID: chanid, USERID: item.USERID, KIND: strKind, TYP: typ, CDT: unidObj.DT, UDT: unidObj.DT, USERNM: item.USERNM
                }).execute()
            }) //아래는 로깅
            let cud = crud
            const kind = replyto ? 'child' : 'parent'
            let typ = hush.getTypeForMsgDtl(kind)
            const logObj = { 
                cdt: unidObj.DT, msgid: msgid, replyto: replyto ? replyto : '', chanid: chanid, 
                userid: userid, usernm: usernm, cud: cud, kind: kind, typ: typ, bodytext: bodyForLog, subkind: subkind
            }
            const ret = await hush.insertDataLog(this.dataSource, logObj)
            if (ret != '') throw new Error(ret)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async forwardToChan(dto: Record<string, any>): Promise<any> {
        const methodName = 'chanmsg>forwardToChan'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])       
        try {
            const { kind, chanid, msgid, targetChanid } = dto
            let rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            rs = await this.chkAcl({ userid: userid, chanid: targetChanid, chkGuest: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            const unidObj = await hush.getMysqlUnid(this.dataSource) //await this.msgmstRepo.createQueryBuilder().select(hush.cons.unidMySqlStr).getRawOne()
            let sql = "INSERT INTO S_MSGMST_TBL (MSGID, CHANID, AUTHORID, AUTHORNM, BODY, BODYTEXT, KIND, CDT, UDT) " //REPLYTO는 없음
            sql += "   SELECT ?, ?, ?, ?, BODY, BODYTEXT, KIND, ?, '' " 
            sql += "     FROM S_MSGMST_TBL "
            sql += "    WHERE MSGID = ? AND CHANID = ? "
            await this.dataSource.query(sql, [unidObj.ID, targetChanid, userid, usernm, unidObj.DT, msgid, chanid])
            resJson.data.newMsgid = unidObj.ID
            //S_MSGSUB_TBL
            sql = "INSERT INTO S_MSGSUB_TBL (MSGID, CHANID, KIND, BODY, FILESIZE, FILEEXT, BUFFER, CDT, UDT) "
            sql += "SELECT ?, ?, KIND, BODY, FILESIZE, FILEEXT, BUFFER, ?, ? " 
            sql += "  FROM S_MSGSUB_TBL "
            sql += " WHERE MSGID = ? AND CHANID = ? "
            await this.dataSource.query(sql, [unidObj.ID, targetChanid, unidObj.DT, unidObj.DT, msgid, chanid])
            //S_MSGDTL_TBL
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder()
            const chandtl = await this.chandtlRepo.createQueryBuilder('A')
            .select(['A.USERID', 'A.USERNM'])
            .where("A.CHANID = :chanid ", { 
                chanid: targetChanid
            }).getMany()
            chandtl.forEach(async (item) => {
                const strKind = (item.USERID == userid) ? 'read' : 'notyet'
                const typ = hush.getTypeForMsgDtl(strKind)
                await qbMsgDtl
                .insert().values({ 
                    MSGID: unidObj.ID, CHANID: targetChanid, USERID: item.USERID, KIND: strKind, TYP: typ, CDT: unidObj.DT, UDT: unidObj.DT, USERNM: item.USERNM
                }).execute()
            }) //아래는 로깅
            const kind1 = 'parent'
            let typ = hush.getTypeForMsgDtl(kind1)
            const logObj = { 
                cdt: unidObj.DT, msgid: unidObj.ID, replyto: '', chanid: targetChanid, 
                userid: userid, usernm: usernm, cud: 'C', kind: kind1, typ: typ, bodytext: msgid, subkind: kind == 'home' ? 'WS' : 'GS'
            }
            const ret = await hush.insertDataLog(this.dataSource, logObj)
            if (ret != '') throw new Error(ret)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        } 
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async delMsg(dto: Record<string, any>): Promise<any> { 
        const methodName = 'chanmsg>delMsg'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])       
        try { //메시지 마스터를 삭제하면 거기에 딸려 있는 서브와 디테일 테이블 정보는 소용없으므로 모두 삭제함 (DEL_TBL로 이동시킴)
            const { msgid, chanid } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid, chkAuthor: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            const msgReply = await this.msgmstRepo.findOneBy({ REPLYTO: msgid, CHANID: chanid })
            if (msgReply) return hush.setResJson(resJson, '댓글이 있습니다.', hush.Code.NOT_OK, this.req, methodName)
            let msgidParent = ''
            let msgmst = await this.msgmstRepo.createQueryBuilder('A')
            .select(['A.REPLYTO'])
            .where("A.MSGID = :msgid and A.CHANID = :chanid ", { 
                msgid: msgid, chanid: chanid
            }).getOne()
            if (msgmst) msgidParent = msgmst.REPLYTO ? msgmst.REPLYTO : msgid
            let sql = "INSERT INTO S_MSGMSTDEL_TBL (MSGID, CHANID, AUTHORID, AUTHORNM, BODY, BODYTEXT, REPLYTO, KIND, CDT, UDT) "
            sql += "   SELECT MSGID, CHANID, AUTHORID, AUTHORNM, BODY, BODYTEXT, REPLYTO, KIND, CDT, UDT "
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
            .delete().where("MSGID = :msgid and CHANID = :chanid ", {
                msgid: msgid, chanid: chanid
            }).execute()
            await this.msgsubRepo.createQueryBuilder()
            .delete().where("MSGID = :msgid and CHANID = :chanid ", {
                msgid: msgid, chanid: chanid
            }).execute()
            await this.msgdtlRepo.createQueryBuilder()
            .delete().where("MSGID = :msgid and CHANID = :chanid ", {
                msgid: msgid, chanid: chanid
            }).execute() //아래는 로깅
            const curdtObj = await hush.getMysqlCurdt(this.dataSource)
            const kind = msgmst.REPLYTO ? 'child' : 'parent'
            const typ = hush.getTypeForMsgDtl(kind)
            const logObj = { 
                cdt: curdtObj.DT, msgid: msgid, replyto: msgmst.REPLYTO ? msgmst.REPLYTO : '', chanid: chanid, 
                userid: userid, usernm: usernm, cud: 'D', kind: kind, typ: typ, bodytext: ''
            }
            const ret = await hush.insertDataLog(this.dataSource, logObj)
            if (ret != '') throw new Error(ret)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async toggleChanOption(dto: Record<string, any>): Promise<any> { //TX 필요없음
        const methodName = 'chanmsg>toggleChanOption'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            const { chanid, kind, job } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            const qbChanDtl = this.chandtlRepo.createQueryBuilder()
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) //await qbChanDtl.select(hush.cons.curdtMySqlStr).getRawOne()
            const chandtl = await qbChanDtl
            .select("COUNT(*) CNT")
            .where("CHANID = :chanid and USERID = :userid ", {
                chanid: chanid, userid: userid
            }).getRawOne()
            if (chandtl.CNT == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, methodName)
            } else {
                let obj = { MODR: userid, UDT: curdtObj.DT }
                if (kind == "noti") { //job=X/빈값
                    Object.assign(obj, { NOTI: job })
                } else if (kind == "bookmark") { //job=Y/빈값
                    Object.assign(obj, { BOOKMARK: job })
                } else {
                    return hush.setResJson(resJson, 'kind값이 잘못되었습니다.' + fv, hush.Code.NOT_OK, this.req, methodName)
                }
                await qbChanDtl
                .update()
                .set(obj)
                .where("CHANID = :chanid and USERID = :userid ", {
                    chanid: chanid, userid: userid
                }).execute()
            }
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async updateWithNewKind(dto: Record<string, any>): Promise<any> {
        //원래는 읽음처리 전용으로 사용하려 했으나 문제가 있어 이건 msgdtl 처리용 일반용으로 사용하기로 하고 여기 로직은 새로 updateNotyetToRead()로 만들어 대체함 
        //그래서, 현재는 이 메소드 미사용중이나 나중에 필요하면 그냥 사용해도 무방할 것임 (리얼타임을 위한 로깅처리 여부는 검토해야 함)
        const methodName = 'chanmsg>updateWithNewKind'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])       
        try {            
            const { msgid, chanid, oldKind, newKind } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder('B')
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) //await qbMsgDtl.select(hush.cons.curdtMySqlStr).getRawOne()
            let sql = " SELECT COUNT(*) CNT FROM S_MSGDTL_TBL WHERE MSGID = ? AND CHANID = ? AND USERID = ? AND KIND = ? "
            const ret = await this.dataSource.query(sql, [msgid, chanid, userid, newKind])
            if (ret[0].CNT > 0) {
                sql = " DELETE FROM S_MSGDTL_TBL WHERE MSGID = ? AND CHANID = ? AND USERID = ? AND KIND = ? "
                await this.dataSource.query(sql, [msgid, chanid, userid, newKind]) //console.log(msgid, chanid, userid, newKind, '000')
            }
            let msgdtl = await this.msgdtlRepo.findOneBy({ MSGID: msgid, CHANID: chanid, USERID: userid, KIND: oldKind })
            if (msgdtl) { //console.log(msgid, chanid, userid, newKind, '222')
                await qbMsgDtl.update()
                .set({ KIND: newKind, UDT: curdtObj.DT })
                .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                    msgid: msgid, chanid: chanid, userid: userid, kind: oldKind
                }).execute()
                // const bracket = new Brackets((qb) => { //지우지말 것. where는 아래처럼 넣지 말고 Bracket으로 분리해서 공용으로 사용할 수 있도록 하는 것도 방법
                //     qb.where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                //         msgid: msgid, chanid: chanid, userid: userid, kind: oldKind
                //     })
                // })
                // await qbMsgDtl.update().set({ KIND: newKind, UDT: curdtObj.DT }).where(bracket).execute() //console.log(msgid, chanid, userid, newKind, '333')
            } else { //console.log(msgid, chanid, userid, newKind, '444')
                await qbMsgDtl.insert().values({ 
                    MSGID: msgid, CHANID: chanid, USERID: userid, KIND: newKind, USERNM: usernm, TYP: '', CDT: curdtObj.DT, UDT: curdtObj.DT
                }).execute()
            }
            //위의 save()는 kind가 primary key인데 그걸 update하는 것으로서 아래처럼 코딩하면 update가 아닌 insert되어 버리는 문제가 발생함
            //primary key, unique 인덱스 잘 설정되어 있어야 하고 제대로 사용(primary key는 고치지 않는 것만 사용)해야 문제를 막을 수 있는데 키가 많으면 복잡하고 어려울 것임
            //따라서, 가장 안전하게 위와 같이 createQueryBuilder로 처리하기로 함
            // if (msgdtl) { //console.log(msgid, chanid, userid, oldKind, "1")
            //     msgdtl.UDT = curdtObj.DT
            //     msgdtl.KIND = newKind
            //     this.msgdtlRepo.save(msgdtl)
            // } else { //console.log(msgid, chanid, userid, oldKind, "2")
            //     msgdtl = this.msgdtlRepo.create()
            //     msgdtl.MSGID = msgid
            //     msgdtl.CHANID = chanid
            //     msgdtl.USERID = userid
            //     msgdtl.USERNM = usernm
            //     msgdtl.TYP = ''
            //     msgdtl.CDT = curdtObj.DT
            //     msgdtl.KIND = newKind
            //     this.msgdtlRepo.save(msgdtl)
            // }
            msgdtl = await this.qryMsgDtl(qbMsgDtl, msgid, chanid)
            resJson.data.msgdtl = msgdtl
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async updateNotyetToRead(dto: Record<string, any>): Promise<any> { //읽음처리중 notyet -> read 처리 전용 (워낙 빈도수가 많으므로 별도 구현)
        const methodName = 'chanmsg>updateNotyetToRead'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])       
        try {            
            const { msgid, chanid } = dto
            const oldKind = 'notyet'
            const newKind = 'read' //console.log(oldKind, newKind, msgid)
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder('B')
            const curdtObj = await hush.getMysqlCurdt(this.dataSource)
            let sql = " SELECT COUNT(*) CNT FROM S_MSGDTL_TBL WHERE MSGID = ? AND CHANID = ? AND USERID = ? AND KIND = ? "
            const ret = await this.dataSource.query(sql, [msgid, chanid, userid, newKind])
            if (ret[0].CNT > 0) { //read가 이미 있으면 굳이 다시 처리할 필요없음
                //console.log(msgid, chanid, userid, newKind, '000')
            } else { //console.log(msgid, chanid, userid, newKind, '111111')
                let msgdtl = await this.msgdtlRepo.findOneBy({ MSGID: msgid, CHANID: chanid, USERID: userid, KIND: oldKind })
                if (msgdtl) { //console.log(msgid, chanid, userid, newKind, '222222')
                    await qbMsgDtl.update()
                    .set({ KIND: newKind, UDT: curdtObj.DT })
                    .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                        msgid: msgid, chanid: chanid, userid: userid, kind: oldKind
                    }).execute() //console.log(msgid, chanid, userid, newKind, '333333')
                    //아래는 MsgList.vue에서의 newParentAdded/newChildAdded배열에 들어 있는 msgid 항목을 제거하기 위해 로깅하는 것임 (CUD=D가 필요함)
                    //여기서는 기본창이든 새창이든 notyet->read처리된 것이 msgid가 있어야 제거처리가 가능한데 로깅테이블에서 읽어올 때는
                    //부하 고려해서 group by로 읽어와 msgid가 없음. 그래서 notyet->read인 경우만 여기서 로깅추가해 처리하고자 함 
                    const replyto = rs.data.msgmst.REPLYTO
                    const kind = newKind
                    const typ = hush.getTypeForMsgDtl(kind)
                    const logObj = { 
                        cdt: curdtObj.DT, msgid: msgid, replyto: replyto ? replyto : '', chanid: chanid, 
                        userid: userid, usernm: usernm, cud: 'D', kind: newKind, typ: typ, bodytext: ''
                    }
                    const ret = await hush.insertDataLog(this.dataSource, logObj)
                    if (ret != '') throw new Error(ret)
                } else { //원래 notyet은 기본적으로 insert되어 있으므로 여기로 들어오면 로직 이상이나 일단 처리해주는 것으로 함
                    //console.log(msgid, chanid, userid, newKind, '444')
                    await qbMsgDtl.insert().values({ 
                        MSGID: msgid, CHANID: chanid, USERID: userid, KIND: newKind, USERNM: usernm, TYP: 'read', CDT: curdtObj.DT, UDT: curdtObj.DT
                    }).execute() //console.log(msgid, chanid, userid, newKind, '555')
                }
            }
            //읽음 처리시 브라우조로부터 거의 동일한 시각에 2회 동시처리가 일어나는데 (물론 근본 원인은 브라우저에서 2회 호출이 문제지만)
            //어쨋든 아래 console.log(JSON.stringify(msgdtl), "0000000000") 찍어보면 두번째 데이터가 CNT가 더 적어져야 하는데 더 많음
            //이건 트랜잭션상 아직 commit하지 않은 상태가 반영된 것이 아닌 가 하는 의심이 드는데 해결책을 구하지 못하고 있어 
            //일단, 브라우저로 돌려 주는 아래 msgdtl을 제거하고 브라우저에서도 코딩을 항상 새로 서버호출해 데이터를 다시 가져오는 것으로 함
            //const msgdtl = await this.qryMsgDtl(qbMsgDtl, msgid, chanid)
            //console.log(JSON.stringify(msgdtl), "0000000000")
            //resJson.data.msgdtl = msgdtl
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async updateAllWithNewKind(dto: Record<string, any>): Promise<any> { //TX 필요없음        
        //현재는 읽기 관련 처리만 하므로 로킹 필요없으나 향후 추가시 로깅 처리 여부 체크 필요
        //모두읽음처리 : 1) notyet -> read 2) unread -> read
        const methodName = 'chanmsg>updateAllWithNewKind'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])       
        try {            
            const { chanid, oldKind, newKind } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder('B')
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) //await qbMsgDtl.select(hush.cons.curdtMySqlStr).getRawOne()
            await qbMsgDtl
            .update() //아래 readall은 리얼타임 반영시 모두읽음처리가 몇천개쯤 되면 로깅 읽을 때는 하나의 행으로 가져와야 부하를 줄일 수 있음 (동일시각)
            .set({ KIND: newKind, SUBKIND: 'readall', UDT: curdtObj.DT })
            .where("CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                chanid: chanid, userid: userid, kind: oldKind
            }).execute()
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })    
    async toggleReaction(dto: Record<string, any>): Promise<any> {
        const methodName = 'chanmsg>toggleReaction'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            const { msgid, chanid, kind } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            let qbMsgDtl = this.msgdtlRepo.createQueryBuilder()
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) //await qbMsgDtl.select(hush.cons.curdtMySqlStr).getRawOne()
            let cud = ''
            let msgdtl = await qbMsgDtl
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
                cud = 'D'
            } else {                
                await qbMsgDtl
                .insert().values({ 
                    MSGID: msgid, CHANID: chanid, USERID: userid, KIND: kind, CDT: curdtObj.DT, UDT: curdtObj.DT, USERNM: usernm, TYP: 'react'
                }).execute()
                cud = 'C'
            } //아래는 로깅 (changeAction과 동일)
            const logObj = { 
                cdt: curdtObj.DT, msgid: msgid, replyto: rs.data.msgmst.REPLYTO ? rs.data.msgmst.REPLYTO : '', chanid: chanid, 
                userid: userid, usernm: usernm, cud: cud, kind: kind, typ: hush.getTypeForMsgDtl(kind), bodytext: ''
            }
            const ret = await hush.insertDataLog(this.dataSource, logObj)
            if (ret != '') throw new Error(ret)
            qbMsgDtl = this.msgdtlRepo.createQueryBuilder('B')
            msgdtl = await this.qryMsgDtl(qbMsgDtl, msgid, chanid)
            resJson.data.msgdtl = msgdtl
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async changeAction(dto: Record<string, any>): Promise<any> {
        const methodName = 'chanmsg>changeAction'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            const { msgid, chanid, kind, job } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder()
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) //await qbMsgDtl.select(hush.cons.curdtMySqlStr).getRawOne()
            let cud = ''
            if (kind == 'later' || kind == 'stored' || kind == 'finished') {
                const msgdtlforuser = await qbMsgDtl
                .select("KIND")
                .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND in ('later', 'stored', 'finished') ", {
                    msgid: msgid, chanid: chanid, userid: userid
                }).getRawOne()
                if (!msgdtlforuser) {
                    await qbMsgDtl
                    .insert().values({ 
                        MSGID: msgid, CHANID: chanid, USERID: userid, KIND: kind, TYP: 'user', CDT: curdtObj.DT, UDT: curdtObj.DT, USERNM: usernm
                    }).execute()
                    cud = 'C' //resJson.data.work = "create"
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
                    cud = 'D' //resJson.data.work = "delete" //LaterPanel 탭에 보이는 행을 제거하기
                }
            } else if (kind == 'fixed' || kind == 'delfixed') {
                const msgdtlforuser = await qbMsgDtl
                .select("KIND")
                .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND IN ('fixed', 'delfixed') ", {
                    msgid: msgid, chanid: chanid, userid: userid
                }).getRawOne() //console.log(msgdtl.length, "@@@@@@@@@@")
                if (!msgdtlforuser) {
                    await qbMsgDtl
                    .insert().values({ 
                        MSGID: msgid, CHANID: chanid, USERID: userid, KIND: 'fixed', TYP: 'user', CDT: curdtObj.DT, UDT: curdtObj.DT, USERNM: usernm
                    }).execute()
                    cud = 'C'
                } else {
                    const newKInd = (msgdtlforuser.KIND == 'fixed') ? 'delfixed' : 'fixed'
                    cud = (msgdtlforuser.KIND == 'fixed') ? 'D' : 'C'
                    await qbMsgDtl
                    .update()
                    .set({ KIND: newKInd })
                    .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND IN ('fixed', 'delfixed') ", {
                        msgid: msgid, chanid: chanid, userid: userid
                    }).execute()
                }
                // if (kind == 'fixed') {
                //     if (!msgdtlforuser) {
                //         await qbMsgDtl
                //         .insert().values({ 
                //             MSGID: msgid, CHANID: chanid, USERID: userid, KIND: 'fixed', TYP: 'user', CDT: curdtObj.DT, UDT: curdtObj.DT, USERNM: usernm
                //         }).execute()
                //     } else {
                //         await qbMsgDtl
                //         .update()
                //         .set({ KIND: 'fixed' })
                //         .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                //             msgid: msgid, chanid: chanid, userid: userid, kind: kind
                //         }).execute()
                //     }
                //     cud = 'C'
                // } else { //delfixed
                //     if (msgdtlforuser) {
                //         await qbMsgDtl
                //         .delete()
                //         .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = 'fixed' ", {
                //             msgid: msgid, chanid: chanid, userid: userid
                //         }).execute()
                //     }
                //     cud = 'D'
                // }
            } //아래는 로깅 (changeReaction과 동일)
            const logObj = { 
                cdt: curdtObj.DT, msgid: msgid, replyto: rs.data.msgmst.REPLYTO ? rs.data.msgmst.REPLYTO : '', chanid: chanid, 
                userid: userid, usernm: usernm, cud: cud, kind: kind, typ: hush.getTypeForMsgDtl(kind), bodytext: ''
            }
            const ret = await hush.insertDataLog(this.dataSource, logObj)
            if (ret != '') throw new Error(ret)
            //resJson.data.work = (cud == 'D') ? 'delete' : 'create'
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async uploadBlob(dto: Record<string, any>, @UploadedFile() file: Express.Multer.File): Promise<any> {
        const methodName = 'chanmsg>uploadBlob'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])        
        try {
            const { msgid, chanid, kind, body, filesize } = dto //console.log(userid, msgid, chanid, kind, body, filesize)
            const rs = await this.chkAcl({ userid: userid, msgid: msgid, chanid: chanid, chkAuthor: true, chkGuest: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            let fileExt = '' //파일 검색에서 사용됨
            if (kind == 'F') {
                const arr = body.split('.')
                if (arr.length > 1) fileExt = arr[arr.length - 1].toLowerCase()
            }                
            const qbMsgSub = this.msgsubRepo.createQueryBuilder()
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) //await qbMsgSub.select(hush.cons.curdtMySqlStr).getRawOne()
            await qbMsgSub.insert().values({
                MSGID: userid, CHANID: chanid, KIND: kind, BODY: body, FILESIZE: filesize, FILEEXT: fileExt, CDT: curdtObj.DT, UDT: curdtObj.DT, 
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
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async delBlob(dto: Record<string, any>): Promise<any> { //temp일 상태와 msgid가 있는 상태 모두 여기서 처리하는 것임   
        const methodName = 'chanmsg>delBlob'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])            
        try {
            const msgid = (dto.msgid == 'temp') ? userid : dto.msgid //temp는 채널별로 사용자가 메시지 저장(발송)전에 미리 업로드한 것임
            const { chanid, kind, cdt } = dto //console.log(userid, msgid, chanid, kind, cdt)
            const rs = await this.chkAcl({ userid: userid, msgid: msgid, chanid: chanid, chkAuthor: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            await this.msgsubRepo.createQueryBuilder()
            .delete()
            .where("MSGID = :msgid and CHANID = :chanid and KIND = :kind and CDT = :cdt ", {
                msgid: msgid, chanid: chanid, kind: kind, cdt: cdt
            }).execute()
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async readBlob(dto: Record<string, any>): Promise<any> { //파일,이미지 읽어서 다운로드. 파일의 경우 파일시스템이 아닌 db에 저장하는 것을 전제로 한 것임
        const methodName = 'chanmsg>readBlob'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])        
        try {
            const msgid = (dto.msgid == 'temp') ? userid : dto.msgid //temp는 채널별로 사용자가 메시지 저장(발송)전에 미리 업로드한 것임
            const { chanid, kind, cdt, name } = dto //console.log('readBlob', userid, msgid, chanid, kind, cdt, name)
            const rs = await this.chkAcl({ userid: userid, chanid: chanid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            const msgsub = await this.msgsubRepo.createQueryBuilder('A')
            .select(['A.BUFFER'])
            .where("MSGID = :msgid and CHANID = :chanid and KIND = :kind and CDT = :cdt ", { //and BODY = :name ", { //Image도 조회해야 해서 name은 막음
                msgid: msgid, chanid: chanid, kind: kind, cdt: cdt //, name: name //name은 없어도 될 것이나 더 정확한 조회 목적임
            }).getOne()
            if (!msgsub) {                
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, methodName)
            }
            resJson.data = msgsub
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async saveChan(dto: Record<string, any>): Promise<any> { //삭제는 별도 서비스 처리
        const methodName = 'chanmsg>saveChan'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            const { GR_ID, CHANID, CHANNM, STATE, MEMBER } = dto
            const unidObj = await hush.getMysqlUnid(this.dataSource) //await this.chanmstRepo.createQueryBuilder().select(hush.cons.unidMySqlStr).getRawOne()
            let chanmst: ChanMst
            let kind = ''
            if (CHANID != 'new') {
                const rs = await this.chkAcl({ userid: userid, chanid: CHANID })
                if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
                if (rs.data.chanmst.KIND != 'admin') {
                    return hush.setResJson(resJson, '해당 관리자만 저장 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName)
                }
                kind = 'mst'
                if (rs.data.chanmst.TYP != 'WS') return //채널만 마스터정보 수정,저장되고 DM은 그럴 필요없음 (수정,저장할 정보 없음)
                chanmst = await this.chanmstRepo.findOneBy({ CHANID: CHANID }) //chanmst = rs.data.chanmst
                chanmst.CHANNM = CHANNM
                chanmst.STATE = STATE
                chanmst.MODR = userid
                chanmst.UDT = unidObj.DT
            } else { //신규
                if (GR_ID) { //dm이 아닌 chan의 경우임
                    const gr = await this.grmstRepo.createQueryBuilder('A')
                    .select(['A.GR_NM', 'B.SYNC'])
                    .innerJoin('A.dtl', 'B', 'A.GR_ID = B.GR_ID') 
                    .where("A.GR_ID = :grid and B.USERID = :userid ", { 
                        grid: GR_ID, userid: userid 
                    }).getOne()
                    if (!gr) {
                        return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (이 채널의 그룹에 해당 사용자가 없습니다)' + fv, hush.Code.NOT_FOUND, null, methodName)
                    }
                }
                chanmst = this.chanmstRepo.create()
                chanmst.CHANID = unidObj.ID
                chanmst.CHANNM = GR_ID ? CHANNM : 'DM'
                chanmst.TYP = GR_ID ? 'WS' : 'GS'
                chanmst.GR_ID = GR_ID ? GR_ID : 'GS'
                chanmst.MASTERID = userid
                chanmst.MASTERNM = usernm
                chanmst.STATE = GR_ID ? STATE : 'M' //DM은 무조건 M=마스터만열람으로 설정후 메시지 저장시 P(비공개)로 변경됨
                chanmst.ISUR = userid
                chanmst.CDT = unidObj.DT
                chanmst.MODR = userid
                chanmst.UDT = unidObj.DT
            }
            if (GR_ID) {
                if (!CHANNM || CHANNM.trim() == '' || CHANNM.trim().length > 50) {
                    return hush.setResJson(resJson, '채널명은 공란없이 50자까지 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName)
                }
            }
            await this.chanmstRepo.save(chanmst)
            if (CHANID == 'new') {
                const chandtl = this.chandtlRepo.create()                
                chandtl.CHANID = unidObj.ID
                chandtl.USERID = userid
                chandtl.USERNM = usernm
                chandtl.KIND = 'admin'
                chandtl.SYNC = 'Y' //채널 생성은 Y만 가능 (그룹도 마찬가지임)
                chandtl.ISUR = userid
                chandtl.CDT = unidObj.DT
                chandtl.MODR = userid
                chandtl.UDT = unidObj.DT
                await this.chandtlRepo.save(chandtl)
                if (MEMBER && Array.isArray(MEMBER) && MEMBER.length > 0) {
                    for (let i = 0; i < MEMBER.length; i++) {
                        if (MEMBER[i].USERID == userid) continue //바로 위에서 처리
                        const chandtl = this.chandtlRepo.create()                
                        chandtl.CHANID = unidObj.ID
                        chandtl.USERID = MEMBER[i].USERID
                        chandtl.USERNM = MEMBER[i].USERNM
                        chandtl.KIND = 'member'
                        chandtl.SYNC = MEMBER[i].SYNC
                        chandtl.ISUR = userid
                        chandtl.CDT = unidObj.DT
                        chandtl.MODR = userid
                        chandtl.UDT = unidObj.DT
                        await this.chandtlRepo.save(chandtl)
                    }
                }
                resJson.data.chanid = unidObj.ID
                kind = 'new'
            }
            const logObj = { 
                cdt: unidObj.DT, msgid: '', replyto: '', chanid: (CHANID != 'new') ? CHANID : unidObj.ID, 
                userid: userid, usernm: usernm, cud: (CHANID != 'new') ? 'U' : 'C', kind: kind, typ: 'chan', bodytext: '', subkind: chanmst.TYP
            }
            const ret = await hush.insertDataLog(this.dataSource, logObj)
            if (ret != '') throw new Error(ret)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }
    
    @Transactional({ propagation: Propagation.REQUIRED })
    async deleteChan(dto: Record<string, any>): Promise<any> { //채널 및 멤버 삭제시 백업테이블은 사용하지 않고 로그로 대체함 
        const methodName = 'chanmsg>deleteChan'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { CHANID } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            let sql = "SELECT COUNT(*) CNT FROM S_MSGMST_TBL WHERE CHANID = ? "
            const msgmst = await this.dataSource.query(sql, [CHANID])
            if (msgmst[0].CNT > 0) {
                return hush.setResJson(resJson, '해당 채널(또는 DM)에서 생성된 메시지가 있습니다.' + fv, hush.Code.NOT_OK, null, methodName)
            }
            const chanmst = rs.data.chanmst
            if (chanmst.MASTERID != userid) {
                return hush.setResJson(resJson, '마스터만 삭제 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName)
            }
            await this.dataSource.query("DELETE FROM S_CHANDTL_TBL WHERE CHANID = ? ", [CHANID])
            await this.dataSource.query("DELETE FROM S_CHANMST_TBL WHERE CHANID = ? ", [CHANID])
            const curdtObj = await hush.getMysqlCurdt(this.dataSource)
            const logObj = { 
                cdt: curdtObj.DT, msgid: '', replyto: '', chanid: CHANID, 
                userid: userid, usernm: usernm, cud: 'D', kind: 'mst', typ: 'chan', bodytext: '', subkind: chanmst.TYP
            }
            const ret = await hush.insertDataLog(this.dataSource, logObj)
            if (ret != '') throw new Error(ret)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async saveChanMember(dto: Record<string, any>): Promise<any> { //삭제는 별도 서비스 처리
        const methodName = 'chanmsg>saveChanMember'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { crud, CHANID, USERID, USERNM, KIND, SYNC, chkOnly } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            const chanmst = rs.data.chanmst
            if (chanmst.KIND != 'admin') {
                return hush.setResJson(resJson, '해당 채널 관리자만 멤버저장 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName)
            }
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) //await this.chandtlRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            let chandtl = await this.chandtlRepo.findOneBy({ CHANID: CHANID, USERID: USERID })
            if (crud == 'U') {
                if (!chandtl) {
                    return hush.setResJson(resJson, '해당 채널에 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName)
                }
                if (KIND != 'admin' && chanmst.MASTERID == USERID) {
                    return hush.setResJson(resJson, '해당 채널 생성자는 항상 admin이어야 합니다.' + fv, hush.Code.NOT_OK, null, methodName)
                }
                chandtl.USERNM = USERNM
                chandtl.KIND = KIND
                chandtl.MODR = userid
                chandtl.UDT = curdtObj.DT
            } else { //crud=C
                if (chandtl) {
                    return hush.setResJson(resJson, '해당 채널에 사용자가 이미 있습니다.' + fv, hush.Code.NOT_OK, null, methodName)
                }
                chandtl = this.chandtlRepo.create()
                chandtl.CHANID = CHANID
                chandtl.USERID = USERID
                chandtl.USERNM = USERNM
                chandtl.KIND = KIND
                chandtl.STATE = 'C' //초대직전
                chandtl.SYNC = SYNC
                chandtl.ISUR = userid
                chandtl.CDT = curdtObj.DT
                chandtl.MODR = userid
                chandtl.UDT = curdtObj.DT
            }
            if (!chkOnly) {
                await this.chandtlRepo.save(chandtl)
                const logObj = { 
                    cdt: curdtObj.DT, msgid: '', replyto: '', chanid: CHANID, 
                    userid: userid, usernm: usernm, cud: crud, kind: 'mem', typ: 'chan', bodytext: '', subkind: chanmst.TYP
                }
                const ret = await hush.insertDataLog(this.dataSource, logObj)
                if (ret != '') throw new Error(ret)
            }
            return resJson
        } catch (ex) {            
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async deleteChanMember(dto: Record<string, any>): Promise<any> { //채널 및 멤버 삭제시 백업테이블은 사용하지 않고 로그로 대체함 
        const methodName = 'chanmsg>deleteChanMember'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { CHANID, USERID, chkOnly } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            const chanmst = rs.data.chanmst
            if (chanmst.KIND != 'admin') {
                if (USERID == userid) {
                    //본인이 방에서 나가려고 하는 것임
                } else { //멤버삭제=강제퇴장
                    return hush.setResJson(resJson, '해당 관리자만 멤버삭제 가능합니다.' + fv, hush.Code.NOT_OK, null, methodName)
                }
            }
            if (chanmst.MASTERID == USERID) {
                return hush.setResJson(resJson, '해당 채널 생성자는 삭제할 수 없습니다.' + fv, hush.Code.NOT_OK, null, methodName)
            }
            let chandtl = await this.chandtlRepo.findOneBy({ CHANID: CHANID, USERID: USERID })
            if (!chandtl) {
                return hush.setResJson(resJson, '해당 채널에 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName)
            }
            if (chkOnly) {
                //퇴장 메시지 등은 시스템에서 해당 룸으로 보내면 문제없을 것이나 data polling 등 구조적으로 어려워 (다음 과제로 넘기고)
                //일단, delete해도 되는지 미리 체크하고자 함 (본인이 나가는 경우에 먼저 chkOnly 알아보지 않으면 멤버제거후 권한이 없어져 퇴장메시지 전송이 안됨)
            } else {
                await this.chandtlRepo.delete(chandtl) //더 위로 올라가면 안됨
                const curdtObj = await hush.getMysqlCurdt(this.dataSource)
                const logObj = { 
                    cdt: curdtObj.DT, msgid: '', replyto: '', chanid: CHANID, 
                    userid: userid, usernm: usernm, cud: 'D', kind: 'mem', typ: 'chan', bodytext: '', subkind: chanmst.TYP
                }
                const ret = await hush.insertDataLog(this.dataSource, logObj)
                if (ret != '') throw new Error(ret)
            }
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async inviteToMember(dto: Record<string, any>): Promise<any> {
        const methodName = 'chanmsg>inviteToMember'
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { CHANID, CHANNM, USERIDS } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, methodName)
            const curdtObj = await hush.getMysqlCurdt(this.dataSource) //await this.chandtlRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            const chanmst = rs.data.chanmst
            const grid = chanmst.GR_ID
            const mailTo = [], nmTo = []
            const link = '<p><a href="http://localhost:5173/login" target="_blank" style="margin:10px">WiSEBand 열기</a></p>'
            const mailTitle = '[' + hush.cons.appName + ']로 조대합니다 - ' + usernm
            let mailBody = '<p style="margin:10px">방명 : <b>' + CHANNM + '</b></p>' + link
            for (let i = 0; i < USERIDS.length; i++) {
                const useridMem = USERIDS[i]
                const chandtl = await this.chandtlRepo.findOneBy({ CHANID: CHANID, USERID: useridMem })
                if (!chandtl) {
                    return hush.setResJson(resJson, '해당 사용자의 채널 멤버 정보가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName)
                }
                let rec: any
                if (chandtl.SYNC == 'Y') {
                    rec = await this.userRepo.findOneBy({ USERID: useridMem })                    
                } else {
                    rec = await this.grdtlRepo.findOneBy({ GR_ID: grid, USERID: useridMem })
                }
                if (!rec) {
                    return hush.setResJson(resJson, '해당 사용자의 정보가 없습니다.' + fv, hush.Code.NOT_FOUND, null, methodName)
                }
                if (!rec.EMAIL.includes('@')) { //정확하게 체크하려면 정규식 사용해야 하나 일단 @ 체크로 처리
                    return hush.setResJson(resJson, '해당 사용자의 이메일 주소에 문제가 있습니다.' + fv, hush.Code.NOT_OK, null, methodName)
                }
                mailTo.push(rec.EMAIL)                
                if (chandtl.SYNC == 'Y') {
                    nmTo.push(rec.USERNM + '/' + rec.ORG_NM + '/' + rec.TOP_ORG_NM)
                } else {
                    nmTo.push(rec.USERNM + '/' + rec.ORG)
                }
                chandtl.STATE = '' //발송후엔 참여상태로 변경
                chandtl.MODR = userid
                chandtl.UDT = curdtObj.DT
                await this.chandtlRepo.save(chandtl)
            }
            mailBody += '<p style="margin:10px">대상 : ' + nmTo.join(', ') + '</p>'
            this.mailSvc.sendMail(mailTo, mailTitle, mailBody)
            //위 메일 발송 결과를 알 수 있으면 베스트. 아래는 초대 메시지 생성
            const str = '초대합니다.<br><br>' + nmTo.join(', ')
            await this.saveMsg({ //const param: Record<string, any> = { crud: 'C'.. }
                crud: 'C', chanid: CHANID, body : str, bodytext : str.replaceAll('<br>', '\n') 
            })
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryDataLogEach(dto: Record<string, any>): Promise<any> { //insertDataLog()는 common.ts에 있음
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { logdt } = dto  //console.log(logdt, "qryDataLogEach", userid)
            let sql = "SELECT MSGID, X.CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND "
            sql += "  FROM ( "
            sql += "SELECT MSGID, CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND "
            sql += "  FROM S_DATALOG_TBL "
            sql += " WHERE CDT > ? AND TYP = 'chan' AND NOT (KIND = 'mst' AND CUD = 'D') " //chan의 mst의 D는 S_CHANDTL_TBL에 INNERJOIN할 데이터 없음
            sql += " UNION ALL "
            sql += "SELECT MSGID, CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND "
            sql += "  FROM S_DATALOG_TBL "
            sql += " WHERE CDT > ? AND TYP IN ('msg', 'react') "
            sql += " UNION ALL "
            sql += "SELECT MSGID, CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND "
            sql += "  FROM S_DATALOG_TBL " //read는 원래 S_MSGDTL_TBL에서 가져오는데 MsgList의 newParentAdded/newChildAdded 배열의 항목을 제거하기 위해 msgid가 필요함
            sql += " WHERE CDT > ? AND TYP IN ('user', 'read') AND USERID = ? " //그래서, updateNotyetToRead()에서 로깅처리중임 (내가 읽은 메시지를 배열에서 제거하면 됨)
            sql += " UNION ALL "
            sql += "SELECT MSGID, CHANID, MAX(UDT) CDT, (SELECT REPLYTO FROM S_MSGMST_TBL WHERE MSGID = A.MSGID AND A.CHANID) REPLYTO, "
            sql += "       '' USERID, '' USERNM, 'T' CUD, '' KIND, TYP, '' BODYTEXT, '' SUBKIND "
            sql += "  FROM S_MSGDTL_TBL A "
            sql += " WHERE UDT > ? AND TYP = 'read' AND SUBKIND = '' " //UDT에 유의. NOTYET -> READ로의 처리는 빈번하게 발생하므로 효율적으로 GROUP BY가 필요함
            sql += " GROUP BY MSGID, CHANID "
            sql += " UNION ALL "
            sql += "SELECT '' MSGID, CHANID, UDT AS CDT, '' REPLYTO, '' USERID, '' USERNM, 'T' CUD, '' KIND, TYP, '' BODYTEXT, SUBKIND "
            sql += "  FROM S_MSGDTL_TBL " //아래 readall은 리얼타임 반영시 모두읽음처리가 몇천개쯤 되면 로깅 읽을 때는 하나의 행으로 가져와야 부하를 줄일 수 있음 (동일시각)
            sql += " WHERE UDT > ? AND TYP = 'read' AND SUBKIND = 'readall' " //UDT에 유의
            sql += " GROUP BY CHANID, UDT " //UDT에 유의
            sql += ") X INNER JOIN (SELECT CHANID FROM S_CHANDTL_TBL WHERE USERID = ?) Y ON X.CHANID = Y.CHANID " //#$ 사용자가 속하지 않은 공개된 채널은 리얼타임 반영(알림 포함)하지 않음 
            sql += " UNION ALL "
            sql += "SELECT MSGID, CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND "
            sql += "  FROM S_DATALOG_TBL "
            sql += " WHERE CDT > ? AND TYP = 'chan' AND KIND = 'mst' AND CUD = 'D' " //chan의 mst의 D는 S_CHANDTL_TBL에 INNERJOIN할 데이터 없음
            sql += " UNION ALL "
            sql += "SELECT MSGID, CHANID, CDT, REPLYTO, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND "
            sql += "  FROM S_DATALOG_TBL "
            sql += " WHERE CDT > ? AND TYP = 'group' AND KIND = 'mst' " //group은 S_CHANDTL_TBL에 INNERJOIN할 데이터 없으며 kind가 mem은 리얼타임엔 필요없음. CHANID에 GR_ID가 들어가 있음
            sql += " ORDER BY CDT "
            const list = await this.dataSource.query(sql, [logdt, logdt, logdt, userid, logdt, logdt, userid, logdt, logdt])
            const len = list.length
            for (let i = 0; i < len; i++) {
                const row = list[i]
                if (row.SUBKIND == 'readall') {
                    //qryMsg() 필요없음
                } else if (row.TYP == 'chan') {
                    if (row.KIND == 'mst' && row.CUD == 'D') {
                        //S_CHANDTL_TBL에 INNERJOIN할 데이터 없어 권한이 없는 경우도 있을텐데 로깅만 내리는 것이므로 문제될 사안은 아님
                    } else {
                        const rs = await this.chkAcl({ userid: userid, chanid: row.CHANID, includeBlob: true })
                        row.chanmst = rs.data.chanmst
                        row.chandtl = rs.data.chandtl
                    }
                } else if (row.TYP == 'group') {
                    if (row.KIND == 'mst' && row.CUD == 'D') {
                        //권한이 없는 경우도 있을텐데 로깅만 내리는 것이므로 문제될 사안은 아님
                    } else {
                        const sqlGr = "SELECT GR_NM FROM S_GRMST_TBL WHERE GR_ID = ? "
                        const grData = await this.dataSource.query(sqlGr, [row.CHANID]) //실제로는 GR_ID임
                        row.grnm = (grData.length > 0) ? grData[0].GR_NM : ''
                    }
                } else if (row.CUD == 'C' && row.KIND == 'parent') { //child는 부모정보가 필요해서 아래 else로 읽어옴
                    //클라이언트에서 getList()로 scrollToBottom으로 통으로 가져옴
                } else {
                    const parentMsgid = (row.REPLYTO != '') ? row.REPLYTO : row.MSGID
                    row.msgItem = await this.qryMsg({ chanid: row.CHANID, msgid: parentMsgid }) //모두 부모메시지 정보만 있으면 됨 (S_MSGDTL_TBL 관련일 경우는 사실 본문,이미지 등 필요없긴 함)
                }
            }
            sql = "SELECT Z.TYP, SUM(Y.CNT) SUM "
            sql += " FROM (SELECT CHANID, COUNT(*) CNT FROM S_MSGDTL_TBL WHERE USERID = ? AND KIND = 'notyet' GROUP BY CHANID) Y "
            sql += "INNER JOIN (SELECT A.CHANID, A.TYP FROM S_CHANMST_TBL A "
            sql += "             INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID WHERE B.USERID = ?) Z "
            sql += "   ON Y.CHANID = Z.CHANID "
            sql += "GROUP BY Z.TYP "
            sql += "ORDER BY Z.TYP "
            const listByMenu = await this.dataSource.query(sql, [userid, userid])
            resJson.data.logdt = (len == 0) ? logdt : list[len - 1].CDT
            resJson.list = list
            resJson.data.listByMenu = listByMenu //사이드메뉴에 안읽은 메시지 카운트 표시 (내가 포함되지 않은 공개 채널은 매번 알림이 뜨는 건 불편하므로 제외. 바로 위 #$ sql 참조)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

}
