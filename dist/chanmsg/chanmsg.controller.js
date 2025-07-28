"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChanmsgController = void 0;
const common_1 = require("@nestjs/common");
const multer_1 = require("@nestjs/platform-express/multer");
const fs_1 = require("fs");
const mime = require("mime-types");
const config_1 = require("@nestjs/config");
const hush = require("../common/common");
const chanmsg_service_1 = require("./chanmsg.service");
let ChanmsgController = class ChanmsgController {
    constructor(chanmsgSvc, configService) {
        this.chanmsgSvc = chanmsgSvc;
        this.configService = configService;
    }
    qry(dto) { return this.chanmsgSvc.qry(dto); }
    qryChanMstDtl(dto) { return this.chanmsgSvc.qryChanMstDtl(dto); }
    qryOneMsgNotYet(dto) { return this.chanmsgSvc.qryOneMsgNotYet(dto); }
    qryMsg(dto) { return this.chanmsgSvc.qryMsg(dto); }
    searchMedia(dto) { return this.chanmsgSvc.searchMedia(dto); }
    searchMsg(dto) { return this.chanmsgSvc.searchMsg(dto); }
    qryActionForUser(dto) { return this.chanmsgSvc.qryActionForUser(dto); }
    qryAction(dto) { return this.chanmsgSvc.qryAction(dto); }
    saveMsg(dto) { return this.chanmsgSvc.saveMsg(dto); }
    forwardToChan(dto) { return this.chanmsgSvc.forwardToChan(dto); }
    delMsg(dto) { return this.chanmsgSvc.delMsg(dto); }
    toggleChanOption(dto) { return this.chanmsgSvc.toggleChanOption(dto); }
    updateWithNewKind(dto) { return this.chanmsgSvc.updateWithNewKind(dto); }
    updateNotyetToRead(dto) { return this.chanmsgSvc.updateNotyetToRead(dto); }
    updateAllWithNewKind(dto) { return this.chanmsgSvc.updateAllWithNewKind(dto); }
    toggleReaction(dto) { return this.chanmsgSvc.toggleReaction(dto); }
    changeAction(dto) { return this.chanmsgSvc.changeAction(dto); }
    uploadBlob(dto, file) {
        return this.chanmsgSvc.uploadBlob(dto, file);
    }
    delBlob(dto) { return this.chanmsgSvc.delBlob(dto); }
    saveChan(dto) { return this.chanmsgSvc.saveChan(dto); }
    deleteChan(dto) { return this.chanmsgSvc.deleteChan(dto); }
    saveChanMember(dto) { return this.chanmsgSvc.saveChanMember(dto); }
    deleteChanMember(dto) { return this.chanmsgSvc.deleteChanMember(dto); }
    inviteToMember(dto) { return this.chanmsgSvc.inviteToMember(dto); }
    qryDataLogEach(dto) { return this.chanmsgSvc.qryDataLogEach(dto); }
    async readBlob(dto, res) {
        try {
            const filename = dto.name;
            const rs = await this.chanmsgSvc.readBlob(dto);
            if (rs.code != hush.Code.OK) {
                return;
            }
            const buf = Buffer.from(new Uint8Array(rs.data.BUFFER));
            const filePath = this.configService.get('FILE_DOWN_TEMP_FOLDER') + filename;
            const writer = (0, fs_1.createWriteStream)(filePath);
            writer.write(buf);
            writer.end();
            writer.on("finish", () => {
                res.setHeader('Content-Type', mime.lookup(filename));
                res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(filename) + '"');
                res.download(filePath, filename, (err) => {
                    if (err) {
                        return;
                    }
                    (0, fs_1.unlink)(filePath, () => { });
                });
            });
        }
        catch (ex) {
            hush.throwHttpEx(ex.message);
        }
    }
    async readBlob1(dto, res) {
        try {
            const rs = await this.chanmsgSvc.readBlob(dto);
            const buf = Buffer.from(new Uint8Array(rs.data.BUFFER));
            const filename = '111.png';
            const filePath = 'd:/temp/' + filename;
            res.set({
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="${filename}"`,
            });
            const fileStream = await this.makeFile(filePath, buf);
            return new common_1.StreamableFile(fileStream);
        }
        catch (ex) {
            console.log("@@@" + ex.toString());
        }
    }
    makeFile(filepath, buf) {
        return new Promise((resolve) => {
            const writer = (0, fs_1.createWriteStream)(filepath);
            writer.write(buf);
            writer.end();
            writer.on("finish", () => {
                const filestream = (0, fs_1.createReadStream)(filepath);
                resolve(filestream);
            });
        });
    }
};
exports.ChanmsgController = ChanmsgController;
__decorate([
    (0, common_1.Post)('qry'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "qry", null);
__decorate([
    (0, common_1.Post)('qryChanMstDtl'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "qryChanMstDtl", null);
__decorate([
    (0, common_1.Post)('qryOneMsgNotYet'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "qryOneMsgNotYet", null);
__decorate([
    (0, common_1.Post)('qryMsg'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "qryMsg", null);
__decorate([
    (0, common_1.Post)('searchMedia'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "searchMedia", null);
__decorate([
    (0, common_1.Post)('searchMsg'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "searchMsg", null);
__decorate([
    (0, common_1.Post)('qryActionForUser'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "qryActionForUser", null);
__decorate([
    (0, common_1.Post)('qryAction'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "qryAction", null);
__decorate([
    (0, common_1.Post)('saveMsg'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "saveMsg", null);
__decorate([
    (0, common_1.Post)('forwardToChan'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "forwardToChan", null);
__decorate([
    (0, common_1.Post)('delMsg'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "delMsg", null);
__decorate([
    (0, common_1.Post)('toggleChanOption'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "toggleChanOption", null);
__decorate([
    (0, common_1.Post)('updateWithNewKind'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "updateWithNewKind", null);
__decorate([
    (0, common_1.Post)('updateNotyetToRead'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "updateNotyetToRead", null);
__decorate([
    (0, common_1.Post)('updateAllWithNewKind'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "updateAllWithNewKind", null);
__decorate([
    (0, common_1.Post)('toggleReaction'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "toggleReaction", null);
__decorate([
    (0, common_1.Post)('changeAction'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "changeAction", null);
__decorate([
    (0, common_1.Post)('uploadBlob'),
    (0, common_1.UseInterceptors)((0, multer_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "uploadBlob", null);
__decorate([
    (0, common_1.Post)('delBlob'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "delBlob", null);
__decorate([
    (0, common_1.Post)('saveChan'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "saveChan", null);
__decorate([
    (0, common_1.Post)('deleteChan'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "deleteChan", null);
__decorate([
    (0, common_1.Post)('saveChanMember'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "saveChanMember", null);
__decorate([
    (0, common_1.Post)('deleteChanMember'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "deleteChanMember", null);
__decorate([
    (0, common_1.Post)('inviteToMember'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "inviteToMember", null);
__decorate([
    (0, common_1.Post)('qryDataLogEach'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChanmsgController.prototype, "qryDataLogEach", null);
__decorate([
    (0, common_1.Get)('readBlob'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChanmsgController.prototype, "readBlob", null);
__decorate([
    (0, common_1.Get)('readBlob1'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChanmsgController.prototype, "readBlob1", null);
exports.ChanmsgController = ChanmsgController = __decorate([
    (0, common_1.Controller)('chanmsg'),
    __metadata("design:paramtypes", [chanmsg_service_1.ChanmsgService, config_1.ConfigService])
], ChanmsgController);
//# sourceMappingURL=chanmsg.controller.js.map