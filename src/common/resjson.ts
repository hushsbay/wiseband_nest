export class ResJson {
    
    code: string //number 아닌 string : 클라이언트에서 rs.code.startsWith()처럼 number보다 string이 개발 효율적 (sendjay도 이미 string이므로 통합)
    msg: string
    data: any //서버에서 object로 리턴되는 데이터 (예: jwt token)
    list: any //리턴되는 object중에서 특히, list(array)로 리턴되는 데이터
    
    constructor(code = '0', msg = '', data = {}, list = []) {
        this.code = code
        this.msg = msg
        this.data = data
        this.list = list
    }
    
}
