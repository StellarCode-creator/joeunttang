export type SeriesPoint = {
  ym: string;
  avgPrice: number;
  cnt: number;
};

type ChartResponse = {
  ok: boolean;
  series: SeriesPoint[];
};

export async function fetchJeonseSeries(
  aptNm: string
): Promise<SeriesPoint[]> {
  const qs = new URLSearchParams({ aptNm });

  const res = await fetch(
    `http://localhost:4000/api/chart/apt-jeonse?${qs.toString()}`,
    { cache: "no-store" }
  );

  const json = (await res.json()) as ChartResponse;
  if (!json?.ok || !Array.isArray(json.series)) return [];
  return json.series;
}
