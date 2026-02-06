// backend/src/domains/apt-rent/apt-rent.module.ts
import { Module } from '@nestjs/common';
import { AptRentController } from './apt-rent.controller';

@Module({
  controllers: [AptRentController],
})
export class AptRentModule {}
