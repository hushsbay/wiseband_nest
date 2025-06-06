import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity({ name: 'S_ORG_TBL' })
export class Org {

    @PrimaryColumn()
    ORG_CD: string

    @Column()
    ORG_NM: string

    @Column()
    SEQ: string

    @Column()
    LVL: number

}

@Entity({ name: 'S_USER_TBL' })
export class User {

    @PrimaryColumn()
    USERID: string

    @Column()
    USERNM: string

    @Column()
    KIND: string

    @Column()
    PWD: string
    
    @Column()
    SEQ: string

    @Column()
    ORG_CD: string

    @Column()
    ORG_NM: string

    @Column()
    TOP_ORG_CD: string

    @Column()
    TOP_ORG_NM: string
    
    @Column()
    PICTURE: Buffer

    @Column()
    JOB: string

    @Column()
    EMAIL: string

    @Column()
    TELNO: string

    @Column()
    SYNC: string

    @Column()
    OTP_NUM: string

    @Column()
    OTP_DT: string

    @Column()
    ISUR: string

    @Column()
    ISUDT: string

    @Column()
    MODR: string

    @Column()
    MODDT: string

}

@Entity({ name: 'S_USERCODE_TBL' })
export class UserCode {

    @PrimaryColumn()
    KIND: string

    @PrimaryColumn()
    USERID: string

    @PrimaryColumn()
    UID: string

    @Column()
    UNM: string

}
