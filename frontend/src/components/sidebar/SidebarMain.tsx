// frontend/src/components/sidebar/SidebarMain.tsx
"use client";

import Header from "./modules/Header";
import Summary from "./modules/Summary";
import Banner from "./modules/Banner";
import PriceSection from "./modules/PriceSection";
import RecentTrades3Months from "./modules/RecentTrades3Months";
import UnitTypeInfo from "./modules/UnitTypeInfo";
import PredictiveLease from "./modules/PredictiveLease";
import TaxLoanSection from "./modules/TaxLoanSection";
import AssetManagement from "./modules/AssetManagement";
import type { DealMode, SelectedApt } from "@/app/page";

export default function SidebarMain({
  selectedApt,
  dealMode,
  onChangeDealMode,
  onOpenTradePanel,
}: {
  selectedApt: SelectedApt | null;
  dealMode: DealMode;
  onChangeDealMode: (m: DealMode) => void;
  onOpenTradePanel: () => void;
}) {
  return (
    <aside className="fixed left-0 top-0 z-30 flex h-full w-[420px] flex-col bg-white shadow-2xl">
      <Header selectedApt={selectedApt} dealMode={dealMode} onChangeDealMode={onChangeDealMode} />

      <div className="scrollbar-hide flex-1 overflow-y-auto bg-white">
        <Summary selectedApt={selectedApt} dealMode={dealMode} />
        <Banner />

        <div className="my-4 h-2 border-y border-gray-100 bg-gray-50" />

        <PriceSection selectedApt={selectedApt} dealMode={dealMode} />
        <RecentTrades3Months selectedApt={selectedApt} dealMode={dealMode} onOpenMore={onOpenTradePanel} />

        <UnitTypeInfo />
        <PredictiveLease />
        <TaxLoanSection />
        <AssetManagement />
      </div>

      <div className="border-t border-gray-100 bg-white p-4">
        <button className="w-full rounded-xl border border-[#635BFF] py-4 font-bold text-[#635BFF] transition-all hover:bg-blue-50">
          이 단지 매물 2개 보기
        </button>
      </div>
    </aside>
  );
}
