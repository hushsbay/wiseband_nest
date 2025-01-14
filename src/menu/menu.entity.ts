import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity({ name: 'S_MENU_TBL'})
export class Menu {

    @PrimaryColumn()
    KIND: string

    @PrimaryColumn()
    ID: string

    @Column()
    NM: string

    @Column()
    SEQ: string

    @Column()
    INUSE: string

    @Column()
    BASIC: string    

    @Column()
    IMG: string

    @Column()
    RMKS: string

}

@Entity({ name: 'S_MENUPER_TBL'})
export class MenuPer {

    @PrimaryColumn()
    USER_ID: string

    @PrimaryColumn()
    KIND: string

    @PrimaryColumn()
    ID: string

}

// import { Entity, PrimaryColumn, Column } from 'typeorm'

// @Entity({ name: 'Z_MENU_TBL'})
// export class Menu {

//     @PrimaryColumn()
//     KIND: string

//     @PrimaryColumn()
//     ID: string

//     @Column()
//     NM: string

//     @Column()
//     IMG: string

//     @Column()
//     TYP: string

// }