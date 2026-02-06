// frontend/src/components/map/RightMapKakao.tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DealMode, SelectedApt } from "@/app/page";

type KakaoLatLng = { getLat(): number; getLng(): number };
type KakaoBounds = { getSouthWest(): KakaoLatLng; getNorthEast(): KakaoLatLng };

type KakaoMap = {
  getBounds(): KakaoBounds;
  relayout(): void;
};

type KakaoMarker = { setMap(map: KakaoMap | null): void };
type KakaoCustomOverlay = { setMap(map: KakaoMap | null): void };

type KakaoLike = {
  maps: {
    load(cb: () => void): void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    Map: new (el: HTMLElement, opts: { center: KakaoLatLng; level: number }) => KakaoMap;
    Marker: new (opts: { position: KakaoLatLng }) => KakaoMarker;
    CustomOverlay: new (opts: { position: KakaoLatLng; content: HTMLElement; yAnchor?: number }) => KakaoCustomOverlay;
    event: { addListener(target: unknown, type: string, handler: () => void): void };
  };
};

declare global {
  interface Window {
    kakao?: KakaoLike;
  }
}

type TradeClusterItem = {
  lawdCd: string;
  umdNm: string;
  aptNm: string;
  lat: number;
  lng: number;
  tradeCnt: number;
  minPrice: number;
  maxPrice: number;
  lastTradeYmd: string;
};

type RentClusterItem = {
  lawdCd: string;
  umdNm: string;
  aptNm: string;
  lat: number;
  lng: number;
  rentCnt: number;
  minDeposit: number;
  maxDeposit: number;
  minMonthlyRent: number;
  maxMonthlyRent: number;
  lastDealYmd: string;
};

function getObj(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}
function getStr(o: Record<string, unknown>, k: string) {
  const v = o[k];
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}
function getNum(o: Record<string, unknown>, k: string) {
  const v = o[k];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function isValidLawdCd(v: string) {
  return /^[0-9]{5,10}$/.test(v);
}

function formatEokFromManwon(vManwon: number) {
  const eok = vManwon / 10000;
  return `${eok.toFixed(eok >= 10 ? 0 : 1)}억`;
}
function formatYmd(ymd: string) {
  if (!ymd) return ymd;
  if (ymd.length === 6) return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}`;
  if (ymd.length === 8) return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  return ymd;
}

function buildOverlayElTrade(it: TradeClusterItem) {
  const el = document.createElement("div");
  el.className = "rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-md";
  el.style.whiteSpace = "nowrap";
  el.style.cursor = "pointer";
  el.innerHTML = `
    <div style="font-weight:700; color:#111827; max-width:220px; overflow:hidden; text-overflow:ellipsis;">
      ${it.aptNm}
    </div>
    <div style="margin-top:2px; color:#374151;">
      ${formatEokFromManwon(it.minPrice)} ~ ${formatEokFromManwon(it.maxPrice)} · ${it.tradeCnt}건
    </div>
    <div style="margin-top:2px; color:#6B7280;">
      ${formatYmd(it.lastTradeYmd)}
    </div>
  `;
  return el;
}

function buildOverlayElRent(it: RentClusterItem, dealMode: DealMode) {
  const el = document.createElement("div");
  el.className = "rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-md";
  el.style.whiteSpace = "nowrap";
  el.style.cursor = "pointer";

  const line =
    dealMode === "jeonse"
      ? `${formatEokFromManwon(it.minDeposit)} ~ ${formatEokFromManwon(it.maxDeposit)} · ${it.rentCnt}건`
      : `보 ${formatEokFromManwon(it.minDeposit)}~${formatEokFromManwon(it.maxDeposit)} / 월 ${it.minMonthlyRent}~${it.maxMonthlyRent}만 · ${it.rentCnt}건`;

  el.innerHTML = `
    <div style="font-weight:700; color:#111827; max-width:220px; overflow:hidden; text-overflow:ellipsis;">
      ${it.aptNm}
    </div>
    <div style="margin-top:2px; color:#374151;">
      ${line}
    </div>
    <div style="margin-top:2px; color:#6B7280;">
      ${formatYmd(it.lastDealYmd)}
    </div>
  `;
  return el;
}

export default function RightMapKakao({
  dealMode,
  onSelectApt,
}: {
  dealMode: DealMode;
  onSelectApt: (apt: SelectedApt) => void;
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const overlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPins = useCallback(() => {
    for (const m of markersRef.current) m.setMap(null);
    for (const o of overlaysRef.current) o.setMap(null);
    markersRef.current = [];
    overlaysRef.current = [];
  }, []);

  const fetchAndRender = useCallback(async () => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;

    const b = map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();

    // ✅ 백엔드 컨트롤러 파라미터에 맞춤 (min/max)
    const qs = new URLSearchParams({
      minLng: String(sw.getLng()),
      minLat: String(sw.getLat()),
      maxLng: String(ne.getLng()),
      maxLat: String(ne.getLat()),
      limit: "1200",
    });

    if (dealMode !== "trade") {
      qs.set("rentType", dealMode === "jeonse" ? "jeonse" : "monthly");
    }

    try {
      const url =
        dealMode === "trade"
          ? `http://localhost:4000/api/map/trades?${qs.toString()}`
          : `http://localhost:4000/api/map/rents?${qs.toString()}`;

      const res = await fetch(url, { cache: "no-store" });
      const json: unknown = await res.json();
      const root = getObj(json);

      if (!root || root["ok"] !== true) {
        clearPins();
        return;
      }

      clearPins();

      const itemsRaw = Array.isArray(root["items"]) ? (root["items"] as unknown[]) : [];

      if (dealMode === "trade") {
        for (const raw of itemsRaw) {
          const o = getObj(raw);
          if (!o) continue;

          const it: TradeClusterItem = {
            lawdCd: getStr(o, "lawdCd"),
            umdNm: getStr(o, "umdNm"),
            aptNm: getStr(o, "aptNm"),
            lat: getNum(o, "lat"),
            lng: getNum(o, "lng"),
            tradeCnt: getNum(o, "tradeCnt"),
            minPrice: getNum(o, "minPrice"),
            maxPrice: getNum(o, "maxPrice"),
            lastTradeYmd: getStr(o, "lastTradeYmd"),
          };

          const selectable = isValidLawdCd(it.lawdCd);

          const pos = new kakao.maps.LatLng(it.lat, it.lng);
          const marker = new kakao.maps.Marker({ position: pos });
          marker.setMap(map);
          markersRef.current.push(marker);

          const overlayEl = buildOverlayElTrade(it);
          const select = () => {
            if (!selectable) return;
            onSelectApt({ lawdCd: it.lawdCd, umdNm: it.umdNm, aptNm: it.aptNm });
          };
          overlayEl.addEventListener("click", select);

          const overlay = new kakao.maps.CustomOverlay({ position: pos, content: overlayEl, yAnchor: 1.55 });
          overlay.setMap(map);
          overlaysRef.current.push(overlay);

          kakao.maps.event.addListener(marker, "click", select);
        }
      } else {
        for (const raw of itemsRaw) {
          const o = getObj(raw);
          if (!o) continue;

          const it: RentClusterItem = {
            lawdCd: getStr(o, "lawdCd"),
            umdNm: getStr(o, "umdNm"),
            aptNm: getStr(o, "aptNm"),
            lat: getNum(o, "lat"),
            lng: getNum(o, "lng"),
            rentCnt: getNum(o, "rentCnt"),
            minDeposit: getNum(o, "minDeposit"),
            maxDeposit: getNum(o, "maxDeposit"),
            minMonthlyRent: getNum(o, "minMonthlyRent"),
            maxMonthlyRent: getNum(o, "maxMonthlyRent"),
            lastDealYmd: getStr(o, "lastDealYmd"),
          };

          const selectable = isValidLawdCd(it.lawdCd);

          const pos = new kakao.maps.LatLng(it.lat, it.lng);
          const marker = new kakao.maps.Marker({ position: pos });
          marker.setMap(map);
          markersRef.current.push(marker);

          const overlayEl = buildOverlayElRent(it, dealMode);
          const select = () => {
            if (!selectable) return;
            onSelectApt({ lawdCd: it.lawdCd, umdNm: it.umdNm, aptNm: it.aptNm });
          };
          overlayEl.addEventListener("click", select);

          const overlay = new kakao.maps.CustomOverlay({ position: pos, content: overlayEl, yAnchor: 1.55 });
          overlay.setMap(map);
          overlaysRef.current.push(overlay);

          kakao.maps.event.addListener(marker, "click", select);
        }
      }
    } catch (e) {
      console.error(e);
      clearPins();
    }
  }, [clearPins, dealMode, onSelectApt]);

  useEffect(() => {
    const div = mapDivRef.current;
    if (!div) return;

    const kakao = window.kakao;
    if (!kakao?.maps?.load) return;

    kakao.maps.load(() => {
      const center = new kakao.maps.LatLng(33.4996, 126.5312);
      const map = new kakao.maps.Map(div, { center, level: 6 });
      mapRef.current = map;

      void fetchAndRender();

      kakao.maps.event.addListener(map, "idle", () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => void fetchAndRender(), 250);
      });

      setTimeout(() => {
        try {
          map.relayout();
        } catch {}
      }, 0);
    });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      clearPins();
      mapRef.current = null;
    };
  }, [clearPins, fetchAndRender]);

  useEffect(() => {
    void fetchAndRender();
  }, [fetchAndRender]);

  return <div ref={mapDivRef} className="h-full w-full" />;
}
