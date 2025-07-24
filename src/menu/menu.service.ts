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
        sql += "     LEFT OUTER JOIN S_USER_TBL B ON A.USERID = B.USERID "
        sql += "    WHERE A.CHANID = ? "
        sql += "    ORDER BY A.USERNM "
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

    async qryKindCntForUser(chanid: string, userid: string, kind: string): Promise<number> { //해당 채널 + 해당 사용자의 kindCnt 조회
        let sql = "SELECT COUNT(*) CNT FROM S_MSGDTL_TBL WHERE CHANID = ? AND USERID = ? AND KIND = ? "
        const list = await this.dataSource.query(sql, [chanid, userid, kind])
        return list[0].CNT
    }
    
    ///////////////////////////////////////////////////////////////////////////////위는 서비스내 공통 모듈

    async qry(dto: Record<string, any>): Promise<any> { //사이드메뉴
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        try {            
            const { kind } = dto //바로 아래에서 개인메뉴 없으면 생성하기
            const curdtObj = await hush.getMysqlCurdt(this.dataSource)
            let sqlChk = "SELECT COUNT(*) CNT FROM S_MENUPER_TBL WHERE USERID = ? AND KIND = ? "
            const menuList = await this.dataSource.query(sqlChk, [userid, kind])
            if (menuList[0].CNT == 0) {
                sqlChk =  "INSERT INTO S_MENUPER_TBL (USERID, KIND, ID) "
                sqlChk += "SELECT ?, ?, ID FROM S_MENU_TBL WHERE INUSE = 'Y' "
                await this.dataSource.query(sqlChk, [userid, kind])
            }
            let sql = "SELECT A.ID, A.NM, A.SEQ, A.IMG, A.POPUP, A.RMKS, B.USERID " //B.USERID가 있으면 내게 설정된 메뉴. null이면 내게 설정되지 않은 메뉴
            sql += "     FROM S_MENU_TBL A "
            sql += "     LEFT OUTER JOIN (SELECT USERID, KIND, ID FROM S_MENUPER_TBL WHERE USERID = ? AND KIND = ?) B "
            sql += "       ON A.KIND = B.KIND AND A.ID = B.ID "
            sql += "    WHERE A.KIND = ? "
            sql += "      AND A.INUSE = 'Y' "
            sql += "    ORDER BY A.SEQ "
            const list = await this.dataSource.query(sql, [userid, kind, kind])
            resJson.list = list
            resJson.data.dbdt = curdtObj.DT
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req) 
        }
    }

    async qryChan(dto: Record<string, any>): Promise<any> { //내가 권한이 있는 채널들만 보여야 함 (사용자그룹에서 제거 되었으면 그 채널은 권한이 없어짐)
        const resJson = new ResJson() //인덱싱 완료
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            const { kind } = dto //GRMST_UDT, CHANMST_UDT는 리얼타임용이며 DTL은 필요없이 MST만 사용
            //아래 sql은 가끔 QueryFailedError: read ECONNRESET 발생시켰는데 맨 아래 ORDER BY을 막으면 문제없었음 (서버도 죽이는 SQL은 어찌되었던 MYSQL 이슈인 듯)
            //해결 : 원래 MYSQL은 JOIN 등에서 반드시 ALIAS를 붙여야 하는 점이 기억나서 맨 위 2행과 함께 Z로 한번 더 감싸주니 더 이상 죽지 않음
            let sql = "SELECT Z.DEPTH, Z.GR_ID, Z.GR_NM, Z.GRMST_UDT, Z.CHANID, Z.CHANNM, Z.MASTERID, Z.MASTERNM, Z.STATE, Z.CHANMST_UDT, Z.KIND, Z.NOTI, Z.BOOKMARK, Z.OTHER "
            sql += "     FROM ( "
            sql += "SELECT 1 DEPTH, A.GR_ID, A.GR_NM, A.UDT GRMST_UDT, '' CHANID, '' CHANNM, '' MASTERID, '' MASTERNM, '' STATE, '' CHANMST_UDT, '' KIND, '' NOTI, '' BOOKMARK, '' OTHER "
            sql += "     FROM S_GRMST_TBL A "
            sql += "    INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID "
            sql += "    WHERE B.USERID = '" + userid + "' "
            sql += "    UNION ALL "
            sql += "   SELECT X.DEPTH, X.GR_ID, X.GR_NM, X.GRMST_UDT, Y.CHANID, Y.CHANNM, Y.MASTERID, Y.MASTERNM, Y.STATE, Y.CHANMST_UDT, Y.KIND, Y.NOTI, Y.BOOKMARK, Y.OTHER "
            sql += "     FROM (SELECT 2 DEPTH, A.GR_ID, A.GR_NM, A.UDT GRMST_UDT "
            sql += "             FROM S_GRMST_TBL A "
            sql += "            INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID "
            sql += "            WHERE B.USERID = '" + userid + "') X "
            if (kind == 'my') {
                sql += " LEFT OUTER JOIN (SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT, B.KIND, B.NOTI, B.BOOKMARK, '' OTHER "
                sql += "                    FROM S_CHANMST_TBL A "
                sql += "                   INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID "
                sql += "                   WHERE B.USERID = '" + userid + "' "
                sql += "                     AND A.TYP = 'WS') Y "
            } else if (kind == 'other') {
                sql += " LEFT OUTER JOIN (SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT, '' KIND, '' NOTI, '' BOOKMARK, 'other' OTHER "
                sql += "                    FROM S_CHANMST_TBL A "
                sql += "                   WHERE A.CHANID NOT IN (SELECT CHANID FROM S_CHANDTL_TBL WHERE USERID = '" + userid + "') "
                sql += "                     AND A.TYP = 'WS' AND A.STATE = 'A') Y "
            } else { //all=my+other
                sql += " LEFT OUTER JOIN (SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT, B.KIND, B.NOTI, B.BOOKMARK, '' OTHER "
                sql += "                    FROM S_CHANMST_TBL A "
                sql += "                   INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID "
                sql += "                   WHERE B.USERID = '" + userid + "' "
                sql += "                   UNION ALL "
                sql += "                  SELECT A.CHANID, A.CHANNM, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT, '' KIND, '' NOTI, '' BOOKMARK, 'other' OTHER "
                sql += "                    FROM S_CHANMST_TBL A "
                sql += "                   WHERE A.CHANID NOT IN (SELECT CHANID FROM S_CHANDTL_TBL WHERE USERID = '" + userid + "') "
                sql += "                     AND A.TYP = 'WS' AND A.STATE = 'A') Y "
            }
            sql += "      ON X.GR_ID = Y.GR_ID) Z "
            sql += "   ORDER BY Z.GR_NM, Z.GR_ID, Z.DEPTH, Z.CHANNM, Z.CHANID "
            //console.log(sql)
            const list = await this.dataSource.query(sql, null)
            for (let i = 0; i < list.length; i++) {
                if (list[i].DEPTH == 2) list[i].mynotyetCnt = await this.qryKindCntForUser(list[i].CHANID, userid, 'notyet')
            }
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv) 
        }
    }

    async qryKindCnt(dto: Record<string, any>): Promise<any> { //해당 채널 + 해당 사용자의 kindCnt 조회
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {            
            const { chanid, kind } = dto
            resJson.data.kindCnt = await this.qryKindCntForUser(chanid, userid, kind)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryDm(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try { //LASTMSGDT를 구해야 일단 최신메시지순으로 방이 소팅 가능하게 되므로 아래 sql은 MAX(CDT)가 필요
            const { kind, search, prevMsgMstCdt, chanid, oldestMsgDt } = dto //all,notyet
            const memField = search ? ', Z.MEMBERS ' : ''
            let sql = "SELECT Z.CHANID, Z.CHANNM, Z.BOOKMARK, Z.NOTI, Z.STATE, Z.MASTERID, Z.CDT, Z.LASTMSGDT, Z.CHANDTL_UDT, Z.CHANMST_UDT  " + memField
            sql += "     FROM (SELECT B.CHANID, B.CHANNM, B.STATE, B.MASTERID, A.BOOKMARK, A.NOTI, A.CDT, B.UDT CHANMST_UDT, "
            sql += "                  (SELECT MAX(UDT) FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) CHANDTL_UDT, " //리얼타임용
            sql += "                  IFNULL((SELECT MAX(CDT) FROM S_MSGMST_TBL WHERE CHANID = B.CHANID), '9999-99-98') LASTMSGDT " //메시지가 없는 경우 맨 위에 표시
            if (search) {
                sql += "              ,(SELECT GROUP_CONCAT(USERNM SEPARATOR ', ') FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) MEMBERS "
            }
            sql += "             FROM S_CHANDTL_TBL A "
            sql += "            INNER JOIN S_CHANMST_TBL B ON A.CHANID = B.CHANID "
            if (kind == 'notyet') {
                sql += "        INNER JOIN (SELECT DISTINCT CHANID FROM S_MSGDTL_TBL WHERE USERID = '" + userid + "' AND KIND = 'notyet') D ON A.CHANID = D.CHANID "
            }
            sql += "            WHERE A.USERID = ? "
            if (chanid) {
                sql += "          AND A.CHANID = '" + chanid + "' "
            }
            sql += "              AND B.TYP = 'GS' "
            sql += "           ) Z "
            if (!oldestMsgDt) {
                sql += "    WHERE Z.LASTMSGDT < '" + prevMsgMstCdt + "' "
            } else {
                sql += "    WHERE Z.LASTMSGDT >= '" + oldestMsgDt + "' "
            }
            if (search) {
                sql += "  AND LOWER(Z.MEMBERS) LIKE '%" + search.toLowerCase() + "%' "
            }
            sql += "ORDER BY Z.LASTMSGDT DESC, Z.CDT DESC "
            if (!oldestMsgDt) sql += "LIMIT " + hush.cons.rowsCnt
            //console.log(sql, userid, prevMsgMstCdt)
            const arr = [] //list가 아닌 arr가 저장 (중간에 빠지는 행이 있음)
            const list = await this.dataSource.query(sql, [userid])
            for (let i = 0; i < list.length; i++) {
                const row = list[i]
                //console.log(row.CHANID, row.STATE, row.MASTERID, userid)
                if (row.STATE == 'M') { //DM방이 맨 처음 만들어지고 아직 메시지가 없을 때는 방을 만든 마스터에게만 보이기로 함
                    //만들 때 먼저 중복체크해서 이미 동일한 멤버들이 있는 방이 존재하면 안만들면 베스트인데 현재 멤버 한명씩 추가시마다 저장되는 로직이므로
                    //처음 추가시 없을 때는 저장하다가 뒤에 추가시 있으면 그때 없애야 하는 구조임 (아니면 최종 방만들기 버튼 별도로 있어야 함 - 사용자불편) 
                    //따라서, 최초 만들었을 때는 상대방들에게는 안보여야 하고 마스터에게만 보여야 함 (일장일단)
                    if (row.MASTERID != userid) continue //이 M은 메시지가 처음 생길 때 P(DM은 무조건 비공개)로 변경되어야 함
                }
                sql = "SELECT MSGID, BODYTEXT, REPLYTO FROM S_MSGMST_TBL WHERE CHANID = ? ORDER BY CDT DESC LIMIT 1 "
                const listMst = await this.dataSource.query(sql, [row.CHANID])
                if (listMst.length == 0) {
                    row.MSGID = ''
                    row.BODYTEXT = ''
                    row.REPLYTO = ''
                } else {
                    row.MSGID = listMst[0].MSGID
                    row.BODYTEXT = listMst[0].BODYTEXT
                    row.REPLYTO = listMst[0].REPLYTO
                }
                const obj = await this.qryMembersWithPic(row.CHANID, userid, hush.cons.picCnt)
                row.memcnt = obj.memcnt
                row.memnm = obj.memnm
                row.memid = obj.memid
                row.picCnt = obj.picCnt
                row.picture = obj.picture
                row.url = obj.url //url은 로컬에서 사용
                row.mynotyetCnt = await this.qryKindCntForUser(row.CHANID, userid, 'notyet')
                arr.push(row)
            }
            resJson.list = arr
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryDmChkExist(dto: Record<string, any>): Promise<any> { //복수로 구성된 DM방 찾아서 방 아이디 리턴
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            let { member } = dto
            if (!member.includes(userid)) member.push(userid) //소팅전에 추가
            member.sort((a: string, b: string) => a.localeCompare(b)) //오름차순 정렬            
            //console.log(userid, member.length, member.join(','))
            let sql = "SELECT CHANID, CNT, MEM "
            sql += "     FROM (SELECT A.CHANID, "
            sql += "                  (SELECT COUNT(*) FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) CNT, "
            sql += "                  (SELECT GROUP_CONCAT(USERID ORDER BY USERID) FROM S_CHANDTL_TBL WHERE CHANID = A.CHANID) MEM "
            sql += "             FROM S_CHANDTL_TBL A "
            sql += "            INNER JOIN S_CHANMST_TBL B ON A.CHANID = B.CHANID "
            sql += "            WHERE A.USERID = ? AND B.TYP = 'GS' ORDER BY A.UDT DESC) Z "
            sql += "    WHERE CNT = ? AND MEM = ? "
            const list = await this.dataSource.query(sql, [userid, member.length, member.join(',')])
            if (list.length > 0) resJson.data.chanid = list[0].CHANID
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryPanel(dto: Record<string, any>): Promise<any> { //사용자 본인만 조회
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { kind, prevMsgMstCdt, msgid, oldestMsgDt } = dto //kind = later, stored, finished
            let sql = "SELECT A.MSGID, A.AUTHORID, A.AUTHORNM, A.BODYTEXT, A.KIND, A.CDT, A.UDT, A.REPLYTO, "
            sql += "          B.CHANID, B.TYP, B.CHANNM, B.STATE, D.KIND, E.PICTURE "
            sql += "     FROM S_MSGMST_TBL A "
            sql += "    INNER JOIN S_CHANMST_TBL B ON A.CHANID = B.CHANID "
            sql += "     LEFT OUTER JOIN S_MSGDTL_TBL D ON A.MSGID = D.MSGID AND A.CHANID = D.CHANID "
            sql += "     LEFT OUTER JOIN S_USER_TBL E ON A.AUTHORID = E.USERID "
            if (msgid) {
                sql += "WHERE A.MSGID = '" + msgid + "' AND D.USERID = ? "
            } else {
                if (!oldestMsgDt) {
                    sql += "WHERE D.USERID = ? AND D.KIND = ? AND A.CDT < '" + prevMsgMstCdt + "' "
                } else {
                    sql += "WHERE D.USERID = ? AND D.KIND = ? AND A.CDT >= '" + oldestMsgDt + "' "
                }
            }
            sql += "    ORDER BY A.CDT DESC "
            if (!oldestMsgDt) sql += "    LIMIT " + hush.cons.rowsCnt
            const list = await this.dataSource.query(sql, [userid, kind])
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
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryPanelCount(dto: Record<string, any>): Promise<any> { //(특정 채널이 아닌) 해당 사용자의 kindCnt
        try {
            const resJson = new ResJson()
            const userid = this.req['user'].userid
            const { kind } = dto //later, stored, finished, fixed
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

    async qryActivity(dto: Record<string, any>): Promise<any> { //현재 SUBKIND 미사용이나 나중을 위해 두기로 함
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try {
            const { kind, notyet, prevMsgMstCdt, oldestMsgDt } = dto
            //0. 기본
            let sqlHeaderStart = "SELECT Y.MSGID, Y.CHANID, Z.CHANNM, Y.AUTHORID, Y.AUTHORNM, Y.REPLYTO, Y.BODYTEXT, Y.SUBKIND, Y.TITLE, Y.DT, E.PICTURE FROM ( "
            let sqlHeaderEnd = ") Y "
            let sqlBasicAcl = hush.getBasicAclSql(userid, "ALL")
            //1. vip : 방별로 구분 (group by chanid)
            let sqlVip = "SELECT '' MSGID, A.CHANID, AUTHORID, AUTHORNM, '' REPLYTO, '' BODYTEXT, 'VIP_MSG' SUBKIND, 'vip' TITLE, MAX(A.UDT) DT "
            sqlVip += "     FROM S_MSGMST_TBL A "
            if (notyet == 'Y') {
                sqlVip += "INNER JOIN S_MSGDTL_TBL B ON A.MSGID = B.MSGID AND B.USERID = '" + userid + "' AND B.KIND = 'notyet' "
            }
            sqlVip += "    WHERE AUTHORID IN (SELECT UID FROM S_USERCODE_TBL WHERE KIND = 'vip' AND USERID = '" + userid + "') "
            sqlVip += "    GROUP BY CHANID, AUTHORID, AUTHORNM "
            //2. mention
            //웹에디터와 같이 개발
            //3. thread : 메시지별로 구분
            // let sqlThread = "SELECT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, 'MY_MSG_WITH_CHILD' SUBKIND, 'thread' TITLE, "
            // sqlThread += "          (SELECT MAX(CDT) FROM S_MSGMST_TBL WHERE REPLYTO = A.MSGID) DT "
            // sqlThread += "     FROM S_MSGMST_TBL A "
            // sqlThread += "    WHERE A.AUTHORID = '" + userid + "' "
            // if (notyet == 'Y') {
            //     sqlThread += "      AND (SELECT COUNT(*) FROM S_MSGMST_TBL K INNER JOIN S_MSGDTL_TBL J ON K.MSGID = J.MSGID AND J.USERID = '" + userid + "' AND J.KIND = 'notyet' "
            //     sqlThread += "           WHERE K.REPLYTO = A.MSGID ) > 0 "//내가 아직 안읽은 자식을 가진 내글(부모글)
            // } else {
            //     sqlThread += "      AND (SELECT COUNT(*) FROM S_MSGMST_TBL WHERE REPLYTO = A.MSGID) > 0 " //자식을 가진 내글(부모글)
            // }
            // if (notyet != 'Y') { //내가 댓글 단 부모글은 무조건 읽은 것이므로 notyet != 'Y'으로 읽어야 함
            //     sqlThread += "    UNION ALL "
            //     sqlThread += "   SELECT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, 'PARENT_TO_MY_REPLY' SUBKIND, 'thread' TITLE, MAX(B.CDT) DT "
            //     sqlThread += "     FROM S_MSGMST_TBL A "
            //     sqlThread += "    INNER JOIN (SELECT REPLYTO, MSGID, CHANID, BODYTEXT, AUTHORID, AUTHORNM, CDT "
            //     sqlThread += "                  FROM S_MSGMST_TBL "
            //     sqlThread += "                 WHERE REPLYTO <> '' AND AUTHORID = '" + userid + "') B ON A.MSGID = B.REPLYTO " //내가 댓글 단 부모글        
            //     sqlThread += "    GROUP BY A.MSGID, A.CHANID, A.BODYTEXT, A.AUTHORID, A.AUTHORNM "
            // }
            let sqlThread = "SELECT Z.MSGID, Z.CHANID, Z.AUTHORID, Z.AUTHORNM, Z.REPLYTO, (SELECT BODYTEXT FROM S_MSGMST_TBL WHERE MSGID = Z.MSGID) BODYTEXT, "
            sqlThread += "          '' SUBKIND, 'thread' TITLE, MAX(CDT) DT "
            sqlThread += "     FROM (SELECT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, CDT "
            sqlThread += "             FROM S_MSGMST_TBL A "
            sqlThread += "            WHERE A.AUTHORID = '" + userid + "' "
            if (notyet == 'Y') {
                sqlThread += "          AND (SELECT COUNT(*) FROM S_MSGMST_TBL K INNER JOIN S_MSGDTL_TBL J ON K.MSGID = J.MSGID AND J.USERID = '" + userid + "' AND J.KIND = 'notyet' "
                sqlThread += "                WHERE K.REPLYTO = A.MSGID ) > 0 "//내가 아직 안읽은 자식을 가진 내글(부모글)
            } else {
                sqlThread += "          AND (SELECT COUNT(*) FROM S_MSGMST_TBL WHERE REPLYTO = A.MSGID) > 0 " //자식을 가진 내글(부모글)
            }
            if (notyet == 'Y') {
                sqlThread += " ) Z "
            } else{ //내가 댓글 단 부모글은 무조건 읽은 것이므로 notyet != 'Y'으로 읽어야 함
                sqlThread += "        UNION ALL "
                sqlThread += "       SELECT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, B.CDT "
                sqlThread += "         FROM S_MSGMST_TBL A "
                sqlThread += "        INNER JOIN (SELECT REPLYTO, MSGID, CHANID, BODYTEXT, AUTHORID, AUTHORNM, CDT "
                sqlThread += "                      FROM S_MSGMST_TBL "
                sqlThread += "                     WHERE AUTHORID = '" + userid + "' AND REPLYTO <> '') B ON A.MSGID = B.REPLYTO) Z " //내가 댓글 단 부모글        
            }
            sqlThread += "   GROUP BY Z.MSGID, Z.CHANID, Z.AUTHORID, Z.AUTHORNM, Z.REPLYTO "
            //4. react : 메시지별로 구분
            let sqlReact = ''
            if (notyet == 'Y') { //notyet은 없을 것임 (내글은 분명히 읽음처리되었고 내가 단 리액션은 내가 읽었으니 달았을 것임 - 그래서 dummy 추가)
                sqlReact = "SELECT DISTINCT MSGID, CHANID, AUTHORID, AUTHORNM, REPLYTO, BODYTEXT, '' SUBKIND, 'react' TITLE, CDT DT "
                sqlReact += " FROM S_MSGMST_TBL "
                sqlReact += "WHERE AUTHORID = 'dummy' "
            } else {
                // sqlReact = " SELECT DISTINCT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, 'MY_MSG_WITH_OHTER_REACT' SUBKIND, 'react' TITLE, A.CDT DT "
                // sqlReact += "  FROM S_MSGMST_TBL A "
                // sqlReact += " INNER JOIN S_MSGDTL_TBL B ON A.MSGID = B.MSGID "
                // sqlReact += " WHERE A.AUTHORID = '" + userid + "' "
                // sqlReact += "   AND B.TYP = 'react' "
                // sqlReact += " UNION ALL "
                // sqlReact += "SELECT DISTINCT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, 'MSG_WITH_MY_REACT' SUBKIND, 'react' TITLE, A.CDT DT "
                // sqlReact += "  FROM S_MSGMST_TBL A "
                // sqlReact += " INNER JOIN S_MSGDTL_TBL B ON A.MSGID = B.MSGID "
                // sqlReact += " WHERE B.USERID = '" + userid + "' "
                // sqlReact += "   AND B.TYP = 'react' "
                sqlReact = " SELECT Z.MSGID, Z.CHANID, Z.AUTHORID, Z.AUTHORNM, Z.REPLYTO, (SELECT BODYTEXT FROM S_MSGMST_TBL WHERE MSGID = Z.MSGID) BODYTEXT, '' SUBKIND, 'react' TITLE, MAX(CDT) DT "
                sqlReact += "  FROM (SELECT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, A.CDT "
                sqlReact += "          FROM S_MSGMST_TBL A "
                sqlReact += "         INNER JOIN S_MSGDTL_TBL B ON A.MSGID = B.MSGID "
                sqlReact += "         WHERE A.AUTHORID = '" + userid + "' AND B.TYP = 'react' "
                sqlReact += "         UNION ALL "
                sqlReact += "        SELECT A.MSGID, A.CHANID, A.AUTHORID, A.AUTHORNM, A.REPLYTO, A.BODYTEXT, A.CDT "
                sqlReact += "          FROM S_MSGMST_TBL A "
                sqlReact += "         INNER JOIN S_MSGDTL_TBL B ON A.MSGID = B.MSGID "
                sqlReact += "         WHERE B.USERID = '" + userid + "' AND B.TYP = 'react') Z "
                sqlReact += " GROUP BY Z.MSGID, Z.CHANID, Z.AUTHORID, Z.AUTHORNM, Z.REPLYTO "
            }
            let sql = ''
            if (kind == 'mention') {
                //웹에디터와 같이 개발
            } else if (kind == 'vip') {
                sql = sqlHeaderStart + sqlVip + sqlHeaderEnd
            } else if (kind == 'thread') {
                sql = sqlHeaderStart + sqlThread + sqlHeaderEnd
            } else if (kind == 'react') {
                sql = sqlHeaderStart + sqlReact + sqlHeaderEnd
            } else { //전체 조회
                sql = sqlHeaderStart
                sql += sqlVip + "UNION ALL "
                sql += sqlThread + "UNION ALL "
                sql += sqlReact
                sql += sqlHeaderEnd
            }
            sql += "INNER JOIN (" + sqlBasicAcl + ") Z ON Y.CHANID = Z.CHANID "
            sql += " LEFT OUTER JOIN S_USER_TBL E ON Y.AUTHORID = E.USERID "
            if (!oldestMsgDt) {
                sql += "WHERE Y.DT < '" + prevMsgMstCdt + "' "      
            } else {
                sql += "WHERE Y.DT >= '" + oldestMsgDt + "' "      
            }      
            sql += "ORDER BY Y.DT DESC "
            if (!oldestMsgDt) sql += "LIMIT " + hush.cons.rowsCnt
            const list = await this.dataSource.query(sql, null)
            for (let i = 0; i < list.length; i++) {
                const row = list[i]
                if (row.TITLE == 'vip') {
                    let sql = "SELECT MSGID, BODYTEXT, REPLYTO, UDT CHKDT FROM S_MSGMST_TBL WHERE CHANID = ? AND AUTHORID = ? AND UDT = ? "
                    const listSub = await this.dataSource.query(sql, [row.CHANID, row.AUTHORID, row.DT])
                    if (listSub.length == 0) {
                        row.LASTMSG = '없음'
                    } else {
                        row.LASTMSG = listSub[0].BODYTEXT
                    }
                    row.MSGID = listSub[0].MSGID //처음엔 GROUP BY때문에 빈칸이었다가 여기서 가져옴. 
                    //1. MsgList로 라우팅할 때 다른 Activity는 모두 msgid 있는데 vip만 없어 선택 이상해져 가져오게 됨
                    //2. 뒤로가기 등으로 다시 돌아올 떄 msgid를 키로 찾아와야 함
                    row.REPLYTO = listSub[0].REPLYTO //처음엔 GROUP BY때문에 빈칸이었다가 여기서 가져옴. 댓글 여부
                    row.CHKDT = listSub[0].CHKDT
                } else if (row.TITLE == 'thread') {
                    let sql = "SELECT BODYTEXT, UDT CHKDT FROM S_MSGMST_TBL WHERE REPLYTO = ? AND CHANID = ? AND CDT = ? "
                    const listSub = await this.dataSource.query(sql, [row.MSGID, row.CHANID, row.DT])
                    if (listSub.length == 0) {
                        row.LASTMSG = '없음'
                    } else {
                        row.LASTMSG = listSub[0].BODYTEXT
                    }
                    row.CHKDT = listSub[0].CHKDT
                } else if (row.TITLE == 'react') {
                    row.LASTMSG = '' //BODYTEXT로 커버됨
                    let sql = "SELECT KIND, COUNT(KIND) CNT, GROUP_CONCAT(USERNM ORDER BY USERNM SEPARATOR \", \") NM, "
                    sql += "          GROUP_CONCAT(USERID ORDER BY USERID SEPARATOR \", \") ID, MAX(UDT) CHKDT "
                    sql += "     FROM S_MSGDTL_TBL "
                    sql += "    WHERE MSGID = ? AND CHANID = ? AND TYP = 'react' "
                    sql += "    GROUP BY KIND "
                    sql += "    ORDER BY KIND "
                    const listSub = await this.dataSource.query(sql, [row.MSGID, row.CHANID])
                    if (listSub.length == 0) {
                        row.msgdtl = null
                    } else {
                        row.msgdtl = listSub
                    }
                    row.CHKDT = listSub[0].CHKDT
                }
                let sql = "SELECT TYP FROM S_CHANMST_TBL WHERE CHANID = ? "
                const listSub = await this.dataSource.query(sql, [row.CHANID])
                if (listSub.length == 0) {
                    row.TYP = 'WS'
                } else {
                    row.TYP = listSub[0].TYP
                }
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
            hush.throwCatchedEx(ex, this.req, fv)
        }
    }

    async qryGroup(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        let fv = hush.addFieldValue(dto, null, [userid])
        try { //내가 만들지 않았지만 내가 관리자로 들어가 있는 그룹도 포함됨 (관리자로 지정이 안되어 있으면 편집 권한 없음)
            //const { kind } = dto
            // let sql = "SELECT A.GR_ID, A.GR_NM, A.MASTERID, A.MASTERNM, B.KIND, B.SYNC, CASE WHEN A.MASTERID = ? THEN '' ELSE 'other' END OTHER "
            // sql += "     FROM S_GRMST_TBL A "
            // sql += "    INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID "
            // sql += "    WHERE B.USERID = '" + userid + "' "
            // if (kind == 'my') { //내가 만든 그룹만 조회
            //     sql += "  AND A.MASTERID = '" + userid + "' "
            // } else if (kind == 'other') { //내가 만들지 않았지만 내가 관리자로 들어가 있는 그룹 (관리자로 지정이 안되어 있으면 편집 권한 없음)
            //     sql += "  AND A.MASTERID <> '" + userid + "' "
            // }
            // sql += "    ORDER BY GR_NM, GR_ID "
            let sql = "SELECT A.GR_ID, A.GR_NM, A.MASTERID, A.MASTERNM, B.KIND, B.SYNC, CASE WHEN A.MASTERID = ? THEN '' ELSE 'other' END OTHER "
            sql += "     FROM S_GRMST_TBL A "
            sql += "    INNER JOIN S_GRDTL_TBL B ON A.GR_ID = B.GR_ID "
            sql += "    WHERE B.USERID = ? AND B.KIND = 'admin' " //A.MASTERID는 무조건 B.KIND가 admin임
            sql += "    ORDER BY A.GR_NM, A.GR_ID "
            const list = await this.dataSource.query(sql, [userid, userid])
            if (list.length == 0) {
                return hush.setResJson(resJson, hush.Msg.NOT_FOUND + fv, hush.Code.NOT_FOUND, this.req, 'menu>qryGroup')
            }
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req, fv) 
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