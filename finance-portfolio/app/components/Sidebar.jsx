"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Activity, 
  PieChart as PieIcon, 
  TrendingUp, 
  ListFilter, 
  Settings 
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  // 활성화 메뉴 여부 판단
  const isDashboardActive = pathname === '/';
  const isAccountsActive = pathname === '/accounts';
  const isTransactionsActive = pathname === '/transactions';
  const isSettingsActive = pathname === '/settings';

  return (
    <aside className="sidebar">
      {/* 로고 영역 */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Activity size={20} />
        </div>
        <span className="logo-text">Finance portfolio</span>
      </div>

      {/* 내비게이션 메뉴 */}
      <nav style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <ul className="sidebar-menu">
          <li>
            <Link href="/" className="menu-item-link">
              <div className={`menu-item ${isDashboardActive ? 'active' : ''}`}>
                <PieIcon size={18} />
                <span>대시보드</span>
              </div>
            </Link>
          </li>
          <li>
            <Link href="/accounts" className="menu-item-link">
              <div className={`menu-item ${isAccountsActive ? 'active' : ''}`}>
                <TrendingUp size={18} />
                <span>현행화 입력</span>
              </div>
            </Link>
          </li>
          <li>
            <Link href="/transactions" className="menu-item-link">
              <div className={`menu-item ${isTransactionsActive ? 'active' : ''}`}>
                <ListFilter size={18} />
                <span>주식 현황</span>
              </div>
            </Link>
          </li>
          <li>
            <Link href="/settings" className="menu-item-link">
              <div className={`menu-item ${isSettingsActive ? 'active' : ''}`}>
                <Settings size={18} />
                <span>설정</span>
              </div>
            </Link>
          </li>
        </ul>
      </nav>

      {/* 푸터 프로필 */}
      <div className="sidebar-footer">
        <div className="user-profile-summary">
          <div className="avatar">JD</div>
          <div className="profile-info">
            <span className="profile-name">홍길동</span>
            <span className="profile-role">개인 투자자</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
