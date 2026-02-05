"use client";

import Script from "next/script";

export default function KakaoMapScript() {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  // 키가 없으면 스크립트를 로드하지 않음(페이지가 죽는 것 방지)
  if (!key) return null;

  return (
    <Script
      src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`}
      strategy="beforeInteractive"
    />
  );
}
