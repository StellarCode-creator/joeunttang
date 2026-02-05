import { Module } from '@nestjs/common';
import { ChartController } from './chart.controller';

@Module({
  controllers: [ChartController],
})
export class ChartModule {}
