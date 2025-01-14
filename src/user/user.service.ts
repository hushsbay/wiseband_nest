import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import appConfig from 'src/app.config'
import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { User } from 'src/user/user.entity'
import { Profile } from 'src/profile/profile.entity'

@Injectable({ scope: Scope.REQUEST })
export class UserService {
    
    constructor(
        @InjectRepository(User) private userRepo: Repository<User>, 
        @InjectRepository(Profile) private profileRepo: Repository<Profile>, 
        @Inject(REQUEST) private readonly req: Request) {}

    async login(uid: string, pwd: string): Promise<ResJson> {
        const resJson = new ResJson()
        const detailInfo = hush.addDetailInfo(uid, '아이디')
        try {
            if (!uid || !pwd) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req)
            const user = await this.userRepo.findOneBy({ USER_ID: uid })
            if (!user) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            const config = appConfig()
            const decoded = hush.decrypt(user.PWD, config.crypto.key) //sendjay와 SSO (동일한 암호화 키값 사용)
            if (pwd !== decoded) return hush.setResJson(resJson, hush.Msg.PWD_MISMATCH + detailInfo, hush.Code.PWD_MISMATCH, this.req)
            const { PWD, PICTURE, MIMETYPE, ...userFiltered } = user 
            resJson.data = userFiltered
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qry(dto: Record<string, any>): Promise<any> { //test
        const resJson = new ResJson()
        try {
            //const list = await this.userRepo.find({ relations: { profiles: true }}) 
            //아래 1번째 arg인 u는 테이블 Alias, 2번째는 테이블명 또는 Alias (u.가 없으면 join없이 select됨)
            //아래 2번째 arg는 다른 테이블명이 아닌 무의미한 값이 들어가도 innerjoin 제대로 됨 (다른 테이블명 들어가면 안됨) : 따라서, 같은 이름으로 넣기로 함 u.profile, profile
            //아래 Join은 user기준으로 (user가 마스터) 나오는 것이므로 profiles 있는 것은 user.profiles로 2개 이상 붙어서 나올 수 있음
            const list = await this.userRepo.createQueryBuilder('u').innerJoinAndSelect("u.profiles", 'profile').getMany()            
            //const list = await this.userRepo.createQueryBuilder('u').leftJoinAndSelect("u.profiles", 'profile').getMany()
            console.log(JSON.stringify(list))
            if (!list) return hush.setResJson(resJson, hush.Msg.NOT_FOUND, hush.Code.NOT_FOUND, this.req)
            resJson.list = list

            // const photo = new Photo()
            // photo.ID = "c"
            // photo.NM = "ccc"

            // const metadata = new PhotoMeta()
            // metadata.ID = '333'
            // metadata.COMMENT = '333'
            // metadata.photo = photo

            // await this.photoRepo.save(photo)
            // await this.photometaRepo.save(metadata)

            // const photo1 = new Profile()
            // photo1.ID = "hbcho1"
            // photo1.NM = '조현빈'
            // photo1.USER_ID = "hbcho"
            // await this.profileRepo.save(photo1)

            // const photo2 = new Profile()
            // photo2.ID = "hbcho2"
            // photo2.NM = '조현빈'
            // photo2.USER_ID = "hbcho"
            // await this.profileRepo.save(photo2)

            // const user = new User()
            // user.USER_ID = "hbcho"
            // user.USER_NM = '조현빈'
            // user.profiles = [photo1, photo2]
            // await this.userRepo.save(user)

            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }            
    }

}
