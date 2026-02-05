import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MapModule } from './map/map.module';
import { ChartModule } from './chart/chart.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MapModule,
    ChartModule, // ✅ 여기로 합침
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
