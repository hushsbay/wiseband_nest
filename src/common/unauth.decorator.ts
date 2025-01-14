import { SetMetadata } from '@nestjs/common'

export const IS_UNAUTH_KEY = 'isUnAuth'

export const Unauth = () => SetMetadata(IS_UNAUTH_KEY, true)