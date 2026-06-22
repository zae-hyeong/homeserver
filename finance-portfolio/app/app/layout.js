import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "Finance Portfolio",
  description: "개인 자산 포트폴리오 관리 및 AI 현행화 시스템",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="dashboard-container">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
