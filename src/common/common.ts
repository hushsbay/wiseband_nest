import { HttpStatus, HttpException, Logger } from '@nestjs/common'
import { Request, Response } from 'express'
import { createCipheriv, randomBytes, createDecipheriv } from 'crypto'
import { DataSource } from 'typeorm'
//import * as _ from 'lodash' //const keyStr = _.findKey(HttpStatus, (o) => o === statusCode)

import { ResJson } from 'src/common/resjson'

const comLog = new Logger()

export enum Code {
    OK = '0',
    NOT_OK = '-1',
    NOT_FOUND = '-100',
    BLANK_DATA = '-101',
    ALREADY_EXIST = '-102',
    DELETE_FAIL = '-201',
    JWT_NEEDED = '-801',
    JWT_MISMATCH = '-802',
    JWT_EXPIRED = '-803',
    JWT_ETC = '-809',
    PWD_MISMATCH = '-811',
    OTP_MISMATCH = '-812',
    OTP_TIMEOVER = '-813',
    NOT_AUTHORIZED = '860',
}

export enum Msg {
    NOT_OK = '오류가 발생하였습니다.',
    NOT_FOUND = '데이터가 없습니다.',
    BLANK_DATA = '값이 없습니다.',
    ALREADY_EXIST = '이미 존재하는 데이터입니다.',
    DELETE_FAIL = '삭제실패입니다.',
    JWT_NEEDED = '인증토큰이 필요합니다.',
    JWT_MISMATCH = '인증토큰이 일치하지 않습니다.', //필요시 위변조 가능성도 체크
    JWT_EXPIRED = '인증토큰이 만료되었습니다.',
    JWT_ETC = '토큰 오류입니다.', //(ex.message가 아예 없을 수도 있으나) ex.message를 추가로 사용할 필요있음
    PWD_MISMATCH = '비번이 다릅니다.',
    OTP_MISMATCH = 'OTP 값이 다릅니다.',
    //OTP_TIMEOVER = 'OTP 체크시간이 지났습니다.',
    NOT_AUTHORIZED = '권한이 없습니다.',
}

export const cons = {
    appName : 'WiSEBand',
    otpDiffMax : 1, //분
    rowsCnt : 30, //20개 이하는 설정하지 말기. 예1) 20개로 했을 때 맨 아래->위로 스크롤시 다시 아래로 내려가는 현상. 예2) 10개로 줄이면 새창 띄우기 할 때 위 5개 아래 5개 가져와서 맨 위 맨 아래 메시지 기준으로 하면 스크롤이 생기지 않음
    rowsCntForNotyet : 1000,
    replyCntLimit : 2, //댓글표시할 때 사진 보여주기 Max값
    //아래 2개는 chanmsg_working_tanstack, chanmsg_before_refactoring에 들어 있는 것으로서 이 폴더가 제거되면 아래 2개 변수도 제거하기
    unidMySqlStr : "", //"CONCAT(DATE_FORMAT(now(6), '%Y%m%d%H%i%s%f'), LPAD(CAST(RAND() * 100000 AS SIGNED), '6', '0')) AS ID, DATE_FORMAT(now(6), '%Y-%m-%d %H:%i:%s.%f') AS DT",
    curdtMySqlStr : "", //"DATE_FORMAT(now(6), '%Y-%m-%d %H:%i:%s.%f') AS DT",
    tempdir : 'd:/temp/', //파일업로드시 파일시스템에 넣지 않고 db에 넣는 경우, 나중에 다운로드시 파일로 내릴 때 필요한 폴더임
    picCnt : 4, //picCnt명까지만 사진 등 보여주기 (클라이언트 고려해 4명까지만 가능)
    cdtAtFirst : "1111-11-11",
    cdtAtLast : "9999-99-99",
    bodyLenForLog : 200,
}

//Controller, Service 등에 모두 사용하도록 함. throw되면 무조건 클라이언트까지 전달됨. 그게 아니면 CodeMsg class 사용
//- A서비스에서 B서비스를 호출시 B가 A에게 throw도 아닌 코드값을 전달하고 싶을 경우가 많은데 특히, TypeORM에서
//- 예를 들어 async findOne(userid: string): Promise<User | undefined> {로 처리시 오류내지 않고 code와 msg를 제대로 전달할 방법을 못찾음
//- 그렇다고 User Entity에 code와 msg를 추가하는 것도 좋은 방법이 아님. 그래서 일단, undefined 대신에 CodeMsg를 넣기로 함
//- 이 경우, 리턴 받는 A에서는 chkCodeMsg()로 code,msg를 체크하게 되는데 이 때 User | CodeMsg 때문에 명시적으로 casting 해줘야 하는 불편이 있음
//- 따라서, B에서는 Promise<User | CodeMsg>가 아닌 Promise<any>로 처리하는 것이 현실적으로 합리적인 것으로 보임
//HttpException class를 상속받아 만들지 않는 이유는 필요시마다 contructor에 주입해 사용하기가 불편해 단순함수 만들어 사용하고자 함
export function throwHttpEx(msg?: string, code?: string) { //, logger?: Logger, debug?: boolean) { => 필요하면 이 함수 호출전에 logger 한줄 더 넣어서 사용
    const statusCode = HttpStatus.OK //무조건 200이어야 클라이언트(특히, 웹브라우저)에게 오류표시없이 전달될 것임. 예) 500이면 웹브라우저에서 처리하는데 어려움
    // if (logger) {
    //     if (debug) logger.debug(msg, code) //오류로 처리하되 로그파일에 남기지 않고 console에만 정해진 포맷으로 표시 (개발자 대량 테스트 등에 유용)
    //     else logger.error(msg, code) //로그파일에 오류로 남김 (error와 warn이 오류파일에 남기도록 winston에 설정되어 있음)
    // }
    const codeReal = code ?? Code.NOT_OK
    const msgReal = msg ?? Msg.NOT_OK
    throw new HttpException({
        statusCode: statusCode,
        message: ''
    }, statusCode, { //statusCode가 HttpStatus Enum에 없으면 throw new ERR_HTTP_INVALID_STATUS_CODE(statusCode)
        cause: { code: codeReal, msg: msgReal } //클라이언트에서 받아 처리하게 될 오류 (코드/메시지 키값 일관성 유지)
    })//클라이언트에서는 { error: { code: '-100', msg: 'xxxx' }, message: '', path: '/auth/login', statusCode: 200, timestamp: '2024-12-09T22:25:52.818Z'} 형식으로 리턴될 것이나
    //http-exception.filter.ts에서 code/msg의 object내 위치 수정시켜 위로 올림
}

export function throwCatchedEx(ex: any, req?: Request, fv?: string) { //, logger?: Logger) {
    //try에서 catch로 넘어온 오류는 아래와 같을 것인데 그걸 받아서 (다시 throwHttpEx()로) 클라이언트에게 응답하기
    //1. 바로 위 throwHttpEx()로 넘어온 경우 (아래 예 참조 - 나중에 http-exception.filter.ts를 거침)
    //   => {"response":{"statusCode":200,"message":""},"status":200,"options":{"cause":{"code":"-100","msg":"데이터가 없습니다.사업자번호: 1298701825"}},"message":"","name":"HttpException","cause":{"code":"-100","msg":"데이터가 없습니다.사업자번호: 1298701825"}}
    //2. 시스템에서 던지는 오류 : 바로 클라이언트로 응답될 것임
    //   => statusCode가 200이 아닐 것임
    //3. new Error("xxx")로 넘어온 경우
    //   => ex.message만 있을 것임
    let codeMsg = { code: Code.NOT_OK, msg: ''}
    if (ex.status == HttpStatus.OK) { //200인데 오류로 넘어온 것은 위 1.항목 케이스
        if (ex.options && ex.options.cause) {
            codeMsg = ex.options.cause
        } else {
            codeMsg.msg = ex.message
        }
    } else if (ex.status) { //위 2.항목 케이스
        codeMsg.code = ex.status
    } else { //위 3.항목 케이스
        codeMsg.msg = ex.message
    }
    const [msgStr, bracket] = setMsgBracket(codeMsg.msg, codeMsg.code, req)
    comLog.error(msgStr, bracket) //comLog.error(codeMsg.msg, codeMsg.code)
    //if (ex.stack && !msgStr.includes('SQL syntax')) comLog.error(ex.stack) //SQL 오류시 해당 파일(.ts)을 못찾고 있어서 stack 표시해도 현재 도움이 안됨
    if (ex.stack) comLog.error(ex.stack) //SQL 오류시 해당 파일(.ts)을 못찾고 있어서 stack 표시해도 현재 도움이 안됨
    throwHttpEx(codeMsg.msg + fv, codeMsg.code) //userid, ip를 오류표시하면서 화면에 굳이 노출하지 말기
}

export function setResJson(json: ResJson, msg: string, code?: string, req?: Request, smallTitle?: string) {
    if (req) { //req가 전달되면 로깅하겠다는 의도로 보면 됨
        const [msgStr, bracket] = setMsgBracket(msg, code, req, smallTitle)
        comLog.warn(msgStr, bracket)
    }
    json.code = isvoid(code) ? Code.NOT_OK : code
    json.msg = smallTitle ? smallTitle + ' : ' + msg : msg
    return json
}

export function writeLogError(msg: string, code?: string, req?: Request, smallTitle?: string) {
    //console.log()만으로는 로깅처리가 안됨. 이 함수로 로깅 및 console.log() 동시 처리함 (error만 지원)
    const [msgStr, bracket] = setMsgBracket(msg, code, req, smallTitle)
    comLog.error(msgStr, bracket)
    if (bracket) {
        console.log(bracket, msgStr)
    } else {
        console.log(msgStr)
    }
}

export function setMsgBracket(msg: string, code?: string, req?: Request, smallTitle?: string) { //logger에 표시되는 메시지 포맷팅
    const codeStr = isvoid(code) ? '-1' : code
    let msgStr = codeStr + ' / ' + msg
    if (smallTitle) msgStr = smallTitle + ' : ' + msgStr
    if (req) {
        const bracket = req['user'] ? (req['user'].userid + '/' + req.ip) : req.ip
        return [msgStr, bracket]
    } else {
        return [msgStr, null]
    }
}

export function procDownloadFailure(res: Response) { //임시폴더에 다운로드실패.txt를 미리 두고 다운로드시킴
    //오류처리안하면 요청한 파일명이 그대로 내려가는데 그걸 열어봐야 깨진 줄 알게되므로 사용자 불편사항임
    //그걸, 일단 response로 전환하기 쉽지 않아 그나마 일단 실패를 알리는 파일이라도 다운로드하는 방법을 택한 것임
    //그런데, 결과적으로 잘안됨 (axios 호출결과에서도 실패인지 구분이 안되고 있어서 현재 방법 못찾고 있음)
    const filename = '다운로드실패.txt'
    const filePath = cons.tempdir + filename
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"')
    res.download(filePath, filename, (err) => {
        if (err) writeLogError(err.toString())
        //이 파일은 지우면 안됨 (안내용 파일)
    })
}

//tanstack query 테스트용임 (code.service.ts 참조)
export function setPageInfo(perPage: number, curPage: number, totalCnt: number, resJson: ResJson): void {
    resJson.offsetPos = (curPage - 1) * perPage //offsetPos를 resJson에 넣은 것은 별도 객체 안 만들고 resJson으로 한번에 이용하려는 단순한 목적임
    resJson.totalCnt = totalCnt
    resJson.totalPage = Math.ceil(totalCnt / perPage)
    console.log(perPage, curPage, resJson.offsetPos, "====", resJson.offsetPos, resJson.totalCnt, resJson.totalPage)
}

export async function getMysqlCurdt(dataSource: DataSource): Promise<any> {
    let sql = "SELECT DATE_FORMAT(now(6), '%Y-%m-%d %H:%i:%s.%f') AS DT "
    const list = await dataSource.query(sql, null)
    return list[0]
}

export async function getMysqlUnid(dataSource: DataSource): Promise<any> {
    let sql = "SELECT CONCAT(DATE_FORMAT(now(6), '%Y%m%d%H%i%s%f'), LPAD(CAST(RAND() * 100000 AS SIGNED), '6', '0')) AS ID, DATE_FORMAT(now(6), '%Y-%m-%d %H:%i:%s.%f') AS DT "
    const list = await dataSource.query(sql, null)
    return list[0]
}

export function getTypeForMsgDtl(strKind: string): string { //서버,클라언트 모두 동일
    switch (strKind) { //break 안쓰고 바로 return
        case 'later':
        case 'stored':
        case 'finished':
        case 'fixed':
            return 'user'
        case 'done':
        case 'checked':
        case 'watching':
            return 'react'
        case 'notyet':
        case 'read':
        case 'unread':
            return 'read'
        case 'parent':
        case 'child':
            return 'msg'
        default:
            return 'error'         
    }
}

export async function insertDataLog(dataSource: DataSource, obj: any): Promise<any> { 
    //로깅은 2가지 역할 : 1) 로그 자체의 역할 (사용자 동선 추적) 2) 리얼타임 화면 데이터 반영
    let { cdt, msgid, replyto, chanid, userid, usernm, cud, kind, typ, bodytext, subkind } = obj
    try {
        let sql = "INSERT INTO S_DATALOG_TBL (CDT, MSGID, REPLYTO, CHANID, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND) "
        sql += " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
        await dataSource.query(sql, [cdt, msgid, replyto, chanid, userid, usernm, cud, kind, typ, bodytext, subkind ?? ''])
        return ''
    } catch (ex) {
        return ex.message
    }
}

export function getBasicAclSql(userid: string, typ: string): string { //typ=WS,GS,ALL
    //아래는 앱 전체를 관통하는 메시징의 구조 및 권한을 보여주는 sql임. WS(WorkSpace)는 채널메시지. GS(GeneralSpace)는 DM 메시지
    //채널메시지는 1) 내가 속한 그룹의 내가 속한 채널방 것만 열람 가능 (관리자가 그룹에서 제외시키면 채널방에만 있어도 권한 없음)
    //           2) 내가 속하지 않아도 공개(A=All)된 방이면 그룹 멤버라면 누구나 열람 가능
    //DM은 그룹에 무관하게 DM방이 존재하여 내가 속한 DM방의 메시지는 모두 열람 가능

    let sqlWs = "SELECT DISTINCT A.CHANID, A.CHANNM, A.TYP, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT "
    sqlWs += " FROM S_CHANMST_TBL A "
    sqlWs += "INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID "
    sqlWs += "INNER JOIN S_GRDTL_TBL C ON A.GR_ID = C.GR_ID "
    sqlWs += "WHERE A.TYP = 'WS' AND (B.USERID = '" + userid + "' OR A.STATE = 'A') "

    let sqlGs = "SELECT DISTINCT A.CHANID, A.CHANNM, A.TYP, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT "
    sqlGs += " FROM S_CHANMST_TBL A "
    sqlGs += "INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID "
    sqlGs += "WHERE A.TYP = 'GS' AND B.USERID = '" + userid + "' "
    
    if (typ == 'WS') {
        return sqlWs
    } else if (typ == 'GS') {
        return sqlGs
    } else {
        return sqlWs + "UNION ALL " + sqlGs
    }
}

//////////////////////////////////////////////////////////////////////////////////////////
//아래는 nest.js와는 무관하게 사용 가능한 일반적인 메소드임

export function isvoid(obj: any) { //0 ?? 500 = 0을 반환. 0 || 500 = 500을 반환
    //대신 a ?? b로 사용가능 (a가 null도 아니고 undefined도 아니면 a 반환. a가 0이거나 false라도 a를 반환)
    if (typeof obj == "undefined" || obj == null || obj == "undefined") return true
    return false
}

export function isObject(value: any): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function addFieldValue(val: any, title?: any, includeOther?: any) { //, newLine?: boolean) { //title은 AA/BB/CC..형식
    const deli = '\n' //newLine ? '\n' : ' => '
    let valStr = "" //fv(fieldvalue)값을 보여줄 때 name/value로 맞춰서 보여주면 사용자가 읽기 쉽게 볼 수 있도록 함
    //사실, 아래에서 #### 이외는 사용할 일이 없을 것이나 일단 그대로 두기로 함
    if (Array.isArray(val)) {
        if (title) {
            const arr = title.split('/')
            if (arr.length == val.length) {
                let valStr = '', deliHere = ''
                for (let i = 0; i < arr.length; i++) {
                    valStr += deliHere + arr[i] + '[' + val[i] + ']'
                    deliHere = ' / '
                }
                return deli + valStr
            } else {
                if (val.length == 1) {
                    valStr = " [" + val + "]"
                } else {
                    valStr = " [" + val.join("][") + "]"
                }
                return deli + title + valStr
            }
        } else {
            if (val.length == 1) {
                valStr = " [" + val + "]"
            } else {
                valStr = " [" + val.join("][") + "]"
            }
            return deli + valStr
        }
    } else if (isObject(val)) { //####
        const arr = (title) ? title.split('/') : []
        const entries = Object.entries(val)
        let valStr = '', deliHere = ''
        entries.forEach(([key, value]) => {
            if (title) {
                if (title.startsWith('@')) { //@는 제외하라는 표시임
                    if (!arr.includes(key)) {
                        valStr += deliHere + key + '[' + value + ']'
                        deliHere = ' / '
                    }
                } else {
                    if (arr.includes(key)) {
                        valStr += deliHere + key + '[' + value + ']'
                        deliHere = ' / '
                    }
                }
            } else {
                valStr += deliHere + key + '[' + value + ']'
                deliHere = ' / '
            }
        })
        if (includeOther) { //무조건 배열이여야 함 (하지만, userid, ip 등은 굳이 일부러 사용자 화면에 노출하지는 말기 - 꼭 필요시만 사용)
            const arrStr = includeOther.join(',')
            valStr += deliHere + '[' + arrStr + ']'
        }
        return deli + valStr
    } else { 
        if (val == '') {
            valStr = ' [없음]'
        } else {
            valStr = " [" + val + "]"
        }
        if (title) return deli + title + valStr
        return deli + valStr
    }
}

export function encrypt(text: string, key: string) { //key = 32bytes
    const iv = randomBytes(16)
    let cipher = createCipheriv('aes-256-cbc', Buffer.from(key), iv)
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decrypt(text: string, key: string) { 				
    let arr = text.split(':')
    let iv = Buffer.from(arr[0], 'hex')
    let encryptedText = Buffer.from(arr[1], 'hex')
    let decipher = createDecipheriv('aes-256-cbc', Buffer.from(key), iv) //const decode = crypto.createDecipher('aes-256-cbc', key). createDecipher deprecated
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
}

export function getDateTimeStr(dt: Date, deli: boolean, millisec: boolean) {
    let ret:string, dot: string
    if (deli) {
        ret = dt.getFullYear().toString() + "-" + (dt.getMonth() + 1).toString().padStart(2, "0") + "-" + dt.getDate().toString().padStart(2, "0") + " " + 
              dt.getHours().toString().padStart(2, "0") + ":" + dt.getMinutes().toString().padStart(2, "0") + ":" + dt.getSeconds().toString().padStart(2, "0")
        dot = "."      
    } else {
        ret = dt.getFullYear().toString() + (dt.getMonth() + 1).toString().padStart(2, "0") + dt.getDate().toString().padStart(2, "0") + 
              dt.getHours().toString().padStart(2, "0") + dt.getMinutes().toString().padStart(2, "0") + dt.getSeconds().toString().padStart(2, "0")
        dot = ""
    }
    if (millisec) ret += dot + dt.getMilliseconds().toString().padEnd(6, "0")
    return ret
}

export function getRnd(min?: number, max?: number): number {
    const minInt = (!min && min != 0) ? 100000 : min
    const maxInt = (!max && max != 0) ? 999999 : max
    return Math.floor(Math.random() * (maxInt - minInt)) + minInt //return min(inclusive) ~ max(exclusive) Integer only 
}

export function getDateTimeStamp(str: string): Date | null { //str = 2012-08-02 14:12:04 (일자형식 체크해야 하나 일단 표준대로 들어온다는 전체하에 사용하기로 함)
    if (str.length < 19) return null
    const str19 = str.substring(0, 19)
    const dt: number = Date.parse(str19)
    return new Date(dt)
}

export function getDateTimeDiff(prev: string, cur: string, type: string): number | null { //yyyy-mm-dd hh:MM:dd (type:S/M/H/D)
    const dtPrev: Date = getDateTimeStamp(prev)
    const dtCur: Date = getDateTimeStamp(cur)
    const diffMs: number = dtCur.getTime() - dtPrev.getTime()
    const diffSec: number = Math.floor(diffMs / 1000)
    if (type == 'S') return diffSec
    const diffMin: number = Math.floor(diffSec / 60)
    if (type == 'M') return diffMin
    const diffHours: number = Math.floor(diffMin / 60)
    if (type == 'H') return diffHours
    const diffDays: number = Math.floor(diffHours / 24)
    if (type == 'D') return diffDays
    return null
}
