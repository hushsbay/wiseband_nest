import { Request } from 'express';
import { DataSource } from 'typeorm';
import { ResJson } from 'src/common/resjson';
export declare enum Code {
    OK = "0",
    NOT_OK = "-1",
    NOT_FOUND = "-100",
    BLANK_DATA = "-101",
    ALREADY_EXIST = "-102",
    DELETE_FAIL = "-201",
    JWT_NEEDED = "-801",
    JWT_MISMATCH = "-802",
    JWT_EXPIRED = "-803",
    JWT_ETC = "-809",
    PWD_MISMATCH = "-811",
    OTP_MISMATCH = "-812",
    OTP_TIMEOVER = "-813",
    NOT_AUTHORIZED = "860"
}
export declare enum Msg {
    NOT_OK = "\uC624\uB958\uAC00 \uBC1C\uC0DD\uD558\uC600\uC2B5\uB2C8\uB2E4.",
    NOT_FOUND = "\uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
    BLANK_DATA = "\uAC12\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
    ALREADY_EXIST = "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 \uB370\uC774\uD130\uC785\uB2C8\uB2E4.",
    DELETE_FAIL = "\uC0AD\uC81C\uC2E4\uD328\uC785\uB2C8\uB2E4.",
    JWT_NEEDED = "\uC778\uC99D\uD1A0\uD070\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.",
    JWT_MISMATCH = "\uC778\uC99D\uD1A0\uD070\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
    JWT_EXPIRED = "\uC778\uC99D\uD1A0\uD070\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
    JWT_ETC = "\uD1A0\uD070 \uC624\uB958\uC785\uB2C8\uB2E4.",
    PWD_MISMATCH = "\uBE44\uBC88\uC774 \uB2E4\uB985\uB2C8\uB2E4.",
    OTP_MISMATCH = "OTP \uAC12\uC774 \uB2E4\uB985\uB2C8\uB2E4.",
    NOT_AUTHORIZED = "\uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."
}
export declare const cons: {
    appName: string;
    otpDiffMax: number;
    rowsCnt: number;
    rowsCntForNotyet: number;
    replyCntLimit: number;
    picCnt: number;
    cdtAtFirst: string;
    cdtAtLast: string;
    bodyLenForLog: number;
};
export declare function throwHttpEx(msg?: string, code?: string): void;
export declare function throwCatchedEx(ex: any, req?: Request, fv?: string): void;
export declare function setResJson(json: ResJson, msg: string, code?: string, req?: Request, smallTitle?: string): ResJson;
export declare function writeLogError(msg: string, code?: string, req?: Request, smallTitle?: string): void;
export declare function setMsgBracket(msg: string, code?: string, req?: Request, smallTitle?: string): string[];
export declare function setPageInfo(perPage: number, curPage: number, totalCnt: number, resJson: ResJson): void;
export declare function insertIntoSockTbl(dataSource: DataSource, obj: any): Promise<any>;
export declare function getMysqlCurdt(dataSource: DataSource): Promise<any>;
export declare function getMysqlUnid(dataSource: DataSource): Promise<any>;
export declare function getTypeForMsgDtl(strKind: string): string;
export declare function insertDataLog(dataSource: DataSource, obj: any): Promise<any>;
export declare function getBasicAclSql(userid: string, typ: string, includeOnlyPrivate?: boolean): string;
export declare function isvoid(obj: any): boolean;
export declare function isObject(value: any): boolean;
export declare function addFieldValue(val: any, title?: any, includeOther?: any): string;
export declare function encrypt(text: string, key: string): string;
export declare function decrypt(text: string, key: string): string;
export declare function getDateTimeStr(dt: Date, deli: boolean, millisec: boolean): string;
export declare function getRnd(min?: number, max?: number): number;
export declare function getDateTimeStamp(str: string): Date | null;
export declare function getDateTimeDiff(prev: string, cur: string, type: string): number | null;
