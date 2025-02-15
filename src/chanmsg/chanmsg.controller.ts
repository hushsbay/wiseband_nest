import { Controller, HttpCode, HttpStatus, Post, Body, UseInterceptors, UploadedFile, Get, Query, Res, StreamableFile } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'

import { ChanmsgService } from './chanmsg.service'
import { ResJson } from 'src/common/resjson'
import { createReadStream, createWriteStream } from 'fs'

@Controller('chanmsg')
export class ChanmsgController {

    constructor(private readonly chanmsgService: ChanmsgService) {}

    @HttpCode(HttpStatus.OK)
    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.chanmsgService.qry(dto) }

    @HttpCode(HttpStatus.OK)
    @Post('saveMsg')
    saveMsg(@Body() dto: Record<string, any>) { return this.chanmsgService.saveMsg(dto) }

    @Post('uploadBlob')
    @UseInterceptors(FileInterceptor('file'))
    uploadBlob(@Body() dto: Record<string, any>, @UploadedFile() file: Express.Multer.File) {
        return this.chanmsgService.uploadBlob(dto, file)
    }

    @HttpCode(HttpStatus.OK)
    @Post('delBlob')
    delBlob(@Body() dto: Record<string, any>) { return this.chanmsgService.delBlob(dto) }

    @Get('readBlob')
    // async readBlob(@Query() dto: Record<string, any>): Promise<StreamableFile>  { 
    //     const rs = await this.chanmsgService.readBlob(dto) as ResJson
    //     const buf = Buffer.from(new Uint8Array(rs.data.BUFFER))
    //     const file = createReadStream(buf)
    //     return new StreamableFile(file)
    // }
    async readBlob(@Query() dto: Record<string, any>, @Res() res: Response) { 
        const rs = await this.chanmsgService.readBlob(dto) //as ResJson //Promise
        const buf = Buffer.from(new Uint8Array(rs.data.BUFFER))
        const filename = 'aaa.js'
        const filePath = 'd:/temp/' + filename
        const writer = createWriteStream(filePath)
        writer.write(buf)
        writer.end()
        writer.on("finish", () => { 
            //res. .setHeader('Content-type', 'text/plain')
            // res.download(filePath, filename, (err) => { //res.setHeader('Content-disposition', 'attachment; filename=' + filename)
            //     if (err) console.log("@@@@@"+err)
            //     //fs.unlink(filePath, () => { })
            // })
            //https://stackoverflow.com/questions/72404025/download-a-file-from-nestjs-without-saving-it
            console.log("@@@@@end@@@")
        })
    }

}
