import { Controller, Post, Body, UseInterceptors, UploadedFile, Get, Query, Res, StreamableFile } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'
import { createReadStream, createWriteStream, ReadStream, unlink } from 'fs'
import * as mime from 'mime-types'
import { Response } from 'express'

import * as hush from 'src/common/common'
import { ChanmsgService } from './chanmsg.service'

@Controller('chanmsg')
export class ChanmsgController {

    constructor(private readonly chanmsgService: ChanmsgService) {}

    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.chanmsgService.qry(dto) }

    @Post('saveMsg')
    saveMsg(@Body() dto: Record<string, any>) { return this.chanmsgService.saveMsg(dto) }

    @Post('uploadBlob')
    @UseInterceptors(FileInterceptor('file'))
    uploadBlob(@Body() dto: Record<string, any>, @UploadedFile() file: Express.Multer.File) {
        return this.chanmsgService.uploadBlob(dto, file)
    }

    @Post('delBlob')
    delBlob(@Body() dto: Record<string, any>) { return this.chanmsgService.delBlob(dto) }

    /////////////////////////////////////////////////////////////////////////////////////
    //readBlob1보다 안정적임. 파일 만들지 않고 바로 res.download로 가는 pipe는 메소드는 아직 구현하지 못함 (가능한지도 아직 모름)
    //그리고 또한, 대부분 db에는 파일을 저장하는 것을 권장하지 않으므로 일단 upload시 용량제한을 두기로 함
    @Get('readBlob')
    async readBlob(@Query() dto: Record<string, any>, @Res() res: Response) { //반환없음. express모듈의 Response임
        const filename = dto.name //console.log(filename, "##############")
        try {
            const rs = await this.chanmsgService.readBlob(dto) //as ResJson //Promise
            if (rs.code != hush.Code.OK) { //비즈니스로직 실패시 오류처리에 대한 부분 구현이 현재 어려움 (procDownloadFailure in common.ts 참조)
                hush.procDownloadFailure(res) //res.json(rs). ##1 procDownloadFailure()도 현재 제대로 안됨
                return
            }
            const buf = Buffer.from(new Uint8Array(rs.data.BUFFER))            
            const filePath = hush.cons.tempdir + filename
            const writer = createWriteStream(filePath)
            writer.write(buf)
            writer.end()
            writer.on("finish", () => { 
                res.setHeader('Content-Type', mime.lookup(filename))
                res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(filename) + '"')
                res.download(filePath, filename, (err) => {
                    if (err) { //##1 잘안되고 있음
                        hush.procDownloadFailure(res) //hush.throwHttpEx(err.toString())
                        return
                    }
                    unlink(filePath, () => {}) //오류든 아니든 temp file은 삭제
                })
            })
        } catch (ex) {
            hush.throwHttpEx(ex.message) //not throwCatchedEx()
        }
    }

    @Get('readBlob1') //동작은 잘되나 사용하지 말고 위 readBlob을 사용하기로 함
    //여기서 바로 unlink 불가능할 수도 있을 것임. StreamableFile이 메모리에 모두 올려 놓고 할 것 같지 않아서 unlink하려면 오류날 수도 있지 않을까 추정
    async readBlob1(@Query() dto: Record<string, any>, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> { //passthrough 없으면 pending
        try {
            const rs = await this.chanmsgService.readBlob(dto) //as ResJson //Promise
            const buf = Buffer.from(new Uint8Array(rs.data.BUFFER))
            const filename = '111.png'
            const filePath = 'd:/temp/' + filename
            res.set({
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="${filename}"`,
            });
            const fileStream = await this.makeFile(filePath, buf) //prompise가 아니고 callback이면 메소드의 아래 retrun이 꼬임
            return new StreamableFile(fileStream);
        } catch (ex) {
            console.log("@@@" + ex.toString())
        }        
    }

    makeFile(filepath: string, buf: Buffer<Uint8Array<any>>): Promise<ReadStream> { //buf: Uint8Array<ArrayBufferLike>도 ok
        return new Promise((resolve) => {
            const writer = createWriteStream(filepath)
            writer.write(buf)
            writer.end()
            writer.on("finish", () => { 
                const filestream = createReadStream(filepath); //원래 node.js에서처럼 fileStream.on('end', () => { 사용하지 않음
                resolve(filestream)
            })
        })
    }
    /////////////////////////////////////////////////////////////////////////////////////

}
