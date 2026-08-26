import "./globals.css";
import "./redesign.css";
import "./design-v3.css";
import "./design-v4.css";
import "./design-v5-memphis.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AgentShelf AI 商品上新质检",
  description: "面向 AI 商品上新的测试、修复和发布工具",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
