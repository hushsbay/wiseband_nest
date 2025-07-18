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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrDtl = exports.GrMst = exports.ChanDtl = exports.ChanMst = exports.MsgDtl = exports.MsgSub = exports.MsgMst = void 0;
const typeorm_1 = require("typeorm");
let MsgMst = class MsgMst {
};
exports.MsgMst = MsgMst;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgMst.prototype, "CHANID", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgMst.prototype, "MSGID", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgMst.prototype, "AUTHORID", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgMst.prototype, "AUTHORNM", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgMst.prototype, "BODY", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgMst.prototype, "BODYTEXT", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgMst.prototype, "REPLYTO", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgMst.prototype, "KIND", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgMst.prototype, "CDT", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgMst.prototype, "UDT", void 0);
exports.MsgMst = MsgMst = __decorate([
    (0, typeorm_1.Entity)({ name: 'S_MSGMST_TBL' })
], MsgMst);
let MsgSub = class MsgSub {
};
exports.MsgSub = MsgSub;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgSub.prototype, "CHANID", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgSub.prototype, "MSGID", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgSub.prototype, "KIND", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgSub.prototype, "CDT", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgSub.prototype, "BODY", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], MsgSub.prototype, "FILESIZE", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgSub.prototype, "FILEEXT", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Buffer)
], MsgSub.prototype, "BUFFER", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgSub.prototype, "UDT", void 0);
exports.MsgSub = MsgSub = __decorate([
    (0, typeorm_1.Entity)({ name: 'S_MSGSUB_TBL' })
], MsgSub);
let MsgDtl = class MsgDtl {
};
exports.MsgDtl = MsgDtl;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgDtl.prototype, "MSGID", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgDtl.prototype, "CHANID", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgDtl.prototype, "USERID", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgDtl.prototype, "KIND", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgDtl.prototype, "SUBKIND", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgDtl.prototype, "TYP", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MsgDtl.prototype, "CDT", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgDtl.prototype, "BODY", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgDtl.prototype, "UDT", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MsgDtl.prototype, "USERNM", void 0);
exports.MsgDtl = MsgDtl = __decorate([
    (0, typeorm_1.Entity)({ name: 'S_MSGDTL_TBL' })
], MsgDtl);
let ChanMst = class ChanMst {
};
exports.ChanMst = ChanMst;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ChanMst.prototype, "CHANID", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanMst.prototype, "TYP", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanMst.prototype, "CHANNM", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanMst.prototype, "GR_ID", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanMst.prototype, "MASTERID", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanMst.prototype, "MASTERNM", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanMst.prototype, "STATE", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanMst.prototype, "ISUR", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanMst.prototype, "CDT", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanMst.prototype, "MODR", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanMst.prototype, "UDT", void 0);
exports.ChanMst = ChanMst = __decorate([
    (0, typeorm_1.Entity)({ name: 'S_CHANMST_TBL' })
], ChanMst);
let ChanDtl = class ChanDtl {
};
exports.ChanDtl = ChanDtl;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "CHANID", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "USERID", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "USERNM", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "STATE", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "KIND", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "NOTI", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "BOOKMARK", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "SYNC", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "ISUR", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "CDT", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "MODR", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChanDtl.prototype, "UDT", void 0);
exports.ChanDtl = ChanDtl = __decorate([
    (0, typeorm_1.Entity)({ name: 'S_CHANDTL_TBL' })
], ChanDtl);
let GrMst = class GrMst {
};
exports.GrMst = GrMst;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], GrMst.prototype, "GR_ID", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrMst.prototype, "GR_NM", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrMst.prototype, "MASTERID", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrMst.prototype, "MASTERNM", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrMst.prototype, "ISUR", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrMst.prototype, "CDT", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrMst.prototype, "MODR", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrMst.prototype, "UDT", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => GrDtl, (dtl) => dtl.mst),
    __metadata("design:type", Array)
], GrMst.prototype, "dtl", void 0);
exports.GrMst = GrMst = __decorate([
    (0, typeorm_1.Entity)({ name: 'S_GRMST_TBL' })
], GrMst);
let GrDtl = class GrDtl {
};
exports.GrDtl = GrDtl;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], GrDtl.prototype, "GR_ID", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], GrDtl.prototype, "USERID", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "USERNM", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "KIND", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "ORG", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "JOB", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "EMAIL", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "TELNO", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "RMKS", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "SYNC", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "ISUR", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "CDT", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "MODR", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GrDtl.prototype, "UDT", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => GrMst, (mst) => mst.dtl),
    (0, typeorm_1.JoinColumn)({ name: 'GR_ID' }),
    __metadata("design:type", GrMst)
], GrDtl.prototype, "mst", void 0);
exports.GrDtl = GrDtl = __decorate([
    (0, typeorm_1.Entity)({ name: 'S_GRDTL_TBL' })
], GrDtl);
//# sourceMappingURL=chanmsg.entity.js.map