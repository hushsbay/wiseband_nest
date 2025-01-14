import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm'

import { Profile } from 'src/profile/profile.entity'

@Entity({ name: 'Z_USER_TBL'})
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
    ORG_CD: string

    @Column()
    ORG_NM: string

    @Column()
    TOP_ORG_CD: string

    @Column()
    TOP_ORG_NM: string

    @Column()
    PICTURE: Buffer /////////////Buffer로 되어 있음을 유의 (테스트 필요)

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
    // UID: string

    @OneToMany(() => Profile, (profile) => profile.user)
    profiles: Profile[]

}
