"use client";

import { useEffect, useMemo, useState } from "react";
import type { SelectedApt } from "@/app/page";

type SeriesPoint = {
  ym: string;       // YYYYMM
  avgPrice: number; // 만원
  cnt: number;
};

type ChartResponse = {
  ok: boolean;
  series: SeriesPoint[];
};

function formatKoreanMoneyManwon(v: number) {
  if (!Number.isFinite(v)) return "-";
  const eok = Math.floor(v / 10000);
  const rest = v % 10000;
  if (eok <= 0) return `${v.toLocaleString()}만`;
  if (rest === 0) return `${eok}억`;
  const dec = Math.round((rest / 10000) * 10) / 10;
  const val = (eok + dec).toFixed(dec % 1 === 0 ? 0 : 1);
  return `${val}억`;
}

function formatYm(ym: string) {
  // YYYYMM → YY.MM
  if (ym.length !== 6) return ym;
  return `${ym.slice(2, 4)}.${ym.slice(4, 6)}`;
}

export default function PriceSection({
  selectedApt,
}: {
  selectedApt: SelectedApt | null;
}) {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!selectedApt) {
        setSeries([]);
        return;
      }

      setLoading(true);

      const qs = new URLSearchParams({
        aptNm: selectedApt.aptNm,
      });

      try {
        const res = await fetch(
          `http://localhost:4000/api/chart/apt-price?${qs.toString()}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as ChartResponse;
        if (!alive) return;

        if (json?.ok && Array.isArray(json.series)) {
          setSeries(json.series);
        } else {
          setSeries([]);
        }
      } catch {
        if (alive) setSeries([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [selectedApt]);

  /** ---------------- 차트 계산 ---------------- */
  const bars = useMemo(() => {
    if (series.length === 0) return [];

    const last = series.slice(-36);
    const max = Math.max(...last.map((s) => s.avgPrice));
    const min = Math.min(...last.map((s) => s.avgPrice));
    const denom = Math.max(max - min, 1);

    const CHART_HEIGHT = 140;

    return last.map((s) => ({
      ...s,
      hPx: Math.max(
        8,
        Math.round(((s.avgPrice - min) / denom) * CHART_HEIGHT)
      ),
    }));
  }, [series]);

  const last3mAvg = useMemo(() => {
    const last3 = series.slice(-3);
    if (last3.length === 0) return null;
    const sum = last3.reduce((a, b) => a + b.avgPrice, 0);
    return Math.round(sum / last3.length);
  }, [series]);

  /** Y축 눈금 (최소 / 중간 / 최대) */
  const yTicks = useMemo(() => {
    if (series.length === 0) return [];
    const values = series.slice(-36).map((s) => s.avgPrice);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mid = Math.round((min + max) / 2);
    return [max, mid, min];
  }, [series]);

  /** X축 라벨 (처음 / 중간 / 끝) */
  const xTicks = useMemo(() => {
    if (bars.length === 0) return [];
    const first = bars[0].ym;
    const mid = bars[Math.floor(bars.length / 2)].ym;
    const last = bars[bars.length - 1].ym;
    return [first, mid, last];
  }, [bars]);

  return (
    <div className="px-5">
      <div className="mb-5 flex w-fit rounded-md bg-gray-100 p-1">
        <button className="rounded bg-white px-4 py-1 text-xs font-bold text-[#635BFF] shadow-sm">
          매매
        </button>
        <button className="px-4 py-1 text-xs font-medium text-gray-400">
          전월세
        </button>
      </div>

      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-medium text-gray-400">
          평균 실거래가 (월별)
        </span>
      </div>

      <h3 className="text-3xl font-black text-blue-600">
        {loading
          ? "…"
          : last3mAvg !== null
          ? formatKoreanMoneyManwon(last3mAvg)
          : "-"}
      </h3>

      <div className="mt-6 flex gap-4 border-b border-gray-100 text-[13px] text-gray-400">
        <button className="border-b-2 border-gray-900 pb-2 font-bold text-gray-900">
          최근 3년
        </button>
        <button className="pb-2">전체 기간</button>
      </div>

      {/* ---------------- 차트 영역 ---------------- */}
      <div className="relative mt-6 h-44 w-full rounded-lg border border-dashed border-gray-200 bg-slate-50 px-6 py-3">
        {!selectedApt ? (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-300">
            단지를 선택하면 차트가 표시됩니다
          </span>
        ) : series.length === 0 ? (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-300">
            {loading ? "로딩 중…" : "차트 데이터 없음"}
          </span>
        ) : (
          <>
            {/* Y축 */}
            <div className="absolute left-0 top-3 flex h-[140px] w-10 flex-col justify-between text-right text-[10px] text-gray-400">
              {yTicks.map((v) => (
                <div key={v}>{formatKoreanMoneyManwon(v)}</div>
              ))}
            </div>

            {/* Bars */}
            <div className="ml-12 flex h-full items-end gap-1">
              {bars.map((b) => (
                <div key={b.ym} className="group relative flex-1">
                  <div
                    className="w-full rounded-sm bg-gray-400"
                    style={{ height: `${b.hPx}px` }}
                  />
                  <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded-md border bg-white px-2 py-1 text-[11px] text-gray-700 shadow-sm group-hover:block">
                    {formatYm(b.ym)} · {formatKoreanMoneyManwon(b.avgPrice)} ·{" "}
                    {b.cnt}건
                  </div>
                </div>
              ))}
            </div>

            {/* X축 */}
            <div className="mt-1 ml-12 flex justify-between text-[10px] text-gray-400">
              {xTicks.map((v) => (
                <span key={v}>{formatYm(v)}</span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
