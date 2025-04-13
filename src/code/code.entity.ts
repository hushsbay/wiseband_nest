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

@Entity({ name: 'Z_DEALER_TBL'})
export class Dealer {

    @PrimaryColumn()
    ERN: string

    @Column()
    TAX_TYP: string

    @Column()
    DEAL_CO_NM: string

    @Column()
    RPST_NM: string

    @Column()
    TEL_NO: string

    @Column()
    ZIP_CD: string

    @Column()
    FAX_NO: string

    @Column()
    BASE_ADDR: string

    @Column()
    DTL_ADDR: string

    @Column()
    CO_ITEM_NM: string

    @Column()
    CRTE_DTD: string

}
