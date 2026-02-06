"use client";

import { useEffect, useMemo, useState } from "react";
import type { DealMode, SelectedApt } from "@/app/page";
import { fetchTradeSeries, buildTradeChart, SeriesPoint } from "@/domains/apt/trade/chart";
import { fetchJeonseSeries } from "@/domains/apt/jeonse/chart";
import { fetchMonthlySeries } from "@/domains/apt/monthly/chart";

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
  if (ym.length !== 6) return ym;
  return `${ym.slice(2, 4)}.${ym.slice(4, 6)}`;
}

export default function PriceSection({
  selectedApt,
  dealMode,
}: {
  selectedApt: SelectedApt | null;
  dealMode: DealMode;
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

      try {
        let data: SeriesPoint[] = [];
        if (dealMode === "trade") data = await fetchTradeSeries(selectedApt.aptNm);
        else if (dealMode === "jeonse") data = await fetchJeonseSeries(selectedApt.aptNm);
        else data = await fetchMonthlySeries(selectedApt.aptNm);

        if (alive) setSeries(data);
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
  }, [selectedApt, dealMode]);

  const { bars, last3mAvg, yTicks, xTicks } = useMemo(() => buildTradeChart(series), [series]);

  const subtitle =
    dealMode === "trade" ? "평균 실거래가 (월별)" : dealMode === "jeonse" ? "평균 전세가 (월별)" : "평균 월세 (월별)";

  return (
    <div className="px-5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-medium text-gray-400">{subtitle}</span>
      </div>

      <h3 className="text-3xl font-black text-blue-600">
        {loading ? "…" : last3mAvg !== null ? formatKoreanMoneyManwon(last3mAvg) : "-"}
      </h3>

      <div className="mt-6 flex gap-4 border-b border-gray-100 text-[13px] text-gray-400">
        <button className="border-b-2 border-gray-900 pb-2 font-bold text-gray-900">최근 3년</button>
        <button className="pb-2">전체 기간</button>
      </div>

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
            <div className="absolute left-0 top-3 flex h-[140px] w-10 flex-col justify-between text-right text-[10px] text-gray-400">
              {yTicks.map((v) => (
                <div key={v}>{formatKoreanMoneyManwon(v)}</div>
              ))}
            </div>

            <div className="ml-12 flex h-full items-end gap-1">
              {bars.map((b) => (
                <div key={b.ym} className="group relative flex-1">
                  <div className="w-full rounded-sm bg-gray-400" style={{ height: `${b.hPx}px` }} />
                  <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded-md border bg-white px-2 py-1 text-[11px] text-gray-700 shadow-sm group-hover:block">
                    {formatYm(b.ym)} · {formatKoreanMoneyManwon(b.avgPrice)} · {b.cnt}건
                  </div>
                </div>
              ))}
            </div>

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
