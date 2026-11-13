import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "席衡 · 剧场演出工作台",
  description: "剧场演出票务一期：产品、场次库存、订单与销售报表。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
