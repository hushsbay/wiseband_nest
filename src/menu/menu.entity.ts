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

    //@OneToMany(() => MenuPer, (menuper) => menuper.menu)
    //menupers: MenuPer[] //여기 서비스에서는 typeorm join을 쓰지 않아 Join 막음 (풀게되면 chanmsg의 entity처럼 mst/dtl 워드로 통일해서 혼란스럽지 않게 사용하기)

}

@Entity({ name: 'S_MENUPER_TBL'})
export class MenuPer {

    @PrimaryColumn()
    USER_ID: string

    @PrimaryColumn()
    KIND: string

    @PrimaryColumn()
    ID: string

    //@ManyToOne(() => Menu, (menu) => menu.menupers)
    //@JoinColumn({ name: 'ID' })
    //menu: Menu

}
