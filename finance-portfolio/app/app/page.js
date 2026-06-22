"use client";

import { useState, useEffect } from 'react';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Filler 
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Bell, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Briefcase, 
  Calendar, 
  Wallet, 
  Percent,
  Loader2
} from 'lucide-react';
import { getDashboardData } from './dashboard-actions';

// Chart.js 모듈 등록
ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Filler
);

const iconMap = {
  Briefcase: Briefcase,
  Wallet: Wallet,
  Percent: Percent,
  Calendar: Calendar
};

const categoryColors = {
  '국내주식': '#6366f1',
  '해외주식': '#06b6d4',
  '채권': '#f59e0b',
  '가상자산': '#ec4899',
  '현금': '#10b981',
  '현금자산': '#10b981',
  '배당자산': '#3b82f6',
  '성장자산': '#6366f1',
  '대체투자': '#8b5cf6',
  '금': '#eab308'
};

const defaultColors = ['#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#8b5cf6', '#eab308'];

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [timeline, setTimeline] = useState('6M'); // 1M, 3M, 6M, 1Y
  const [txFilter, setTxFilter] = useState('ALL'); // ALL, ADD, CHANGE, DELETE
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getDashboardData();
      setData(res);
      setError(null);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <Loader2 className="spinner" size={40} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>대시보드 데이터를 실시간 분석 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <p style={{ color: 'var(--color-danger)', fontSize: '1rem', fontWeight: 600 }}>{error}</p>
        <button 
          onClick={loadData}
          style={{ padding: '10px 20px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data || !data.hasData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '24px', padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <Briefcase size={28} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>대시보드 데이터가 없습니다</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: 1.5, margin: '0 auto' }}>
            대시보드를 활성화하기 위해 자산 현행화 입력 페이지에서 먼저 계좌와 자산을 추가해 주세요.
          </p>
        </div>
        <a 
          href="/accounts"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)' }}
        >
          <Plus size={16} />
          <span>자산 등록하러 가기</span>
        </a>
      </div>
    );
  }

  // 1. 원형 그래프 (자산 배분) 데이터 및 옵션 설정
  const allocationLabels = data.assetAllocation.map(item => item.category);
  const allocationValues = data.assetAllocation.map(item => item.percentage);
  const allocationColors = data.assetAllocation.map((item, idx) => 
    categoryColors[item.category] || defaultColors[idx % defaultColors.length]
  );

  const assetAllocationData = {
    labels: allocationLabels,
    datasets: [
      {
        data: allocationValues,
        backgroundColor: allocationColors,
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4
      }
    ]
  };

  const assetAllocationOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return ` ${context.label}: ${context.raw}%`;
          }
        }
      }
    },
    cutout: '75%'
  };

  // 투자 비중 계산 (현금 및 현금자산을 제외한 비중)
  const cashAmount = data.assetAllocation
    .filter(item => item.category === '현금' || item.category === '현금자산')
    .reduce((sum, item) => sum + item.amount, 0);
  const totalVal = data.assetAllocation.reduce((sum, item) => sum + item.amount, 0);
  const investPercentage = totalVal > 0 ? Math.round(((totalVal - cashAmount) / totalVal) * 100) : 0;

  // 2. 선 그래프 (자산 성장 추이 - 타임라인 슬라이싱)
  const getFilteredTrend = () => {
    let limit = 6;
    if (timeline === '1M') limit = 2;
    else if (timeline === '3M') limit = 3;
    else if (timeline === '6M') limit = 6;
    else if (timeline === '1Y') limit = 12;
    return data.monthlyTrend.slice(-limit);
  };

  const filteredTrend = getFilteredTrend();
  const trendLabels = filteredTrend.map(item => item.label);
  const trendValues = filteredTrend.map(item => item.value);

  const assetTrendData = {
    labels: trendLabels,
    datasets: [
      {
        label: '총 자산 추이',
        data: trendValues,
        fill: true,
        backgroundColor: function(context) {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
          gradient.addColorStop(1, 'rgba(99, 102, 241, 0.00)');
          return gradient;
        },
        borderColor: '#6366f1',
        borderWidth: 3,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35
      }
    ]
  };

  const assetTrendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return ` ₩${context.raw.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#64748b',
          font: {
            family: 'Plus Jakarta Sans',
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          color: '#64748b',
          font: {
            family: 'Plus Jakarta Sans',
            size: 11
          },
          callback: function(value) {
            return (value / 10000).toLocaleString() + '만';
          }
        }
      }
    }
  };

  // 주요 보유 자산 검색 필터 적용
  const filteredHoldings = data.holdings.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* 상단 헤더 */}
      <header className="top-header">
        <div className="header-title-section">
          <h1 className="header-title">투자 대시보드</h1>
          <p className="header-subtitle">실시간 금융 자산 현황과 분석 데이터를 확인하세요.</p>
        </div>

        <div className="header-actions">
          <div className="search-bar">
            <Search size={18} className="search-icon" style={{ color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="종목명 검색..." 
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <button className="action-btn" aria-label="Notifications">
            <Bell size={18} />
            <div className="badge"></div>
          </button>

          <a href="/accounts" className="action-btn" aria-label="Add Asset" style={{ backgroundColor: 'var(--color-primary)', color: 'white', borderColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={18} />
          </a>
        </div>
      </header>

      {/* 1. KPI 카드 그리드 */}
      <section className="kpi-grid">
        {data.kpis.map((kpi, idx) => {
          const Icon = iconMap[kpi.icon] || Briefcase;
          return (
            <div key={idx} className={`kpi-card ${kpi.type}`}>
              <div className="kpi-header">
                <span className="kpi-title">{kpi.title}</span>
                <div className="kpi-icon-wrapper">
                  <Icon size={18} />
                </div>
              </div>
              <div className="kpi-value-container">
                <span className="kpi-value">{kpi.value}</span>
                {kpi.isUp !== null ? (
                  <span className={`kpi-change ${kpi.isUp ? 'up' : 'down'}`}>
                    {kpi.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {kpi.change}
                  </span>
                ) : (
                  <span className="kpi-change neutral">
                    {kpi.change}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* 2. 차트 영역 그리드 */}
      <section className="charts-grid">
        {/* 자산 추이 그래프 */}
        <div className="chart-card">
          <div className="chart-header">
            <span className="chart-title">누적 자산 추이</span>
            <div className="chart-actions">
              {['1M', '3M', '6M', '1Y'].map((t) => (
                <button 
                  key={t}
                  className={`chart-tab-btn ${timeline === t ? 'active' : ''}`}
                  onClick={() => setTimeline(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="line-chart-wrapper">
            <Line data={assetTrendData} options={assetTrendOptions} />
          </div>
        </div>

        {/* 자산 배분 도넛 차트 */}
        <div className="chart-card">
          <div className="chart-header">
            <span className="chart-title">자산 배분 비율 ({data.latestMonth ? `${data.latestMonth.substring(0, 4)}년 ${data.latestMonth.substring(5, 7)}월` : ''})</span>
          </div>
          <div className="pie-chart-wrapper">
            {allocationValues.length > 0 ? (
              <Doughnut data={assetAllocationData} options={assetAllocationOptions} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>등록된 종목이 없습니다.</div>
            )}
            <div className="pie-chart-center">
              <span className="pie-center-value">{investPercentage}%</span>
              <span className="pie-center-label">투자 비중</span>
            </div>
          </div>
          {/* 커스텀 범례 */}
          <div className="pie-legend">
            {data.assetAllocation.map((item, idx) => (
              <div key={idx} className="legend-item">
                <span 
                  className="legend-indicator" 
                  style={{ backgroundColor: assetAllocationData.datasets[0].backgroundColor[idx] }}
                />
                <span>{item.category}</span>
                <span className="legend-percentage">
                  {item.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. 하단 상세 정보 그리드 */}
      <section className="bottom-grid">
        {/* 보유 종목 상세 */}
        <div className="data-card">
          <div className="data-card-header">
            <span className="data-card-title">주요 보유 자산</span>
            <a href="/transactions" className="view-all-link">전체 보기</a>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>자산명</th>
                  <th>평가금액</th>
                  <th>평가손익</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {filteredHoldings.map((stock, idx) => {
                  const color = categoryColors[stock.category] || '#64748b';
                  const code = stock.name.substring(0, 2).toUpperCase();
                  const isGainUp = stock.changeVal > 0;
                  const isGainDown = stock.changeVal < 0;
                  
                  return (
                    <tr key={idx}>
                      <td>
                        <div className="holding-ticker-cell">
                          <div className="ticker-icon" style={{ backgroundColor: color }}>
                            {code}
                          </div>
                          <div className="ticker-info">
                            <span className="ticker-symbol">{stock.name}</span>
                            <span className="ticker-name">{stock.accountName || stock.category}</span>
                          </div>
                        </div>
                      </td>
                      <td>₩{stock.amount.toLocaleString()}</td>
                      <td className={isGainUp ? 'positive-val' : isGainDown ? 'negative-val' : ''}>
                        {isGainUp ? '+' : ''}{stock.changeVal !== 0 ? `₩${Math.round(stock.changeVal).toLocaleString()}` : '-'}
                      </td>
                      <td>{stock.note || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 최근 자산 변동 내역 */}
        <div className="data-card">
          <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span className="data-card-title">최근 자산 변동 내역</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="chart-actions" style={{ gap: '4px' }}>
                {['ALL', 'ADD', 'CHANGE', 'DELETE'].map((f) => {
                  const labels = { ALL: '전체', ADD: '추가', CHANGE: '변경', DELETE: '삭제' };
                  return (
                    <button 
                      key={f}
                      className={`chart-tab-btn ${txFilter === f ? 'active' : ''}`}
                      onClick={() => setTxFilter(f)}
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    >
                      {labels[f]}
                    </button>
                  );
                })}
              </div>
              <a href="/transactions" className="view-all-link">전체 보기</a>
            </div>
          </div>
          <div className="transaction-list">
            {(() => {
              const filteredChanges = data.recentChanges.filter(tx => {
                if (txFilter === 'ALL') return true;
                if (txFilter === 'ADD') return tx.type === 'ADD';
                if (txFilter === 'CHANGE') return tx.type === 'CHANGE_UP' || tx.type === 'CHANGE_DOWN';
                if (txFilter === 'DELETE') return tx.type === 'DELETE';
                return true;
              });

              const txStyles = {
                ADD: { icon: Plus, class: 'buy', meta: '신규 자산 추가' },
                CHANGE_UP: { icon: ArrowDownLeft, class: 'buy', meta: '자산 상승' },
                CHANGE_DOWN: { icon: ArrowUpRight, class: 'sell', meta: '자산 하락' },
                DELETE: { icon: ArrowUpRight, class: 'sell', meta: '자산 제외/삭제' }
              };

              if (filteredChanges.length === 0) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '120px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>선택한 필터 조건에 해당하는 변동 내역이 없습니다.</div>
                );
              }

              return filteredChanges.map((tx) => {
                const styleInfo = txStyles[tx.type] || txStyles.ADD;
                const TxIcon = styleInfo.icon;
                return (
                  <div key={tx.id} className="transaction-item">
                    <div className="tx-left">
                      <div className={`tx-icon-wrapper ${styleInfo.class}`}>
                        <TxIcon size={16} />
                      </div>
                      <div className="tx-details">
                        <span className="tx-title">{tx.name}</span>
                        <span className="tx-meta">{styleInfo.meta} • {tx.accountName || '계좌'}</span>
                      </div>
                    </div>
                    <div className="tx-right">
                      <span className="tx-amount">{tx.amount >= 0 ? '+' : ''}₩{Math.round(tx.amount).toLocaleString()}</span>
                      <span className="tx-shares">{tx.note || ''}</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </section>
    </>
  );
}
