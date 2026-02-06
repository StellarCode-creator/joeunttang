import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { getPool } from '../db';

type AptPriceRow = {
  deal_year: number;
  deal_month: number;
  avg_price: number;
  cnt: number;
};

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

    const { rows } = await pool.query<AptPriceRow>(sql, [aptNm]);

    return {
      ok: true,
      series: rows.map((r) => ({
        ym: String(r.deal_year) + String(r.deal_month).padStart(2, '0'),
        avgPrice: Number(r.avg_price),
        cnt: Number(r.cnt),
      })),
    };
  }

  // ✅ 전세 차트 (보증금 기준)
  @Get('apt-jeonse')
  async aptJeonseChart(@Query('aptNm') aptNm: string) {
    if (!aptNm) throw new BadRequestException('aptNm is required');

    const pool = getPool();

    const sql = `
      SELECT
        deal_year,
        deal_month,
        ROUND(AVG(deposit_manwon))::int AS avg_price,
        COUNT(*)::int AS cnt
      FROM apt_trade_rent
      WHERE
        apt_nm = $1
        AND deal_year IS NOT NULL
        AND deal_month IS NOT NULL
        AND COALESCE(monthly_rent_manwon, 0) = 0
        AND deposit_manwon IS NOT NULL
      GROUP BY deal_year, deal_month
      ORDER BY deal_year, deal_month;
    `;

    const { rows } = await pool.query<AptPriceRow>(sql, [aptNm]);

    return {
      ok: true,
      series: rows.map((r) => ({
        ym: String(r.deal_year) + String(r.deal_month).padStart(2, '0'),
        avgPrice: Number(r.avg_price),
        cnt: Number(r.cnt),
      })),
    };
  }

  // ✅ 월세 차트 (월세 기준, 원하면 보증금/월세 둘로 분리도 가능)
  @Get('apt-monthly')
  async aptMonthlyChart(@Query('aptNm') aptNm: string) {
    if (!aptNm) throw new BadRequestException('aptNm is required');

    const pool = getPool();

    const sql = `
      SELECT
        deal_year,
        deal_month,
        ROUND(AVG(monthly_rent_manwon))::int AS avg_price,
        COUNT(*)::int AS cnt
      FROM apt_trade_rent
      WHERE
        apt_nm = $1
        AND deal_year IS NOT NULL
        AND deal_month IS NOT NULL
        AND COALESCE(monthly_rent_manwon, 0) > 0
      GROUP BY deal_year, deal_month
      ORDER BY deal_year, deal_month;
    `;

    const { rows } = await pool.query<AptPriceRow>(sql, [aptNm]);

    return {
      ok: true,
      series: rows.map((r) => ({
        ym: String(r.deal_year) + String(r.deal_month).padStart(2, '0'),
        avgPrice: Number(r.avg_price),
        cnt: Number(r.cnt),
      })),
    };
  }
}
