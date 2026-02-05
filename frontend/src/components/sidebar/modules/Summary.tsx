"use client";

import { useEffect, useMemo, useState } from "react";
import type { SelectedApt } from "@/app/page";

type SeriesPoint = { ym: string; avgPrice: number; cnt: number }; // avgPrice: 만원
type SummaryData = {
  ok: true;
  apt: { lawdCd: string; umdNm: string; aptNm: string; jibun: string };
  last3m: { avgPrice: number; cnt: number };
  series: SeriesPoint[]; // 최근 36개월
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

export default function Summary({ selectedApt }: { selectedApt: SelectedApt | null }) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => {
    if (!selectedApt) return "지도에서 단지를 클릭해 주세요";
    return `${selectedApt.aptNm} ${selectedApt.jibun ? `(${selectedApt.jibun})` : ""}`;
  }, [selectedApt]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!selectedApt) {
        setData(null);
        return;
      }
      setLoading(true);

      const qs = new URLSearchParams({
        lawdCd: selectedApt.lawdCd,
        aptNm: selectedApt.aptNm,
        jibun: selectedApt.jibun ?? "",
      });

      try {
        const res = await fetch(`http://localhost:4000/api/map/apt/summary?${qs.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!alive) return;

        if (json?.ok) setData(json as SummaryData);
        else setData(null);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [selectedApt]);

  // 차트(간단 막대): series avgPrice를 0~1로 정규화해서 높이로 표시
  const bars = useMemo(() => {
    const series = data?.series ?? [];
    if (series.length === 0) return [];
    const max = Math.max(...series.map((s) => s.avgPrice));
    const min = Math.min(...series.map((s) => s.avgPrice));
    const denom = Math.max(max - min, 1);
    return series.map((s) => ({
      ...s,
      h: Math.round(((s.avgPrice - min) / denom) * 100),
    }));
  }, [data]);

  return (
    <div className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold leading-tight text-gray-900">
            {data?.apt ? `${data.apt.umdNm} ${data.apt.aptNm}` : title}
          </h2>

          {data?.apt ? (
            <p className="mt-1 text-[12px] text-gray-500">
              {data.apt.lawdCd} · {data.apt.jibun}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-gray-500">
              {selectedApt ? "선택된 단지의 요약을 불러오는 중…" : "지도의 단지 라벨/마커를 클릭"}
            </p>
          )}
        </div>

        <button className="shrink-0 rounded-md bg-[#F4F7FF] px-3 py-1.5 text-[11px] font-bold text-[#635BFF]">
          3D 단지투어
        </button>
      </div>

      <div className="mt-4">
        <div className="text-[11px] text-gray-400">최근 3개월 평균(만원)</div>
        <div className="mt-1 flex items-end justify-between">
          <div className="text-2xl font-extrabold text-gray-900">
            {data?.last3m ? formatKoreanMoneyManwon(data.last3m.avgPrice) : loading ? "…" : "-"}
          </div>
          <div className="text-[12px] text-gray-500">
            {data?.last3m ? `${data.last3m.cnt}건` : ""}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[12px] font-bold text-gray-800">최근 36개월 추이(평균)</div>
          <div className="text-[11px] text-gray-500">{loading ? "로딩…" : ""}</div>
        </div>

        {bars.length === 0 ? (
          <div className="flex h-28 items-center justify-center text-xs text-gray-400">
            {selectedApt ? "데이터 없음" : "단지를 선택하면 차트가 표시됩니다"}
          </div>
        ) : (
          <div className="flex h-28 items-end gap-1">
            {bars.map((b) => (
              <div key={b.ym} className="group relative flex-1">
                <div className="w-full rounded-sm bg-gray-300" style={{ height: `${Math.max(6, b.h)}%` }} />
                <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded-md border bg-white px-2 py-1 text-[11px] text-gray-700 shadow-sm group-hover:block">
                  {b.ym} · {formatKoreanMoneyManwon(b.avgPrice)} · {b.cnt}건
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-gray-400">* 지도에서 단지를 클릭하면 갱신됩니다</p>
    </div>
  );
}
