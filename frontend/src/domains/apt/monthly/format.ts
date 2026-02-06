export function formatMonthly(deposit: number | null, monthly: number | null) {
  const dep =
    typeof deposit === "number" && Number.isFinite(deposit)
      ? `${Math.round(deposit).toLocaleString()}만`
      : "-";

  const mon =
    typeof monthly === "number" && Number.isFinite(monthly)
      ? `${Math.round(monthly).toLocaleString()}만`
      : "-";

  return `보 ${dep} / 월 ${mon}`;
}
