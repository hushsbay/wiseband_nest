import { User } from 'src/user/user.entity'
import { Entity, PrimaryColumn, Column, OneToOne, Relation, ManyToOne, JoinColumn } from 'typeorm'

@Entity({ name: 'profile'})
export class Profile {

    @PrimaryColumn()
    ID: string

    @Column()
    NM: string

    // @OneToOne(() => PhotoMeta, (photoMeta) => photoMeta.photo)
    // photoMeta: Relation<PhotoMeta>

    @Column()
    PHOTO: string

    @Column()
    USER_ID: string

    @ManyToOne(() => User, (user) => user.profiles)
    @JoinColumn({ name: 'USER_ID' })
    user: User

}
