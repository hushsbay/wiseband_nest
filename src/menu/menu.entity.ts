import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity({ name: 'Z_MENU_TBL'})
export class Menu {

    @PrimaryColumn()
    KIND: string

    @PrimaryColumn()
    ID: string

    @Column()
    NM: string

    @Column()
    IMG: string

    @Column()
    TYP: string

}
