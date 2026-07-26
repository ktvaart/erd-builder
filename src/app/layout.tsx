import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERD Builder",
  description: "브라우저에서 테이블을 그리고 컬럼을 연결해 DDL을 뽑아내는 ERD 설계 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="h-full overflow-hidden antialiased">{children}</body>
    </html>
  );
}
