import { registerAs } from '@nestjs/config'

//https://suyeonme.tistory.com/109
export default registerAs('app', () => ({
    mysql: {
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
        username: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    },
    crypto: {
        key: process.env.CRYPTO_KEY
    },
    jwt: {
        key: process.env.JWT_KEY
    },
}))
