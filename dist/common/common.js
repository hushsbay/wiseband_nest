"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cons = exports.Msg = exports.Code = void 0;
exports.throwHttpEx = throwHttpEx;
exports.throwCatchedEx = throwCatchedEx;
exports.setResJson = setResJson;
exports.writeLogError = writeLogError;
exports.setMsgBracket = setMsgBracket;
exports.setPageInfo = setPageInfo;
exports.insertIntoSockTbl = insertIntoSockTbl;
exports.getMysqlCurdt = getMysqlCurdt;
exports.getMysqlUnid = getMysqlUnid;
exports.getTypeForMsgDtl = getTypeForMsgDtl;
exports.insertDataLog = insertDataLog;
exports.getBasicAclSql = getBasicAclSql;
exports.isvoid = isvoid;
exports.isObject = isObject;
exports.addFieldValue = addFieldValue;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.getDateTimeStr = getDateTimeStr;
exports.getRnd = getRnd;
exports.getDateTimeStamp = getDateTimeStamp;
exports.getDateTimeDiff = getDateTimeDiff;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const comLog = new common_1.Logger();
const SOCK_PORT = 3052;
var Code;
(function (Code) {
    Code["OK"] = "0";
    Code["NOT_OK"] = "-1";
    Code["NOT_FOUND"] = "-100";
    Code["BLANK_DATA"] = "-101";
    Code["ALREADY_EXIST"] = "-102";
    Code["DELETE_FAIL"] = "-201";
    Code["JWT_NEEDED"] = "-801";
    Code["JWT_MISMATCH"] = "-802";
    Code["JWT_EXPIRED"] = "-803";
    Code["JWT_ETC"] = "-809";
    Code["PWD_MISMATCH"] = "-811";
    Code["OTP_MISMATCH"] = "-812";
    Code["OTP_TIMEOVER"] = "-813";
    Code["NOT_AUTHORIZED"] = "860";
})(Code || (exports.Code = Code = {}));
var Msg;
(function (Msg) {
    Msg["NOT_OK"] = "\uC624\uB958\uAC00 \uBC1C\uC0DD\uD558\uC600\uC2B5\uB2C8\uB2E4.";
    Msg["NOT_FOUND"] = "\uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.";
    Msg["BLANK_DATA"] = "\uAC12\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
    Msg["ALREADY_EXIST"] = "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uB370\uC774\uD130\uC785\uB2C8\uB2E4.";
    Msg["DELETE_FAIL"] = "\uC0AD\uC81C\uC2E4\uD328\uC785\uB2C8\uB2E4.";
    Msg["JWT_NEEDED"] = "\uC778\uC99D\uD1A0\uD070\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.";
    Msg["JWT_MISMATCH"] = "\uC778\uC99D\uD1A0\uD070\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
    Msg["JWT_EXPIRED"] = "\uC778\uC99D\uD1A0\uD070\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
    Msg["JWT_ETC"] = "\uD1A0\uD070 \uC624\uB958\uC785\uB2C8\uB2E4.";
    Msg["PWD_MISMATCH"] = "\uBE44\uBC88\uC774 \uB2E4\uB985\uB2C8\uB2E4.";
    Msg["OTP_MISMATCH"] = "OTP \uAC12\uC774 \uB2E4\uB985\uB2C8\uB2E4.";
    Msg["NOT_AUTHORIZED"] = "\uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
})(Msg || (exports.Msg = Msg = {}));
exports.cons = {
    appName: 'WiSEBand',
    sockPort: SOCK_PORT,
    corsOrigin: [
        'http://localhost:5173',
        'https://hushsbay.com:446', 'https://hushsbay.com:' + SOCK_PORT.toString(),
        'http://domdev2.sbs.co.kr:9450', 'http://domdev2.sbs.co.kr:' + SOCK_PORT.toString()
    ],
    otpDiffMax: 1,
    rowsCnt: 30,
    rowsCntForNotyet: 1000,
    replyCntLimit: 2,
    picCnt: 4,
    cdtAtFirst: "1111-11-11",
    cdtAtLast: "9999-99-99",
    bodyLenForLog: 200,
};
function throwHttpEx(msg, code) {
    const statusCode = common_1.HttpStatus.OK;
    const codeReal = code ?? Code.NOT_OK;
    const msgReal = msg ?? Msg.NOT_OK;
    throw new common_1.HttpException({
        statusCode: statusCode,
        message: ''
    }, statusCode, {
        cause: { code: codeReal, msg: msgReal }
    });
}
function throwCatchedEx(ex, req, fv) {
    let codeMsg = { code: Code.NOT_OK, msg: '' };
    if (ex.status == common_1.HttpStatus.OK) {
        if (ex.options && ex.options.cause) {
            codeMsg = ex.options.cause;
        }
        else {
            codeMsg.msg = ex.message;
        }
    }
    else if (ex.status) {
        codeMsg.code = ex.status;
    }
    else {
        codeMsg.msg = ex.message;
    }
    const [msgStr, bracket] = setMsgBracket(codeMsg.msg, codeMsg.code, req);
    comLog.error(msgStr, bracket);
    if (ex.stack)
        comLog.error(ex.stack);
    throwHttpEx(codeMsg.msg + fv, codeMsg.code);
}
function setResJson(json, msg, code, req, smallTitle) {
    if (req) {
        const [msgStr, bracket] = setMsgBracket(msg, code, req, smallTitle);
        comLog.warn(msgStr, bracket);
    }
    json.code = isvoid(code) ? Code.NOT_OK : code;
    json.msg = smallTitle ? smallTitle + ' : ' + msg : msg;
    return json;
}
function writeLogError(msg, code, req, smallTitle) {
    const [msgStr, bracket] = setMsgBracket(msg, code, req, smallTitle);
    comLog.error(msgStr, bracket);
    if (bracket) {
        console.log(bracket, msgStr);
    }
    else {
        console.log(msgStr);
    }
}
function setMsgBracket(msg, code, req, smallTitle) {
    const codeStr = isvoid(code) ? '-1' : code;
    let msgStr = codeStr + ' / ' + msg;
    if (smallTitle)
        msgStr = smallTitle + ' : ' + msgStr;
    if (req) {
        const bracket = req['user'] ? (req['user'].userid + '/' + req.ip) : req.ip;
        return [msgStr, bracket];
    }
    else {
        return [msgStr, null];
    }
}
function setPageInfo(perPage, curPage, totalCnt, resJson) {
    resJson.offsetPos = (curPage - 1) * perPage;
    resJson.totalCnt = totalCnt;
    resJson.totalPage = Math.ceil(totalCnt / perPage);
    console.log(perPage, curPage, resJson.offsetPos, "====", resJson.offsetPos, resJson.totalCnt, resJson.totalPage);
}
async function insertIntoSockTbl(dataSource, obj) {
    let sql = "INSERT INTO S_SOCK_TBL (ROOMID, USERID, USERNM, SOCKETID, KIND, ISUR, ISUDT) ";
    sql += " VALUES (?, ?, ?, ?, ?, ?, ?) ";
    await dataSource.query(sql, [obj.roomid, obj.memberid, obj.membernm, obj.socketid, obj.kind, obj.userid, obj.dt]);
}
async function getMysqlCurdt(dataSource) {
    let sql = "SELECT DATE_FORMAT(now(6), '%Y-%m-%d %H:%i:%s.%f') AS DT ";
    const list = await dataSource.query(sql, null);
    return list[0];
}
async function getMysqlUnid(dataSource) {
    let sql = "SELECT CONCAT(DATE_FORMAT(now(6), '%Y%m%d%H%i%s%f'), LPAD(CAST(RAND() * 100000 AS SIGNED), '6', '0')) AS ID, DATE_FORMAT(now(6), '%Y-%m-%d %H:%i:%s.%f') AS DT ";
    const list = await dataSource.query(sql, null);
    return list[0];
}
function getTypeForMsgDtl(strKind) {
    switch (strKind) {
        case 'later':
        case 'stored':
        case 'finished':
        case 'fixed':
        case 'delfixed':
            return 'user';
        case 'done':
        case 'checked':
        case 'watching':
            return 'react';
        case 'notyet':
        case 'read':
        case 'unread':
            return 'read';
        case 'parent':
        case 'child':
            return 'msg';
        default:
            return 'error';
    }
}
async function insertDataLog(dataSource, obj) {
    let { cdt, msgid, replyto, chanid, userid, usernm, cud, kind, typ, bodytext, subkind } = obj;
    try {
        let sql = "INSERT INTO S_DATALOG_TBL (CDT, MSGID, REPLYTO, CHANID, USERID, USERNM, CUD, KIND, TYP, BODYTEXT, SUBKIND) ";
        sql += " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ";
        await dataSource.query(sql, [cdt, msgid, replyto, chanid, userid, usernm, cud, kind, typ, bodytext, subkind ?? '']);
        return '';
    }
    catch (ex) {
        return ex.message;
    }
}
function getBasicAclSql(userid, typ, includeOnlyPrivate) {
    let sqlWs = "SELECT DISTINCT A.CHANID, A.CHANNM, A.TYP, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT ";
    sqlWs += " FROM S_CHANMST_TBL A ";
    sqlWs += "INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID ";
    sqlWs += "INNER JOIN S_GRDTL_TBL C ON A.GR_ID = C.GR_ID ";
    if (includeOnlyPrivate) {
        sqlWs += "WHERE B.USERID = '" + userid + "' AND A.TYP = 'WS' ";
    }
    else {
        sqlWs += "WHERE A.TYP = 'WS' AND (B.USERID = '" + userid + "' OR A.STATE = 'A') ";
    }
    let sqlGs = "SELECT DISTINCT A.CHANID, A.CHANNM, A.TYP, A.GR_ID, A.MASTERID, A.MASTERNM, A.STATE, A.UDT CHANMST_UDT ";
    sqlGs += " FROM S_CHANMST_TBL A ";
    sqlGs += "INNER JOIN S_CHANDTL_TBL B ON A.CHANID = B.CHANID ";
    sqlGs += "WHERE B.USERID = '" + userid + "' AND A.TYP = 'GS' ";
    if (typ == 'WS') {
        return sqlWs;
    }
    else if (typ == 'GS') {
        return sqlGs;
    }
    else {
        return sqlWs + "UNION ALL " + sqlGs;
    }
}
function isvoid(obj) {
    if (typeof obj == "undefined" || obj == null || obj == "undefined")
        return true;
    return false;
}
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function addFieldValue(val, title, includeOther) {
    const deli = '\n';
    let valStr = "";
    if (Array.isArray(val)) {
        if (title) {
            const arr = title.split('/');
            if (arr.length == val.length) {
                let valStr = '', deliHere = '';
                for (let i = 0; i < arr.length; i++) {
                    valStr += deliHere + arr[i] + '[' + val[i] + ']';
                    deliHere = ' / ';
                }
                return deli + valStr;
            }
            else {
                if (val.length == 1) {
                    valStr = " [" + val + "]";
                }
                else {
                    valStr = " [" + val.join("][") + "]";
                }
                return deli + title + valStr;
            }
        }
        else {
            if (val.length == 1) {
                valStr = " [" + val + "]";
            }
            else {
                valStr = " [" + val.join("][") + "]";
            }
            return deli + valStr;
        }
    }
    else if (isObject(val)) {
        const arr = (title) ? title.split('/') : [];
        const entries = Object.entries(val);
        let valStr = '', deliHere = '';
        entries.forEach(([key, value]) => {
            if (title) {
                if (title.startsWith('@')) {
                    if (!arr.includes(key)) {
                        valStr += deliHere + key + '[' + value + ']';
                        deliHere = ' / ';
                    }
                }
                else {
                    if (arr.includes(key)) {
                        valStr += deliHere + key + '[' + value + ']';
                        deliHere = ' / ';
                    }
                }
            }
            else {
                valStr += deliHere + key + '[' + value + ']';
                deliHere = ' / ';
            }
        });
        if (includeOther) {
            const arrStr = includeOther.join(',');
            valStr += deliHere + '[' + arrStr + ']';
        }
        return deli + valStr;
    }
    else {
        if (val == '') {
            valStr = ' [없음]';
        }
        else {
            valStr = " [" + val + "]";
        }
        if (title)
            return deli + title + valStr;
        return deli + valStr;
    }
}
function encrypt(text, key) {
    const iv = (0, crypto_1.randomBytes)(16);
    let cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}
function decrypt(text, key) {
    let arr = text.split(':');
    let iv = Buffer.from(arr[0], 'hex');
    let encryptedText = Buffer.from(arr[1], 'hex');
    let decipher = (0, crypto_1.createDecipheriv)('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
function getDateTimeStr(dt, deli, millisec) {
    let ret, dot;
    if (deli) {
        ret = dt.getFullYear().toString() + "-" + (dt.getMonth() + 1).toString().padStart(2, "0") + "-" + dt.getDate().toString().padStart(2, "0") + " " +
            dt.getHours().toString().padStart(2, "0") + ":" + dt.getMinutes().toString().padStart(2, "0") + ":" + dt.getSeconds().toString().padStart(2, "0");
        dot = ".";
    }
    else {
        ret = dt.getFullYear().toString() + (dt.getMonth() + 1).toString().padStart(2, "0") + dt.getDate().toString().padStart(2, "0") +
            dt.getHours().toString().padStart(2, "0") + dt.getMinutes().toString().padStart(2, "0") + dt.getSeconds().toString().padStart(2, "0");
        dot = "";
    }
    if (millisec)
        ret += dot + dt.getMilliseconds().toString().padEnd(6, "0");
    return ret;
}
function getRnd(min, max) {
    const minInt = (!min && min != 0) ? 100000 : min;
    const maxInt = (!max && max != 0) ? 999999 : max;
    return Math.floor(Math.random() * (maxInt - minInt)) + minInt;
}
function getDateTimeStamp(str) {
    if (str.length < 19)
        return null;
    const str19 = str.substring(0, 19);
    const dt = Date.parse(str19);
    return new Date(dt);
}
function getDateTimeDiff(prev, cur, type) {
    const dtPrev = getDateTimeStamp(prev);
    const dtCur = getDateTimeStamp(cur);
    const diffMs = dtCur.getTime() - dtPrev.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (type == 'S')
        return diffSec;
    const diffMin = Math.floor(diffSec / 60);
    if (type == 'M')
        return diffMin;
    const diffHours = Math.floor(diffMin / 60);
    if (type == 'H')
        return diffHours;
    const diffDays = Math.floor(diffHours / 24);
    if (type == 'D')
        return diffDays;
    return null;
}
//# sourceMappingURL=common.js.map