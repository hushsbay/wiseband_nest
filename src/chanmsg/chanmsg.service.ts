import { Inject, Injectable, Scope, UploadedFile } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
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

    /* 여기말고 그 아래 chkQry가 잘되면 여긴 지우기
    async chkQry(dto: Record<string, any>): Promise<any> { //1) 각종 권한 체크 2) 각종 공통데이터 읽어 오기
        try {
            let data = { chanmst: null, chandtl: [], msgmst: null }
            const resJson = new ResJson()
            const { userid, grid, chanid, msgid, includeBlob } = dto
            let fv = hush.addFieldValue([userid, grid, chanid, msgid], 'userid/grid/chanid/msgid')
            //////////a) S_GRMST_TBL
            let grnm = ''
            if (grid) {
                const gr = await this.grmstRepo.createQueryBuilder('A')
                .select(['A.GR_NM', 'A.RMKS'])
                .innerJoin('A.dtl', 'B', 'A.GR_ID = B.GR_ID') 
                .where("A.GR_ID = :grid and A.INUSE = 'Y' and B.USERID = :userid ", { 
                    grid: grid, userid: userid 
                }).getOne()
                if (!gr) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkQry>gr')
                }
                grnm = gr.GR_NM
            }
            //////////b) S_CHANMST_TBL
            const chanmst = await this.chanmstRepo.createQueryBuilder('A')
            .select(['A.CHANNM', 'A.MASTERNM', 'A.STATE'])
            .where("A.CHANID = :chanid and A.INUSE = 'Y' and A.TYP = 'WS' ", { 
                chanid: chanid 
            }).getOne()
            if (!chanmst) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkQry>chanmst')
            }
            data.chanmst = chanmst
            data.chanmst.GR_NM = grnm
            //////////c) S_CHANDTL_TBL (지우지 말 것)
            /#const chandtl = await this.chandtlRepo.createQueryBuilder('A')
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
                    item.buffer = user.PICTURE //item.buffer이 entity에 없으므로 오류 발생 ******************************
                }
                if (item.USERID == userid) {
                    data.chanmst.USERID = item.USERID
                    data.chanmst.KIND = item.KIND
                    data.chanmst.STATE1 = item.STATE //STATE(공용,비밀)가 이미 S_CHANMST_TBL에 존재함 (여기는 S_CHANDTL_TBL의 STATE임=STATE1=매니저(M)/참여대기(W)/퇴장(X)/강제퇴장(Z))
                    break
                }
            } 위 TYPEORM으로 처리시 이미지 담기에 노력(****)이 들어가므로 간단하게 아래 SQL로 처리함 #/
            const picFld = includeBlob ? ", B.PICTURE" : ""
            let sql = "SELECT A.USERID, A.USERNM, A.STATE, A.KIND " + picFld
            sql += "     FROM S_CHANDTL_TBL A "
            sql += "    INNER JOIN S_USER_TBL B ON A.USERID = B.USER_ID "
            sql += "    WHERE A.CHANID = ? "
            sql += "      AND A.STATE IN ('', 'M') " //매니저(M)/참여대기(W)/퇴장(X)/강제퇴장(Z)
            sql += "    ORDER BY A.USERNM "
            const chandtl = await this.dataSource.query(sql, [chanid])
            if (chandtl.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkQry>chandtl')
            }
            for (let item of chandtl) {
                if (item.USERID == userid) {
                    data.chanmst.USERID = item.USERID
                    data.chanmst.KIND = item.KIND //R(읽기전용)
                    data.chanmst.STATE1 = item.STATE //S_CHANDTL_TBL의 STATE=STATE1임 : 매니저(M)/참여대기(W)/퇴장(X)/강제퇴장(Z). S_CHANMST_TBL에도 STATE(공용,비밀)가 존재함
                    break
                }
            }
            if (data.chanmst.STATE == 'A') {
                //공개(All)된 채널이므로 채널멤버가 아니어도 읽을 수는 있음
            } else { //비공개(Private)
                if (!data.chanmst.USERID) {
                    return hush.setResJson(resJson, hush.Msg.NOT_AUTHORIZED + fv, hush.Code.NOT_AUTHORIZED, null, 'chanmsg>chkQry>private')
                }
            }
            if (data.chanmst.STATE1 == 'X' || data.chanmst.STATE1 == 'Z') { //퇴장 or 강제퇴장
                return hush.setResJson(resJson, hush.Msg.NOT_AUTHORIZED + fv, hush.Code.NOT_AUTHORIZED, null, 'chanmsg>chkQry>out')
            }
            data.chandtl = chandtl            
            if (data.chanmst.STATE1 == 'W') { //초청받고 참여대기시엔 메시지는 안보여주기
                resJson.data = data
                return resJson
            } //data.chanmst.STATE1(M)=채널매니저,data.chanmst.KIND(R)=읽기전용은 클라이언트에서 사용됨
            //////////d) S_MSGMST_TBL
            if (msgid) {
                let msgmst = await this.msgmstRepo.createQueryBuilder('A')
                .select(['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.REPLYCNT', 'A.KIND', 'A.REPLYTO', 'A.CDT', 'A.UDT'])
                .where("A.MSGID = :msgid and A.CHANID = :chanid and A.DEL = '' ", { 
                    msgid: msgid, chanid: chanid
                }).getOne()
                if (msgmst) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkQry>msgmst')
                }
                data.msgmst = msgmst
            }
            resJson.data = data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }*/

    async chkQry(dto: Record<string, any>): Promise<any> { //1) 각종 권한 체크 2) 각종 공통데이터 읽어 오기
        try {
            let data = { chanmst: null, chandtl: [], msgmst: null }
            const resJson = new ResJson()
            const { userid, grid, chanid, msgid, includeBlob } = dto //보통은 grid 없어도 chanid로 grid 가져와서 체크함
            let fv = hush.addFieldValue([userid, grid, chanid, msgid], 'userid/grid/chanid/msgid')
            //////////a) S_CHANMST_TBL + S_GRMST_TBL
            //TYP : WS(WorkSpace)/GS(GeneralSapce-S_GRMST_TBL비연동)
            //STATE : 공개(A)/비공개(P)
            const chanmst = await this.chanmstRepo.createQueryBuilder('A')
            .select(['A.CHANNM', 'A.TYP', 'A.GR_ID', 'A.MASTERID', 'A.MASTERNM', 'A.STATE', 'A.RMKS'])
            .where("A.CHANID = :chanid and A.INUSE = 'Y' ", { 
                chanid: chanid 
            }).getOne()
            if (!chanmst) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkQry>chanmst')
            }
            let grnm = ''
            if (chanmst.TYP == 'GS') {
                //S_GRMST_TBL 체크할 필요없음 (예: DM은 GR_ID 필요없는 GS 타입)
            } else {
                if (grid) {
                    if (grid != chanmst.GR_ID) {
                        return hush.setResJson(resJson, 'grid와 chanid에서 가져온 grid가 다릅니다.' + fv, hush.Code.NOT_OK, null, 'chanmsg>chkQry>grid')
                    }
                }
                const gr = await this.grmstRepo.createQueryBuilder('A')
                .select(['A.GR_NM'])
                .innerJoin('A.dtl', 'B', 'A.GR_ID = B.GR_ID') 
                .where("A.GR_ID = :grid and A.INUSE = 'Y' and B.USERID = :userid ", { 
                    grid: chanmst.GR_ID, userid: userid 
                }).getOne()
                if (!gr) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkQry>gr')
                }
                grnm = gr.GR_NM
            }
            data.chanmst = chanmst
            data.chanmst.GR_NM = grnm
            //////////b) S_CHANDTL_TBL
            /* (지우지 말 것) const chandtl = await this.chandtlRepo.createQueryBuilder('A')
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
                    item.buffer = user.PICTURE //item.buffer이 entity에 없으므로 오류 발생 ******************************
                }
                if (item.USERID == userid) {
                    data.chanmst.USERID = item.USERID
                    data.chanmst.KIND = item.KIND
                    data.chanmst.STATE1 = item.STATE //STATE(공용,비밀)가 이미 S_CHANMST_TBL에 존재함 (여기는 S_CHANDTL_TBL의 STATE임=STATE1=매니저(M)/참여대기(W)/퇴장(X)/강제퇴장(Z))
                    break
                }
            } 위 TYPEORM으로 처리시 이미지 담기에 노력(****)이 들어가므로 간단하게 아래 SQL로 처리함 */
            const picFld = includeBlob ? ", B.PICTURE" : ""
            let sql = "SELECT A.USERID, A.USERNM, A.STATE, A.KIND " + picFld
            sql += "     FROM S_CHANDTL_TBL A "
            sql += "    INNER JOIN S_USER_TBL B ON A.USERID = B.USER_ID "
            sql += "    WHERE A.CHANID = ? "
            sql += "      AND A.STATE IN ('', 'M') " //매니저(M)/참여대기(W)/퇴장(X)/강제퇴장(Z)
            sql += "    ORDER BY A.USERNM "
            const chandtl = await this.dataSource.query(sql, [chanid])
            if (chandtl.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkQry>chandtl')
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
                    return hush.setResJson(resJson, hush.Msg.NOT_AUTHORIZED + fv, hush.Code.NOT_AUTHORIZED, null, 'chanmsg>chkQry>private')
                }
            }
            if (data.chanmst.STATE1 == 'X' || data.chanmst.STATE1 == 'Z') { //퇴장 or 강제퇴장
                return hush.setResJson(resJson, hush.Msg.NOT_AUTHORIZED + fv, hush.Code.NOT_AUTHORIZED, null, 'chanmsg>chkQry>out')
            }
            data.chandtl = chandtl            
            if (data.chanmst.STATE1 == 'W') { //초청받고 참여대기시엔 메시지는 안보여주기
                resJson.data = data
                return resJson
            } //data.chanmst.STATE1(M)=채널매니저,data.chanmst.KIND(R)=읽기전용은 클라이언트든 서버든 로직 추가될 수 있음
            //////////c) S_MSGMST_TBL
            //KIND : 아직은 Invite만 존재함
            if (msgid) {
                let msgmst = await this.msgmstRepo.createQueryBuilder('A')
                .select(['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.REPLYCNT', 'A.KIND', 'A.REPLYTO', 'A.CDT', 'A.UDT'])
                .where("A.MSGID = :msgid and A.CHANID = :chanid and A.DEL = '' ", { 
                    msgid: msgid, chanid: chanid
                }).getOne()
                if (msgmst) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, null, 'chanmsg>chkQry>msgmst')
                }
                data.msgmst = msgmst
            }
            resJson.data = data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qry(dto: Record<string, any>): Promise<any> {
        try {
            let data = { chanmst: null, chandtl: [], msglist: [], tempfilelist: [], tempimagelist: [], templinklist: [] }
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { grid, chanid } = dto
            let lastMsgMstCdt = dto.lastMsgMstCdt
            let firstMsgMstCdt = dto.firstMsgMstCdt //메시지 작성후 화면 맨 아래에 방금 작성한 메시지 추가하기 위한 param
            //console.log(lastMsgMstCdt, "@@@@@@@@@@", firstMsgMstCdt) //let fv = hush.addFieldValue([grid, chanid], 'grid/chanid')
            const rs = await this.chkQry({ userid: userid, grid: grid, chanid: chanid })
            data.chanmst = rs.data.chanmst
            data.chandtl = rs.data.chandtl
            //////////d) S_MSGMST_TBL (목록 읽어오기. 그 안에 S_MSGDTL_TBL, S_MSGSUB_TBL 포함. 댓글도 포함)
            const qb = this.msgmstRepo.createQueryBuilder('A')
            const fldArr = ['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.REPLYCNT', 'A.KIND', 'A.CDT', 'A.UDT']
            let msglist: MsgMst[]
            if (firstMsgMstCdt) {
                msglist = await qb.select(fldArr)
                .where("A.CHANID = :chanid and A.CDT > :firstcdt and A.DEL = '' and A.REPLYTO = '' ", { 
                    chanid: chanid, firstcdt: firstMsgMstCdt
                }).orderBy('A.CDT', 'DESC').getMany()
            } else {
                msglist = await qb.select(fldArr)
                .where("A.CHANID = :chanid and A.CDT < :lastcdt and A.DEL = '' and A.REPLYTO = '' ", { 
                    chanid: chanid, lastcdt: lastMsgMstCdt
                }).orderBy('A.CDT', 'DESC').limit(hush.cons.rowsCnt).getMany()
            }
            if (msglist.length > 0) data.msglist = msglist
            for (let i = 0; i < data.msglist.length; i++) {
                const item = data.msglist[i]
                //d-1) S_MSGDTL_TBL
                const msgdtl = await this.msgdtlRepo.createQueryBuilder('B') //1) S_MSGDTL_TBL(각종 이모티콘)
                .select(['B.KIND KIND', 'COUNT(B.KIND) CNT', 'GROUP_CONCAT(B.USERNM ORDER BY B.USERNM SEPARATOR ", ") NM'])
                .where("B.CHANID = :chanid and B.MSGID = :msgid ", { 
                    chanid: chanid, msgid: item.MSGID 
                }).groupBy('B.KIND').orderBy('B.KIND', 'ASC').getRawMany()
                item.msgdtl = (msgdtl.length > 0) ? msgdtl : []
                //d-2) S_MSGSUB_TBL
                const msgsub = await this.msgsubRepo.createQueryBuilder('C') //2) S_MSGSUB_TBL(파일, 이미지, 링크 등)
                .select(['C.KIND', 'C.CDT', 'C.BODY', 'C.BUFFER', 'C.FILESIZE'])
                .where("C.CHANID = :chanid and C.MSGID = :msgid ", { 
                    chanid: chanid, msgid: item.MSGID 
                }).orderBy('C.KIND', 'ASC').addOrderBy('C.CDT', 'ASC').getMany()
                if (msgsub.length > 0) {
                    const msgfile = msgsub.filter((val) => val.KIND == 'F' || val.KIND == 'f')
                    const msgimg = msgsub.filter((val) => val.KIND == 'I' || val.KIND == 'i')
                    const msglink = msgsub.filter((val) => val.KIND == 'L')
                    item.msgfile = msgfile
                    item.msgimg = msgimg
                    item.msglink = msglink
                } else {
                    item.msgfile = []
                    item.msgimg = []
                    item.msglink = []
                }
                //d-3) S_MSGMST_TBL (댓글-스레드)
                const reply = await qb.select(['A.MSGID MSGID', 'A.AUTHORID AUTHORID', 'A.AUTHORNM AUTHORNM', '(CASE WHEN A.CDT > A.UDT THEN A.CDT ELSE A.UDT END) DT']) //3) 댓글
                .where("A.CHANID = :chanid and A.REPLYTO = :msgid and A.DEL = '' ", { 
                    chanid: chanid, msgid: item.MSGID 
                }).orderBy('DT', 'DESC').getRawMany()
                item.reply = (reply.length > 0) ? reply : []
            }
            //////////e) S_MSGSUB_TBL (메시지에 저장하려고 올렸던 임시 저장된 파일/이미지/링크)
            // const qbMsgsub = this.msgsubRepo.createQueryBuilder('A')
            // const msgsub1 = await qbMsgsub //파일
            // .select(['A.CDT', 'A.BODY', 'A.FILESIZE'])
            // .where("A.MSGID = :userid and A.CHANID = :chanid and KIND = 'F' ", { 
            //     userid: userid, chanid: chanid
            // }).orderBy('A.CDT', 'ASC').getMany()
            // if (msgsub1.length > 0) data.tempfilelist = msgsub1
            // const msgsub2 = await qbMsgsub //이미지
            // .select(['A.CDT', 'A.BUFFER'])
            // .where("A.MSGID = :userid and A.CHANID = :chanid and KIND = 'I' ", { 
            //     userid: userid, chanid: chanid
            // }).orderBy('A.CDT', 'ASC').getMany()
            // if (msgsub2.length > 0) data.tempimagelist = msgsub2
            // const msgsub3 = await qbMsgsub //링크
            // .select(['A.CDT', 'A.BODY', 'A.FILESIZE'])
            // .where("A.MSGID = :userid and A.CHANID = :chanid and KIND = 'F' ", { 
            //     userid: userid, chanid: chanid
            // }).orderBy('A.CDT', 'ASC').getMany()
            // if (msgsub3.length > 0) data.templinklist = msgsub3
            const acc = ['F', 'I', 'L'] //파일,이미지,링크
            const qbMsgsub = this.msgsubRepo.createQueryBuilder('A')
            for (let item of acc) {
                const msgsub = await qbMsgsub
                .select(['A.CDT', 'A.BODY', 'A.FILESIZE'])
                .where("A.MSGID = :userid and A.CHANID = :chanid and KIND = :kind ", { 
                    userid: userid, chanid: chanid, kind: item
                }).orderBy('A.CDT', 'ASC').getMany()
                if (msgsub.length > 0) {
                    if (item == 'F') data.tempfilelist = msgsub
                    if (item == 'I') data.tempimagelist = msgsub
                    if (item == 'L') data.templinklist = msgsub
                }
            }            
            //////////END
            resJson.data = data
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
            const { crud, chanid, body, num_file, num_image } = dto //cud는 C or U만 처리 
            let msgid = dto.msgid //console.log(userid, msgid, chanid, crud, body, num_file, num_image)
            let fv = hush.addFieldValue([msgid, chanid, crud, num_file, num_image], 'msgid/chanid/crud/num_file/num_image')
            if (crud == 'C' || crud == 'U') {
                if (!chanid || !body) {
                    return hush.setResJson(resJson, hush.Msg.BLANK_DATA + fv, hush.Code.BLANK_DATA, this.req, 'chanmsg>saveMsg')    
                }
                await this.chkQry({ userid: userid, chanid: chanid })
            } else {
                return hush.setResJson(resJson, 'crud값은 C/U중 하나여야 합니다.' + fv, hush.Code.NOT_OK, this.req, 'chanmsg>saveMsg')
            }
            const qbMsgMst = this.msgmstRepo.createQueryBuilder()
            if (crud == 'C') {
                const unidObj = await qbMsgMst.select(hush.cons.unidMySqlStr).getRawOne()
                msgid = unidObj.ID
                await qbMsgMst
                .insert().values({ 
                    MSGID: msgid, CHANID: chanid, AUTHORID: userid, AUTHORNM: usernm, BODY: body, CDT: unidObj.DT
                }).execute()
                const qbMsgSub = this.msgsubRepo.createQueryBuilder()
                let arr = []
                if (num_file > 0 && num_image > 0) {
                    arr = ['F', 'I']
                } else if (num_file > 0) {
                    arr = ['F']
                } else if (num_image > 0) {
                    arr = ['I']
                }
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
            } //수정저장시엔 권한 체크 필요 (미리 있는지 체크)
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
            await this.chkQry({ userid: userid, chanid: chanid, msgid: msgid })
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
                    MSGID: msgid, CHANID: chanid, USERID: userid, KIND: kind, CDT: curdtObj.DT, USERNM: usernm
                }).execute()
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
            const { chanid, kind, body, filesize } = dto //console.log(userid, chanid, kind, body, filesize)
            await this.chkQry({ userid: userid, chanid: chanid })
            const qbMsgSub = this.msgsubRepo.createQueryBuilder()
            const curdtObj = await qbMsgSub.select(hush.cons.curdtMySqlStr).getRawOne()
            await qbMsgSub.insert().values({
                MSGID: userid, CHANID: chanid, KIND: kind, BODY: body, FILESIZE: filesize, CDT: curdtObj.DT, 
                BUFFER: (kind != 'L') ? Buffer.from(new Uint8Array(file.buffer)) : null 
            }).execute()
            resJson.data.cdt = curdtObj.DT
            //임시 코딩 - 사진 넣기 시작
            if (kind == 'I') {
                let sql = "UPDATE jay.s_user_tbl set PICTURE = ? WHERE USER_ID = ? "
                await this.dataSource.query(sql, [Buffer.from(new Uint8Array(file.buffer)), userid])
            }
            //임시 코딩 - 사진 넣기 끝
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async delBlob(dto: Record<string, any>): Promise<any> {        
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const msgid = (dto.msgid == 'temp') ? userid : dto.msgid //temp는 채널별로 사용자가 메시지 저장(발송)전에 미리 업로드한 것임
            const { chanid, kind, cdt } = dto //console.log(userid, msgid, chanid, kind, cdt)
            await this.chkQry({ userid: userid, chanid: chanid })
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
            await this.chkQry({ userid: userid, chanid: chanid })
            const msgsub = await this.msgsubRepo.createQueryBuilder('A')
            .select(['A.BUFFER'])
            .where("MSGID = :msgid and CHANID = :chanid and KIND = :kind and CDT = :cdt and BODY = :name ", {
                msgid: msgid, chanid: chanid, kind: kind, cdt: cdt, name: name //name은 없어도 될 것이나 더 정확한 조회 목적임
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
  FROM JAY.S_GRMST_TBL A 
 INNER JOIN JAY.S_GRDTL_TBL B ON A.GR_ID = B.GR_ID
 WHERE A.GR_ID = '20250120084532918913033423' AND A.INUSE = 'Y' AND B.USERID = 'oldclock'
*/