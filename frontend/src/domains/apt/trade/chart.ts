export type SeriesPoint = {
  ym: string;       // YYYYMM
  avgPrice: number; // 만원
  cnt: number;
};

export type ChartResponse = {
  ok: boolean;
  series: SeriesPoint[];
};

export async function fetchTradeSeries(aptNm: string): Promise<SeriesPoint[]> {
  const qs = new URLSearchParams({ aptNm });

  const res = await fetch(
    `http://localhost:4000/api/chart/apt-price?${qs.toString()}`,
    { cache: "no-store" }
  );

  const json = (await res.json()) as ChartResponse;
  if (json?.ok && Array.isArray(json.series)) {
    return json.series;
  }
  return [];
}

export function buildTradeChart(series: SeriesPoint[]) {
  if (series.length === 0) {
    return {
      bars: [],
      last3mAvg: null,
      yTicks: [],
      xTicks: [],
    };
  }

  const last = series.slice(-36);
  const max = Math.max(...last.map((s) => s.avgPrice));
  const min = Math.min(...last.map((s) => s.avgPrice));
  const denom = Math.max(max - min, 1);
  const CHART_HEIGHT = 140;

  const bars = last.map((s) => ({
    ...s,
    hPx: Math.max(
      8,
      Math.round(((s.avgPrice - min) / denom) * CHART_HEIGHT)
    ),
  }));

  const last3 = series.slice(-3);
  const last3mAvg =
    last3.length === 0
      ? null
      : Math.round(
          last3.reduce((a, b) => a + b.avgPrice, 0) / last3.length
        );

  const values = last.map((s) => s.avgPrice);
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const yMid = Math.round((yMin + yMax) / 2);

  const yTicks = [yMax, yMid, yMin];

  const xTicks =
    bars.length === 0
      ? []
      : [
          bars[0].ym,
          bars[Math.floor(bars.length / 2)].ym,
          bars[bars.length - 1].ym,
        ];

  return {
    bars,
    last3mAvg,
    yTicks,
    xTicks,
  };
}
