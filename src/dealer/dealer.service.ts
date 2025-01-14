import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Like, Brackets } from 'typeorm'
//import { Transactional } from 'typeorm-transactional'

import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { Dealer } from 'src/dealer/dealer.entity'

@Injectable({ scope: Scope.REQUEST })
export class DealerService {

    constructor(@InjectRepository(Dealer) private dealerRepo: Repository<Dealer>, @Inject(REQUEST) private readonly req: Request) {}

    async qry(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const { tax_typ, sort, search, pageRq, ern } = dto
        const detailInfo = hush.addDetailInfo('tax_typ:' + tax_typ + ',sort:' + sort + ',search:' + search + ',ern:' + ern)
        try {
            const fields = ['ERN', 'TAX_TYP', 'DEAL_CO_NM', 'RPST_NM', 'CO_ITEM_NM', 'CONCAT(BASE_ADDR, " ", DTL_ADDR) AS ADDR']
            if (hush.isvoid(tax_typ)) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req) //빈값은 허용해야 해서 isvoid()로 체크
            const rowStart = (parseInt(pageRq.curPage) - 1) * parseInt(pageRq.rowPerPage) //console.log(pageRq.curPage, "@@@@", pageRq.rowPerPage, "@@@@", rowStart)
            const where = { TAX_TYP: tax_typ }   
            let andWhere = {}, orderBy = ''
            if (search) { //AND (ERN LIKE '%" + search + "%' OR DEAL_CO_NM LIKE '%" + search + "%' OR ~)
                const text = '%' + search + '%'
                andWhere = new Brackets((qb) => {
                    qb.where({ ERN: Like(text)}).orWhere({ DEAL_CO_NM: Like(text)}).orWhere({ CO_ITEM_NM: Like(text)}).orWhere({ BASE_ADDR: Like(text)})
                })
            } 
            if (sort == 'N') {
                orderBy = 'DEAL_CO_NM'
            } else if (sort == 'I') {
                orderBy = 'CO_ITEM_NM'
            } else {
                orderBy = 'BASE_ADDR'
            } //const list = await this.dealerRepo.find({ where: where }) //and or 조건 거는 메소드 못찾음 (찾으면 find로도 해보기)
            const sql = this.dealerRepo.createQueryBuilder().select(fields).where(where).andWhere(andWhere)
            const list = await sql.orderBy(orderBy).skip(rowStart).take(parseInt(pageRq.rowPerPage)).getRawMany() //CONCAT, SUBSTR 등 사용시
            if (!list) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            const totalRow = await sql.getCount() //console.log(totalRow, list.length, JSON.stringify(list[0]))
            resJson.list = list
            resJson.data.totalRow = totalRow
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryOne(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const { ern, kind } = dto
        const detailInfo = hush.addDetailInfo(ern, '사업자번호')
        let data: any
        try {            
            if (kind == 'view_update') { //목록스타일로 한 행 조회 (저장후 행 갱신/추가시 사용)
                const fields = ['ERN', 'TAX_TYP', 'DEAL_CO_NM', 'RPST_NM', 'CO_ITEM_NM', 'CONCAT(BASE_ADDR, " ", DTL_ADDR) AS ADDR'] //필드명이 달라도 오류나지 않고 select 안되는..
                data = await this.dealerRepo.createQueryBuilder().select(fields).where({ ERN: ern }).getRawOne()
            } else {
                data = await this.dealerRepo.findOneBy({ ERN: ern })
            }
            if (!data) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            resJson.data = data //getOne(),getRawOne()은 list가 아닌 data로 받아야 함
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    //@Transactional()
    async saveOne(dto: Record<string, any>): Promise<any> { //dto와 결합해서 효율적으로 테이블 업뎃하는 것도 좋지만 필드별 예외 등 각각 처리해야 할 경우도 고려해 아래와 같이 처리함
        const resJson = new ResJson()
        const { isNew, ...fields } = dto, { ERN } = fields //Request필드 모두 대문자로 해야 간단 해결 (CRUD중 문서의 CU는 대문자로 하기)
        const detailInfo = hush.addDetailInfo(ERN, '사업자번호')
        try {
            if (!ERN) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req) //req 있으면 콘솔 및 로그파일에 warn으로 표시 (not error)
            //if (!ERN) hush.throwHttpEx(hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA) //가능하면 setResJson 사용하고 오류로 던져야 할 상황일 때만 throwHttpEx()로 처리
            //- try catch가 없으면 바로 클라이언트에게 전달되고 콘솔 및 로그파일에 표시되지 않으므로 로거를 쓰려면 바로 위에 logger.error나 logger.warn 사용하거나 항상 try catch 쓰기
            //- try catch내에서 throw하면 catch에서 무조건 콘솔 및 로그파일에 error로 표시
            const dealer = await this.dealerRepo.findOneBy({ ERN: ERN })
            if (isNew) {
                if (dealer) return hush.setResJson(resJson, hush.Msg.ALREADY_EXIST + detailInfo, hush.Code.ALREADY_EXIST, this.req)
            } else {                
                if (!dealer) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            } //console.log(JSON.stringify(fields))          
            await this.dealerRepo.save(fields) //rs로 받으면 updated dealer로 리턴 : 필요시 사용 (예: 서버 통해 뭔가를 클라이언트가 전달받아야 하는 경우)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async deleteOne(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson() 
        const { ern } = dto
        const detailInfo = hush.addDetailInfo(ern, '사업자번호')
        try {
            if (!ern) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req)
            const result = await this.dealerRepo.delete({ ERN: ern })
            if (!result.affected) return hush.setResJson(resJson, hush.Msg.DELETE_FAIL + detailInfo, hush.Code.DELETE_FAIL, this.req)
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

}
