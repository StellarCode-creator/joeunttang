"use client";

import type { SelectedApt } from "@/app/page";

export default function Header({ selectedApt }: { selectedApt: SelectedApt | null }) {
  const title = selectedApt?.aptNm ?? "신곡리 길훈1차";

  return (
    <div className="bg-[#635BFF] p-4 text-white">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {/* back */}
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

          {/* ✅ 선택된 단지명 표시 */}
          <h1 className="truncate whitespace-nowrap text-lg font-bold text-white">
            {title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-3 opacity-90">
          {/* share */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0-10.628a2.25 2.25 0 110 4.372m0-4.372a2.25 2.25 0 110 4.372"
            />
          </svg>

          {/* bell */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7a6.75 6.75 0 00-13.5 0v.7c0 3.537-2.053 6.599-5.05 7.723a23.848 23.848 0 005.454 1.31M6.25 17.082a3.75 3.75 0 107.5 0V17H6.25v.082z"
            />
          </svg>

          {/* close */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="h-6 w-6"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-4 pb-2 text-sm font-bold">
        <div className="flex cursor-pointer items-center gap-1 whitespace-nowrap">
          매매
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={3}
            stroke="currentColor"
            className="h-3 w-3 shrink-0"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>

        <div className="flex cursor-pointer items-center gap-1 whitespace-nowrap">
          34평
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={3}
            stroke="currentColor"
            className="h-3 w-3 shrink-0"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>

        {/* 건수는 아직 단지별 집계 연결 전이라 기존 유지 */}
        <div className="ml-auto flex items-center gap-1 whitespace-nowrap rounded bg-white/20 px-2 py-1 text-[12px]">
          92 <span className="font-normal opacity-70">건</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-3 w-3 shrink-0"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      </div>
    </div>
  );
}
