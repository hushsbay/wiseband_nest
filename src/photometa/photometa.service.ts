import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { Photo } from 'src/photo/photo.entity'
import { PhotoMeta } from 'src/photometa/photometa.entity'

@Injectable({ scope: Scope.REQUEST })
export class PhotoMetaService {
    
    constructor(
        @InjectRepository(Photo) private photoRepo: Repository<Photo>, 
        @InjectRepository(PhotoMeta) private photometaRepo: Repository<PhotoMeta>, 
        @Inject(REQUEST) private readonly req: Request
    ) {}

    async qry(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        try {
            //const list = await this.photometaRepo.find({ relations: { photoMeta: true } }) //정상 동작함
            const list = this.photometaRepo.createQueryBuilder('photometa').innerJoinAndSelect('photoMeta.photo', 'photo').getMany() //데이터 못가져옴
            console.log(JSON.stringify(list))
            if (!list) return hush.setResJson(resJson, hush.Msg.NOT_FOUND, hush.Code.NOT_FOUND, this.req)
            resJson.list = list

            //아래는 정상 처리됨
            // const photo = new Photo()
            // photo.ID = "c"
            // photo.NM = "ccc"

            // const metadata = new PhotoMeta()
            // metadata.ID = '333'
            // metadata.COMMENT = '333'
            // metadata.photo = photo

            // await this.photoRepo.save(photo)
            // await this.photometaRepo.save(metadata)

            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }            
    }

}

