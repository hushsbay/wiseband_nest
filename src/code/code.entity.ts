import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity({ name: 'Z_CODE_TBL'})
export class Code {

    @PrimaryColumn()
    KIND: string

    @PrimaryColumn()
    ID: string

    @Column()
    NM: string

}
