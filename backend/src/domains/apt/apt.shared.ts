// backend/src/domains/apt/apt.shared.ts

export function toNum(v: string | undefined): number | null {
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toInt(v: string | undefined): number | null {
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

// apt_trade: deal_ymd 가 'YYYYMMDD' 또는 'YYYYMM' 인 케이스까지 안전 변환
export const DEAL_DATE_EXPR = `
  CASE
    WHEN length(t.deal_ymd) = 8 THEN to_date(t.deal_ymd, 'YYYYMMDD')
    WHEN length(t.deal_ymd) = 6 THEN to_date(t.deal_ymd || '01', 'YYYYMMDD')
    ELSE NULL
  END
`;

// apt_trade_rent: deal_ymd 가 'YYYYMMDD' 또는 'YYYYMM' 인 케이스까지 안전 변환
export const RENT_DATE_EXPR = `
  CASE
    WHEN length(r.deal_ymd) = 8 THEN to_date(r.deal_ymd, 'YYYYMMDD')
    WHEN length(r.deal_ymd) = 6 THEN to_date(r.deal_ymd || '01', 'YYYYMMDD')
    ELSE NULL
  END
`;

// ✅ jibun 옵셔널 필터 (trade)
export const JIBUN_OPT_FILTER_T = `
  (
    btrim(COALESCE($3, '')) = ''
    OR btrim(COALESCE(t.jibun, '')) = btrim($3)
  )
`;

// ✅ jibun 옵셔널 필터 (rent)
export const JIBUN_OPT_FILTER_R = `
  (
    btrim(COALESCE($3, '')) = ''
    OR btrim(COALESCE(r.jibun, '')) = btrim($3)
  )
`;

// ✅ 쿼리 파라미터 날짜(YYYYMMDD/YYYYMM/빈값) 안전 변환
export const PARAM_DATE_EXPR = (idx: number) => `
  CASE
    WHEN btrim(COALESCE($${idx}, '')) = '' THEN NULL
    WHEN length(btrim($${idx})) = 8 THEN to_date(btrim($${idx}), 'YYYYMMDD')
    WHEN length(btrim($${idx})) = 6 THEN to_date(btrim($${idx}) || '01', 'YYYYMMDD')
    ELSE NULL
  END
`;
