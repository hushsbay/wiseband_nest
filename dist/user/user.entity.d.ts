export declare class Org {
    ORG_CD: string;
    ORG_NM: string;
    SEQ: string;
    LVL: number;
}
export declare class User {
    USERID: string;
    USERNM: string;
    KIND: string;
    PWD: string;
    SEQ: string;
    ORG_CD: string;
    ORG_NM: string;
    TOP_ORG_CD: string;
    TOP_ORG_NM: string;
    PICTURE: Buffer;
    JOB: string;
    EMAIL: string;
    TELNO: string;
    SYNC: string;
    OTP_NUM: string;
    OTP_DT: string;
    ISUR: string;
    ISUDT: string;
    MODR: string;
    MODDT: string;
}
export declare class UserCode {
    KIND: string;
    USERID: string;
    UID: string;
    UNM: string;
}
export declare class UserEnv {
    USERID: string;
    USERNM: string;
    NICKNM: string;
    AB_CD: string;
    AB_NM: string;
    NOTI_OFF: string;
    BODY_OFF: string;
    AUTHOR_OFF: string;
    ISUR: string;
    ISUDT: string;
    MODR: string;
    MODDT: string;
}
