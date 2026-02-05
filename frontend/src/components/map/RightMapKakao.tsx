"use client";

import { useEffect, useRef } from "react";
import type { SelectedApt } from "@/app/page";

declare global {
  interface Window {
    kakao?: any;
  }
}

type TradeClusterItem = {
  lawdCd: string;
  umdNm: string;
  aptNm: string;
  jibun?: string;
  lat: number;
  lng: number;
  tradeCnt: number;
  minPrice: number;
  maxPrice: number;
  lastTradeYmd: string;
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

function norm(s: unknown) {
  return String(s ?? "").trim();
}

function isValidLawdCd(v: string) {
  // 숫자로만 이루어진 5~10자리 코드만 허용
  return /^[0-9]{5,10}$/.test(v);
}

function buildOverlayEl(it: TradeClusterItem) {
  const el = document.createElement("div");
  el.className =
    "rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-md";
  (el.style as any).whiteSpace = "nowrap";
  el.style.cursor = "pointer";
  el.innerHTML = `
    <div style="font-weight:700; color:#111827; max-width:220px; overflow:hidden; text-overflow:ellipsis;">
      ${it.aptNm}
    </div>
    <div style="margin-top:2px; color:#374151;">
      ${formatKoreanMoneyManwon(it.minPrice)} ~ ${formatKoreanMoneyManwon(
        it.maxPrice
      )} · ${it.tradeCnt}건
    </div>
    <div style="margin-top:2px; color:#6B7280;">
      ${formatYmd(it.lastTradeYmd)}
    </div>
  `;
  return el;
}

export default function RightMapKakao({
  onSelectApt,
}: {
  onSelectApt: (apt: SelectedApt) => void;
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);
  const debounceTimerRef = useRef<any>(null);

  const clearPins = () => {
    markersRef.current.forEach((m) => m.setMap(null));
    overlaysRef.current.forEach((o) => o.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];
  };

  const fetchAndRender = async () => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;

    const b = map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();

    const qs = new URLSearchParams({
      swLat: String(sw.getLat()),
      swLng: String(sw.getLng()),
      neLat: String(ne.getLat()),
      neLng: String(ne.getLng()),
      limit: "500",
    });

    try {
      const res = await fetch(
        `http://localhost:4000/api/map/trades?${qs.toString()}`,
        { cache: "no-store" }
      );
      const json = await res.json();

      if (!json?.ok) {
        clearPins();
        return;
      }

      const items: TradeClusterItem[] = json.items ?? [];
      clearPins();

      for (const raw of items) {
        const it: TradeClusterItem = {
          ...raw,
          lawdCd: norm(raw.lawdCd),
          umdNm: norm(raw.umdNm),
          aptNm: norm(raw.aptNm),
          jibun: norm(raw.jibun),
        };

        // 🚨 lawdCd 비정상이면 지도에만 보여주고 "선택 불가"
        const selectable = isValidLawdCd(it.lawdCd);

        const pos = new kakao.maps.LatLng(it.lat, it.lng);
        const marker = new kakao.maps.Marker({ position: pos });
        marker.setMap(map);
        markersRef.current.push(marker);

        const overlayEl = buildOverlayEl(it);

        const select = () => {
          if (!selectable) {
            console.warn("❌ INVALID lawdCd – selection blocked", it);
            return;
          }

          console.log("✅ SELECT APT", it);

          onSelectApt({
            lawdCd: it.lawdCd,
            umdNm: it.umdNm,
            aptNm: it.aptNm,
          });
        };

        overlayEl.addEventListener("click", select);

        const overlay = new kakao.maps.CustomOverlay({
          position: pos,
          content: overlayEl,
          yAnchor: 1.55,
        });
        overlay.setMap(map);
        overlaysRef.current.push(overlay);

        kakao.maps.event.addListener(marker, "click", select);
      }
    } catch (e) {
      console.error(e);
      clearPins();
    }
  };

  useEffect(() => {
    const div = mapDivRef.current;
    if (!div) return;

    const kakao = window.kakao;
    if (!kakao?.maps?.load) return;

    kakao.maps.load(() => {
      const center = new kakao.maps.LatLng(33.4996, 126.5312);
      const map = new kakao.maps.Map(div, { center, level: 6 });
      mapRef.current = map;

      fetchAndRender();

      kakao.maps.event.addListener(map, "idle", () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(fetchAndRender, 250);
      });

      setTimeout(() => {
        try {
          map.relayout();
        } catch {}
      }, 0);
    });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      clearPins();
      mapRef.current = null;
    };
  }, []);

  return <div ref={mapDivRef} className="h-full w-full" />;
}
