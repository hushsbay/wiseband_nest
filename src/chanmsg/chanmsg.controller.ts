import { Controller, HttpCode, HttpStatus, Post, Body, UseInterceptors, UploadedFile, Get, Query, Res, StreamableFile } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'
import { Response } from 'express'

import { ChanmsgService } from './chanmsg.service'
import { createReadStream, createWriteStream, ReadStream, unlink } from 'fs'

@Controller('chanmsg')
export class ChanmsgController {

    constructor(private readonly chanmsgService: ChanmsgService) {}

    //@HttpCode(HttpStatus.OK)
    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.chanmsgService.qry(dto) }

    //@HttpCode(HttpStatus.OK)
    @Post('saveMsg')
    saveMsg(@Body() dto: Record<string, any>) { return this.chanmsgService.saveMsg(dto) }

    @Post('uploadBlob')
    @UseInterceptors(FileInterceptor('file'))
    uploadBlob(@Body() dto: Record<string, any>, @UploadedFile() file: Express.Multer.File) {
        return this.chanmsgService.uploadBlob(dto, file)
    }

    //@HttpCode(HttpStatus.OK)
    @Post('delBlob')
    delBlob(@Body() dto: Record<string, any>) { return this.chanmsgService.delBlob(dto) }

    @Get('readBlob2') //readBlob1보다 안정적임. 그러나, 파일 만들지 않고 바로 res.download로 가는 pipe 메소드 구현해야 할 것임
    async readBlob2(@Query() dto: Record<string, any>, @Res() res: Response) { 
        const rs = await this.chanmsgService.readBlob(dto) //as ResJson //Promise
        const buf = Buffer.from(new Uint8Array(rs.data.BUFFER))
        const filename = '111.png'
        const filePath = 'd:/temp/' + filename
        const writer = createWriteStream(filePath)
        writer.write(buf)
        writer.end()
        writer.on("finish", () => { 
            res.setHeader('Content-Type', 'image/png')
            res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"')
            res.download(filePath, filename, (err) => {
                if (err) console.log("!!!!!!!"+err)
                unlink(filePath, () => { })
                console.log("finished")
            })
            //https://stackoverflow.com/questions/72404025/download-a-file-from-nestjs-without-saving-it
            console.log("@@@@@end@@@")
        })
    }

    @Get('readBlob1')
    async readBlob1(@Query() dto: Record<string, any>, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> { //passthrough 없으면 pending.
        try {
            const rs = await this.chanmsgService.readBlob(dto) //as ResJson //Promise
            const buf = Buffer.from(new Uint8Array(rs.data.BUFFER))
            const filename = '111.png'
            const filePath = 'd:/temp/' + filename
            res.set({
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="${filename}"`,
            });
            const fileStream = await this.makeFile(filePath, buf)
            return new StreamableFile(fileStream); //unlink가 불가능할 수도? => StreamableFile이 메모리에 모두 올려 놓고 스트리밍을 할 것 같지 않아서 unlink하려면 오류날 수도??!!
        } catch (ex) {
            console.log("@@@@@end@@@" + ex.toString())
        }        
    }

    makeFile(filepath: string, buf: Buffer<Uint8Array<any>>): Promise<ReadStream> { //buf: Uint8Array<ArrayBufferLike>도 ok
        return new Promise((resolve, reject) => {
            const writer = createWriteStream(filepath)
            writer.write(buf)
            writer.end()
            writer.on("finish", () => { 
                console.log("22222222222222222222")
                // const fileStream = createReadStream(filepath);
                // fileStream.on('end', () => {
                //     try {
                //         //unlink(filePath, () => { })
                //         console.log("OKOOKOKOKOKOKOK")
                //         resolve(fileStream)
                //     } catch (err) {
                //         reject(err)
                //     }
                // }); 
                const filestream = createReadStream(filepath); //원래 node.js에서처럼 fileStream.on('end', () => { 사용하지 않음
                resolve(filestream)
                console.log("555555555")           
                
            })
        })
    }

    @Get('readBlob')
    async readBlob(@Query() dto: Record<string, any>, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> { //passthrough 없으면 pending.
        try {
            const rs = await this.chanmsgService.readBlob(dto) //as ResJson //Promise
            const buf = Buffer.from(new Uint8Array(rs.data.BUFFER))
            const filename = '111.png'
            const filePath = 'd:/temp/' + filename
            const stream = res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="${filename}"`,
            });
            const fileStream = await this.makeFile(filePath, buf)
            return new StreamableFile(fileStream); //unlink가 불가능할 수도? => StreamableFile이 메모리에 모두 올려 놓고 스트리밍을 할 것 같지 않아서 unlink하려면 오류날 수도??!!
        } catch (ex) {
            console.log("@@@@@end@@@" + ex.toString())
        }        
    }

}
