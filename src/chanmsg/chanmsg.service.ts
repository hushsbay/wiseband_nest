import { Inject, Injectable, Scope, UploadedFile } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm'
import { Propagation, Transactional } from 'typeorm-transactional'

import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { MailService } from 'src/mail/mail.service'
import { MsgMst, MsgSub, MsgDtl, ChanMst, ChanDtl, GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity'
import { User } from 'src/user/user.entity'

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
        private mailSvc: MailService, 
        @Inject(REQUEST) private readonly req: Request
    ) {}

    async chkAcl(dto: Record<string, any>): Promise<any> { //1) 각종 권한 체크 2) 각종 공통데이터 읽어 오기
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            let data = { chanmst: null, chandtl: [], msgmst: null }
            const { userid, grid, chanid, msgid, includeBlob, chkAuthor } = dto //보통은 grid 없어도 chanid로 grid 가져와서 체크
            //console.log('chkAcl', userid, chanid, msgid, includeBlob, chkAuthor)
            //////////a) S_CHANMST_TBL + S_GRMST_TBL => TYP : WS(WorkSpace)/GS(GeneralSapce-S_GRMST_TBL비연동), STATE : 공개(A)/비공개(P)
            const chanmst = await this.chanmstRepo.createQueryBuilder('A')
            .select(['A.CHANNM', 'A.TYP', 'A.GR_ID', 'A.MASTERID', 'A.MASTERNM', 'A.STATE'])
            .where("A.CHANID = :chanid ", { 
                chanid: chanid 
            }).getOne()
            if (!chanmst) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkAcl>chanmst')
            }
            let grnm = ''
            if (chanmst.TYP == 'GS') {
                //S_GRMST_TBL 체크할 필요없음 (예: DM은 GR_ID 필요없는 GS 타입)
            } else {
                if (grid) {
                    if (grid != chanmst.GR_ID) {
                        return hush.setResJson(resJson, '요청한 grid와 chanid가 속한 grid가 다릅니다.' + fv, hush.Code.NOT_OK, null, 'chanmsg>chkAcl>grid')
                    }
                }
                const gr = await this.grmstRepo.createQueryBuilder('A')
                .select(['A.GR_NM'])
                .innerJoin('A.dtl', 'B', 'A.GR_ID = B.GR_ID') 
                .where("A.GR_ID = :grid and B.USERID = :userid ", { 
                    grid: chanmst.GR_ID, userid: userid 
                }).getOne()
                if (!gr) {
                    return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (이 채널의 그룹에 해당 사용자가 없습니다)' + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkAcl>gr')
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
                    data.chanmst.STATE1 = item.STATE //STATE(공용,비밀)가 이미 S_CHANMST_TBL에 존재함 (여기는 S_CHANDTL_TBL의 STATE임=STATE1=매니저(M)/참여대기(W))
                    break
                }
            } */
            /* 바로 아래와 같이 개선함
            const picFld = includeBlob ? ", B.PICTURE" : ""
            let sql = "SELECT A.USERID, A.USERNM, A.STATE, A.KIND " + picFld
            sql += "     FROM S_CHANDTL_TBL A "
            sql += "    INNER JOIN S_USER_TBL B ON A.USERID = B.USERID "
            sql += "    WHERE A.CHANID = ? "
            sql += "      AND A.STATE IN ('', 'M') " //사용중(빈칸)/매니저(M)/참여대기(W)
            sql += "    ORDER BY A.USERNM "
            const chandtl = await this.dataSource.query(sql, [chanid])
            if (chandtl.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkAcl>chandtl')
            }
            for (let item of chandtl) {
                if (item.USERID == userid) {
                    data.chanmst.USERID = item.USERID
                    data.chanmst.KIND = item.KIND //R(읽기전용)
                    data.chanmst.STATE1 = item.STATE //S_CHANDTL_TBL의 STATE=STATE1임 : 매니저(M)/참여대기(W)
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
            //if (data.chanmst.STATE1 == 'X' || data.chanmst.STATE1 == 'Z') { //퇴장 or 강제퇴장
            //    return hush.setResJson(resJson, '퇴장처리된 채널입니다.' + fv, hush.Code.NOT_AUTHORIZED, null, 'chanmsg>chkAcl>out')
            //}
            data.chandtl = chandtl */
            let sql = "SELECT USERID, USERNM, STATE, KIND, SYNC "
            sql += "     FROM S_CHANDTL_TBL "
            sql += "    WHERE CHANID = ? "
            //sql += "      AND STATE IN ('') " //사용중(빈칸)/초대전(C)/참여대기(W)
            sql += "    ORDER BY USERNM "
            const chandtl = await this.dataSource.query(sql, [chanid])
            if (chandtl.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkAcl>chandtl')
            }
            for (let item of chandtl) {
                if (item.USERID == userid) { //현재 사용자와 같으면 현재 사용자의 정보를 CHANMST에 표시
                    //data.chanmst.USERID = item.USERID
                    data.chanmst.KIND = item.KIND //admin/member/guest
                    data.chanmst.STATE1 = item.STATE //S_CHANDTL_TBL의 STATE=STATE1임 : 초대전(C)/참여대기(W)
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
                //공개(All)된 채널이므로 채널멤버가 아니어도 읽을 수 있음
            } else { //비공개(Private)
                if (!data.chanmst.USERID) {
                    return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (비공개 채널)' + fv, hush.Code.NOT_AUTHORIZED, null, 'chanmsg>chkAcl>private')
                }
            }
            data.chandtl = chandtl
            if (data.chanmst.STATE1 == 'C' || data.chanmst.STATE1 == 'W') { //초청받고 초대전이나 참여대기시엔 메시지는 안보여주기
                resJson.data = data
                return resJson
            }
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
            hush.throwCatchedEx(ex, this.req, fv)
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
        .where("B.MSGID = :msgid and B.CHANID = :chanid and B.TYP in ('', 'react') ", { //and B.KIND not in ('read', 'unread') 화면에는 notyet만 보여주면 read, unread는 안보여줘도 알 수 있음
            msgid: msgid, chanid: chanid
        }).groupBy('B.KIND').orderBy('B.KIND', 'ASC').getRawMany()
        return (msgdtl.length > 0) ? msgdtl : []
    }

    async qryMsgDtlMention(qb: SelectQueryBuilder<MsgDtl>, msgid: string, chanid: string): Promise<any> { //d-1) S_MSGDTL_TBL
        // const msgdtl = await qb
        // .select(['B.MSGID', 'B.KIND', 'B.USERID', 'B.USERNM'])
        // .where("B.MSGID = :msgid and B.CHANID = :chanid and B.TYP = 'touser' ", {
        //     msgid: msgid, chanid: chanid
        // }).orderBy('B.USERNM', 'ASC').getMany() //계속 GROUP BY 관련 오류가 나오는데 원인 못밝혀 아래 방식대로 바꿈
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
        replyInfo[0].MYNOTYETCNT = replyUnread[0].MYNOTYETCNT
        return replyInfo
    }

    async qryVipList(userid: string): Promise<any> {
        let sql = "SELECT GROUP_CONCAT(UID) UID FROM S_USERCODE_TBL WHERE KIND = 'vip' AND USERID = ? "
        return await this.dataSource.query(sql, [userid])
    }

    getSqlWs(userid: string): string {
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

    getSqlGs(userid: string): string {
        let sqlGs = "      SELECT '' GR_ID, '' GR_NM, A.CHANID, A.CHANNM " //2) DM은 사용자그룹 등록없이 채널멤버만으로도 사용되므로 바로 여기처럼 가져옴
        sqlGs += "           FROM S_CHANMST_TBL A "
        sqlGs += "          INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID "
        sqlGs += "          WHERE B.USERID = '" + userid + "' AND A.TYP = 'GS' "
        return sqlGs
    }

    ///////////////////////////////////////////////////////////////////////////////위는 서비스내 공통 모듈

    async qry(dto: Record<string, any>): Promise<any> { //채널내 메시지 리스트를 무한스크롤로 가져 오는 경우에도 마스터 정보는 어차피 ACL때문이라도 읽어야 함
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try { //어차피 권한체크때문이라도 chanmst,chandtl를 읽어야 하므로 읽는 김에 데이터 가져와서 사용하기로 함
            let data = { 
                chanmst: null, chandtl: [], msglist: [], tempfilelist: [], tempimagelist: [], templinklist: [], 
                msgidParent: '', msgidChild: '', vipStr: null 
            }
            const { chanid, lastMsgMstCdt, firstMsgMstCdt, msgid, kind } = dto //console.log("qry", lastMsgMstCdt, firstMsgMstCdt, msgid, kind)
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, includeBlob: true }) //a),b),c) 가져옴 //msgid 들어가면 안됨
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>qry')
            data.chanmst = rs.data.chanmst
            data.chandtl = rs.data.chandtl
            const viplist = await this.qryVipList(userid)
            data.vipStr = viplist[0].UID
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
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'chanmsg>qry>atHome')
                } //위의 msgid는 부모글일 수도 댓글일 수도 있지만 아래 2행은 무조건 부모글과 자식글로 구분해서 전달함
                data.msgidParent = msgidParent //MsgList.vue의 getList()에서 사용
                data.msgidChild = msgid //MsgList.vue의 getList()에서 사용. msgidParent와 다르면 이건 댓글의 msgid임
                //console.log(msgidParent, msgid, "$$$$$$$")
            } else if (msgid && kind == 'withReply') { //ASC임을 유의
                const fields = fldArr.join(", ").replace(/A\./g, "") + " " 
                const tbl = "FROM S_MSGMST_TBL "
                let sql = "SELECT " + fields + tbl + " WHERE MSGID = ? AND CHANID = ? "
                sql += "    UNION ALL "
                sql += "   SELECT " + fields + tbl + " WHERE REPLYTO = ? AND CHANID = ? "    
                sql += "    ORDER BY CDT ASC "
                msglist = await this.dataSource.query(sql, [msgid, chanid, msgid, chanid])
                if (msglist.length == 0) { //사용자가 마스터 선택했으므로 데이터가 반드시 있어야 함
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'menu>qry>withReply')
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
                sql += "    LIMIT 1000 " //1년치만 조회하는 것으로 했으나 혹시 몰라서 LIMIT도 설정 (처음 못읽은 것은 두번째 클릭하면 읽힘)
                msglist = await this.dataSource.query(sql, [chanid, userid, kind, dtMinusStr, chanid, userid, kind, dtMinusStr, chanid])
            }
            if (msglist.length > 0) data.msglist = msglist
            ///////////////////////////////////////////////////////////d-1),d-2),d-3),d-4)
            for (let i = 0; i < data.msglist.length; i++) {
                const item = data.msglist[i] //item.isVip = vipStr.includes(item.AUTHORID) ? true : false
                const msgdtlforuser = await this.qryMsgDtlForUser(qbDtl, item.MSGID, chanid, userid) //d-0) S_MSGDTL_TBL (본인액션만 가져오기)
                item.act_later = msgdtlforuser.act_later
                item.act_fixed = msgdtlforuser.act_fixed
                const msgdtl = await this.qryMsgDtl(qbDtl, item.MSGID, chanid) //d-1) S_MSGDTL_TBL (각종 이모티콘)
                item.msgdtl = (msgdtl.length > 0) ? msgdtl : []                
                const msgdtlmention = await this.qryMsgDtlMention(qbDtl, item.MSGID, chanid) //d-1) S_MSGDTL_TBL (멘션)
                item.msgdtlmention = (msgdtlmention.length > 0) ? msgdtlmention : []
                const msgsub = await this.qryMsgSub(qbSub, item.MSGID, chanid) //d-2) S_MSGSUB_TBL (파일, 이미지, 링크 등)
                item.msgfile = msgsub.msgfile
                item.msgimg = msgsub.msgimg
                item.msglink = msgsub.msglink
                const reply = await this.qryReply(qb, item.MSGID, chanid) //d-3) S_MSGMST_TBL (댓글-스레드)
                item.reply = (reply.length > 0) ? reply : []
                const replyInfo = await this.qryReplyInfo(item.MSGID, chanid, userid) //d-4) S_MSGMST_TBL (댓글-스레드)
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
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }
    
    async qryChanMstDtl(dto: Record<string, any>): Promise<any> { //1) MemberList에서 사용 2) MsgList에서 채널 정보만 읽어서 새로고침 용도로 사용
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try { //내가 멤버로 들어가 있는 그룹만 조회 가능
            const { chanid, state } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, includeBlob: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>qryChanMstDtl')
            resJson.data.chanmst = rs.data.chanmst
            if (state == 'C' || state == 'W') { //초대전(초대필요),참여대기 : 위 chkAcl은 권한 체크모듈이므로 거기서 처리하지 않고 여기서 안전하게 처리 
                resJson.data.chandtl = rs.data.chandtl.filter((item: ChanDtl) => (item.STATE == state))
            } else { //All
                resJson.data.chandtl = rs.data.chandtl
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

    // async searchMedia(dto: Record<string, any>): Promise<any> { //원본
    //     try {
    //         const resJson = new ResJson()
    //         const userid = this.req['user'].userid
    //         const { chanid, lastMsgMstCdt, kind, fileName, fileExt, frYm, toYm, authorNm, bodyText } = dto
    //         const kindStr = kind.substr(0, 1).toUpperCase()
    //         console.log("searchMedia", chanid, lastMsgMstCdt, kindStr, fileName, fileExt, frYm, toYm, authorNm, bodyText)
    //         const rs = await this.chkAcl({ userid: userid, chanid: chanid })
    //         if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>searchMedia')
    //         const bufferField = kind == 'image' ? ', A.BUFFER ' : ''
    //         let frDash = '0000-00-00', toDash = '9999-99-99'
    //         if (frYm.length == 6) frDash = frYm.substr(0, 4) + '-' + frYm.substr(4, 2)
    //         if (toYm.length == 6) toDash = toYm.substr(0, 4) + '-' + toYm.substr(4, 2) + '-99'            
    //         let sql = "SELECT A.MSGID, A.CHANID, A.KIND, A.BODY, B.CDT, B.UDT, A.FILESIZE, B.AUTHORID, B.AUTHORNM, B.REPLYTO, B.BODYTEXT " + bufferField
    //         sql += "     FROM S_MSGSUB_TBL A " //메시지는 있는데 파일,이미지 데이터가 없는 경우는 제외되어야 함
    //         sql += "    INNER JOIN S_MSGMST_TBL B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID "
    //         sql += "    WHERE A.CDT >= '" + frDash + "' AND A.CDT <= '" + toDash + "' "
    //         sql += "      AND A.CHANID = ? "
    //         sql += "      AND A.KIND = ? "
    //         if (kindStr == 'F' && fileExt != '') sql += " AND A.FILEEXT = '" + fileExt + "' "
    //         sql += "      AND A.CDT < ? "
    //         if (kindStr == 'F' && fileName != '') sql += " AND A.BODY LIKE '%" + fileName + "%' "
    //         if (authorNm != '') sql += " AND B.AUTHORNM LIKE '%" + authorNm + "%' "
    //         if (bodyText != '') sql += " AND B.BODYTEXT LIKE '%" + bodyText + "%' "
    //         sql += "    ORDER BY A.CDT DESC "
    //         sql += "    LIMIT " + hush.cons.rowsCnt
    //         console.log(sql)
    //         const list = await this.dataSource.query(sql, [chanid, kindStr, lastMsgMstCdt])
    //         resJson.list = list
    //         return resJson
    //     } catch (ex) {
    //         hush.throwCatchedEx(ex, this.req)
    //     }
    // }

    async searchMedia(dto: Record<string, any>): Promise<any> { //아래 sql에서 먼저 권한있는 채널만 필터링됨
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { chanid, lastMsgMstCdt, rdoOpt, kind, fileName, fileExt, frYm, toYm, authorNm, searchText } = dto
            const kindStr = kind.substr(0, 1).toUpperCase()
            //console.log("searchMedia", chanid, lastMsgMstCdt, rdoOpt, kindStr, fileName, fileExt, frYm, toYm, authorNm, searchText)
            let frDash = '0000-00-00', toDash = '9999-99-99'
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
            console.log(sql)
            const list = await this.dataSource.query(sql, [lastMsgMstCdt])
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
            const { chanid, lastMsgMstCdt, rdoOpt, frYm, toYm, authorNm, searchText } = dto            
            //console.log("searchMsg", chanid, lastMsgMstCdt, rdoOpt, frYm, toYm, authorNm, searchText)
            let frDash = '0000-00-00', toDash = '9999-99-99'
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
            //console.log(sql)
            const list = await this.dataSource.query(sql, [lastMsgMstCdt])
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

    async qryMsg(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            let data = { 
                msgmst: null, act_later: null, act_fixed: null, msgdtl: null, msgfile: null, msgimg: null, msglink: null, reply: null, replyinfo: null 
            }
            const { chanid, msgid } = dto
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
            const replyInfo = await this.qryReplyInfo(msgid, chanid, userid) //d-4) S_MSGMST_TBL (댓글-스레드)
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
            resJson.data = msgdtl //데이터 없어도 없는대로 넘기기 (안그러면 사용자에게 소켓통신 통해 정보요청이 올 때마다 뜨게됨)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async saveMsg(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            const { crud, chanid, replyto, body, bodytext, num_file, num_image, num_link } = dto //crud는 C or U만 처리 
            let msgid = dto.msgid //console.log(userid, msgid, chanid, crud, replyto, body, num_file, num_image)
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
                .where("A.CHANID = :chanid and A.STATE = '' ", { 
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
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async delMsg(dto: Record<string, any>): Promise<any> { 
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])       
        try { //메시지 마스터를 삭제하면 거기에 딸려 있는 서브와 디테일 테이블 정보는 소용없으므로 모두 삭제함 (DEL_TBL로 이동시킴)
            const { msgid, chanid } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid, chkAuthor: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>delMsg')  
            const msgReply = await this.msgmstRepo.findOneBy({ REPLYTO: msgid, CHANID: chanid })
            if (msgReply) return hush.setResJson(resJson, '댓글이 있습니다.', hush.Code.NOT_OK, this.req, 'chanmsg>delMsg')  
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
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async toggleChanOption(dto: Record<string, any>): Promise<any> { //TX 필요없음
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            const { chanid, kind, job } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>toggleChanOption')
            const qbChanDtl = this.chandtlRepo.createQueryBuilder()
            const curdtObj = await qbChanDtl.select(hush.cons.curdtMySqlStr).getRawOne()
            const chandtl = await qbChanDtl
            .select("COUNT(*) CNT")
            .where("CHANID = :chanid and USERID = :userid ", {
                chanid: chanid, userid: userid
            }).getRawOne()
            if (chandtl.CNT == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'chanmsg>toggleChanOption')
            } else {
                let obj = { MODR: userid, UDT: curdtObj.DT }
                if (kind == "noti") { //job=X/빈값
                    Object.assign(obj, { NOTI: job })
                } else if (kind == "bookmark") { //job=Y/빈값
                    Object.assign(obj, { BOOKMARK: job })
                } else {
                    return hush.setResJson(resJson, 'kind값이 잘못되었습니다.' + fv, hush.Code.NOT_OK, this.req, 'chanmsg>toggleChanOption')
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

    async updateWithNewKind(dto: Record<string, any>): Promise<any> { //TX 필요없음
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])       
        try {            
            const { msgid, chanid, oldKind, newKind } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid, msgid: msgid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>updateWithNewKind')
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder('B')
            const curdtObj = await qbMsgDtl.select(hush.cons.curdtMySqlStr).getRawOne()
            const msgdtlNew = await this.msgdtlRepo.findOneBy({ MSGID: msgid, CHANID: chanid, USERID: userid, KIND: newKind })
            if (msgdtlNew) this.msgdtlRepo.delete(msgdtlNew) //아래에서 update하면 같은 newKind가 생길 수 있으므로 미리 check and delete
            let msgdtl = await this.msgdtlRepo.findOneBy({ MSGID: msgid, CHANID: chanid, USERID: userid, KIND: oldKind })
            if (msgdtl) {
                msgdtl.UDT = curdtObj.DT
            } else {
                msgdtl = this.msgdtlRepo.create()
                msgdtl.MSGID = msgid
                msgdtl.CHANID = chanid
                msgdtl.USERID = userid
                msgdtl.USERNM = usernm
                msgdtl.TYP = ''
                msgdtl.CDT = curdtObj.DT
            }
            msgdtl.KIND = newKind
            this.msgdtlRepo.save(msgdtl)
            // await qbMsgDtl
            // .update()
            // .set({ KIND: newKind, UDT: curdtObj.DT })
            // .where("MSGID = :msgid and CHANID = :chanid and USERID = :userid and KIND = :kind ", {
            //     msgid: msgid, chanid: chanid, userid: userid, kind: oldKind
            // }).execute()
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async updateAllWithNewKind(dto: Record<string, any>): Promise<any> { //TX 필요없음
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])       
        try {            
            const { chanid, oldKind, newKind } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: chanid })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>updateAllWithNewKind')
            const qbMsgDtl = this.msgdtlRepo.createQueryBuilder('B')
            const curdtObj = await qbMsgDtl.select(hush.cons.curdtMySqlStr).getRawOne()
            await qbMsgDtl
            .update()
            .set({ KIND: newKind, UDT: curdtObj.DT })
            .where("CHANID = :chanid and USERID = :userid and KIND = :kind ", {
                chanid: chanid, userid: userid, kind: oldKind
            }).execute()
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }
    
    async toggleAction(dto: Record<string, any>): Promise<any> { //TX 필요없음 : checked, done, watching
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
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
                    MSGID: msgid, CHANID: chanid, USERID: userid, KIND: kind, CDT: curdtObj.DT, USERNM: usernm, TYP: 'react'
                }).execute()
            }
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async changeAction(dto: Record<string, any>): Promise<any> { //TX 필요없음 : later, stored, finished, fixed
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
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
                }).getRawOne()
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
                    resJson.data.work = "delete" //LaterPanel 탭에 보이는 행을 제거하기
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
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async uploadBlob(dto: Record<string, any>, @UploadedFile() file: Express.Multer.File): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])        
        try {
            const { msgid, chanid, kind, body, filesize } = dto //console.log(userid, msgid, chanid, kind, body, filesize)
            const rs = await this.chkAcl({ userid: userid, msgid: msgid, chanid: chanid, chkAuthor: true })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>uploadBlob')
            let fileExt = '' //파일 검색에서 사용됨
            if (kind == 'F') {
                const arr = body.split('.')
                if (arr.length > 1) fileExt = arr[arr.length - 1].toLowerCase()
            }                
            const qbMsgSub = this.msgsubRepo.createQueryBuilder()
            const curdtObj = await qbMsgSub.select(hush.cons.curdtMySqlStr).getRawOne()
            await qbMsgSub.insert().values({
                MSGID: userid, CHANID: chanid, KIND: kind, BODY: body, FILESIZE: filesize, FILEEXT: fileExt, CDT: curdtObj.DT, 
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
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])            
        try {
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
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async readBlob(dto: Record<string, any>): Promise<any> { //파일,이미지 읽어서 다운로드. 파일의 경우 파일시스템이 아닌 db에 저장하는 것을 전제로 한 것임
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])        
        try {
            const msgid = (dto.msgid == 'temp') ? userid : dto.msgid //temp는 채널별로 사용자가 메시지 저장(발송)전에 미리 업로드한 것임
            const { chanid, kind, cdt, name } = dto //console.log('readBlob', userid, msgid, chanid, kind, cdt, name)
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
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async saveChan(dto: Record<string, any>): Promise<any> { //삭제는 별도 서비스 처리
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            const { GR_ID, CHANID, CHANNM, STATE } = dto
            const unidObj = await this.chanmstRepo.createQueryBuilder().select(hush.cons.unidMySqlStr).getRawOne()
            let chanmst: ChanMst
            if (CHANID != 'new') {
                const rs = await this.chkAcl({ userid: userid, chanid: CHANID })
                if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>saveChan')
                if (rs.data.chanmst.KIND != 'admin') {
                    return hush.setResJson(resJson, '해당 관리자만 저장 가능합니다.' + fv, hush.Code.NOT_OK, null, 'chanmsg>saveChan')
                }
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
                        return hush.setResJson(resJson, '채널에 대한 권한이 없습니다. (이 채널의 그룹에 해당 사용자가 없습니다)' + fv, hush.Code.NOT_FOUND, null, 'chanmsg>saveChan>gr')
                    }
                }
                chanmst = this.chanmstRepo.create()
                chanmst.CHANID = unidObj.ID
                chanmst.CHANNM = GR_ID ? CHANNM : 'DM'
                chanmst.TYP = GR_ID ? 'WS' : 'GS'
                chanmst.GR_ID = GR_ID ? GR_ID : 'GS'
                chanmst.MASTERID = userid
                chanmst.MASTERNM = usernm
                chanmst.STATE = GR_ID ? STATE : 'P' //DM은 무조건 P=비공개
                chanmst.ISUR = userid
                chanmst.CDT = unidObj.DT
            }
            if (GR_ID) {
                if (!CHANNM || CHANNM.trim() == '' || CHANNM.trim().length > 50) {
                    return hush.setResJson(resJson, '채널명은 공란없이 50자까지 가능합니다.' + fv, hush.Code.NOT_OK, null, 'user>saveChan>chanmst')
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
                await this.chandtlRepo.save(chandtl)
                resJson.data.chanid = unidObj.ID
            }
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }
    
    @Transactional({ propagation: Propagation.REQUIRED })
    async deleteChan(dto: Record<string, any>): Promise<any> { //채널 및 멤버 삭제시 백업테이블은 사용하지 않고 로그로 대체함 
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { CHANID } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>deleteChan')
            let sql = "SELECT COUNT(*) CNT FROM S_MSGMST_TBL WHERE CHANID = ? "
            const msgmst = await this.dataSource.query(sql, [CHANID])
            if (msgmst[0].CNT > 0) {
                return hush.setResJson(resJson, '해당 채널(또는 DM)에서 생성된 메시지가 있습니다.' + fv, hush.Code.NOT_OK, null, 'chanmsg>deleteChan')
            }
            // sql = "SELECT COUNT(*) CNT FROM S_CHANDTL_TBL WHERE CHANID = ? "
            // const chandtl = await this.dataSource.query(sql, [CHANID])
            // if (chandtl[0].CNT > 0) {
            //     return hush.setResJson(resJson, '해당 채널(또는 DM)의의 멤버를 모두 제거해 주시기 바랍니다.' + fv, hush.Code.NOT_OK, null, 'chanmsg>deleteChan')
            // }
            const chanmst = rs.data.chanmst
            if (chanmst.MASTERID != userid) {
                return hush.setResJson(resJson, '마스터만 삭제 가능합니다.' + fv, hush.Code.NOT_OK, null, 'chanmsg>deleteChan')
            }
            /*아래는 S_CHANMSTDEL_TBL로의 백업 시작
            const curdtObj = await this.chanmstRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            let sqlDel = "SELECT COUNT(*) CNT FROM S_CHANMSTDEL_TBL WHERE CHANID = ? "
            const delchanmst = await this.dataSource.query(sqlDel, [CHANID])
            if (delchanmst[0].CNT > 0) {
                sqlDel =  "DELETE FROM S_CHANMSTDEL_TBL WHERE CHANID = ? "
                await this.dataSource.query(sqlDel, [CHANID])
            }
            sqlDel = " INSERT INTO S_CHANMSTDEL_TBL (CHANID, CHANNM, TYP, GR_ID, MASTERID, MASTERNM, STATE, ISUR, CDT, MODR, UDT) "
            sqlDel += "SELECT CHANID, CHANNM, TYP, GR_ID, MASTERID, MASTERNM, STATE, ISUR, CDT, ?, ? "
            sqlDel += "  FROM S_CHANMST_TBL "
            sqlDel += " WHERE CHANID = ? "
            await this.dataSource.query(sqlDel, [userid, curdtObj.DT, CHANID])
            //S_GRMSTDEL_TBL로의 백업 종료*/
            //sql = "DELETE FROM S_CHANMST_TBL WHERE GR_ID = ? "
            //await this.dataSource.query(sql, [CHANID]) //더 위로 올라가면 안됨
            await this.dataSource.query("DELETE FROM S_CHANDTL_TBL WHERE CHANID = ? ", [CHANID])
            await this.dataSource.query("DELETE FROM S_CHANMST_TBL WHERE CHANID = ? ", [CHANID])
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async saveChanMember(dto: Record<string, any>): Promise<any> { //삭제는 별도 서비스 처리
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { crud, CHANID, USERID, USERNM, KIND, SYNC } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>saveChanMember')
            const chanmst = rs.data.chanmst
            if (chanmst.KIND != 'admin') {
                return hush.setResJson(resJson, '해당 채널 관리자만 멤버저장 가능합니다.' + fv, hush.Code.NOT_OK, null, 'usechanmsgr>saveChanMember')
            }
            const curdtObj = await this.chandtlRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            let chandtl = await this.chandtlRepo.findOneBy({ CHANID: CHANID, USERID: USERID })
            if (crud == 'U') {
                if (!chandtl) {
                    return hush.setResJson(resJson, '해당 채널에 편집 대상 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, 'user>saveChanMember')
                }
                if (KIND != 'admin' && chanmst.MASTERID == USERID) {
                    return hush.setResJson(resJson, '해당 채널 생성자는 항상 admin이어야 합니다.' + fv, hush.Code.NOT_OK, null, 'user>saveChanMember')
                }
                chandtl.USERNM = USERNM
                chandtl.KIND = KIND
                chandtl.MODR = userid
                chandtl.UDT = curdtObj.DT
            } else { //crud=C
                if (chandtl) {
                    return hush.setResJson(resJson, '해당 채널에 편집 대상 사용자가 이미 있습니다.' + fv, hush.Code.NOT_OK, null, 'user>saveChanMember')
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
            }
            await this.chandtlRepo.save(chandtl)
            return resJson
        } catch (ex) {            
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    @Transactional({ propagation: Propagation.REQUIRED })
    async deleteChanMember(dto: Record<string, any>): Promise<any> { //채널 및 멤버 삭제시 백업테이블은 사용하지 않고 로그로 대체함 
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { CHANID, USERID } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>deleteChanMember')
            const chanmst = rs.data.chanmst
            if (chanmst.KIND != 'admin') {
                return hush.setResJson(resJson, '해당 관리자만 멤버삭제 가능합니다.' + fv, hush.Code.NOT_OK, null, 'chanmsg>deleteChanMember')
            }
            if (chanmst.MASTERID == USERID) {
                return hush.setResJson(resJson, '해당 채널 생성자는 삭제할 수 없습니다.' + fv, hush.Code.NOT_OK, null, 'chanmsg>deleteChanMember')
            }
            let chandtl = await this.chandtlRepo.findOneBy({ CHANID: CHANID, USERID: USERID })
            if (!chandtl) {
                return hush.setResJson(resJson, '해당 채널에 편집 대상 사용자가 없습니다.' + fv, hush.Code.NOT_FOUND, null, 'uschanmsger>deleteChanMember')
            }
            /*아래는 S_CHANDTLDEL_TBL로의 백업 시작
            const curdtObj = await this.chandtlRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            let sqlDel = "SELECT COUNT(*) CNT FROM S_CHANDTLDEL_TBL WHERE CHANID = ? AND USERID = ? "
            const deldtl = await this.dataSource.query(sqlDel, [CHANID, USERID])
            if (deldtl[0].CNT > 0) {
                sqlDel =  "DELETE FROM S_CHANDTLDEL_TBL WHERE CHANID = ? AND USERID = ? "
                await this.dataSource.query(sqlDel, [CHANID, USERID])
            }
            sqlDel = " INSERT INTO S_CHANDTLDEL_TBL (CHANID, USERID, USERNM, STATE, KIND, NOTI, BOOKMARK, SYNC, ISUR, CDT, MODR, UDT) "
            sqlDel += "SELECT CHANID, USERID, USERNM, STATE, KIND, NOTI, BOOKMARK, SYNC, ISUR, CDT, ?, ? "
            sqlDel += "  FROM S_CHANDTL_TBL "
            sqlDel += " WHERE CHANID = ? AND USERID = ? "
            await this.dataSource.query(sqlDel, [userid, curdtObj.DT, CHANID, USERID])
            //S_GRDTLDEL_TBL로의 백업 종료*/
            await this.chandtlRepo.delete(chandtl) //더 위로 올라가면 안됨
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async inviteToMember(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { CHANID, USERID } = dto
            const rs = await this.chkAcl({ userid: userid, chanid: CHANID })
            if (rs.code != hush.Code.OK) return hush.setResJson(resJson, rs.msg, rs.code, this.req, 'chanmsg>inviteToMember')
            const chanmst = rs.data.chanmst
            const grid = chanmst.GR_ID
            const channm = chanmst.CHANNM
            const chandtl = await this.chandtlRepo.findOneBy({ CHANID: CHANID, USERID: USERID })
            if (!chandtl) {
                return hush.setResJson(resJson, '해당 사용자의 채널 멤버 정보가 없습니다.' + fv, hush.Code.NOT_FOUND, null, 'user>inviteToMember')
            }
            let rec: any
            if (chandtl.SYNC == 'Y') {
                rec = await this.userRepo.findOneBy({ USERID: USERID })
            } else {
                rec = await this.grdtlRepo.findOneBy({ GR_ID: grid, USERID: USERID })
            }
            if (!rec) {
                return hush.setResJson(resJson, '해당 사용자의 정보가 없습니다.' + fv, hush.Code.NOT_FOUND, null, 'user>inviteToMember')
            }
            if (!rec.EMAIL.includes('@')) { //정확하게 체크하려면 정규식 사용해야 하나 일단 @ 체크로 처리
                return hush.setResJson(resJson, '해당 사용자의 이메일 주소에 문제가 있습니다.' + fv, hush.Code.NOT_OK, null, 'user>inviteToMember')
            }
            const link = '<p><a href="http://localhost:5173/login" target="_blank" style="margin:10px">WiSEBand 열기</a></p>'
            const mailTitle = rec.USERNM + '님! [' + hush.cons.appName + ']로 조대합니다. (from ' + usernm + ')'
            const mailBody = '<p style="margin:10px">초대 채널 : <b>' + channm + '</b></p>' + link
            this.mailSvc.sendMail(rec.EMAIL, mailTitle, mailBody)
            //메일 발송 결과를 알 수 있으면 베스트임
            const curdtObj = await this.chandtlRepo.createQueryBuilder().select(hush.cons.curdtMySqlStr).getRawOne()
            chandtl.STATE = 'W' //메일 발송후엔 참여대기로 상태가 변경됨
            chandtl.MODR = userid
            chandtl.UDT = curdtObj.DT
            await this.chandtlRepo.save(chandtl)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

}
