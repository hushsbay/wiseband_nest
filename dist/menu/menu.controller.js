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
exports.MenuController = void 0;
const common_1 = require("@nestjs/common");
const menu_service_1 = require("./menu.service");
let MenuController = class MenuController {
    constructor(menuSvc) {
        this.menuSvc = menuSvc;
    }
    qry(dto) { return this.menuSvc.qry(dto); }
    qryChan(dto) { return this.menuSvc.qryChan(dto); }
    qryDm(dto) { return this.menuSvc.qryDm(dto); }
    qryDmChkExist(dto) { return this.menuSvc.qryDmChkExist(dto); }
    qryActivity(dto) { return this.menuSvc.qryActivity(dto); }
    qryPanel(dto) { return this.menuSvc.qryPanel(dto); }
    qryKindCnt(dto) { return this.menuSvc.qryKindCnt(dto); }
    qryPanelCount(dto) { return this.menuSvc.qryPanelCount(dto); }
    qryGroup(dto) { return this.menuSvc.qryGroup(dto); }
};
exports.MenuController = MenuController;
__decorate([
    (0, common_1.Post)('qry'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MenuController.prototype, "qry", null);
__decorate([
    (0, common_1.Post)('qryChan'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MenuController.prototype, "qryChan", null);
__decorate([
    (0, common_1.Post)('qryDm'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MenuController.prototype, "qryDm", null);
__decorate([
    (0, common_1.Post)('qryDmChkExist'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MenuController.prototype, "qryDmChkExist", null);
__decorate([
    (0, common_1.Post)('qryActivity'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MenuController.prototype, "qryActivity", null);
__decorate([
    (0, common_1.Post)('qryPanel'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MenuController.prototype, "qryPanel", null);
__decorate([
    (0, common_1.Post)('qryKindCnt'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MenuController.prototype, "qryKindCnt", null);
__decorate([
    (0, common_1.Post)('qryPanelCount'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MenuController.prototype, "qryPanelCount", null);
__decorate([
    (0, common_1.Post)('qryGroup'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MenuController.prototype, "qryGroup", null);
exports.MenuController = MenuController = __decorate([
    (0, common_1.Controller)('menu'),
    __metadata("design:paramtypes", [menu_service_1.MenuService])
], MenuController);
//# sourceMappingURL=menu.controller.js.map