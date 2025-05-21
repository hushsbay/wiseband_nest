import { Entity, PrimaryColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm'

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
    BODYTEXT: string

    @Column()
    REPLYTO: string

    @Column()
    KIND: string    

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
    CDT: string    

    @Column()
    BODY: string

    @Column()
    FILESIZE: number

    @Column()
    FILEEXT: string    

    @Column()
    BUFFER: Buffer

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

    @Column()
    TYP: string    

    @PrimaryColumn()
    CDT: string    

    @Column()
    BODY: string
    
    @Column()
    UDT: string

    @Column()
    USERNM: string

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
    RMKS: string

    @Column()
    CDT: string

    @Column()
    UDT: string

    @OneToMany(() => GrDtl, (dtl) => dtl.mst)
    dtl: GrDtl[]

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
    KIND: string

    @Column()
    ORG: string

    @Column()
    JOB: string

    @Column()
    EMAIL: string

    @Column()
    TELNO: string

    @Column()
    RMKS: string

    @Column()
    IS_SYNC: string

    @Column()
    CDT: string

    @Column()
    UDT: string

    @ManyToOne(() => GrMst, (mst) => mst.dtl)
    @JoinColumn({ name: 'GR_ID' })
    mst: GrMst

}