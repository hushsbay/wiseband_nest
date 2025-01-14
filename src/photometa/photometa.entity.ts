import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, Relation } from 'typeorm'

import { Photo } from "src/photo/photo.entity"

@Entity({ name: 'photometa'})
export class PhotoMeta {

    @PrimaryColumn()
    ID: string

    @Column()
    COMMENT: string

    @OneToOne(() => Photo, (photo) => photo.photoMeta)
    @JoinColumn({ name: 'FID'})
    photo: Relation<Photo>

}
