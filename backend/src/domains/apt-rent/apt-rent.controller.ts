// backend/src/domains/apt-rent/apt-rent.controller.ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { getPool } from '../../db';
import { toNum, RENT_DATE_EXPR, JIBUN_OPT_FILTER_R, PARAM_DATE_EXPR } from '../apt/apt.shared';

type RentClusterRow = {
  lawd_cd: string;
  umd_nm: string;
  apt_nm: string;
  lat: number;
  lng: number;
  rent_cnt: number;
  min_deposit: number;
  max_deposit: number;
  min_monthly_rent: number;
  max_monthly_rent: number;
  last_deal_ymd: string | null;
};

type RecentRentRow = {
  id: string;
  deal_ymd: string | null;
  deposit_manwon: number | null;
  monthly_rent_manwon: number | null;
  exclu_use_ar: number | null;
  floor: number | null;
};

type AptInfoRow = {
  lawd_cd: string | null;
  umd_nm: string | null;
  apt_nm: string | null;
  jibun: string | null;
};

type RentLast3mRow = { avg_deposit: number | null; avg_monthly: number | null; cnt: number | null };
type RentSeriesRow = { ym: string; avg_deposit: number | null; avg_monthly: number | null; cnt: number | null };

@Controller('api/map')
export class AptRentController {
  // ✅ 전월세 클러스터 (기존 경로 유지)
  @Get('rents')
  async rents(
    @Query('minLng') minLngS: string,
    @Query('minLat') minLatS: string,
    @Query('maxLng') maxLngS: string,
    @Query('maxLat') maxLatS: string,
    @Query('limit') limitS?: string,
    @Query('rentType') rentTypeS?: string,
  ) {
    const swLng = toNum(minLngS);
    const swLat = toNum(minLatS);
    const neLng = toNum(maxLngS);
    const neLat = toNum(maxLatS);
    const limit = Math.min(Math.max(toNum(limitS) ?? 1200, 1), 5000);
    const rentType = (rentTypeS ?? 'all').trim();

    if (swLng === null || swLat === null || neLng === null || neLat === null) {
      throw new BadRequestException('Invalid bbox');
    }
    if (!['all', 'jeonse', 'monthly'].includes(rentType)) {
      throw new BadRequestException('rentType must be all|jeonse|monthly');
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
        r.lawd_cd,
        rl.umd_nm,
        r.apt_nm,
        rl.lat,
        rl.lng,
        COUNT(*)::int AS rent_cnt,
        MIN(r.deposit_manwon)::int AS min_deposit,
        MAX(r.deposit_manwon)::int AS max_deposit,
        MIN(COALESCE(r.monthly_rent_manwon, 0))::int AS min_monthly_rent,
        MAX(COALESCE(r.monthly_rent_manwon, 0))::int AS max_monthly_rent,
        MAX(r.deal_ymd) AS last_deal_ymd
      FROM apt_trade_rent r
      JOIN rep_location rl
        ON r.lawd_cd = rl.lawd_cd
       AND r.apt_nm = rl.apt_nm
      WHERE
        rl.lat BETWEEN $1 AND $2
        AND rl.lng BETWEEN $3 AND $4
        AND (${RENT_DATE_EXPR}) >= (CURRENT_DATE - INTERVAL '3 months')
        AND (
          $6 = 'all'
          OR ($6 = 'jeonse' AND COALESCE(r.monthly_rent_manwon, 0) = 0)
          OR ($6 = 'monthly' AND COALESCE(r.monthly_rent_manwon, 0) > 0)
        )
      GROUP BY r.lawd_cd, rl.umd_nm, r.apt_nm, rl.lat, rl.lng
      ORDER BY MAX(${RENT_DATE_EXPR}) DESC NULLS LAST
      LIMIT $5;
    `;

    const { rows } = await pool.query<RentClusterRow>(sql, [swLat, neLat, swLng, neLng, limit, rentType]);

    return {
      ok: true,
      items: rows.map((r) => ({
        lawdCd: String(r.lawd_cd ?? '').trim(),
        umdNm: String(r.umd_nm ?? '').trim(),
        aptNm: String(r.apt_nm ?? '').trim(),
        lat: Number(r.lat),
        lng: Number(r.lng),
        rentCnt: Number(r.rent_cnt),
        minDeposit: Number(r.min_deposit),
        maxDeposit: Number(r.max_deposit),
        minMonthlyRent: Number(r.min_monthly_rent),
        maxMonthlyRent: Number(r.max_monthly_rent),
        lastDealYmd: r.last_deal_ymd ? String(r.last_deal_ymd).trim() : '',
      })),
    };
  }

  // ✅ 전월세 상세 리스트 (기존 경로 유지)
  @Get('apt/recent-rents')
  async recentRents(
    @Query('lawdCd') lawdCd: string,
    @Query('aptNm') aptNm: string,
    @Query('jibun') jibun: string,
    @Query('limit') limitS?: string,
    @Query('fromYmd') fromYmd?: string,
    @Query('toYmd') toYmd?: string,
    @Query('rentType') rentTypeS?: string, // all|jeonse|monthly
  ) {
    const limit = Math.min(Math.max(toNum(limitS) ?? 5, 1), 5000);
    const rentType = (rentTypeS ?? 'all').trim();

    if (!lawdCd || !aptNm) throw new BadRequestException('lawdCd and aptNm are required');
    if (!['all', 'jeonse', 'monthly'].includes(rentType)) {
      throw new BadRequestException('rentType must be all|jeonse|monthly');
    }

    const pool = getPool();

    // ✅ (핫픽스) DB에 컬럼이 없으면 500 터지는 문제 방지
    // - current_schema() 사용: public이 아닐 수도 있어서 안전
    const colSql = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'apt_trade_rent'
        AND column_name IN ('exclu_use_ar', 'floor');
    `;
    const colR = await pool.query<{ column_name: string }>(colSql);
    const hasExclu = colR.rows.some((r) => r.column_name === 'exclu_use_ar');
    const hasFloor = colR.rows.some((r) => r.column_name === 'floor');

    const excluSelect = hasExclu ? 'r.exclu_use_ar' : 'NULL::numeric AS exclu_use_ar';
    const floorSelect = hasFloor ? 'r.floor' : 'NULL::int AS floor';

    const sql = `
      WITH p AS (
        SELECT
          ${PARAM_DATE_EXPR(5)} AS from_d,
          ${PARAM_DATE_EXPR(6)} AS to_d
      )
      SELECT
        r.id::text AS id,
        r.deal_ymd,
        r.deposit_manwon,
        r.monthly_rent_manwon,
        ${excluSelect},
        ${floorSelect}
      FROM apt_trade_rent r
      CROSS JOIN p
      WHERE
        r.lawd_cd = $1
        AND r.apt_nm = $2
        AND ${JIBUN_OPT_FILTER_R}
        AND (
          $7 = 'all'
          OR ($7 = 'jeonse' AND COALESCE(r.monthly_rent_manwon, 0) = 0)
          OR ($7 = 'monthly' AND COALESCE(r.monthly_rent_manwon, 0) > 0)
        )
        AND (
          (p.from_d IS NULL AND p.to_d IS NULL AND (${RENT_DATE_EXPR}) >= (CURRENT_DATE - INTERVAL '3 months'))
          OR (
            (p.from_d IS NULL OR (${RENT_DATE_EXPR}) >= p.from_d)
            AND (p.to_d IS NULL OR (${RENT_DATE_EXPR}) <= p.to_d)
          )
        )
      ORDER BY (${RENT_DATE_EXPR}) DESC NULLS LAST, r.deal_ymd DESC
      LIMIT $4;
    `;

    const { rows } = await pool.query<RecentRentRow>(sql, [
      lawdCd,
      aptNm,
      jibun ?? '',
      limit,
      fromYmd ?? '',
      toYmd ?? '',
      rentType,
    ]);

    return {
      ok: true,
      items: rows.map((r) => ({
        id: r.id,
        // ✅ null 방어: 프론트에서 formatYmd 안전하게 처리 가능하도록 빈 문자열로 내림
        dealYmd: r.deal_ymd ? String(r.deal_ymd) : '',
        depositManwon: r.deposit_manwon,
        monthlyRentManwon: r.monthly_rent_manwon,
        excluUseAr: r.exclu_use_ar === null ? null : Number(r.exclu_use_ar),
        floor: r.floor === null ? null : Number(r.floor),
      })),
    };
  }

  // ✅ 전월세 요약 + 월별 추이 (기존 경로 유지)
  @Get('apt/rent-summary')
  async rentSummary(
    @Query('lawdCd') lawdCd: string,
    @Query('aptNm') aptNm: string,
    @Query('jibun') jibun: string,
    @Query('rentType') rentTypeS?: string, // all|jeonse|monthly
  ) {
    const rentType = (rentTypeS ?? 'all').trim();

    if (!lawdCd || !aptNm) throw new BadRequestException('lawdCd and aptNm are required');
    if (!['all', 'jeonse', 'monthly'].includes(rentType)) {
      throw new BadRequestException('rentType must be all|jeonse|monthly');
    }

    const pool = getPool();

    const aptSql = `
      SELECT
        r.lawd_cd,
        MAX(r.umd_nm) AS umd_nm,
        r.apt_nm,
        btrim(COALESCE($3, '')) AS jibun
      FROM apt_trade_rent r
      WHERE
        r.lawd_cd = $1
        AND r.apt_nm = $2
        AND ${JIBUN_OPT_FILTER_R}
        AND (
          $4 = 'all'
          OR ($4 = 'jeonse' AND COALESCE(r.monthly_rent_manwon, 0) = 0)
          OR ($4 = 'monthly' AND COALESCE(r.monthly_rent_manwon, 0) > 0)
        )
      GROUP BY r.lawd_cd, r.apt_nm, btrim(COALESCE($3, ''))
      LIMIT 1;
    `;

    const last3mSql = `
      SELECT
        COALESCE(ROUND(AVG(r.deposit_manwon))::int, 0) AS avg_deposit,
        COALESCE(ROUND(AVG(r.monthly_rent_manwon))::int, 0) AS avg_monthly,
        COUNT(*)::int AS cnt
      FROM apt_trade_rent r
      WHERE
        r.lawd_cd = $1
        AND r.apt_nm = $2
        AND ${JIBUN_OPT_FILTER_R}
        AND (${RENT_DATE_EXPR}) >= (CURRENT_DATE - INTERVAL '3 months')
        AND (
          $4 = 'all'
          OR ($4 = 'jeonse' AND COALESCE(r.monthly_rent_manwon, 0) = 0)
          OR ($4 = 'monthly' AND COALESCE(r.monthly_rent_manwon, 0) > 0)
        );
    `;

    const seriesSql = `
      SELECT
        to_char(date_trunc('month', (${RENT_DATE_EXPR})), 'YYYYMM') AS ym,
        ROUND(AVG(r.deposit_manwon))::int AS avg_deposit,
        ROUND(AVG(r.monthly_rent_manwon))::int AS avg_monthly,
        COUNT(*)::int AS cnt
      FROM apt_trade_rent r
      WHERE
        r.lawd_cd = $1
        AND r.apt_nm = $2
        AND ${JIBUN_OPT_FILTER_R}
        AND (${RENT_DATE_EXPR}) >= (date_trunc('month', CURRENT_DATE) - INTERVAL '35 months')
        AND (${RENT_DATE_EXPR}) IS NOT NULL
        AND (
          $4 = 'all'
          OR ($4 = 'jeonse' AND COALESCE(r.monthly_rent_manwon, 0) = 0)
          OR ($4 = 'monthly' AND COALESCE(r.monthly_rent_manwon, 0) > 0)
        )
      GROUP BY ym
      ORDER BY ym ASC;
    `;

    const [aptR, last3mR, seriesR] = await Promise.all([
      pool.query<AptInfoRow>(aptSql, [lawdCd, aptNm, jibun ?? '', rentType]),
      pool.query<RentLast3mRow>(last3mSql, [lawdCd, aptNm, jibun ?? '', rentType]),
      pool.query<RentSeriesRow>(seriesSql, [lawdCd, aptNm, jibun ?? '', rentType]),
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
        avgDeposit: Number(last3m?.avg_deposit ?? 0),
        avgMonthly: Number(last3m?.avg_monthly ?? 0),
        cnt: Number(last3m?.cnt ?? 0),
      },
      series: (seriesR.rows ?? []).map((r) => ({
        ym: String(r.ym),
        avgDeposit: Number(r.avg_deposit ?? 0),
        avgMonthly: Number(r.avg_monthly ?? 0),
        cnt: Number(r.cnt ?? 0),
      })),
    };
  }
}
