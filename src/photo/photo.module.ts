import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'
import { Photo } from 'src/photo/photo.entity'
import { PhotoMeta } from 'src/photometa/photometa.entity'
import { PhotoService } from 'src/photo/photo.service'
import { PhotoController } from 'src/photo/photo.controller'

@Module({
    imports: [TypeOrmModule.forFeature([Photo, PhotoMeta])],
    controllers: [PhotoController],
    providers: [PhotoService],
})
export class PhotoModule {}
