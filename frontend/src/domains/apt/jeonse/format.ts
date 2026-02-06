export function formatJeonsePrice(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  const eok = v / 10000;
  return `${eok.toFixed(eok >= 10 ? 0 : 1)}억`;
}
