// frontend/src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import SidebarMain from "@/components/sidebar/SidebarMain";
import RightMapKakao from "@/components/map/RightMapKakao";
import SidebarTradeDetail from "@/components/sidebar/SidebarTradeDetail";

export type SelectedApt = {
  lawdCd: string;
  aptNm: string;
  // ✅ jibun은 신뢰 불가: optional로 전환 (또는 제거 가능)
  jibun?: string;
  umdNm?: string;
};

export default function Page() {
  const [selectedApt, setSelectedApt] = useState<SelectedApt | null>(null);

  // ✅ "더 보기" 우측 사이드바 상태
  const [tradePanelOpen, setTradePanelOpen] = useState(false);
  const [tradePanelApt, setTradePanelApt] = useState<SelectedApt | null>(null);

  // 우측 패널이 열려있으면 선택 단지가 바뀔 때 자동으로 갱신
  useEffect(() => {
    if (!tradePanelOpen) return;
    setTradePanelApt(selectedApt);
  }, [selectedApt, tradePanelOpen]);

  const openTradePanel = () => {
    if (!selectedApt) return;
    setTradePanelApt(selectedApt);
    setTradePanelOpen(true);
  };

  const closeTradePanel = () => {
    setTradePanelOpen(false);
  };

  const leftPad = tradePanelOpen ? "pl-[840px]" : "pl-[420px]";

  return (
    <main className="min-h-screen bg-gray-100">
      <SidebarMain selectedApt={selectedApt} onOpenTradePanel={openTradePanel} />

      {tradePanelOpen ? (
        <SidebarTradeDetail
          selectedApt={tradePanelApt}
          onClose={closeTradePanel}
        />
      ) : null}

      {/* 우측 지도 영역 */}
      <section className={`min-h-screen ${leftPad}`}>
        <div className="h-screen w-full bg-white">
          <RightMapKakao onSelectApt={setSelectedApt} />
        </div>
      </section>
    </main>
  );
}
