// frontend/src/app/page.tsx
"use client";

import { useMemo, useState } from "react";
import SidebarMain from "@/components/sidebar/SidebarMain";
import RightMapKakao from "@/components/map/RightMapKakao";
import SidebarTradeDetail from "@/components/sidebar/SidebarTradeDetail";

export type DealMode = "trade" | "jeonse" | "monthly";

export type SelectedApt = {
  lawdCd: string;
  aptNm: string;
  jibun?: string;
  umdNm?: string;
};

export default function Page() {
  const [dealMode, setDealMode] = useState<DealMode>("trade");
  const [selectedApt, setSelectedApt] = useState<SelectedApt | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);

  // ✅ lint(react-hooks/set-state-in-effect) 회피: 파생값으로 처리
  const panelApt = useMemo(() => (panelOpen ? selectedApt : null), [panelOpen, selectedApt]);

  const openPanel = () => {
    if (!selectedApt) return;
    setPanelOpen(true);
  };

  const closePanel = () => setPanelOpen(false);

  const leftPad = panelOpen ? "pl-[840px]" : "pl-[420px]";

  return (
    <main className="min-h-screen bg-gray-100">
      <SidebarMain
        selectedApt={selectedApt}
        dealMode={dealMode}
        onChangeDealMode={setDealMode}
        onOpenTradePanel={openPanel}
      />

      {panelOpen ? (
        <SidebarTradeDetail selectedApt={panelApt} dealMode={dealMode} onClose={closePanel} />
      ) : null}

      <section className={`min-h-screen ${leftPad}`}>
        <div className="h-screen w-full bg-white">
          <RightMapKakao dealMode={dealMode} onSelectApt={setSelectedApt} />
        </div>
      </section>
    </main>
  );
}
