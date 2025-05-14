import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity({ name: 'S_USER_TBL'})
export class User {

    @PrimaryColumn()
    USER_ID: string

    @Column()
    ID_KIND: string

    @Column()
    PWD: string

    @Column()
    USER_NM: string

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
    TEL_NO: string

    @Column()
    MAIL_ADDR: string

    @Column()
    PICTURE: Buffer

    @Column()
    MIMETYPE: string

    @Column()
    IS_SYNC: string

    @Column()
    ISUR: string

    @Column()
    ISUDT: string

    @Column()
    MODR: string

    @Column()
    MODDT: string

    // @Column()
    // LVL: number

}

@Entity({ name: 'S_ORG_TBL'})
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
