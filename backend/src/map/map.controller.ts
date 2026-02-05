import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { getPool } from '../db';

function toNum(v: string | undefined) {
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * deal_ymd가 YYYYMMDD(8) 또는 YYYYMM(6)로 들어올 수 있어 안전하게 date로 변환
 * - 8자리: 그대로 YYYYMMDD
 * - 6자리: YYYYMM01로 간주
 */
const DEAL_DATE_EXPR = `
  CASE
    WHEN length(t.deal_ymd) = 8 THEN to_date(t.deal_ymd, 'YYYYMMDD')
    WHEN length(t.deal_ymd) = 6 THEN to_date(t.deal_ymd || '01', 'YYYYMMDD')
    ELSE NULL
  END
`;

/** jibun은 옵션 필터: 값이 비어있으면 무시, 있으면 trim 비교 */
const JIBUN_OPT_FILTER = `
  (
    btrim(COALESCE($3, '')) = ''
    OR btrim(COALESCE(t.jibun, '')) = btrim($3)
  )
`;

@Controller('api/map')
export class MapController {
  /**
   * ✅ 지도 클러스터(단지 목록)
   * - 지번으로 join 하지 않음
   * - 단지 식별은 (lawd_cd, apt_nm)
   * - 좌표는 apt_location에서 (lawd_cd, apt_nm) 대표 1건을 뽑아 사용
   */
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
        // ✅ 지번은 내려주지 않는다(단지 식별에 사용 금지)
        lat: Number(r.lat),
        lng: Number(r.lng),
        tradeCnt: Number(r.trade_cnt),
        minPrice: Number(r.min_price),
        maxPrice: Number(r.max_price),
        lastTradeYmd: String(r.last_trade_ymd ?? ''),
      })),
    };
  }

  // ✅ 단지 선택 후: 최근 3개월 최신 N건
  @Get('apt/recent-trades')
  async recentTrades(
    @Query('lawdCd') lawdCd: string,
    @Query('aptNm') aptNm: string,
    @Query('jibun') jibun: string,
    @Query('limit') limitS?: string,
  ) {
    const limit = Math.min(Math.max(toNum(limitS) ?? 5, 1), 20);
    if (!lawdCd || !aptNm) throw new BadRequestException('lawdCd and aptNm are required');

    const pool = getPool();

    const sql = `
      SELECT
        t.id::text AS id,
        t.deal_ymd,
        t.deal_amount_manwon,
        t.exclu_use_ar,
        t.floor
      FROM apt_trade t
      WHERE
        t.lawd_cd = $1
        AND t.apt_nm = $2
        AND ${JIBUN_OPT_FILTER}
        AND (${DEAL_DATE_EXPR}) >= (CURRENT_DATE - INTERVAL '3 months')
      ORDER BY (${DEAL_DATE_EXPR}) DESC NULLS LAST, t.deal_ymd DESC
      LIMIT $4;
    `;

    const { rows } = await pool.query(sql, [lawdCd, aptNm, jibun ?? '', limit]);

    return {
      ok: true,
      items: rows.map((r: any) => ({
        id: r.id,
        dealYmd: r.deal_ymd,
        amountManwon: r.deal_amount_manwon,
        excluUseAr: r.exclu_use_ar === null ? null : Number(r.exclu_use_ar),
        floor: r.floor === null ? null : Number(r.floor),
      })),
    };
  }

  // ✅ Summary: 최근 3개월 평균 + 최근 36개월 월평균 시계열
  @Get('apt/summary')
  async aptSummary(
    @Query('lawdCd') lawdCd: string,
    @Query('aptNm') aptNm: string,
    @Query('jibun') jibun: string,
  ) {
    if (!lawdCd || !aptNm) throw new BadRequestException('lawdCd and aptNm are required');

    const pool = getPool();

    // 1) 단지 기본 정보(umd_nm은 trade에서 가져옴) - jibun은 옵션
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

    // 2) 최근 3개월 평균
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

    // 3) 최근 36개월 월평균 시계열
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
