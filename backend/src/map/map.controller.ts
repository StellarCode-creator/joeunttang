// backend/src/map/map.controller.ts
import { Controller, Get, Query, BadRequestException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { getPool } from '../db';
import { toInt, DEAL_DATE_EXPR, RENT_DATE_EXPR } from '../domains/apt/apt.shared';

@Controller('api/map')
export class MapController {
  // ✅ MVT (기존 기능 유지) - 여기만 map에 남긴다.
  @Get('tiles/:z/:x/:y.mvt')
  async tile(
    @Param('z') zS: string,
    @Param('x') xS: string,
    @Param('y') yS: string,
    @Query('layer') layerS?: string,
    @Query('rentType') rentTypeS?: string,
    @Res() res?: Response,
  ) {
    const z = toInt(zS);
    const x = toInt(xS);
    const y = toInt(yS);
    const layer = (layerS ?? 'trades').trim();
    const rentType = (rentTypeS ?? 'all').trim();

    if (z === null || x === null || y === null) throw new BadRequestException('Invalid z/x/y');
    if (z < 0 || z > 22 || x < 0 || y < 0) throw new BadRequestException('Invalid tile coords');
    if (layer !== 'trades' && layer !== 'rent') throw new BadRequestException('layer must be trades|rent');
    if (!['all', 'jeonse', 'monthly'].includes(rentType)) {
      throw new BadRequestException('rentType must be all|jeonse|monthly');
    }

    const pool = getPool();
    const extent = 4096;

    const sqlTrades = `
      WITH
      bounds AS (SELECT ST_TileEnvelope($1, $2, $3) AS geom),
      rep_location AS (
        SELECT DISTINCT ON (lawd_cd, apt_nm)
          lawd_cd, apt_nm, umd_nm, lat, lng
        FROM apt_location
        WHERE lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY lawd_cd, apt_nm, id
      ),
      agg AS (
        SELECT
          t.lawd_cd, rl.umd_nm, t.apt_nm, rl.lat, rl.lng,
          COUNT(*)::int AS trade_cnt,
          MIN(t.deal_amount_manwon)::int AS min_price,
          MAX(t.deal_amount_manwon)::int AS max_price,
          MAX(t.deal_ymd) AS last_trade_ymd
        FROM apt_trade t
        JOIN rep_location rl ON t.lawd_cd = rl.lawd_cd AND t.apt_nm = rl.apt_nm
        WHERE (${DEAL_DATE_EXPR}) >= (CURRENT_DATE - INTERVAL '3 months')
        GROUP BY t.lawd_cd, rl.umd_nm, t.apt_nm, rl.lat, rl.lng
      )
      SELECT
        ST_AsMVT(tile, $4, $5, 'geom') AS mvt
      FROM (
        SELECT
          ST_AsMVTGeom(
            ST_Transform(ST_SetSRID(ST_MakePoint(agg.lng, agg.lat), 4326), 3857),
            bounds.geom,
            $5,
            256,
            true
          ) AS geom,
          agg.lawd_cd, agg.umd_nm, agg.apt_nm,
          agg.trade_cnt, agg.min_price, agg.max_price, agg.last_trade_ymd
        FROM agg, bounds
        WHERE ST_Intersects(
          ST_Transform(ST_SetSRID(ST_MakePoint(agg.lng, agg.lat), 4326), 3857),
          bounds.geom
        )
      ) AS tile;
    `;

    const sqlRent = `
      WITH
      bounds AS (SELECT ST_TileEnvelope($1, $2, $3) AS geom),
      rep_location AS (
        SELECT DISTINCT ON (lawd_cd, apt_nm)
          lawd_cd, apt_nm, umd_nm, lat, lng
        FROM apt_location
        WHERE lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY lawd_cd, apt_nm, id
      ),
      base AS (
        SELECT
          r.lawd_cd, rl.umd_nm, r.apt_nm, rl.lat, rl.lng,
          COUNT(*)::int AS rent_cnt,
          MIN(r.deposit_manwon)::int AS min_deposit,
          MAX(r.deposit_manwon)::int AS max_deposit,
          MIN(COALESCE(r.monthly_rent_manwon, 0))::int AS min_monthly_rent,
          MAX(COALESCE(r.monthly_rent_manwon, 0))::int AS max_monthly_rent,
          MAX(r.deal_ymd) AS last_deal_ymd
        FROM apt_trade_rent r
        JOIN rep_location rl ON r.lawd_cd = rl.lawd_cd AND r.apt_nm = rl.apt_nm
        WHERE (${RENT_DATE_EXPR}) >= (CURRENT_DATE - INTERVAL '3 months')
          AND (
            $6 = 'all'
            OR ($6 = 'jeonse' AND COALESCE(r.monthly_rent_manwon, 0) = 0)
            OR ($6 = 'monthly' AND COALESCE(r.monthly_rent_manwon, 0) > 0)
          )
        GROUP BY r.lawd_cd, rl.umd_nm, r.apt_nm, rl.lat, rl.lng
      )
      SELECT
        ST_AsMVT(tile, $4, $5, 'geom') AS mvt
      FROM (
        SELECT
          ST_AsMVTGeom(
            ST_Transform(ST_SetSRID(ST_MakePoint(base.lng, base.lat), 4326), 3857),
            bounds.geom,
            $5,
            256,
            true
          ) AS geom,
          base.lawd_cd, base.umd_nm, base.apt_nm,
          base.rent_cnt, base.min_deposit, base.max_deposit,
          base.min_monthly_rent, base.max_monthly_rent, base.last_deal_ymd
        FROM base, bounds
        WHERE ST_Intersects(
          ST_Transform(ST_SetSRID(ST_MakePoint(base.lng, base.lat), 4326), 3857),
          bounds.geom
        )
      ) AS tile;
    `;

    const sql = layer === 'trades' ? sqlTrades : sqlRent;
    const params = layer === 'trades' ? [z, x, y, layer, extent] : [z, x, y, layer, extent, rentType];

    const { rows } = await pool.query<{ mvt: Buffer | null }>(sql, params);
    const mvt = rows[0]?.mvt;

    if (!mvt || !res) throw new BadRequestException('Empty tile');

    res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.end(mvt);
  }
}
