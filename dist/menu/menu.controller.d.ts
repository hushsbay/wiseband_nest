import { MenuService } from 'src/menu/menu.service';
export declare class MenuController {
    private readonly menuSvc;
    constructor(menuSvc: MenuService);
    qry(dto: Record<string, any>): Promise<any>;
    qryChan(dto: Record<string, any>): Promise<any>;
    qryDm(dto: Record<string, any>): Promise<any>;
    qryDmChkExist(dto: Record<string, any>): Promise<any>;
    qryActivity(dto: Record<string, any>): Promise<any>;
    qryPanel(dto: Record<string, any>): Promise<any>;
    qryKindCnt(dto: Record<string, any>): Promise<any>;
    qryPanelCount(dto: Record<string, any>): Promise<any>;
    qryGroup(dto: Record<string, any>): Promise<any>;
}
