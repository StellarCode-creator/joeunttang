"use client";

import { useEffect, useState } from "react";
import type { DealMode, SelectedApt } from "@/app/page";

type RecentTradeItem = {
  id: string;
  dealYmd: string; // YYYYMMDD (백엔드가 빈문자열로 내려올 수도 있음)
  amountManwon: number;
  excluUseAr?: number | null;
  floor?: number | null;
};

type RecentRentItem = {
  id: string;
  dealYmd: string; // YYYYMMDD (빈문자열 가능)
  depositManwon: number | null;
  monthlyRentManwon: number | null;
};

function formatYmd(ymd: string) {
  if (!ymd || ymd.length !== 8) return ymd || "-";
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

function formatManwonWithSuffix(v: number) {
  if (!Number.isFinite(v)) return "-";
  return `${Math.round(v).toLocaleString()}만원`;
}

function formatRentLine(deposit: number | null, monthly: number | null, dealMode: DealMode) {
  const dep = deposit === null ? "-" : formatManwonWithSuffix(deposit);
  const mon = monthly === null ? "-" : formatManwonWithSuffix(monthly);
  return dealMode === "jeonse" ? dep : `${dep} / ${mon}`;
}

export default function RecentTrades3Months({
  selectedApt,
  dealMode,
  onOpenMore,
}: {
  selectedApt: SelectedApt | null;
  dealMode: DealMode;
  onOpenMore: () => void;
}) {
  const [tradeItems, setTradeItems] = useState<RecentTradeItem[]>([]);
  const [rentItems, setRentItems] = useState<RecentRentItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!selectedApt) {
        setTradeItems([]);
        setRentItems([]);
        return;
      }
      setLoading(true);

      const qs = new URLSearchParams({
        lawdCd: selectedApt.lawdCd.trim(),
        aptNm: selectedApt.aptNm.trim(),
        jibun: selectedApt.jibun ?? "",
        limit: "5",
      });

      try {
        if (dealMode === "trade") {
          const res = await fetch(`http://localhost:4000/api/map/apt/recent-trades?${qs.toString()}`, {
            cache: "no-store",
          });
          const json = await res.json();
          if (!alive) return;
          setTradeItems(json?.ok ? (json.items ?? []) : []);
          setRentItems([]);
        } else {
          qs.set("rentType", dealMode === "jeonse" ? "jeonse" : "monthly");
          const res = await fetch(`http://localhost:4000/api/map/apt/recent-rents?${qs.toString()}`, {
            cache: "no-store",
          });
          const json = await res.json();
          if (!alive) return;
          setRentItems(json?.ok ? (json.items ?? []) : []);
          setTradeItems([]);
        }
      } catch {
        if (!alive) return;
        setTradeItems([]);
        setRentItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [selectedApt, dealMode]);

  const hasItems = dealMode === "trade" ? tradeItems.length > 0 : rentItems.length > 0;
  const canOpenMore = !!selectedApt && !loading && hasItems;

  const title =
    dealMode === "trade"
      ? "최근 3개월 매매 (Top 5)"
      : dealMode === "jeonse"
      ? "최근 3개월 전세 (Top 5)"
      : "최근 3개월 월세 (Top 5)";

  return (
    <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{loading ? "로딩…" : ""}</span>

          <button
            type="button"
            onClick={() => (canOpenMore ? onOpenMore() : null)}
            disabled={!canOpenMore}
            className={[
              "rounded-md px-2 py-1 text-xs font-semibold transition",
              canOpenMore ? "text-[#635BFF] hover:bg-[#F4F7FF]" : "cursor-not-allowed text-gray-300",
            ].join(" ")}
          >
            더 보기
          </button>
        </div>
      </div>

      {!selectedApt ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
          지도에서 단지를 클릭하면 최근 거래 5건을 보여줍니다.
        </div>
      ) : !hasItems ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
          최근 3개월 거래가 없습니다.
        </div>
      ) : dealMode === "trade" ? (
        <ul className="space-y-2">
          {tradeItems.map((it) => (
            <li key={it.id} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">{selectedApt.aptNm}</div>
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
                  <div className="text-sm font-bold text-gray-900">{formatKoreanMoneyManwon(it.amountManwon)}</div>
                  <div className="mt-1 text-xs text-gray-500">{formatYmd(it.dealYmd)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {rentItems.map((it) => (
            <li key={it.id} className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">{selectedApt.aptNm}</div>
                  {/* contractType는 백엔드에서 안 내려오므로 UI 자리만 유지 */}
                  <div className="mt-1 text-xs text-gray-600">&nbsp;</div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold text-gray-900">
                    {formatRentLine(it.depositManwon, it.monthlyRentManwon, dealMode)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">{formatYmd(it.dealYmd)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 text-xs text-gray-500">* 백엔드(DB) 기준: 최근 3개월 + 최신 5건</div>
    </section>
  );
}
