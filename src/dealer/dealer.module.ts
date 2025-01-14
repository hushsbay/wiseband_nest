import { Module, Logger } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Dealer } from 'src/dealer/dealer.entity'
import { DealerService } from 'src/dealer/dealer.service'
import { DealerController } from 'src/dealer/dealer.controller'

@Module({
    imports: [TypeOrmModule.forFeature([Dealer])],
    controllers: [DealerController],
    providers: [DealerService, Logger]
})

export class DealerModule {}
