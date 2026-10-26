import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  description: "공개 저장소의 API 호출과 코드 근거를 확인합니다.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
