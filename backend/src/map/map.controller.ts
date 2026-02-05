// backend/src/map/map.controller.ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { getPool } from '../db';

function toNum(v: string | undefined) {
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const DEAL_DATE_EXPR = `
  CASE
    WHEN length(t.deal_ymd) = 8 THEN to_date(t.deal_ymd, 'YYYYMMDD')
    WHEN length(t.deal_ymd) = 6 THEN to_date(t.deal_ymd || '01', 'YYYYMMDD')
    ELSE NULL
  END
`;

const JIBUN_OPT_FILTER = `
  (
    btrim(COALESCE($3, '')) = ''
    OR btrim(COALESCE(t.jibun, '')) = btrim($3)
  )
`;

const PARAM_DATE_EXPR = (idx: number) => `
  CASE
    WHEN btrim(COALESCE($${idx}, '')) = '' THEN NULL
    WHEN length(btrim($${idx})) = 8 THEN to_date(btrim($${idx}), 'YYYYMMDD')
    WHEN length(btrim($${idx})) = 6 THEN to_date(btrim($${idx}) || '01', 'YYYYMMDD')
    ELSE NULL
  END
`;

@Controller('api/map')
export class MapController {
  @Get('trades')
  async trades(
    @Query('swLat') swLatS: string,
    @Query('swLng') swLngS: string,
    @Query('neLat') neLatS: string,
    @Query('neLng') neLngS: string,
    @Query('limit') limitS?: string,
  ) {
    const swLat = toNum(swLatS);
    const swLng = toNum(swLngS);
    const neLat = toNum(neLatS);
    const neLng = toNum(neLngS);
    const limit = Math.min(Math.max(toNum(limitS) ?? 400, 1), 1000);

    if (
      swLat === null ||
      swLng === null ||
      neLat === null ||
      neLng === null ||
      swLat > neLat ||
      swLng > neLng
    ) {
      throw new BadRequestException('Invalid bbox params');
    }

    const pool = getPool();

    const sql = `
      WITH rep_location AS (
        SELECT DISTINCT ON (lawd_cd, apt_nm)
          lawd_cd,
          apt_nm,
          umd_nm,
          lat,
          lng
        FROM apt_location
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
      ORDER BY last_trade_ymd DESC
      LIMIT $5;
    `;

    const { rows } = await pool.query(sql, [swLat, neLat, swLng, neLng, limit]);

    return {
      ok: true,
      items: rows.map((r: any) => ({
        lawdCd: String(r.lawd_cd ?? '').trim(),
        umdNm: String(r.umd_nm ?? '').trim(),
        aptNm: String(r.apt_nm ?? '').trim(),
        lat: Number(r.lat),
        lng: Number(r.lng),
        tradeCnt: Number(r.trade_cnt),
        minPrice: Number(r.min_price),
        maxPrice: Number(r.max_price),
        lastTradeYmd: String(r.last_trade_ymd ?? ''),
      })),
    };
  }

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

    const fromExpr = PARAM_DATE_EXPR(5);
    const toExpr = PARAM_DATE_EXPR(6);

    const sql = `
      WITH p AS (
        SELECT
          (${fromExpr}) AS from_d,
          (${toExpr}) AS to_d
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
        AND ${JIBUN_OPT_FILTER}
        AND (
          (p.from_d IS NULL AND p.to_d IS NULL AND (${DEAL_DATE_EXPR}) >= (CURRENT_DATE - INTERVAL '3 months'))
          OR
          (
            (p.from_d IS NULL OR (${DEAL_DATE_EXPR}) >= p.from_d)
            AND
            (p.to_d IS NULL OR (${DEAL_DATE_EXPR}) <= p.to_d)
          )
        )
      ORDER BY (${DEAL_DATE_EXPR}) DESC NULLS LAST, t.deal_ymd DESC
      LIMIT $4;
    `;

    const { rows } = await pool.query(sql, [
      lawdCd,
      aptNm,
      jibun ?? '',
      limit,
      fromYmd ?? '',
      toYmd ?? '',
    ]);

    return {
      ok: true,
      items: rows.map((r: any) => {
        const rgst = r.rgst_date ? String(r.rgst_date).trim() : '';
        return {
          id: r.id,
          dealYmd: r.deal_ymd,
          amountManwon: r.deal_amount_manwon,
          excluUseAr: r.exclu_use_ar === null ? null : Number(r.exclu_use_ar),
          floor: r.floor === null ? null : Number(r.floor),
          dealDong: r.deal_dong === null ? null : String(r.deal_dong),
          // ✅ rgst_date가 비어있으면 "미등기"로 확정하지 말고 "미확인(null)" 처리
          isRegistered: rgst ? true : null,
        };
      }),
    };
  }

  @Get('apt/summary')
  async aptSummary(
    @Query('lawdCd') lawdCd: string,
    @Query('aptNm') aptNm: string,
    @Query('jibun') jibun: string,
  ) {
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
        AND ${JIBUN_OPT_FILTER}
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
        AND ${JIBUN_OPT_FILTER}
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
        AND ${JIBUN_OPT_FILTER}
        AND (${DEAL_DATE_EXPR}) >= (date_trunc('month', CURRENT_DATE) - INTERVAL '35 months')
        AND (${DEAL_DATE_EXPR}) IS NOT NULL
      GROUP BY ym
      ORDER BY ym ASC;
    `;

    const [aptR, last3mR, seriesR] = await Promise.all([
      pool.query(aptSql, [lawdCd, aptNm, jibun ?? '']),
      pool.query(last3mSql, [lawdCd, aptNm, jibun ?? '']),
      pool.query(seriesSql, [lawdCd, aptNm, jibun ?? '']),
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
      series: (seriesR.rows ?? []).map((r: any) => ({
        ym: String(r.ym),
        avgPrice: Number(r.avg_price),
        cnt: Number(r.cnt),
      })),
    };
  }
}
