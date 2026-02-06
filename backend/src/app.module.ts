// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MapModule } from './map/map.module';
import { ChartModule } from './chart/chart.module';
import { AptTradeModule } from './domains/apt-trade/apt-trade.module';
import { AptRentModule } from './domains/apt-rent/apt-rent.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MapModule, // tiles만
    AptTradeModule, // trades + apt/summary + apt/recent-trades
    AptRentModule, // rents + apt/rent-summary + apt/recent-rents
    ChartModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
