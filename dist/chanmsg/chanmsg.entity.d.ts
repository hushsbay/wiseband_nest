export declare class MsgMst {
    CHANID: string;
    MSGID: string;
    AUTHORID: string;
    AUTHORNM: string;
    BODY: string;
    BODYTEXT: string;
    REPLYTO: string;
    KIND: string;
    CDT: string;
    UDT: string;
}
export declare class MsgSub {
    CHANID: string;
    MSGID: string;
    KIND: string;
    CDT: string;
    BODY: string;
    FILESIZE: number;
    FILEEXT: string;
    BUFFER: Buffer;
    UDT: string;
}
export declare class MsgDtl {
    MSGID: string;
    CHANID: string;
    USERID: string;
    KIND: string;
    SUBKIND: string;
    TYP: string;
    CDT: string;
    BODY: string;
    UDT: string;
    USERNM: string;
}
export declare class ChanMst {
    CHANID: string;
    TYP: string;
    CHANNM: string;
    GR_ID: string;
    MASTERID: string;
    MASTERNM: string;
    STATE: string;
    ISUR: string;
    CDT: string;
    MODR: string;
    UDT: string;
}
export declare class ChanDtl {
    CHANID: string;
    USERID: string;
    USERNM: string;
    STATE: string;
    KIND: string;
    NOTI: string;
    BOOKMARK: string;
    SYNC: string;
    ISUR: string;
    CDT: string;
    MODR: string;
    UDT: string;
}
export declare class GrMst {
    GR_ID: string;
    GR_NM: string;
    MASTERID: string;
    MASTERNM: string;
    ISUR: string;
    CDT: string;
    MODR: string;
    UDT: string;
    dtl: GrDtl[];
}
export declare class GrDtl {
    GR_ID: string;
    USERID: string;
    USERNM: string;
    KIND: string;
    ORG: string;
    JOB: string;
    EMAIL: string;
    TELNO: string;
    RMKS: string;
    SYNC: string;
    ISUR: string;
    CDT: string;
    MODR: string;
    UDT: string;
    mst: GrMst;
}
