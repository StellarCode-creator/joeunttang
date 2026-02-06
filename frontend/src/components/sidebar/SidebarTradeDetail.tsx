// frontend/src/components/sidebar/SidebarTradeDetail.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { DealMode, SelectedApt } from "@/app/page";

type TradeItem = {
  id: string;
  dealYmd: string;
  amountManwon: number;
  excluUseAr?: number | null;
  floor?: number | null;
  dealDong?: string | null;
  isRegistered?: boolean | null;
};

type RentItem = {
  id: string;
  dealYmd: string;
  depositManwon: number | null;
  monthlyRentManwon: number | null;
  contractTerm?: string | null;
  contractType?: string | null;
};

type Preset = "1m" | "3m" | "6m" | "1y" | "all" | "custom";

function formatYmdDash(ymd: string) {
  if (!ymd || ymd.length !== 8) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function formatYmdDot(ymd: string) {
  if (!ymd || ymd.length !== 8) return ymd;
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;
}

function formatManwonWithSuffix(v: number) {
  if (!Number.isFinite(v)) return "-";
  return `${Math.round(v).toLocaleString()}만원`;
}

function formatArea(v?: number | null) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  return v.toFixed(2);
}

function ymdFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function addMonths(base: Date, months: number) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toDateInput(ymd: string) {
  if (!ymd || ymd.length !== 8) return "";
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function fromDateInput(v: string) {
  if (!v) return "";
  return v.replaceAll("-", "");
}

function formatRentLine(deposit: number | null, monthly: number | null, dealMode: DealMode) {
  const dep = deposit ? formatManwonWithSuffix(deposit) : "-";
  const mon = monthly ? formatManwonWithSuffix(monthly) : "-";
  if (dealMode === "jeonse") return dep;
  return `${dep} / ${mon}`;
}

export default function SidebarTradeDetail({
  selectedApt,
  dealMode,
  onClose,
}: {
  selectedApt: SelectedApt | null;
  dealMode: DealMode;
  onClose: () => void;
}) {
  const [tradeItems, setTradeItems] = useState<TradeItem[]>([]);
  const [rentItems, setRentItems] = useState<RentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [preset, setPreset] = useState<Preset>("3m");
  const [fromYmd, setFromYmd] = useState<string>("");
  const [toYmd, setToYmd] = useState<string>("");

  const { reqFrom, reqTo } = useMemo(() => {
    const today = new Date();
    const to = ymdFromDate(today);

    if (preset === "custom") return { reqFrom: fromYmd.trim(), reqTo: toYmd.trim() };
    if (preset === "all") return { reqFrom: "19000101", reqTo: "" };

    const monthDelta =
      preset === "1m" ? -1 :
      preset === "3m" ? -3 :
      preset === "6m" ? -6 :
      -12; // "1y"

    const from = ymdFromDate(addMonths(today, monthDelta));
    return { reqFrom: from, reqTo: to };
  }, [preset, fromYmd, toYmd]);

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
        jibun: selectedApt.jibun ?? "",   // 추가
        limit: "5000",
      });
      if (reqFrom) qs.set("fromYmd", reqFrom);
      if (reqTo) qs.set("toYmd", reqTo);

      try {
        if (dealMode === "trade") {
          const res = await fetch(`http://localhost:4000/api/map/apt/recent-trades?${qs.toString()}`, { cache: "no-store" });
          const json = await res.json();
          if (!alive) return;
          setTradeItems(json?.ok ? (json.items ?? []) : []);
          setRentItems([]);
        } else {
          qs.set("rentType", dealMode === "jeonse" ? "jeonse" : "monthly");
          const res = await fetch(`http://localhost:4000/api/map/apt/recent-rents?${qs.toString()}`, { cache: "no-store" });
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
  }, [selectedApt, dealMode, reqFrom, reqTo]);

  useEffect(() => {
    if (preset !== "custom") return;
    if (!fromYmd && !toYmd) {
      const today = ymdFromDate(new Date());
      const from = ymdFromDate(addMonths(new Date(), -3));
      setFromYmd(from);
      setToYmd(today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const rangeLabel = useMemo(() => {
    if (preset === "all") return "전체";
    if (preset === "custom") {
      const a = fromYmd ? formatYmdDash(fromYmd) : "-";
      const b = toYmd ? formatYmdDash(toYmd) : "-";
      return `${a} ~ ${b}`;
    }
    return `${formatYmdDash(reqFrom)} ~ ${formatYmdDash(reqTo)}`;
  }, [preset, fromYmd, toYmd, reqFrom, reqTo]);

  const title = dealMode === "trade" ? "실거래 목록" : dealMode === "jeonse" ? "전세 목록" : "월세 목록";

  return (
    <aside className="fixed left-[420px] top-0 z-20 flex h-full w-[420px] flex-col bg-white shadow-2xl">
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-gray-900">
              {selectedApt ? selectedApt.aptNm : "단지 상세"}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              {selectedApt ? `${selectedApt.lawdCd}${selectedApt.umdNm ? ` · ${selectedApt.umdNm}` : ""}` : ""}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
          >
            닫기
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["1m", "1개월"],
                ["3m", "3개월"],
                ["6m", "6개월"],
                ["1y", "1년"],
                ["all", "전체"],
                ["custom", "직접"],
              ] as const
            ).map(([k, label]) => {
              const active = preset === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPreset(k)}
                  className={[
                    "rounded-lg px-2.5 py-1 text-[11px] font-bold transition",
                    active ? "bg-[#635BFF] text-white" : "bg-white text-gray-700 hover:bg-gray-100",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
            <div className="ml-auto text-[11px] font-semibold text-gray-500">{rangeLabel}</div>
          </div>

          {preset === "custom" ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <div className="mb-1 text-[11px] font-semibold text-gray-500">시작일</div>
                <input
                  type="date"
                  value={toDateInput(fromYmd)}
                  onChange={(e) => setFromYmd(fromDateInput(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-900 outline-none focus:border-[#635BFF]"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-[11px] font-semibold text-gray-500">종료일</div>
                <input
                  type="date"
                  value={toDateInput(toYmd)}
                  onChange={(e) => setToYmd(fromDateInput(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-900 outline-none focus:border-[#635BFF]"
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto">
        <div className="px-4 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-gray-900">{title}</div>
            <div className="text-xs text-gray-500">
              {loading
                ? "로딩…"
                : dealMode === "trade"
                  ? tradeItems.length
                    ? `${tradeItems.length}건`
                    : ""
                  : rentItems.length
                    ? `${rentItems.length}건`
                    : ""}
            </div>
          </div>
        </div>

        {dealMode === "trade" ? (
          <>
            <div className="sticky top-0 z-10 border-y border-gray-100 bg-white/95 backdrop-blur">
              <div className="flex items-center px-4 py-2 text-[11px] font-bold text-gray-500">
                <div className="w-[20%]">계약일</div>
                <div className="w-[22%] text-right">가격</div>
                <div className="w-[18%] text-right">면적</div>
                <div className="w-[15%] text-right">동</div>
                <div className="w-[10%] text-right">층</div>
                <div className="w-[15%] text-center">정보</div>
              </div>
            </div>

            <div className="px-4 pb-4 pt-2">
              {!selectedApt ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
                  단지를 선택한 뒤 “더 보기”를 눌러주세요.
                </div>
              ) : tradeItems.length === 0 ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
                  표시할 거래가 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {tradeItems.map((it) => (
                    <div key={it.id} className="flex items-center py-3 hover:bg-gray-50/70">
                      <div className="w-[20%] text-[12px] font-medium text-gray-500">{formatYmdDot(it.dealYmd)}</div>
                      <div className="w-[22%] text-right text-[13px] font-extrabold text-gray-900">
                        {formatManwonWithSuffix(it.amountManwon)}
                      </div>
                      <div className="w-[18%] text-right text-[12px] text-gray-600">{formatArea(it.excluUseAr)}</div>
                      <div className="w-[15%] text-right text-[12px] text-gray-600">{it.dealDong ?? "-"}</div>
                      <div className="w-[10%] text-right text-[12px] text-gray-600">
                        {typeof it.floor === "number" ? `${it.floor}` : "-"}
                      </div>
                      <div className="w-[15%] text-center">
                        {it.isRegistered === true ? (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">등기</span>
                        ) : it.isRegistered === false ? (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">미등기</span>
                        ) : (
                          <span className="text-[10px] text-gray-400">미확인</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 text-xs text-gray-500">* 기간을 변경하면 해당 기간 거래를 다시 조회합니다</div>
            </div>
          </>
        ) : (
          <>
            <div className="sticky top-0 z-10 border-y border-gray-100 bg-white/95 backdrop-blur">
              <div className="flex items-center px-4 py-2 text-[11px] font-bold text-gray-500">
                <div className="w-[25%]">계약일</div>
                <div className="w-[55%] text-right">{dealMode === "jeonse" ? "보증금" : "보증금 / 월세"}</div>
                <div className="w-[20%] text-right">정보</div>
              </div>
            </div>

            <div className="px-4 pb-4 pt-2">
              {!selectedApt ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
                  단지를 선택한 뒤 “더 보기”를 눌러주세요.
                </div>
              ) : rentItems.length === 0 ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
                  표시할 거래가 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {rentItems.map((it) => (
                    <div key={it.id} className="flex items-center py-3 hover:bg-gray-50/70">
                      <div className="w-[25%] text-[12px] font-medium text-gray-500">{formatYmdDot(it.dealYmd)}</div>
                      <div className="w-[55%] text-right text-[13px] font-extrabold text-gray-900">
                        {formatRentLine(it.depositManwon, it.monthlyRentManwon, dealMode)}
                      </div>
                      <div className="w-[20%] text-right text-[11px] text-gray-500">
                        {it.contractType ? it.contractType : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 text-xs text-gray-500">* 기간을 변경하면 해당 기간 거래를 다시 조회합니다</div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
