// backend/src/domains/apt-trade/apt-trade.controller.ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { getPool } from '../../db';
import { toNum, DEAL_DATE_EXPR, JIBUN_OPT_FILTER_T, PARAM_DATE_EXPR } from '../apt/apt.shared';

type TradeClusterRow = {
  lawd_cd: string;
  umd_nm: string;
  apt_nm: string;
  lat: number;
  lng: number;
  trade_cnt: number;
  min_price: number;
  max_price: number;
  last_trade_ymd: string | null;
};

type RecentTradeRow = {
  id: string;
  deal_ymd: string | null;
  deal_amount_manwon: number | null;
  exclu_use_ar: number | null;
  floor: number | null;
  deal_dong: string | null;
  rgst_date: string | null;
};

type AptInfoRow = {
  lawd_cd: string | null;
  umd_nm: string | null;
  apt_nm: string | null;
  jibun: string | null;
};

type Last3mRow = { avg_price: number | null; cnt: number | null };
type SeriesRow = { ym: string; avg_price: number | null; cnt: number | null };

@Controller('api/map')
export class AptTradeController {
  // ✅ 매매 클러스터 (기존 경로 유지)
  @Get('trades')
  async trades(
    @Query('minLng') minLngS: string,
    @Query('minLat') minLatS: string,
    @Query('maxLng') maxLngS: string,
    @Query('maxLat') maxLatS: string,
    @Query('limit') limitS?: string,
  ) {
    const swLng = toNum(minLngS);
    const swLat = toNum(minLatS);
    const neLng = toNum(maxLngS);
    const neLat = toNum(maxLatS);
    const limit = Math.min(Math.max(toNum(limitS) ?? 1200, 1), 5000);

    if (swLng === null || swLat === null || neLng === null || neLat === null) {
      throw new BadRequestException('Invalid bbox');
    }

    const pool = getPool();

    const sql = `
      WITH rep_location AS (
        SELECT DISTINCT ON (lawd_cd, apt_nm)
          lawd_cd, apt_nm, umd_nm, lat, lng
        FROM apt_location
        WHERE lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY lawd_cd, apt_nm, id
      )
      SELECT
        t.lawd_cd,
        rl.umd_nm,
        t.apt_nm,
        rl.lat,
        rl.lng,
        COUNT(*)::int AS trade_cnt,
        MIN(t.deal_amount_manwon)::int AS min_price,
        MAX(t.deal_amount_manwon)::int AS max_price,
        MAX(t.deal_ymd) AS last_trade_ymd
      FROM apt_trade t
      JOIN rep_location rl
        ON t.lawd_cd = rl.lawd_cd
       AND t.apt_nm = rl.apt_nm
      WHERE
        rl.lat BETWEEN $1 AND $2
        AND rl.lng BETWEEN $3 AND $4
        AND (${DEAL_DATE_EXPR}) >= (CURRENT_DATE - INTERVAL '3 months')
      GROUP BY t.lawd_cd, rl.umd_nm, t.apt_nm, rl.lat, rl.lng
      ORDER BY MAX(${DEAL_DATE_EXPR}) DESC NULLS LAST
      LIMIT $5;
    `;

    const { rows } = await pool.query<TradeClusterRow>(sql, [swLat, neLat, swLng, neLng, limit]);

    return {
      ok: true,
      items: rows.map((r) => ({
        lawdCd: String(r.lawd_cd ?? '').trim(),
        umdNm: String(r.umd_nm ?? '').trim(),
        aptNm: String(r.apt_nm ?? '').trim(),
        lat: Number(r.lat),
        lng: Number(r.lng),
        tradeCnt: Number(r.trade_cnt),
        minPrice: Number(r.min_price),
        maxPrice: Number(r.max_price),
        lastTradeYmd: r.last_trade_ymd ? String(r.last_trade_ymd).trim() : '',
      })),
    };
  }

  // ✅ 매매 상세 리스트 (기존 경로 유지)
  @Get('apt/recent-trades')
  async recentTrades(
    @Query('lawdCd') lawdCd: string,
    @Query('aptNm') aptNm: string,
    @Query('jibun') jibun: string,
    @Query('limit') limitS?: string,
    @Query('fromYmd') fromYmd?: string,
    @Query('toYmd') toYmd?: string,
  ) {
    const limit = Math.min(Math.max(toNum(limitS) ?? 5, 1), 5000);
    if (!lawdCd || !aptNm) throw new BadRequestException('lawdCd and aptNm are required');

    const pool = getPool();

    const sql = `
      WITH p AS (
        SELECT
          ${PARAM_DATE_EXPR(5)} AS from_d,
          ${PARAM_DATE_EXPR(6)} AS to_d
      )
      SELECT
        t.id::text AS id,
        t.deal_ymd,
        t.deal_amount_manwon,
        t.exclu_use_ar,
        t.floor,
        NULLIF(btrim(t.apt_dong::text), '') AS deal_dong,
        NULLIF(btrim(t.rgst_date::text), '') AS rgst_date
      FROM apt_trade t
      CROSS JOIN p
      WHERE
        t.lawd_cd = $1
        AND t.apt_nm = $2
        AND ${JIBUN_OPT_FILTER_T}
        AND (
          (p.from_d IS NULL AND p.to_d IS NULL AND (${DEAL_DATE_EXPR}) >= (CURRENT_DATE - INTERVAL '3 months'))
          OR (
            (p.from_d IS NULL OR (${DEAL_DATE_EXPR}) >= p.from_d)
            AND (p.to_d IS NULL OR (${DEAL_DATE_EXPR}) <= p.to_d)
          )
        )
      ORDER BY (${DEAL_DATE_EXPR}) DESC NULLS LAST, t.deal_ymd DESC
      LIMIT $4;
    `;

    const { rows } = await pool.query<RecentTradeRow>(sql, [
      lawdCd,
      aptNm,
      jibun ?? '',
      limit,
      fromYmd ?? '',
      toYmd ?? '',
    ]);

    return {
      ok: true,
      items: rows.map((r) => {
        const rgst = r.rgst_date ? String(r.rgst_date).trim() : '';
        return {
          id: r.id,
          dealYmd: r.deal_ymd,
          amountManwon: r.deal_amount_manwon,
          excluUseAr: r.exclu_use_ar === null ? null : Number(r.exclu_use_ar),
          floor: r.floor === null ? null : Number(r.floor),
          dealDong: r.deal_dong === null ? null : String(r.deal_dong),
          isRegistered: rgst ? true : null,
        };
      }),
    };
  }

  // ✅ 매매 요약 + 월별 추이 (기존 경로 유지)
  @Get('apt/summary')
  async summary(@Query('lawdCd') lawdCd: string, @Query('aptNm') aptNm: string, @Query('jibun') jibun: string) {
    if (!lawdCd || !aptNm) throw new BadRequestException('lawdCd and aptNm are required');

    const pool = getPool();

    const aptSql = `
      SELECT
        t.lawd_cd,
        MAX(t.umd_nm) AS umd_nm,
        t.apt_nm,
        btrim(COALESCE($3, '')) AS jibun
      FROM apt_trade t
      WHERE
        t.lawd_cd = $1
        AND t.apt_nm = $2
        AND ${JIBUN_OPT_FILTER_T}
      GROUP BY t.lawd_cd, t.apt_nm, btrim(COALESCE($3, ''))
      LIMIT 1;
    `;

    const last3mSql = `
      SELECT
        COALESCE(ROUND(AVG(t.deal_amount_manwon))::int, 0) AS avg_price,
        COUNT(*)::int AS cnt
      FROM apt_trade t
      WHERE
        t.lawd_cd = $1
        AND t.apt_nm = $2
        AND ${JIBUN_OPT_FILTER_T}
        AND (${DEAL_DATE_EXPR}) >= (CURRENT_DATE - INTERVAL '3 months');
    `;

    const seriesSql = `
      SELECT
        to_char(date_trunc('month', (${DEAL_DATE_EXPR})), 'YYYYMM') AS ym,
        ROUND(AVG(t.deal_amount_manwon))::int AS avg_price,
        COUNT(*)::int AS cnt
      FROM apt_trade t
      WHERE
        t.lawd_cd = $1
        AND t.apt_nm = $2
        AND ${JIBUN_OPT_FILTER_T}
        AND (${DEAL_DATE_EXPR}) >= (date_trunc('month', CURRENT_DATE) - INTERVAL '35 months')
        AND (${DEAL_DATE_EXPR}) IS NOT NULL
      GROUP BY ym
      ORDER BY ym ASC;
    `;

    const [aptR, last3mR, seriesR] = await Promise.all([
      pool.query<AptInfoRow>(aptSql, [lawdCd, aptNm, jibun ?? '']),
      pool.query<Last3mRow>(last3mSql, [lawdCd, aptNm, jibun ?? '']),
      pool.query<SeriesRow>(seriesSql, [lawdCd, aptNm, jibun ?? '']),
    ]);

    const apt = aptR.rows[0];
    const last3m = last3mR.rows[0];

    return {
      ok: true,
      apt: {
        lawdCd: apt?.lawd_cd ?? lawdCd,
        umdNm: apt?.umd_nm ?? '',
        aptNm: apt?.apt_nm ?? aptNm,
        jibun: apt?.jibun ?? (jibun ?? ''),
      },
      last3m: {
        avgPrice: Number(last3m?.avg_price ?? 0),
        cnt: Number(last3m?.cnt ?? 0),
      },
      series: (seriesR.rows ?? []).map((r) => ({
        ym: String(r.ym),
        avgPrice: Number(r.avg_price ?? 0),
        cnt: Number(r.cnt ?? 0),
      })),
    };
  }
}
