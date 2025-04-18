import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { DataSource } from 'typeorm'
//import { InjectRepository } from '@nestjs/typeorm'
//import { DataSource, Repository } from 'typeorm'

import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
//import { Menu, MenuPer } from 'src/menu/menu.entity'

@Injectable({ scope: Scope.REQUEST })
export class MenuService {
    
    constructor(
        //@InjectRepository(Menu) private menuRepo: Repository<Menu>, 
        //@InjectRepository(MenuPer) private menuperRepo: Repository<MenuPer>, 
        private dataSource : DataSource,
        @Inject(REQUEST) private readonly req: Request
    ) {}

    async qryMembersWithPic(chanid: string, userid: string, pictureCount: number): Promise<any> {
        const retObj = { memcnt: null, picCnt: null, memnm: null, memid: null, picture: null, url: null }
        let sql = "SELECT A.USERID, A.USERNM, B.PICTURE "
        sql += "     FROM S_CHANDTL_TBL A "
        sql += "     LEFT OUTER JOIN S_USER_TBL B ON A.USERID = B.USER_ID "
        sql += "    WHERE A.CHANID = ? AND A.STATE IN ('', 'M', 'W') ORDER BY A.USERNM "
        const listChan = await this.dataSource.query(sql, [chanid])
        const arr = [], brr = [], crr = [], drr = []
        let picCnt = 0, me = null
        for (let j = 0; j < listChan.length; j++) {
            if (listChan[j].USERID == userid) {
                me = listChan[j]
                continue
            }
            arr.push(listChan[j].USERNM)
            brr.push(listChan[j].USERID)
            crr.push(listChan[j].PICTURE)
            drr.push('')
            picCnt += 1
            if (pictureCount > -1 && picCnt >= pictureCount) break //picCnt명까지만 사진 등 보여주기
        }
        if (picCnt == 0 && me) { //나만의 대화인 채널 (me는 반드시 존재할 것이나 한번 더 체크)
            arr.push(me.USERNM)
            brr.push(me.USERID)
            crr.push(me.PICTURE)
            drr.push('')
            picCnt = 1
        } //memcnt(전체멤버수), memnm(전체멤버이름-혼자면내이름포함,여러명이면내이름제외), memid(=memnm), picCnt(사진보여주는갯수), picture(사진), url(빈값으로내려서클라이언트에서이용)
        retObj.memcnt = listChan.length
        retObj.memnm = arr
        retObj.memid = brr
        retObj.picCnt = picCnt
        retObj.picture = crr        
        retObj.url = drr
        return retObj
    }

    async qryKindCntForUser(chanid: string, userid: string, kind: string): Promise<number> { //주로 notyet(아직안읽은메시지) 갯수 읽을 때 사용
        let sql = "SELECT COUNT(*) CNT FROM S_MSGDTL_TBL WHERE CHANID = ? AND USERID = ? AND KIND = ? "
        const list = await this.dataSource.query(sql, [chanid, userid, kind])
        //console.log(list[0].CNT, JSON.stringify(list[0]))
        return list[0].CNT
    }
    
    ///////////////////////////////////////////////////////////////////////////////위는 서비스내 공통 모듈

    async qry(dto: Record<string, any>): Promise<any> {
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const kind = dto.kind
            let fv = hush.addFieldValue(kind, 'kind')
            //여기서는 아래 sql처럼 menu중에 특정 user가 설정하지 않은 menu도 포함해서 조회해서 내려주면 
            //클라이언트가 아래 B.USER_ID가 null인 것을 제외하면 그 사용자가 가진 menu목록이 되고 null은 더보기 버튼을 눌러 보게 되는 것을
            //맨 아래 주석의 '1),2) 위 소스는 아래 SQL과 같음'과 같이 두번을 호출하지 않고 한번의 query로 가져오려 했으나..
            //typeorm으로 leftjoin내의 subquery 구현을 제대로 해내지 못해 결국 포기하고 일단 아래 raw sql로 얻고자 함
            let sql = "SELECT A.ID, A.NM, A.SEQ, A.IMG, A.POPUP, A.RMKS, B.USER_ID "
            sql += "     FROM S_MENU_TBL A "
            sql += "     LEFT OUTER JOIN (SELECT USER_ID, KIND, ID FROM S_MENUPER_TBL WHERE USER_ID = ? AND KIND = ?) B "
            sql += "       ON A.KIND = B.KIND AND A.ID = B.ID "
            sql += "    WHERE A.KIND = ? "
            sql += "      AND A.INUSE = 'Y' "
            sql += "    ORDER BY A.SEQ "
            const list = await this.dataSource.query(sql, [userid, kind, kind]) //console.log(typeof list, list.length)
            if (list.length == 0) {                
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'menu>qry')
            }
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req) 
        }
    }

    async qryChan(dto: Record<string, any>): Promise<any> {
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const kind = dto.kind
            let fv = hush.addFieldValue(kind, 'kind')
            let sql = "SELECT 1 DEPTH, A.GR_ID, A.GR_NM, '' CHANID, '' CHANNM, '' MASTERID, '' MASTERNM, '' STATE, '' KIND, '' NOTI, '' BOOKMARK, '' OTHER "
            sql += "     FROM S_GRMST_TBL A "
            sql += "    INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID "
            sql += "    WHERE A.INUSE = 'Y' "
            sql += "      AND B.USERID = '" + userid + "' "
            sql += "    UNION ALL "
            sql += "   SELECT X.DEPTH, X.GR_ID, X.GR_NM, Y.CHANID, Y.CHANNM, Y.MASTERID, Y.MASTERNM, Y.STATE, Y.KIND, Y.NOTI, Y.BOOKMARK, Y.OTHER "
            sql += "     FROM (SELECT 2 DEPTH, A.GR_ID, A.GR_NM "
            sql += "             FROM S_GRMST_TBL A "
            sql += "            INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID "
            sql += "            WHERE A.INUSE = 'Y' "
            sql += "              AND B.USERID = '" + userid + "') X "
            if (kind == 'my') {
                sql += " LEFT OUTER JOIN (SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, B.KIND, B.NOTI, B.BOOKMARK, '' OTHER "
                sql += "                    FROM S_CHANMST_TBL A "
                sql += "                   INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID "
                sql += "                   WHERE A.INUSE = 'Y' AND A.TYP = 'WS' "
                sql += "                     AND B.USERID = '" + userid + "') Y "
            } else if (kind == 'other') {
                sql += " LEFT OUTER JOIN (SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, '' KIND, '' NOTI, '' BOOKMARK, 'other' OTHER "
                sql += "                    FROM S_CHANMST_TBL A "
                sql += "                   WHERE A.INUSE = 'Y' AND A.TYP = 'WS' AND A.STATE = 'A' "
                sql += "                     AND A.CHANID NOT IN (SELECT CHANID FROM S_CHANDTL_TBL WHERE USERID = '" + userid + "')) Y "
            } else { //all=my+other
                sql += " LEFT OUTER JOIN (SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, B.KIND, B.NOTI, B.BOOKMARK, '' OTHER "
                sql += "                    FROM S_CHANMST_TBL A "
                sql += "                   INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID "
                sql += "                   WHERE A.INUSE = 'Y' "
                sql += "                     AND B.USERID = '" + userid + "' "
                sql += "                   UNION ALL "
                sql += "                  SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, '' KIND, '' NOTI, '' BOOKMARK, 'other' OTHER "
                sql += "                    FROM S_CHANMST_TBL A "
                sql += "                   WHERE A.INUSE = 'Y' AND A.TYP = 'WS' AND A.STATE = 'A' "
                sql += "                     AND A.CHANID NOT IN (SELECT CHANID FROM S_CHANDTL_TBL WHERE USERID = '" + userid + "')) Y "
            }
            sql += "      ON X.GR_ID = Y.GR_ID "
            sql += "   ORDER BY GR_NM, GR_ID, DEPTH, CHANNM, CHANID "
            const list = await this.dataSource.query(sql, null)
            if (!list) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'menu>qryChan')
            }
            for (let i = 0; i < list.length; i++) {
                if (list[i].DEPTH == 2) list[i].notyetCnt = await this.qryKindCntForUser(list[i].CHANID, userid, 'notyet')
            }
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req) 
        }
    }

    async qryKindCnt(dto: Record<string, any>): Promise<any> {
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { chanid, kind } = dto
            const notyetCnt = await this.qryKindCntForUser(chanid, userid, kind)
            resJson.data.notyetCnt = notyetCnt
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryDm(dto: Record<string, any>): Promise<any> {
        try { //LASTMSGDT를 구해야 일단 최신메시지순으로 방이 소팅 가능하게 되므로 아래 sql은 MAX(CDT)가 필요
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { kind, lastMsgMstCdt } = dto //all //let fv = hush.addFieldValue(kind, 'kind')
            let sql = "SELECT Z.CHANID, Z.CHANNM, Z.BOOKMARK, Z.NOTI, Z.LASTMSGDT "
            sql += "     FROM (SELECT B.CHANID, B.CHANNM, A.STATE, A.BOOKMARK, A.NOTI, "
            sql += "                  (SELECT MAX(CDT) FROM S_MSGMST_TBL WHERE CHANID = B.CHANID) LASTMSGDT "
            sql += "             FROM S_CHANDTL_TBL A "
            sql += "            INNER JOIN S_CHANMST_TBL B ON A.CHANID = B.CHANID "
            sql += "            WHERE A.USERID = ? AND A.STATE IN ('', 'M', 'W') AND B.TYP = 'GS' AND B.INUSE = 'Y') Z "
            sql += "    WHERE Z.LASTMSGDT < ? "
            sql += "    ORDER BY Z.LASTMSGDT DESC "
            const list = await this.dataSource.query(sql, [userid, lastMsgMstCdt])
            for (let i = 0; i < list.length; i++) {
                const row = list[i]
                sql = "SELECT MSGID, BODYTEXT FROM S_MSGMST_TBL WHERE CHANID = ? ORDER BY CDT DESC LIMIT 1 "
                const listMst = await this.dataSource.query(sql, [row.CHANID])
                if (listMst.length == 0) {
                    row.MSGID = ''
                    row.BODYTEXT = ''
                } else {
                    row.MSGID = listMst[0].MSGID
                    row.BODYTEXT = listMst[0].BODYTEXT
                }
                const obj = await this.qryMembersWithPic(row.CHANID, userid, hush.cons.picCnt)
                row.memcnt = obj.memcnt
                row.memnm = obj.memnm
                row.memid = obj.memid
                row.picCnt = obj.picCnt
                row.picture = obj.picture
                row.url = obj.url //url은 로컬에서 사용
                row.notyetCnt = await this.qryKindCntForUser(row.CHANID, userid, 'notyet')
            }
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryLater(dto: Record<string, any>): Promise<any> {
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { kind, lastMsgMstCdt, msgid } = dto //later, stored, finished //let fv = hush.addFieldValue(kind, 'kind')
            let sql = "SELECT A.MSGID, A.AUTHORID, A.AUTHORNM, A.BODYTEXT, A.KIND, A.CDT, A.UDT, A.REPLYTO, "
            sql += "          B.CHANID, B.TYP, B.CHANNM, B.STATE, D.KIND, E.PICTURE "
            sql += "     FROM S_MSGMST_TBL A "
            sql += "    INNER JOIN S_CHANMST_TBL B ON A.CHANID = B.CHANID "
            sql += "     LEFT OUTER JOIN S_MSGDTL_TBL D ON A.MSGID = D.MSGID AND A.CHANID = D.CHANID "
            sql += "     LEFT OUTER JOIN S_USER_TBL E ON A.AUTHORID = E.USER_ID "
            if (msgid) {
                sql += "WHERE A.MSGID = '" + msgid + "' AND D.USERID = ? "
            } else {
                sql += "WHERE D.USERID = ? AND D.KIND = ? AND A.CDT < ? "
            }
            sql += "    ORDER BY A.CDT DESC "
            sql += "    LIMIT " + hush.cons.rowsCnt
            const list = await this.dataSource.query(sql, [userid, kind, lastMsgMstCdt])
            for (let i = 0; i < list.length; i++) {
                const row = list[i]
                if (row.TYP == 'GS') { //DM은 GS, 채널은 WS(슬랙의 워크스페이스)
                    const obj = await this.qryMembersWithPic(row.CHANID, userid, hush.cons.picCnt)
                    row.memcnt = obj.memcnt
                    row.memnm = obj.memnm
                    row.memid = obj.memid
                    row.picCnt = obj.picCnt
                    row.picture = obj.picture
                    row.url = obj.url //url은 로컬에서 사용
                }
            }
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryLaterCount(dto: Record<string, any>): Promise<any> {
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { kind } = dto //later, stored, finished //let fv = hush.addFieldValue(kind, 'kind')
            let sql = "SELECT COUNT(*) CNT "
            sql += "     FROM S_MSGMST_TBL A "
            sql += "     LEFT OUTER JOIN S_MSGDTL_TBL B ON A.MSGID = B.MSGID AND A.CHANID = B.CHANID "
            sql += "    WHERE B.USERID = ? AND B.KIND = ? "
            const list = await this.dataSource.query(sql, [userid, kind])
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

}

/*
///////////////////////////////////////1) 위 소스는 아래 SQL과 같음
const list = await this.menuperRepo.createQueryBuilder('menuper')
//.select(['menu.ID', 'menu.NM', 'menu.SEQ', 'menu.IMG', 'menuper.USER_ID']) //addSelect로 분리 또는 여기 'menuper.USER_ID' 하나라도 추가해야 list.length가 0 안나옴
//.leftJoin("menuper.menu", 'menu', 'menuper.ID = menu.ID') 
.leftJoinAndSelect('menuper.menu', 'menu') //보안상 특정 필드는 내리지 않거나 용량 이슈가 있는 경우를 제외하면 편리하게 사용 가능
.where('menuper.USER_ID = :user_id and menuper.KIND = :kind and menu.INUSE = :inuse', {
    user_id: userid, 
    kind: kind, 
    inuse: 'Y'
}).orderBy('menu.SEQ', 'ASC').getMany() 
=>
SELECT B.USER_ID, A.ID, A.NM, A.SEQ, A.IMG
  FROM s_menu_tbl A
  LEFT OUTER JOIN s_menuper_tbl B ON A.KIND = B.KIND AND A.ID = B.ID
 WHERE B.USER_ID = 'oldclock'
   AND B.KIND = 'side' 
   AND A.INUSE = 'Y'
 ORDER BY A.SEQ
///////////////////////////////////////2) 위 소스는 아래 SQL과 같음
const data = await this.menuRepo.createQueryBuilder('menu')
.select('COUNT(*) as CNT') //나중에 parseInt(CNT) 필요
.where('menu.KIND = :kind and menu.INUSE = :inuse', {
    kind: kind, 
    inuse: 'Y'
}).getRawOne()
=>
SELECT count(*)
  FROM s_menu_tbl
 WHERE KIND = 'side' 
   AND INUSE = 'Y'
*/