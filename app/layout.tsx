import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Whetstone — エージェントを専門家の判断で研ぎ上げる",
  description:
    "専門家のジャッジを汎用ルールに変換し、AIエージェントのエスカレーション率を下げるランタイム層",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
