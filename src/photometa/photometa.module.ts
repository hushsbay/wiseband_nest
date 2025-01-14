import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'
import { Photo } from 'src/photo/photo.entity'
import { PhotoMeta } from 'src/photometa/photometa.entity'
import { PhotoMetaService } from './photometa.service';
import { PhotometaController } from './photometa.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Photo, PhotoMeta])],
    controllers: [PhotometaController],
    providers: [PhotoMetaService],
})
export class PhotometaModule {}
