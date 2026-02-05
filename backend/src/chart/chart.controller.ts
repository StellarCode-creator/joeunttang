import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { getPool } from '../db';

@Controller('api/chart')
export class ChartController {
  @Get('apt-price')
  async aptPriceChart(@Query('aptNm') aptNm: string) {
    if (!aptNm) throw new BadRequestException('aptNm is required');

    const pool = getPool();

    const sql = `
      SELECT
        deal_year,
        deal_month,
        ROUND(AVG(deal_amount_manwon))::int AS avg_price,
        COUNT(*)::int AS cnt
      FROM apt_trade
      WHERE
        apt_nm = $1
        AND deal_year IS NOT NULL
        AND deal_month IS NOT NULL
      GROUP BY deal_year, deal_month
      ORDER BY deal_year, deal_month;
    `;

    const { rows } = await pool.query(sql, [aptNm]);

    return {
      ok: true,
      series: rows.map((r: any) => ({
        ym: String(r.deal_year) + String(r.deal_month).padStart(2, '0'),
        avgPrice: Number(r.avg_price),
        cnt: Number(r.cnt),
      })),
    };
  }
}
