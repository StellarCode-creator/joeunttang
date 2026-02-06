// backend/src/domains/apt-trade/apt-trade.module.ts
import { Module } from '@nestjs/common';
import { AptTradeController } from './apt-trade.controller';

@Module({
  controllers: [AptTradeController],
})
export class AptTradeModule {}
