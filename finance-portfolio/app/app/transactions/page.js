"use client";

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown, Calendar, RefreshCw } from 'lucide-react';
import { getStockItemsWithAccount } from './actions';
import './transactions.css';

export default function TransactionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 뷰 모드 상태: 'account' (계좌별로 보기 - 디폴트), 'stock' (종목 모아보기)
  const [viewMode, setViewMode] = useState('account');
  // 월 선택 필터 상태: 디폴트는 'all' (전체보기) 또는 최신 월
  const [selectedMonth, setSelectedMonth] = useState('all');
  // 정렬 상태: { key: 필드명, direction: 'asc' | 'desc' | null }
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getStockItemsWithAccount();
      setItems(data);
      setError(null);
      
      // 데이터 로드 시 디폴트로 가장 최근 월을 선택하도록 유도
      if (data && data.length > 0) {
        const months = Array.from(new Set(data.map(item => 
          item.baseDate ? item.baseDate.substring(0, 7) : '미지정'
        ))).filter(m => m !== '미지정').sort().reverse();
        
        if (months.length > 0) {
          setSelectedMonth(months[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load stock status data:", err);
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilterChange = (mode) => {
    setViewMode(mode);
  };

  // 1. 기준월 목록 추출
  const availableMonths = Array.from(new Set(items.map(item => 
    item.baseDate ? item.baseDate.substring(0, 7) : '미지정'
  ))).filter(m => m !== '미지정').sort().reverse();

  // 2. 월별 필터링
  const filteredByMonth = selectedMonth === 'all' 
    ? items 
    : items.filter(item => (item.baseDate ? item.baseDate.substring(0, 7) : '미지정') === selectedMonth);

  // 총 투자금 및 총 전달 대비 변동 계산 (필터링된 결과 기준)
  const totalAmount = filteredByMonth.reduce((sum, item) => sum + item.amount, 0);
  const totalLastMonthChange = filteredByMonth.reduce((sum, item) => sum + item.lastMonthChange, 0);

  // 3. 뷰 모드에 따른 데이터 가공 처리
  const processedItems = (() => {
    if (viewMode === 'account') {
      return filteredByMonth;
    }
    
    // 종목명(stockName) 기준 그룹 합산
    const grouped = {};
    filteredByMonth.forEach(item => {
      const name = item.stockName || '미지정 종목';
      if (!grouped[name]) {
        grouped[name] = {
          itemId: `group-${name}`,
          stockName: name,
          amount: 0,
          lastMonthChange: 0,
          changeVal: 0,
          category: item.category,
          note: '',
          institution: '여러 기관',
          accountType: '합산 계좌',
          allSavings: true,
          originalNotes: []
        };
      }
      grouped[name].amount += item.amount;
      grouped[name].lastMonthChange += item.lastMonthChange;
      grouped[name].changeVal += item.changeVal;
      
      if (item.accountTypeClass !== 'SAVINGS') {
        grouped[name].allSavings = false;
      }
      if (item.note) {
        grouped[name].originalNotes.push(item.note);
      }
    });

    return Object.values(grouped).map(groupItem => {
      const uniqueNotes = Array.from(new Set(groupItem.originalNotes));
      return {
        ...groupItem,
        note: uniqueNotes.join(', '),
        accountTypeClass: groupItem.allSavings ? 'SAVINGS' : 'STOCK'
      };
    });
  })();

  // 4. 정렬 처리 로직
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      }
    }
    setSortConfig({ key: direction ? key : null, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown size={14} className="sort-icon-inactive" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="sort-icon-active" />
      : <ArrowDown size={14} className="sort-icon-active" />;
  };

  const sortedItems = [...processedItems].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    // 현재비중 필드는 amount 기반으로 정렬
    if (sortConfig.key === 'percentage') {
      aValue = a.amount;
      bValue = b.amount;
    }

    if (aValue === undefined || aValue === null || aValue === '') return 1;
    if (bValue === undefined || bValue === null || bValue === '') return -1;

    // 숫자 정렬
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // 문자열 정렬 (한국어 우선 정렬 가능)
    const strA = String(aValue).toLowerCase();
    const strB = String(bValue).toLowerCase();
    if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <div className="loading-wrapper">
        <Loader2 className="spinner" size={40} />
        <p style={{ color: 'var(--text-secondary)' }}>주식 현황 데이터를 분석 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-wrapper">
        <AlertCircle size={40} style={{ color: 'var(--color-danger)' }} />
        <h3 style={{ color: 'var(--text-primary)' }}>{error}</h3>
        <button className="btn-update" style={{ marginTop: 12 }} onClick={loadData}>다시 시도</button>
      </div>
    );
  }

  return (
    <div className="stock-status-container">
      {/* 상단 헤더 */}
      <header className="page-header-premium">
        <div className="header-title-section">
          <h1 className="header-title-main">주식 현황</h1>
          <p className="header-subtitle-main">
            현행화 데이터를 분석하여 실시간 자산 비중과 가치를 조회합니다.
          </p>
        </div>
        
        {/* 새로고침 버튼 */}
        <button className="refresh-btn" onClick={loadData} title="새로고침">
          <RefreshCw size={16} />
        </button>
      </header>

      {/* 대시보드 요약 정보 카드 */}
      <div className="summary-widgets">
        <div className="widget-card">
          <span className="widget-label">총 포트폴리오 자산</span>
          <span className="widget-value">₩{totalAmount.toLocaleString()}</span>
        </div>
        <div className="widget-card">
          <span className="widget-label">전달 대비 총 변동</span>
          <span className={`widget-value ${totalLastMonthChange > 0 ? 'text-up' : totalLastMonthChange < 0 ? 'text-down' : ''}`}>
            {totalLastMonthChange > 0 ? '+' : ''}
            {totalLastMonthChange.toLocaleString()} 원
          </span>
        </div>
      </div>

      {/* 필터 및 컨트롤 바 */}
      <div className="controls-panel">
        <div className="tab-group">
          <button 
            className={`tab-btn ${viewMode === 'account' ? 'active' : ''}`}
            onClick={() => handleFilterChange('account')}
          >
            계좌별 보기
          </button>
          <button 
            className={`tab-btn ${viewMode === 'stock' ? 'active' : ''}`}
            onClick={() => handleFilterChange('stock')}
          >
            종목 모아보기
          </button>
        </div>

        {/* 월별 필터 셀렉터 */}
        <div className="month-selector-wrapper">
          <Calendar size={15} className="selector-icon" />
          <select 
            className="month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="all">전체 월 보기</option>
            {availableMonths.map(month => (
              <option key={month} value={month}>{month.substring(0, 4)}년 {month.substring(5, 7)}월</option>
            ))}
          </select>
        </div>
      </div>

      {/* 테이블 카드 영역 */}
      <div className="table-card-wrapper">
        {sortedItems.length === 0 ? (
          <div className="empty-table-state">
            <AlertCircle size={36} style={{ color: 'var(--text-muted)' }} />
            <p>해당 기준월에 등록된 주식 현황 데이터가 없습니다.</p>
          </div>
        ) : (
          <div className="table-scroll-container">
            <table className="stock-table-premium">
              <thead>
                <tr>
                  <th onClick={() => requestSort('institution')} className="sortable">
                    <div className="th-content">기관명 {getSortIcon('institution')}</div>
                  </th>
                  <th onClick={() => requestSort('accountType')} className="sortable">
                    <div className="th-content">계좌 {getSortIcon('accountType')}</div>
                  </th>
                  <th onClick={() => requestSort('stockName')} className="sortable">
                    <div className="th-content">종목명 {getSortIcon('stockName')}</div>
                  </th>
                  <th onClick={() => requestSort('amount')} className="sortable text-right">
                    <div className="th-content right">투자금 {getSortIcon('amount')}</div>
                  </th>
                  <th onClick={() => requestSort('lastMonthChange')} className="sortable text-right">
                    <div className="th-content right">전달 대비 변동 {getSortIcon('lastMonthChange')}</div>
                  </th>
                  <th onClick={() => requestSort('category')} className="sortable">
                    <div className="th-content">구분 {getSortIcon('category')}</div>
                  </th>
                  <th onClick={() => requestSort('percentage')} className="sortable text-right">
                    <div className="th-content right">현재비중 {getSortIcon('percentage')}</div>
                  </th>
                  <th onClick={() => requestSort('changeVal')} className="sortable text-right">
                    <div className="th-content right">변동 {getSortIcon('changeVal')}</div>
                  </th>
                  <th onClick={() => requestSort('note')} className="sortable">
                    <div className="th-content">비고 {getSortIcon('note')}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const percentage = item.accountTypeClass === 'SAVINGS' 
                    ? '-' 
                    : (totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(1) + '%' : '0.0%');

                  return (
                    <tr key={item.itemId}>
                      {/* 기관명 */}
                      <td>
                        <span className="institution-badge">{item.institution || '-'}</span>
                      </td>
                      
                      {/* 계좌 */}
                      <td>
                        <span className="account-text">
                          {item.accountType ? `${item.accountType}${item.baseDate ? ` (${item.baseDate.substring(5, 10)})` : ''}` : '-'}
                        </span>
                      </td>
                      
                      {/* 종목명 */}
                      <td className="stock-name-cell">
                        {item.stockName || '-'}
                      </td>
                      
                      {/* 투자금 */}
                      <td className="text-right num-font highlight-amount">
                        {item.amount.toLocaleString()}
                      </td>
                      
                      {/* 전달 대비 변동 */}
                      <td className={`text-right num-font ${item.lastMonthChange > 0 ? 'text-up' : item.lastMonthChange < 0 ? 'text-down' : ''}`}>
                        {item.lastMonthChange > 0 ? '+' : ''}
                        {item.lastMonthChange !== 0 ? item.lastMonthChange.toLocaleString() : '-'}
                      </td>
                      
                      {/* 구분 */}
                      <td>
                        <span className={`category-badge ${item.category === '주식' ? 'stock' : item.category === '현금' ? 'cash' : 'etc'}`}>
                          {item.category || '-'}
                        </span>
                      </td>
                      
                      {/* 현재비중 */}
                      <td className="text-right num-font weight-cell">{percentage}</td>
                      
                      {/* 변동 */}
                      <td className={`text-right num-font ${item.changeVal > 0 ? 'text-up' : item.changeVal < 0 ? 'text-down' : ''}`}>
                        {item.changeVal > 0 ? '+' : ''}
                        {item.changeVal !== 0 ? item.changeVal.toLocaleString() : '-'}
                      </td>
                      
                      {/* 비고 */}
                      <td className="note-cell">
                        {item.note || ''}
                      </td>
                    </tr>
                  );
                })}
                
                {/* 합계 행 (Sum) */}
                <tr className="sum-row-premium">
                  <td className="text-center font-bold">합계 (Sum)</td>
                  <td></td>
                  <td></td>
                  <td className="text-right num-font font-bold">
                    {totalAmount.toLocaleString()}
                  </td>
                  <td className={`text-right num-font font-bold ${totalLastMonthChange > 0 ? 'text-up' : totalLastMonthChange < 0 ? 'text-down' : ''}`}>
                    {totalLastMonthChange > 0 ? '+' : ''}
                    {totalLastMonthChange !== 0 ? totalLastMonthChange.toLocaleString() : '-'}
                  </td>
                  <td></td>
                  <td className="text-right num-font font-bold">
                    {totalAmount > 0 ? '100.0%' : '0.0%'}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
