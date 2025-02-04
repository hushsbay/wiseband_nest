import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity({ name: 'S_MSGMST_TBL'})
export class MsgMst {

    @PrimaryColumn()
    CHANID: string

    @PrimaryColumn()
    MSGID: string

    @Column()
    AUTHORID: string

    @Column()
    AUTHORNM: string

    @Column()
    BODY: string

    @Column()
    REPLYTO: string

    @Column()
    REPLYCNT: number

    @Column()
    KIND: string    

    @Column()
    DEL: string

    @Column()
    CDT: string

    @Column()
    UDT: string

}

@Entity({ name: 'S_MSGSUB_TBL'})
export class MsgSub {

    @PrimaryColumn()
    CHANID: string

    @PrimaryColumn()
    MSGID: string

    @PrimaryColumn()
    KIND: string    

    @PrimaryColumn()
    SEQ: string    

    @Column()
    BODY: string

    @Column()
    BUFFER: Buffer /////////////Buffer로 되어 있음을 유의 (테스트 필요)

    @Column()
    CDT: string

    @Column()
    UDT: string

}

@Entity({ name: 'S_MSGDTL_TBL'})
export class MsgDtl {

    @PrimaryColumn()
    CHANID: string

    @PrimaryColumn()
    MSGID: string

    @PrimaryColumn()
    USERID: string

    @PrimaryColumn()
    KIND: string    

    @PrimaryColumn()
    SEQ: string    

    @Column()
    BODY: string

    @Column()
    CDT: string

    @Column()
    UDT: string

}

//////////////////////////////////////////////////////////////////

@Entity({ name: 'S_CHANMST_TBL'})
export class ChanMst {

    @PrimaryColumn()
    CHANID: string

    @Column()
    TYP: string

    @Column()
    CHANNM: string

    @Column()
    GR_ID: string

    @Column()
    MASTERID: string

    @Column()
    MASTERNM: string

    @Column()
    INUSE: string

    @Column()
    STATE: string

    @Column()
    MEMCNT: number

    @Column()
    RMKS: string

    @Column()
    CDT: string

    @Column()
    UDT: string

}

@Entity({ name: 'S_CHANDTL_TBL'})
export class ChanDtl {

    @PrimaryColumn()
    CHANID: string

    @PrimaryColumn()
    USERID: string

    @Column()
    USERNM: string

    @Column()
    STATE: string

    @Column()
    KIND: string

    @Column()
    NOTI: string

    @Column()
    BOOKMARK: string

    @Column()
    CDT: string

    @Column()
    UDT: string

}

//////////////////////////////////////////////////////////////////

@Entity({ name: 'S_GRMST_TBL'})
export class GrMst {

    @PrimaryColumn()
    GR_ID: string

    @Column()
    GR_NM: string

    @Column()
    MASTERID: string

    @Column()
    MASTERNM: string

    @Column()
    INUSE: string

    @Column()
    MEMCNT: number

    @Column()
    RMKS: string

    @Column()
    CDT: string

    @Column()
    UDT: string

}

@Entity({ name: 'S_GRDTL_TBL'})
export class GrDtl {

    @PrimaryColumn()
    GR_ID: string

    @PrimaryColumn()
    USERID: string

    @Column()
    USERNM: string

    @Column()
    CDT: string

    @Column()
    UDT: string

}