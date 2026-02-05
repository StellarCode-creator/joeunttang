"use client";

import { useState } from "react";
import SidebarMain from "@/components/sidebar/SidebarMain";
import RightMapKakao from "@/components/map/RightMapKakao";

export type SelectedApt = {
  lawdCd: string;
  aptNm: string;
  // ✅ jibun은 신뢰 불가: optional로 전환 (또는 제거 가능)
  jibun?: string;
  umdNm?: string;
};

export default function Page() {
  const [selectedApt, setSelectedApt] = useState<SelectedApt | null>(null);

  return (
    <main className="min-h-screen bg-gray-100">
      <SidebarMain selectedApt={selectedApt} />

      {/* 우측 지도 영역 */}
      <section className="min-h-screen pl-[420px]">
        <div className="h-screen w-full bg-white">
          <RightMapKakao onSelectApt={setSelectedApt} />
        </div>
      </section>
    </main>
  );
}
