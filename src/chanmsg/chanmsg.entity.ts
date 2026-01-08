import { Entity, PrimaryColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm'

@Entity({ name: 's_msgmst_tbl' })
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

@Entity({ name: 's_msgsub_tbl' })
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

@Entity({ name: 's_msgdtl_tbl' })
export class MsgDtl {

    @PrimaryColumn()
    MSGID: string

    @PrimaryColumn()
    CHANID: string    

    @PrimaryColumn()
    USERID: string

    @PrimaryColumn()
    KIND: string    

    @PrimaryColumn()
    SUBKIND: string   

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

@Entity({ name: 's_chanmst_tbl' })
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
    STATE: string

    @Column()
    ISUR: string

    @Column()
    CDT: string

    @Column()
    MODR: string

    @Column()
    UDT: string

}

@Entity({ name: 's_chandtl_tbl' })
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
    SYNC: string

    @Column()
    ISUR: string

    @Column()
    CDT: string

    @Column()
    MODR: string

    @Column()
    UDT: string

}

//////////////////////////////////////////////////////////////////

@Entity({ name: 's_grmst_tbl'})
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
    ISUR: string

    @Column()
    CDT: string

    @Column()
    MODR: string

    @Column()
    UDT: string

    @OneToMany(() => GrDtl, (dtl) => dtl.mst)
    dtl: GrDtl[]

}

@Entity({ name: 's_grdtl_tbl' })
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
    SYNC: string

    @Column()
    ISUR: string

    @Column()
    CDT: string

    @Column()
    MODR: string

    @Column()
    UDT: string

    @ManyToOne(() => GrMst, (mst) => mst.dtl)
    @JoinColumn({ name: 'GR_ID' })
    mst: GrMst

}