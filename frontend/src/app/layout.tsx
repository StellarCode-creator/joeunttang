import "./globals.css";
import KakaoMapScript from "@/components/map/KakaoMapScript";

export const metadata = {
  title: "부동산 대시보드",
  description: "부동산 대시보드 UI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="bg-gray-100">
        <KakaoMapScript />
        {children}
      </body>
    </html>
  );
}
