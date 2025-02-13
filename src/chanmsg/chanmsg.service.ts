import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

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
        @Inject(REQUEST) private readonly req: Request
    ) {}

    async qry(dto: Record<string, any>): Promise<any> {
        let data = { chanmst : null, chandtl : null, msglist : null }
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const grid = dto.grid
        const chanid = dto.chanid //console.log(grid, chanid, userid)
        const fv = hush.addFieldValue([grid, chanid], 'grid/chanid')
        try {
            if (!grid || !chanid) {
                return hush.setResJson(resJson, hush.Msg.BLANK_DATA + fv, hush.Code.BLANK_DATA, this.req)
            }
            //////////a) S_GRMST_TBL
            const gr = await this.grmstRepo.createQueryBuilder('A') //.innerJoinAndSelect('A.dtl', 'B') //모든 필드 가져오기 (아래 2행 대신)
            .select(['A.GR_NM']) //(1) .select(['A.GR_NM', 'A.MEMCNT', 'A.RMKS'])
            .innerJoin('A.dtl', 'B', 'A.GR_ID = B.GR_ID') 
            .where("A.GR_ID = :grid and A.INUSE = 'Y' and B.USERID = :userid", { grid: grid, userid: userid }).getOne() //권한 체크 포함
            if (!gr) { //1) 진짜 없는 경우 2) 사용자가 없어 권한이 없는 경우 혼재
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'gr')
            }
            //////////b) S_CHANMST_TBL
            const chanmst = await this.chanmstRepo.createQueryBuilder('A')
            .select(['A.CHANNM', 'A.MASTERNM', 'A.STATE', 'A.MEMCNT'])
            .where("A.CHANID = :chanid and A.INUSE = 'Y' and A.TYP = 'WS'", { chanid: chanid }).getOne()
            if (!chanmst) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'chanmst')
            }
            data.chanmst = chanmst
            data.chanmst.GR_NM = gr.GR_NM
            //////////c) S_CHANDTL_TBL
            const chandtl = await this.chandtlRepo.createQueryBuilder('A')
            .select(['A.USERID', 'A.USERNM', 'A.STATE', 'A.KIND'])
            .where("A.CHANID = :chanid", { chanid: chanid })
            .orderBy('A.USERNM', 'ASC').getMany()
            if (!chandtl) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'chandtl')
            }
            for (let item of chandtl) {
                if (item.USERID == userid) {
                    data.chanmst.USERID = item.USERID
                    data.chanmst.KIND = item.KIND
                    data.chanmst.STATE1 = item.STATE //STATE가 이미 S_CHANMST_TBL에 존재함 (여기는 S_CHANDTL_TBL의 STATE임=STATE1)
                    break
                }
            }
            if (data.chanmst.STATE == 'A') {
                //공개(All)된 채널이므로 채널멤버가 아니어도 읽을 수는 있음
            } else { //비공개(Private)
                if (!data.chanmst.USERID) {
                    return hush.setResJson(resJson, hush.Msg.NOT_AUTHORIZED + fv, hush.Code.NOT_AUTHORIZED, this.req, 'private')                    
                }
            }
            if (data.chanmst.STATE1 == 'X' || data.chanmst.STATE1 == 'Z') { //퇴장 or 강제퇴장
                return hush.setResJson(resJson, hush.Msg.NOT_AUTHORIZED + fv, hush.Code.NOT_AUTHORIZED, this.req, 'out')
            }
            data.chandtl = chandtl            
            if (data.chanmst.STATE1 == 'W') { //초청받고 참여대기시엔 메시지는 안보여주기
                resJson.data = data
                return resJson
            } //data.chanmst.STATE1(M)=채널매니저,data.chanmst.KIND(R)=읽기전용은 클라이언트에서 사용됨
            //////////d) S_MSGMST_TBL (그 안에 S_MSGDTL_TBL, S_MSGSUB_TBL 포함. 댓글도 포함)
            const qb = this.msgmstRepo.createQueryBuilder('A')
            const msglist = await qb.select(['A.MSGID', 'A.AUTHORID', 'A.AUTHORNM', 'A.BODY', 'A.REPLYCNT', 'A.KIND', 'A.CDT', 'A.UDT'])
            .where("A.CHANID = :chanid and A.DEL = '' and A.REPLYTO = ''", { chanid: chanid })
            .orderBy('A.CDT', 'ASC').getMany()
            if (!msglist) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'msglist')
            }
            data.msglist = msglist
            for (let i = 0; i < data.msglist.length; i++) {
                const item = data.msglist[i]
                const msgdtl = await this.msgdtlRepo.createQueryBuilder('B') //1) S_MSGDTL_TBL(각종 이모티콘)
                .select(['B.KIND KIND', 'COUNT(B.KIND) CNT', 'GROUP_CONCAT(B.USERNM ORDER BY B.USERNM SEPARATOR ", ") NM'])
                .where("B.CHANID = :chanid and B.MSGID = :msgid", { chanid: chanid, msgid: item.MSGID })                
                .groupBy('B.KIND')
                .orderBy('B.KIND', 'ASC').getRawMany()
                if (!msgdtl) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'msglist-msgdtl')
                }
                item.msgdtl = msgdtl
                const msgsub = await this.msgsubRepo.createQueryBuilder('C') //2) S_MSGSUB_TBL(파일, 이미지, 링크 등)
                .select(['C.KIND', 'C.SEQ', 'C.BODY'])
                .where("C.CHANID = :chanid and C.MSGID = :msgid", { chanid: chanid, msgid: item.MSGID })                
                .orderBy('C.KIND', 'ASC').addOrderBy('C.SEQ', 'ASC').getMany()
                if (!msgsub) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'msglist-msgsub')
                }
                //const msglink = msgsub.filter((val) => val.KIND == 'L')
                const msgfile = msgsub.filter((val) => val.KIND == 'F' || val.KIND == 'f')
                const msgimg = msgsub.filter((val) => val.KIND == 'I' || val.KIND == 'i')
                //item.msglink = msglink
                item.msgfile = msgfile
                item.msgimg = msgimg
                const reply = await qb.select(['A.MSGID MSGID', 'A.AUTHORID AUTHORID', 'A.AUTHORNM AUTHORNM', '(CASE WHEN A.CDT > A.UDT THEN A.CDT ELSE A.UDT END) DT']) //3) 댓글
                .where("A.CHANID = :chanid and A.REPLYTO = :msgid and A.DEL = ''", { chanid: chanid, msgid: item.MSGID })                
                .orderBy('DT', 'DESC').getRawMany()
                if (!reply) {
                    return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'msglist-reply')
                }
                item.reply = reply
            }
            //////////END
            resJson.data = data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async saveMsg(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const usernm = this.req['user'].usernm
        const crud = dto.crud //C or U만 처리 
        const chanid = dto.chanid
        let msgid = dto.msgid
        const body = dto.body
        console.log(userid, chanid, crud, body)
        let fv = ''
        try {            
            if (crud == 'C' || crud == 'U') {
                fv = hush.addFieldValue([chanid, body], 'chanid/body')
                if (!chanid || !body) {
                    return hush.setResJson(resJson, hush.Msg.BLANK_DATA + fv, hush.Code.BLANK_DATA, this.req)    
                }
            } else {
                fv = hush.addFieldValue(crud, 'crud')
                return hush.setResJson(resJson, hush.Msg.BLANK_DATA + fv, hush.Code.BLANK_DATA, this.req)
            }
            const qbMsgMst = this.msgmstRepo.createQueryBuilder()
            if (crud == 'C') {
                const unidObj = await qbMsgMst.select(hush.cons.unidMySqlStr).getRawOne() //console.log(ret.ID, ret.DT)
                msgid = unidObj.ID
                await qbMsgMst.insert().values({ 
                    MSGID: () => msgid, CHANID: chanid, AUTHORID: userid, AUTHORNM: usernm, BODY: body, CDT: unidObj.DT
                }).execute()
                resJson.data.msgid = msgid
            }
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