"use server";

import pool from '@/lib/db';

export async function getDashboardData() {
  try {
    const { rows: accounts } = await pool.query('SELECT * FROM account ORDER BY base_date ASC, id ASC');
    const { rows: stockItems } = await pool.query('SELECT * FROM stock_item');

    // 만약 데이터가 전혀 없으면 빈 응답 반환
    if (accounts.length === 0) {
      return {
        hasData: false,
        kpis: [],
        assetAllocation: [],
        monthlyTrend: [],
        holdings: [],
        recentChanges: []
      };
    }

    // base_date 기준 연월 그룹화
    const accountsByMonth = {};
    accounts.forEach(acc => {
      if (!acc.base_date) return;
      const month = acc.base_date.substring(0, 7);
      if (!accountsByMonth[month]) {
        accountsByMonth[month] = [];
      }
      accountsByMonth[month].push(acc);
    });

    const sortedMonths = Object.keys(accountsByMonth).sort();
    if (sortedMonths.length === 0) {
      return {
        hasData: false,
        kpis: [],
        assetAllocation: [],
        monthlyTrend: [],
        holdings: [],
        recentChanges: []
      };
    }

    const latestMonth = sortedMonths[sortedMonths.length - 1];
    const prevMonth = sortedMonths.length > 1 ? sortedMonths[sortedMonths.length - 2] : null;

    const latestAccounts = accountsByMonth[latestMonth] || [];
    const latestTotalValue = latestAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

    let prevTotalValue = 0;
    if (prevMonth) {
      const prevAccounts = accountsByMonth[prevMonth] || [];
      prevTotalValue = prevAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    }

    const momChange = latestTotalValue - prevTotalValue;
    
    // 수익률 (추가로 투자한 금액을 제외하고 순수하게 증가한 금액의 합계)
    // stock_item의 change_val을 합산하여 순수하게 증가한 금액을 구함
    const latestAccountIds = new Set(latestAccounts.map(acc => acc.id));
    const latestStockItems = stockItems.filter(item => latestAccountIds.has(item.account_id));
    
    let totalPureGain = 0;
    latestStockItems.forEach(item => {
      totalPureGain += parseFloat(item.change_val || 0);
    });

    // 수익률 % 계산 (이전 달 총 자산 대비 순수 증가액, 이전 달이 없으면 최신 총 자산 - 순수 증가액 대비)
    let returnRate = 0;
    const denominator = prevTotalValue > 0 ? prevTotalValue : (latestTotalValue - totalPureGain);
    if (denominator > 0) {
      returnRate = (totalPureGain / denominator) * 100;
    }

    let momChangePercent = 0;
    if (prevTotalValue > 0) {
      momChangePercent = (momChange / prevTotalValue) * 100;
    }

    const kpis = [
      {
        title: '총 포트폴리오 가치',
        value: '₩' + Math.round(latestTotalValue).toLocaleString(),
        change: prevTotalValue > 0 
          ? `${momChangePercent >= 0 ? '+' : ''}${momChangePercent.toFixed(1)}% (전월비)` 
          : '첫 달 등록됨',
        isUp: prevTotalValue > 0 ? (momChange >= 0) : null,
        icon: 'Briefcase',
        type: 'primary'
      },
      {
        title: '전달 대비 금액 변동',
        value: (momChange >= 0 ? '+' : '') + '₩' + Math.round(momChange).toLocaleString(),
        change: '추가 투자금 포함',
        isUp: momChange !== 0 ? (momChange > 0) : null,
        icon: 'Wallet',
        type: 'info'
      },
      {
        title: '수익률',
        value: (returnRate >= 0 ? '+' : '') + returnRate.toFixed(1) + '%',
        change: (totalPureGain >= 0 ? '+' : '') + '₩' + Math.round(totalPureGain).toLocaleString() + ' (순수익)',
        isUp: totalPureGain !== 0 ? (totalPureGain > 0) : null,
        icon: 'Percent',
        type: 'success'
      }
    ];

    // 자산 배분 비율
    const categorySums = {};
    latestStockItems.forEach(item => {
      const cat = item.category || '기타';
      categorySums[cat] = (categorySums[cat] || 0) + parseFloat(item.amount || 0);
    });

    const assetAllocation = Object.keys(categorySums).map(cat => {
      const amount = categorySums[cat];
      const percentage = latestTotalValue > 0 ? Math.round((amount / latestTotalValue) * 100) : 0;
      return {
        category: cat,
        amount,
        percentage
      };
    }).sort((a, b) => b.amount - a.amount);

    // 자산 성장 추이
    const monthlyTrend = sortedMonths.map(month => {
      const accs = accountsByMonth[month] || [];
      const totalVal = accs.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
      const [year, m] = month.split('-');
      const label = `${parseInt(m)}월`;
      return {
        month,
        label,
        value: totalVal
      };
    });

    // 주요 보유 자산 (금액 순 정렬)
    const holdings = latestStockItems.map(item => {
      const account = latestAccounts.find(acc => acc.id === item.account_id);
      return {
        id: item.id,
        name: item.name,
        amount: parseFloat(item.amount || 0),
        category: item.category,
        lastMonthChange: parseFloat(item.last_month_change || 0),
        changeVal: parseFloat(item.change_val || 0),
        note: item.note,
        accountName: account ? account.name : ''
      };
    }).sort((a, b) => b.amount - a.amount).slice(0, 10);

    // 최근 변동 내역 계산 (이전 달 데이터와 비교하는 상세 비교 엔진)
    const latestMap = new Map();
    const prevMap = new Map();

    latestStockItems.forEach(item => {
      const account = latestAccounts.find(acc => acc.id === item.account_id);
      const key = `${account ? account.institution : ''}_${account ? account.name : ''}_${item.name}`;
      latestMap.set(key, { item, account });
    });

    let prevAccounts = [];
    let prevStockItems = [];
    if (prevMonth) {
      prevAccounts = accountsByMonth[prevMonth] || [];
      const prevAccountIds = new Set(prevAccounts.map(acc => acc.id));
      prevStockItems = stockItems.filter(item => prevAccountIds.has(item.account_id));
      
      prevStockItems.forEach(item => {
        const account = prevAccounts.find(acc => acc.id === item.account_id);
        const key = `${account ? account.institution : ''}_${account ? account.name : ''}_${item.name}`;
        prevMap.set(key, { item, account });
      });
    }

    const recentChanges = [];

    // 1) 추가되거나 변경된 항목 탐색
    latestMap.forEach((val, key) => {
      const { item, account } = val;
      if (!prevMap.has(key)) {
        // 새로 추가된 항목 (ADD)
        recentChanges.push({
          id: 'add-' + item.id,
          name: item.name,
          type: 'ADD',
          amount: parseFloat(item.amount || 0),
          note: item.note || '새로 추가됨',
          accountName: account ? account.name : ''
        });
      } else {
        // 이전에도 존재했던 항목 (변경 확인)
        const prevVal = prevMap.get(key);
        const prevItem = prevVal.item;
        const amountDiff = parseFloat(item.amount || 0) - parseFloat(prevItem.amount || 0);
        const noteChanged = (item.note || '') !== (prevItem.note || '');
        
        if (amountDiff !== 0 || noteChanged) {
          let changeNote = '';
          if (noteChanged) {
            if (prevItem.note && item.note) {
              changeNote = `${prevItem.note} → ${item.note}`;
            } else if (item.note) {
              changeNote = item.note;
            } else {
              changeNote = '비고 삭제됨';
            }
          } else {
            changeNote = item.note || '평가금 변동';
          }
          
          recentChanges.push({
            id: 'change-' + item.id,
            name: item.name,
            type: amountDiff >= 0 ? 'CHANGE_UP' : 'CHANGE_DOWN',
            amount: amountDiff,
            note: changeNote,
            accountName: account ? account.name : ''
          });
        }
      }
    });

    // 2) 삭제된 항목 탐색
    if (prevMonth) {
      prevMap.forEach((val, key) => {
        const { item, account } = val;
        if (!latestMap.has(key)) {
          recentChanges.push({
            id: 'delete-' + item.id,
            name: item.name,
            type: 'DELETE',
            amount: -parseFloat(item.amount || 0),
            note: '자산 제외됨/삭제됨',
            accountName: account ? account.name : ''
          });
        }
      });
    }

    // 변동액 크기 순으로 정렬
    recentChanges.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return {
      hasData: true,
      latestMonth,
      kpis,
      assetAllocation,
      monthlyTrend,
      holdings,
      recentChanges
    };
  } catch (err) {
    console.error("[Actions] Failed to get dashboard data:", err);
    throw new Error("DB_READ_ERROR");
  }
}
