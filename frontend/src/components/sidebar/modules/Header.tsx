"use client";

import type { DealMode, SelectedApt } from "@/app/page";

export default function Header({
  selectedApt,
  dealMode,
  onChangeDealMode,
}: {
  selectedApt: SelectedApt | null;
  dealMode: DealMode;
  onChangeDealMode: (m: DealMode) => void;
}) {
  const title = selectedApt?.aptNm ?? "단지를 선택하세요";

  const pill = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 text-[12px] font-bold transition",
        active ? "bg-white text-[#635BFF]" : "bg-white/20 text-white hover:bg-white/30",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-[#635BFF] p-4 text-white">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="h-6 w-6 cursor-pointer shrink-0"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>

          <h1 className="truncate whitespace-nowrap text-lg font-bold text-white">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-3 opacity-90">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0-10.628a2.25 2.25 0 110 4.372m0-4.372a2.25 2.25 0 110 4.372" />
          </svg>

          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7a6.75 6.75 0 00-13.5 0v.7c0 3.537-2.053 6.599-5.05 7.723a23.848 23.848 0 005.454 1.31M6.25 17.082a3.75 3.75 0 107.5 0V17H6.25v.082z" />
          </svg>

          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      </div>

      {/* ✅ 매매/전세/월세 선택은 여기(단일 진실) */}
      <div className="flex items-center gap-2 pb-2">
        {pill("매매", dealMode === "trade", () => onChangeDealMode("trade"))}
        {pill("전세", dealMode === "jeonse", () => onChangeDealMode("jeonse"))}
        {pill("월세", dealMode === "monthly", () => onChangeDealMode("monthly"))}

        {/* 아래는 기존 UI 자리 유지용 (평형/건수 등) */}
        <div className="ml-auto flex items-center gap-1 whitespace-nowrap rounded bg-white/20 px-2 py-1 text-[12px]">
          92 <span className="font-normal opacity-70">건</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      </div>
    </div>
  );
}
