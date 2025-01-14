import { PhotoMeta } from 'src/photometa/photometa.entity'
import { Entity, PrimaryColumn, Column, OneToOne, Relation } from 'typeorm'

@Entity({ name: 'photo'})
export class Photo {

    @PrimaryColumn()
    ID: string

    @Column()
    NM: string

    @OneToOne(() => PhotoMeta, (photoMeta) => photoMeta.photo)
    photoMeta: Relation<PhotoMeta>

}
