"use client";

import { useEffect, useState } from "react";
import type { SelectedApt } from "@/app/page";

type RecentTradeItem = {
  id: string;
  dealYmd: string; // YYYYMMDD
  amountManwon: number;
  excluUseAr?: number | null;
  floor?: number | null;
};

function formatYmd(ymd: string) {
  if (!ymd || ymd.length !== 8) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

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

export default function RecentTrades3Months({
  selectedApt,
}: {
  selectedApt: SelectedApt | null;
}) {
  const [items, setItems] = useState<RecentTradeItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!selectedApt) {
        setItems([]);
        return;
      }
      setLoading(true);

      // ✅ 근본 해결: jibun 제거
      const qs = new URLSearchParams({
        lawdCd: selectedApt.lawdCd.trim(),
        aptNm: selectedApt.aptNm.trim(),
        limit: "5",
      });

      try {
        const res = await fetch(
          `http://localhost:4000/api/map/apt/recent-trades?${qs.toString()}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!alive) return;

        if (json?.ok) setItems(json.items ?? []);
        else setItems([]);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [selectedApt]);

  return (
    <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">최근 3개월 실거래 (Top 5)</h3>
        <span className="text-xs text-gray-500">{loading ? "로딩…" : ""}</span>
      </div>

      {!selectedApt ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
          지도에서 단지를 클릭하면 최근 거래 5건을 보여줍니다.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
          최근 3개월 거래가 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">
                    {selectedApt.aptNm}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-600">
                    {typeof it.excluUseAr === "number" ? <span>{it.excluUseAr}㎡</span> : null}
                    {typeof it.floor === "number" ? (
                      <>
                        <span>·</span>
                        <span>{it.floor}층</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold text-gray-900">
                    {formatKoreanMoneyManwon(it.amountManwon)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">{formatYmd(it.dealYmd)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 text-xs text-gray-500">
        * 백엔드(DB) 기준: 최근 3개월 + 최신 5건
      </div>
    </section>
  );
}
