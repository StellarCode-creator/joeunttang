export function formatTradePriceManwon(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  return `${Math.round(v).toLocaleString()}만원`;
}

export function formatTradePriceEok(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  const eok = v / 10000;
  return `${eok.toFixed(eok >= 10 ? 0 : 1)}억`;
}
