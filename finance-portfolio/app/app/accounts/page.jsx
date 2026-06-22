"use client";

import { useState, useEffect } from 'react';
import { Plus, Upload, Trash2, Loader2, Coins, CheckCircle, Calendar, ShieldAlert, Download, FileSpreadsheet } from 'lucide-react';
import { 
  getAccounts, 
  createAccount, 
  deleteAccount, 
  updateSavingsAccount, 
  uploadAndAnalyzeImage,
  updateAccountMeta,
  addStockItem,
  updateStockItem,
  deleteStockItem,
  getLastAmountByStockName,
  importAccountsFromClosestMonth,
  saveStockItemsList
} from './actions';
import * as XLSX from 'xlsx';
import './accounts.css';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  
  // 계좌 추가 모달 상태
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccInstitution, setNewAccInstitution] = useState('');
  const [newAccAccountType, setNewAccAccountType] = useState('');
  const [newAccCategory, setNewAccCategory] = useState('현금자산');
  const [newAccNote, setNewAccNote] = useState('');
  const [newAccStockName, setNewAccStockName] = useState('');
  
  // 연, 월 선택 상태 (YYYY-MM 형식)
  const [commonBaseMonth, setCommonBaseMonth] = useState(new Date().toISOString().slice(0, 7));
  const [analyzingId, setAnalyzingId] = useState(null);
  const [editingSavings, setEditingSavings] = useState({});
  const [addingStock, setAddingStock] = useState({});
  const [editingStockItem, setEditingStockItem] = useState({});
  const [tempStockItems, setTempStockItems] = useState(null);

  const fetchAccounts = async (preserveSelection = true) => {
    setAccountsLoading(true);
    try {
      const data = await getAccounts();
      setAccounts(data);
      
      // 계좌 편집용 데이터 맵 초기화
      const savingsMap = {};
      data.forEach(acc => {
        if (acc.type === 'SAVINGS') {
          const item = acc.stockItems && acc.stockItems[0] ? acc.stockItems[0] : {};
          savingsMap[acc.id] = {
            name: acc.name || '',
            balance: acc.balance,
            category: item.category || '현금자산',
            note: item.note || '',
            institution: acc.institution || '',
            accountType: acc.account_type || '',
            stockName: item.name || ''
          };
        } else if (acc.type === 'STOCK') {
          savingsMap[acc.id] = {
            name: acc.name || '',
            institution: acc.institution || '',
            accountType: acc.account_type || ''
          };
        }
      });
      setEditingSavings(savingsMap);

      // 선택 상태 기본 설정 (월별 필터가 적용된 리스트 기준)
      const filtered = data.filter(acc => acc.baseDate && acc.baseDate.substring(0, 7) === commonBaseMonth);
      if (filtered && filtered.length > 0) {
        if (!preserveSelection || !selectedAccountId || !filtered.some(a => a.id === selectedAccountId)) {
          setSelectedAccountId(filtered[0].id);
        }
      } else {
        setSelectedAccountId(null);
      }
    } catch (err) {
      console.error("Failed to load accounts:", err);
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts(false);
  }, []);

  // 기준월 또는 계좌 전체 목록이 바뀔 때, 필터링된 계좌가 있다면 자동 포커스 처리
  useEffect(() => {
    const filtered = accounts.filter(acc => acc.baseDate && acc.baseDate.substring(0, 7) === commonBaseMonth);
    if (filtered.length > 0) {
      if (!selectedAccountId || !filtered.some(a => a.id === selectedAccountId)) {
        setSelectedAccountId(filtered[0].id);
      }
    } else {
      setSelectedAccountId(null);
    }
  }, [commonBaseMonth, accounts]);

  // 계좌 전환 또는 기준월 변경 시 임시 엑셀 데이터 초기화
  useEffect(() => {
    setTempStockItems(null);
  }, [selectedAccountId, commonBaseMonth]);

  // 기준월 필터가 적용된 계좌들
  const filteredAccounts = accounts.filter(acc => {
    if (!acc.baseDate) return false;
    return acc.baseDate.substring(0, 7) === commonBaseMonth;
  });

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    try {
      await createAccount({
        name: newAccName,
        type: newAccType,
        balance: newAccType === 'SAVINGS' ? parseFloat(newAccBalance || 0) : 0,
        institution: newAccInstitution,
        accountType: newAccAccountType,
        category: newAccCategory,
        note: newAccNote,
        baseDate: commonBaseMonth + "-01", // YYYY-MM-01 형태로 변환하여 날짜 호환성 유지
        stockName: newAccStockName
      });
      
      setNewAccName('');
      setNewAccBalance('');
      setNewAccInstitution('');
      setNewAccAccountType('');
      setNewAccCategory('현금자산');
      setNewAccNote('');
      setNewAccStockName('');
      setShowAddModal(false);
      
      await fetchAccounts(true);
    } catch (err) {
      console.error("Failed to create account:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("정말 이 계좌를 삭제하시겠습니까?")) return;
    try {
      await deleteAccount(id);
      setSelectedAccountId(null);
      fetchAccounts(false);
    } catch (err) {
      console.error("Failed to delete account:", err);
    }
  };

  const handleUpdateSavings = async (id) => {
    const fields = editingSavings[id] || {};
    const acc = accounts.find(a => a.id === id);
    try {
      await updateSavingsAccount(id, {
        name: fields.name || (acc ? acc.name : ''),
        balance: parseFloat(fields.balance ?? 0),
        category: fields.category || '현금자산',
        note: fields.note || '',
        baseDate: commonBaseMonth + "-01", // 저장 시 기준월 연동
        institution: fields.institution || '',
        accountType: fields.accountType || '',
        stockName: fields.stockName || ''
      });
      alert("적금 정보가 성공적으로 현행화되었습니다.");
      fetchAccounts(true);
    } catch (err) {
      console.error("Failed to update savings account:", err);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  const handleUpdateStockMeta = async (id) => {
    const fields = editingSavings[id] || {};
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    try {
      await updateAccountMeta(id, {
        name: fields.name || acc.name,
        institution: fields.institution || '',
        accountType: fields.accountType || '',
        baseDate: commonBaseMonth + "-01" // 저장 시 기준월 연동
      });
      alert("주식 계좌 정보가 성공적으로 현행화되었습니다.");
      fetchAccounts(true);
    } catch (err) {
      console.error("Failed to update stock account meta:", err);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  const handleAddStockItem = async (accountId) => {
    const item = addingStock[accountId] || {};
    if (!item.name?.trim()) {
      alert("종목명을 입력해 주세요.");
      return;
    }

    if (tempStockItems !== null) {
      const newItem = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: item.name,
        amount: parseFloat(item.amount || 0),
        category: item.category || '성장자산',
        note: item.note || ''
      };
      setTempStockItems([...tempStockItems, newItem]);
      setAddingStock({
        ...addingStock,
        [accountId]: { name: '', amount: '', category: '성장자산', note: '' }
      });
      return;
    }

    try {
      await addStockItem(accountId, {
        name: item.name,
        amount: parseFloat(item.amount || 0),
        category: item.category || '성장자산',
        note: item.note || ''
      });
      setAddingStock({
        ...addingStock,
        [accountId]: { name: '', amount: '', category: '성장자산', note: '' }
      });
      fetchAccounts(true);
    } catch (err) {
      console.error("Failed to add stock item:", err);
      alert("주식 항목 추가 중 오류가 발생했습니다.");
    }
  };

  const startEditStockItem = (item) => {
    setEditingStockItem({
      ...editingStockItem,
      [item.id]: {
        name: item.name,
        amount: item.amount,
        category: item.category || '성장자산',
        note: item.note || ''
      }
    });
  };

  const cancelEditStockItem = (itemId) => {
    const updated = { ...editingStockItem };
    delete updated[itemId];
    setEditingStockItem(updated);
  };

  const handleSaveTempStockItem = (itemId) => {
    const fields = editingStockItem[itemId];
    if (!fields || !fields.name?.trim()) {
      alert("종목명을 입력해 주세요.");
      return;
    }
    const updated = tempStockItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          name: fields.name,
          amount: parseFloat(fields.amount || 0),
          category: fields.category || '성장자산',
          note: fields.note || ''
        };
      }
      return item;
    });
    setTempStockItems(updated);
    cancelEditStockItem(itemId);
  };

  const handleSaveStockItem = async (itemId) => {
    const fields = editingStockItem[itemId];
    if (!fields || !fields.name?.trim()) {
      alert("종목명을 입력해 주세요.");
      return;
    }

    if (itemId.toString().startsWith('temp-')) {
      handleSaveTempStockItem(itemId);
      return;
    }

    try {
      await updateStockItem(itemId, {
        name: fields.name,
        amount: parseFloat(fields.amount || 0),
        category: fields.category || '성장자산',
        note: fields.note || ''
      });
      cancelEditStockItem(itemId);
      fetchAccounts(true);
    } catch (err) {
      console.error("Failed to update stock item:", err);
      alert("주식 항목 수정 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteTempStockItem = (itemId) => {
    if (!confirm("정말 이 종목을 제외하시겠습니까?")) return;
    setTempStockItems(tempStockItems.filter(item => item.id !== itemId));
  };

  const handleDeleteStockItem = async (itemId) => {
    if (itemId.toString().startsWith('temp-')) {
      handleDeleteTempStockItem(itemId);
      return;
    }

    if (!confirm("정말 이 주식 종목을 삭제하시겠습니까?")) return;
    try {
      await deleteStockItem(itemId);
      fetchAccounts(true);
    } catch (err) {
      console.error("Failed to delete stock item:", err);
      alert("주식 항목 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleSaveTempList = async () => {
    if (!selectedAccountId || !tempStockItems) return;
    if (Object.keys(editingStockItem).length > 0) {
      alert("수정 중인 항목을 먼저 완료(저장)해 주세요.");
      return;
    }
    try {
      setAccountsLoading(true);
      const res = await saveStockItemsList(selectedAccountId, tempStockItems, commonBaseMonth);
      if (res.success) {
        alert("주식 자산 정보가 성공적으로 현행화되었습니다.");
        setTempStockItems(null);
        await fetchAccounts(true);
      }
    } catch (err) {
      console.error("Failed to save stock items list:", err);
      alert("주식 자산 현행화 저장 중 오류가 발생했습니다.");
    } finally {
      setAccountsLoading(false);
    }
  };

  const handleUpload = async (id, file) => {
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    if (fileExt !== 'xlsx' && fileExt !== 'xls') {
      alert("엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.");
      return;
    }

    setAnalyzingId(id);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length <= 1) {
            alert("엑셀 파일에 데이터가 없습니다.");
            setAnalyzingId(null);
            return;
          }

          const headers = jsonData[0];
          const nameIdx = headers.findIndex(h => h && h.toString().trim().includes("종목명"));
          const qtyIdx = headers.findIndex(h => h && h.toString().trim().includes("보유수량"));
          const amountIdx = headers.findIndex(h => h && (h.toString().trim().includes("평가금") || h.toString().trim().includes("금액")));

          if (nameIdx === -1 || amountIdx === -1) {
            alert("엑셀 파일 구조가 올바르지 않습니다. '종목명'과 '총 평가금' 열이 포함되어 있어야 합니다.");
            setAnalyzingId(null);
            return;
          }

          const parsedItems = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            const name = row[nameIdx]?.toString().trim();
            if (!name) continue;

            const quantity = row[qtyIdx];
            const amount = row[amountIdx];

            let parsedAmount = 0;
            if (typeof amount === 'number') {
              parsedAmount = amount;
            } else if (typeof amount === 'string') {
              parsedAmount = parseFloat(amount.replace(/,/g, '')) || 0;
            }

            let parsedQuantity = '';
            if (quantity !== undefined && quantity !== null) {
              parsedQuantity = quantity.toString().trim();
            }

            let category = '성장자산';
            const currentAcc = accounts.find(a => a.id === id);
            if (currentAcc && currentAcc.stockItems) {
              const found = currentAcc.stockItems.find(item => item.name === name);
              if (found) category = found.category;
            }
            if (category === '성장자산') {
              for (const acc of accounts) {
                if (acc.stockItems) {
                  const found = acc.stockItems.find(item => item.name === name);
                  if (found) {
                    category = found.category;
                    break;
                  }
                }
              }
            }

            const note = parsedQuantity ? `수량: ${parsedQuantity}` : '';

            parsedItems.push({
              id: `temp-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
              name,
              amount: parsedAmount,
              category,
              note
            });
          }

          if (parsedItems.length === 0) {
            alert("파싱된 주식 항목이 없습니다.");
          } else {
            setTempStockItems(parsedItems);
          }
        } catch (err) {
          console.error("Failed to parse excel file content:", err);
          alert("엑셀 파일 파싱 중 오류가 발생했습니다.");
        } finally {
          setAnalyzingId(null);
        }
      };

      reader.onerror = () => {
        alert("파일 읽기 오류가 발생했습니다.");
        setAnalyzingId(null);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Excel analysis failed:", err);
      alert("엑셀 파일 업로드 중 오류가 발생했습니다.");
      setAnalyzingId(null);
    }
  };

  // 계좌 가져오기 기능 핸들러
  const handleImportAccounts = async () => {
    const hasData = filteredAccounts.length > 0;
    let overwrite = false;

    if (hasData) {
      const confirmMsg = `${commonBaseMonth.substring(0, 4)}년 ${commonBaseMonth.substring(5, 7)}월에 이미 등록된 자산 계좌 데이터(${filteredAccounts.length}건)가 있습니다.\n기존 데이터를 모두 지우고 가장 가까운 달의 데이터를 복사하여 가져오시겠습니까?`;
      if (!confirm(confirmMsg)) return;
      overwrite = true;
    } else {
      if (!confirm("현재 날짜 기준 데이터가 있는 가장 가까운 달의 자산 계좌 구성을 이월하여 가져오시겠습니까?")) return;
    }

    try {
      setAccountsLoading(true);
      const res = await importAccountsFromClosestMonth(commonBaseMonth, overwrite);
      if (res.success) {
        alert(`${res.importedFrom.substring(0, 4)}년 ${res.importedFrom.substring(5, 7)}월의 데이터를 가져왔습니다.`);
        await fetchAccounts(true);
      }
    } catch (err) {
      console.error("Failed to import accounts:", err);
      if (err.message === "NO_SOURCE_DATA") {
        alert("복사해 올 과거 또는 미래의 계좌 데이터가 존재하지 않습니다.");
      } else {
        alert("계좌를 가져오는 데 실패했습니다.");
      }
    } finally {
      setAccountsLoading(false);
    }
  };

  const selectedAccount = filteredAccounts.find(a => a.id === selectedAccountId);

  return (
    <div className="update-input-container">
      {/* 상단 헤더 */}
      <header className="page-header-premium">
        <div className="header-title-section">
          <h1 className="header-title-main">자산 현행화 입력</h1>
          <p className="header-subtitle-main">직접 가입 자산을 기입하거나 주식 화면 스크린샷을 분석하여 자산을 현행화합니다.</p>
        </div>
        <div className="header-controls-area">
          {/* 연월 선택 */}
          <div className="common-date-picker">
            <Calendar size={16} className="date-icon" />
            <div className="date-input-group">
              <label>공통 기준월</label>
              <input 
                type="month"
                value={commonBaseMonth}
                onChange={(e) => setCommonBaseMonth(e.target.value)}
              />
            </div>
          </div>
          {/* 계좌 가져오기 버튼 추가 */}
          <button className="btn-import-accounts" onClick={handleImportAccounts} title="이전/가까운 달 계좌 데이터 가져오기">
            <Download size={16} />
            <span>계좌 가져오기</span>
          </button>
          <button className="btn-add-account" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            <span>계좌 추가</span>
          </button>
        </div>
      </header>

      {/* 로딩 상태 */}
      {accountsLoading && accounts.length === 0 ? (
        <div className="loading-state-premium">
          <Loader2 className="spinner" size={40} />
          <p>계좌 정보를 불러오는 중입니다...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="empty-state-premium">
          <Coins size={54} className="empty-icon" />
          <h3>등록된 계좌가 없습니다.</h3>
          <p>자산을 현행화하기 위해 "계좌 추가" 버튼을 눌러 먼저 계좌를 등록해 주세요.</p>
        </div>
      ) : (
        /* Master-Detail 분할 레이아웃 */
        <div className="accounts-split-layout">
          
          {/* 마스터 (좌측 계좌 리스트 - 필터링된 목록 적용) */}
          <div className="accounts-master-sidebar">
            <h3 className="sidebar-section-title">계좌 목록 ({filteredAccounts.length})</h3>
            <div className="master-list-container">
              {filteredAccounts.length === 0 ? (
                <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                  해당 월에 등록된 계좌가 없습니다.
                </div>
              ) : (
                filteredAccounts.map((acc) => {
                  const isActive = selectedAccountId === acc.id;
                  return (
                    <div 
                      key={acc.id} 
                      className={`master-list-item ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedAccountId(acc.id)}
                    >
                      <div className="item-row-header">
                        <span className={`acc-type-badge-mini ${acc.type.toLowerCase()}`}>
                          {acc.type === 'STOCK' ? '주식' : '적금'}
                        </span>
                        <span className="item-institution">{acc.institution || '-'}</span>
                      </div>
                      <h4 className="item-name">{acc.name}</h4>
                      <div className="item-row-footer">
                        <span className="item-balance">₩{acc.balance.toLocaleString()}</span>
                        {acc.baseDate && (
                          <span className="item-date">
                            {acc.baseDate.substring(5, 7)}월 {acc.baseDate.substring(8, 10)}일
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 디테일 (우측 상세 편집 패널) */}
          <div className="accounts-detail-panel">
            {selectedAccount ? (
              <div className="detail-panel-card">
                
                {/* 디테일 헤더 */}
                <div className="detail-panel-header">
                  <div className="title-area">
                    <div className="institution-type-row">
                      <span className="detail-institution-badge">{selectedAccount.institution || '기타 기관'}</span>
                      {selectedAccount.accountType && (
                        <span className="detail-type-badge">{selectedAccount.accountType}</span>
                      )}
                      {selectedAccount.baseDate && (
                        <span className="detail-date-badge">{selectedAccount.baseDate.substring(0, 7)} 기준</span>
                      )}
                    </div>
                    <h2 className="detail-account-name">{selectedAccount.name}</h2>
                  </div>
                  <button 
                    className="btn-delete-account" 
                    onClick={() => handleDelete(selectedAccount.id)}
                  >
                    <Trash2 size={15} />
                    <span>계좌 삭제</span>
                  </button>
                </div>

                {/* 디테일 콘텐트 */}
                <div className="detail-panel-content">
                  
                  {/* 주식 계좌 에디터 */}
                  {selectedAccount.type === 'STOCK' ? (
                    <div className="editor-stock-layout">
                      
                      {/* 계좌 메타 수정 섹션 */}
                      <section className="editor-section">
                        <h4 className="section-title-premium">계좌 메타 정보 설정</h4>
                        <div className="meta-inputs-row">
                          <div className="input-group-premium">
                            <label>계좌명 (관리용)</label>
                            <input 
                              type="text"
                              placeholder="예: KB 주식계좌"
                              value={editingSavings[selectedAccount.id]?.name ?? selectedAccount.name}
                              onChange={(e) => {
                                setEditingSavings({
                                  ...editingSavings,
                                  [selectedAccount.id]: {
                                    ...editingSavings[selectedAccount.id],
                                    name: e.target.value
                                  }
                                });
                              }}
                            />
                          </div>
                          <div className="input-group-premium">
                            <label>기관명</label>
                            <input 
                              type="text"
                              placeholder="예: KB 증권"
                              value={editingSavings[selectedAccount.id]?.institution ?? selectedAccount.institution}
                              onChange={(e) => {
                                setEditingSavings({
                                  ...editingSavings,
                                  [selectedAccount.id]: {
                                    ...editingSavings[selectedAccount.id],
                                    institution: e.target.value
                                  }
                                });
                              }}
                            />
                          </div>
                          <div className="input-group-premium">
                            <label>계좌 종류</label>
                            <input 
                              type="text"
                              placeholder="예: ISA, 종합위탁"
                              value={editingSavings[selectedAccount.id]?.accountType ?? selectedAccount.accountType}
                              onChange={(e) => {
                                setEditingSavings({
                                  ...editingSavings,
                                  [selectedAccount.id]: {
                                    ...editingSavings[selectedAccount.id],
                                    accountType: e.target.value
                                  }
                                });
                              }}
                            />
                          </div>
                          <button 
                            className="btn-save-meta"
                            onClick={() => handleUpdateStockMeta(selectedAccount.id)}
                          >
                            저장
                          </button>
                        </div>
                      </section>

                      {/* 엑셀 파일 업로드 섹션 */}
                      <section className="editor-section">
                        <h4 className="section-title-premium">엑셀 파일 업로드 현행화</h4>
                        <div 
                          className={`premium-dropzone ${analyzingId === selectedAccount.id ? 'analyzing' : ''}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files[0];
                            if (file) handleUpload(selectedAccount.id, file);
                          }}
                          onClick={() => document.getElementById(`file-input-${selectedAccount.id}`).click()}
                        >
                          <input 
                            type="file" 
                            id={`file-input-${selectedAccount.id}`}
                            style={{ display: 'none' }}
                            accept=".xlsx, .xls"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) handleUpload(selectedAccount.id, file);
                            }}
                          />
                          {analyzingId === selectedAccount.id ? (
                            <div className="analyzing-spinner-group">
                              <Loader2 className="spinner-fast" size={36} />
                              <p>엑셀 파일에서 데이터를 추출하는 중입니다...</p>
                            </div>
                          ) : (
                            <div className="dropzone-inner-content">
                              <FileSpreadsheet size={32} className="icon" />
                              <p className="main-text">엑셀 파일을 여기에 드래그하거나 클릭하여 업로드</p>
                              <span className="sub-text">규격 양식(종목명, 보유수량, 총 평가금)의 엑셀 파일을 넣어주세요.</span>
                            </div>
                          )}
                        </div>
                      </section>
 
                      {/* 주식 종목 리스트 테이블 */}
                      <section className="editor-section">
                        <h4 className="section-title-premium">자산 종목 내역</h4>
                        
                        {tempStockItems !== null && (
                          <div className="draft-notice-banner">
                            <ShieldAlert size={16} className="draft-banner-icon" />
                            <span className="draft-banner-text">엑셀 파일에서 불러온 임시 데이터 목록입니다. 하단의 '현행화 저장' 버튼을 누르기 전까지 반영되지 않습니다.</span>
                            <button className="btn-cancel-draft" onClick={() => setTempStockItems(null)}>가져오기 취소</button>
                          </div>
                        )}
                        
                        {((tempStockItems !== null ? tempStockItems : selectedAccount.stockItems) || []).length > 0 ? (
                          <div className="stock-table-card">
                            <table className="premium-mini-table">
                              <thead>
                                <tr>
                                  <th>종목명</th>
                                  <th className="text-right">평가금액</th>
                                  <th>구분</th>
                                  <th>비고</th>
                                  <th className="text-center">관리</th>
                                </tr>
                              </thead>
                              <tbody>
                                {((tempStockItems !== null ? tempStockItems : selectedAccount.stockItems) || []).map((item) => {
                                  const isEditing = !!editingStockItem[item.id];
                                  const editFields = editingStockItem[item.id] || {};
 
                                  if (isEditing) {
                                    return (
                                      <tr key={item.id} className="editing-row">
                                        <td>
                                          <input 
                                            type="text"
                                            className="table-input"
                                            value={editFields.name}
                                            onChange={(e) => setEditingStockItem({
                                              ...editingStockItem,
                                              [item.id]: { ...editFields, name: e.target.value }
                                            })}
                                          />
                                        </td>
                                        <td>
                                          <input 
                                            type="number"
                                            className="table-input text-right"
                                            value={editFields.amount}
                                            onChange={(e) => setEditingStockItem({
                                              ...editingStockItem,
                                              [item.id]: { ...editFields, amount: e.target.value }
                                            })}
                                          />
                                        </td>
                                        <td>
                                          <select
                                            className="table-input"
                                            value={editFields.category}
                                            onChange={(e) => setEditingStockItem({
                                              ...editingStockItem,
                                              [item.id]: { ...editFields, category: e.target.value }
                                            })}
                                          >
                                            <option value="현금자산">현금자산</option>
                                            <option value="배당자산">배당자산</option>
                                            <option value="성장자산">성장자산</option>
                                            <option value="채권">채권</option>
                                            <option value="대체투자">대체투자</option>
                                            <option value="금">금</option>
                                          </select>
                                        </td>
                                        <td>
                                          <input 
                                            type="text"
                                            className="table-input"
                                            value={editFields.note}
                                            onChange={(e) => setEditingStockItem({
                                              ...editingStockItem,
                                              [item.id]: { ...editFields, note: e.target.value }
                                            })}
                                          />
                                        </td>
                                        <td className="text-center">
                                          <div className="table-action-buttons">
                                            <button 
                                              className="btn-table-save"
                                              onClick={() => handleSaveStockItem(item.id)}
                                            >
                                              저장
                                            </button>
                                            <button 
                                              className="btn-table-cancel"
                                              onClick={() => cancelEditStockItem(item.id)}
                                            >
                                              취소
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  }
 
                                  return (
                                    <tr key={item.id}>
                                      <td className="font-semibold">{item.name}</td>
                                      <td className="text-right font-semibold num-font">
                                        ₩{item.amount.toLocaleString()}
                                      </td>
                                      <td>
                                        <span className={`category-tag ${item.category === '성장자산' ? 'growth' : item.category === '현금자산' ? 'cash' : 'etc'}`}>
                                          {item.category}
                                        </span>
                                      </td>
                                      <td className="text-muted-row">{item.note || '-'}</td>
                                      <td className="text-center">
                                        <div className="table-action-buttons">
                                          <button 
                                            className="btn-table-edit"
                                            onClick={() => startEditStockItem(item)}
                                          >
                                            수정
                                          </button>
                                          <button 
                                            className="btn-table-delete"
                                            onClick={() => handleDeleteStockItem(item.id)}
                                            title="종목 삭제"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            
                            <div className="detail-total-card">
                              <span>{tempStockItems !== null ? '임시 총 평가 가치' : '총 평가 가치'}</span>
                              <span className="total-value-text">
                                ₩{((tempStockItems !== null ? tempStockItems : selectedAccount.stockItems) || []).reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="empty-stock-list-notice">
                            <ShieldAlert size={20} />
                            <p>등록된 주식 종목이 없습니다. 엑셀 업로드 또는 아래 직접 등록 기능을 사용해 주세요.</p>
                          </div>
                        )}
                      </section>
 
                      {/* 주식 종목 직접 추가 섹션 */}
                      <section className="editor-section last-section">
                        <h4 className="section-title-premium">주식 종목 직접 등록</h4>
                        <div className="quick-add-grid">
                          <div className="input-field">
                            <label>종목명</label>
                            <input 
                              type="text" 
                              placeholder="예: 삼성전자"
                              value={addingStock[selectedAccount.id]?.name || ''}
                              onChange={(e) => setAddingStock({
                                ...addingStock,
                                [selectedAccount.id]: { ...(addingStock[selectedAccount.id] || {}), name: e.target.value }
                              })}
                            />
                          </div>
                          <div className="input-field">
                            <label>평가금액</label>
                            <input 
                              type="number" 
                              placeholder="0"
                              className="text-right"
                              value={addingStock[selectedAccount.id]?.amount || ''}
                              onChange={(e) => setAddingStock({
                                ...addingStock,
                                [selectedAccount.id]: { ...(addingStock[selectedAccount.id] || {}), amount: e.target.value }
                              })}
                            />
                          </div>
                          <div className="input-field">
                            <label>구분</label>
                            <select
                              value={addingStock[selectedAccount.id]?.category || '성장자산'}
                              onChange={(e) => setAddingStock({
                                ...addingStock,
                                [selectedAccount.id]: { ...(addingStock[selectedAccount.id] || {}), category: e.target.value }
                              })}
                            >
                              <option value="현금자산">현금자산</option>
                              <option value="배당자산">배당자산</option>
                              <option value="성장자산">성장자산</option>
                              <option value="채권">채권</option>
                              <option value="대체투자">대체투자</option>
                              <option value="금">금</option>
                            </select>
                          </div>
                          <div className="input-field">
                            <label>비고</label>
                            <input 
                              type="text" 
                              placeholder="특이사항 입력"
                              value={addingStock[selectedAccount.id]?.note || ''}
                              onChange={(e) => setAddingStock({
                                ...addingStock,
                                [selectedAccount.id]: { ...(addingStock[selectedAccount.id] || {}), note: e.target.value }
                              })}
                            />
                          </div>
                          <button 
                            className="btn-add-stock-direct"
                            onClick={() => handleAddStockItem(selectedAccount.id)}
                          >
                            종목 등록
                          </button>
                        </div>
                      </section>

                      {/* 임시 목록 일괄 저장 버튼 */}
                      {tempStockItems !== null && (
                        <div className="savings-submit-bar" style={{ marginTop: '24px' }}>
                          <div className="current-status-badge">
                            <span>예상 총 평가 가치:</span>
                            <strong>₩{((tempStockItems !== null ? tempStockItems : selectedAccount.stockItems) || []).reduce((sum, item) => sum + item.amount, 0).toLocaleString()}</strong>
                          </div>
                          <button 
                            className="btn-update-savings"
                            onClick={handleSaveTempList}
                          >
                            현행화 저장
                          </button>
                        </div>
                      )}
 
                    </div>
                  ) : (
                    /* 적금/수동 계좌 에디터 */
                    <div className="editor-savings-layout">
                      <section className="editor-section">
                        <h4 className="section-title-premium">자산 및 매핑 정보 직접 수정</h4>
                        
                        <div className="savings-inputs-grid">
                          <div className="input-group-premium">
                            <label>계좌명 (관리용)</label>
                            <input 
                              type="text"
                              value={editingSavings[selectedAccount.id]?.name ?? selectedAccount.name}
                              onChange={(e) => {
                                setEditingSavings({
                                  ...editingSavings,
                                  [selectedAccount.id]: {
                                    ...editingSavings[selectedAccount.id],
                                    name: e.target.value
                                  }
                                });
                              }}
                            />
                          </div>
                          <div className="input-group-premium">
                            <label>기관명</label>
                            <input 
                              type="text"
                              value={editingSavings[selectedAccount.id]?.institution ?? selectedAccount.institution}
                              onChange={(e) => {
                                setEditingSavings({
                                  ...editingSavings,
                                  [selectedAccount.id]: {
                                    ...editingSavings[selectedAccount.id],
                                    institution: e.target.value
                                  }
                                });
                              }}
                            />
                          </div>
                          <div className="input-group-premium">
                            <label>계좌 종류</label>
                            <input 
                              type="text"
                              value={editingSavings[selectedAccount.id]?.accountType ?? selectedAccount.accountType}
                              onChange={(e) => {
                                setEditingSavings({
                                  ...editingSavings,
                                  [selectedAccount.id]: {
                                    ...editingSavings[selectedAccount.id],
                                    accountType: e.target.value
                                  }
                                });
                              }}
                            />
                          </div>
                          <div className="input-group-premium">
                            <label>종목명 (세부 상품명)</label>
                            <input 
                              type="text"
                              value={editingSavings[selectedAccount.id]?.stockName ?? (selectedAccount.stockItems[0]?.name || '')}
                              onChange={(e) => {
                                setEditingSavings({
                                  ...editingSavings,
                                  [selectedAccount.id]: {
                                    ...editingSavings[selectedAccount.id],
                                    stockName: e.target.value
                                  }
                                });
                              }}
                            />
                          </div>
                          
                          <div className="input-group-premium">
                            <div className="label-with-action">
                              <label>현재 잔액 (투자금)</label>
                              <button 
                                type="button"
                                className="btn-fetch-last-amount"
                                onClick={async () => {
                                  const stockName = editingSavings[selectedAccount.id]?.stockName ?? (selectedAccount.stockItems[0]?.name || '');
                                  if (!stockName) {
                                    alert("종목명(세부 상품명)을 먼저 입력해 주세요.");
                                    return;
                                  }
                                  try {
                                    const lastAmount = await getLastAmountByStockName(stockName, selectedAccount.id);
                                    if (lastAmount > 0) {
                                      setEditingSavings({
                                        ...editingSavings,
                                        [selectedAccount.id]: {
                                          ...editingSavings[selectedAccount.id],
                                          balance: lastAmount
                                        }
                                      });
                                    } else {
                                      alert("이전 금액 기록을 찾을 수 없습니다.");
                                    }
                                  } catch (err) {
                                    console.error("Failed to fetch last amount:", err);
                                    alert("이전 금액을 가져오는 중 오류가 발생했습니다.");
                                  }
                                }}
                              >
                                저번 금액 가져오기
                              </button>
                            </div>
                            <input 
                              type="number"
                              value={editingSavings[selectedAccount.id]?.balance ?? selectedAccount.balance}
                              onChange={(e) => {
                                setEditingSavings({
                                  ...editingSavings,
                                  [selectedAccount.id]: {
                                    ...editingSavings[selectedAccount.id],
                                    balance: e.target.value
                                  }
                                });
                              }}
                            />
                          </div>

                          <div className="input-group-premium">
                            <label>구분</label>
                            <select
                              value={editingSavings[selectedAccount.id]?.category ?? (selectedAccount.stockItems[0]?.category || '현금자산')}
                              onChange={(e) => {
                                setEditingSavings({
                                  ...editingSavings,
                                  [selectedAccount.id]: {
                                    ...editingSavings[selectedAccount.id],
                                    category: e.target.value
                                  }
                                });
                              }}
                            >
                              <option value="현금자산">현금자산</option>
                              <option value="배당자산">배당자산</option>
                              <option value="성장자산">성장자산</option>
                              <option value="채권">채권</option>
                              <option value="대체투자">대체투자</option>
                              <option value="금">금</option>
                            </select>
                          </div>
                          
                          <div className="input-group-premium full-width">
                            <label>비고</label>
                            <input 
                              type="text"
                              placeholder="예: 필수 금액 등"
                              value={editingSavings[selectedAccount.id]?.note ?? (selectedAccount.stockItems[0]?.note || '')}
                              onChange={(e) => {
                                setEditingSavings({
                                  ...editingSavings,
                                  [selectedAccount.id]: {
                                    ...editingSavings[selectedAccount.id],
                                    note: e.target.value
                                  }
                                });
                              }}
                            />
                          </div>
                        </div>

                        <div className="savings-submit-bar">
                          <div className="current-status-badge">
                            <span>현재 잔액:</span>
                            <strong>₩{selectedAccount.balance.toLocaleString()}</strong>
                          </div>
                          <button 
                            className="btn-update-savings"
                            onClick={() => handleUpdateSavings(selectedAccount.id)}
                          >
                            현행화 저장
                          </button>
                        </div>
                      </section>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="detail-panel-empty">
                <Coins size={48} className="empty-icon" />
                <p>현재 기준월({commonBaseMonth.substring(0, 4)}년 {commonBaseMonth.substring(5, 7)}월)에 활성화된 자산 계좌가 없습니다. 목록에서 계좌를 선택하시거나 새 계좌를 추가해 주세요.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 계좌 추가 모달 */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => {
          setNewAccName('');
          setNewAccBalance('');
          setNewAccInstitution('');
          setNewAccAccountType('');
          setNewAccCategory('현금자산');
          setNewAccNote('');
          setNewAccStockName('');
          setNewAccType('');
          setShowAddModal(false);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">새 자산 계좌 추가</h3>
            <form onSubmit={handleCreateAccount} className="modal-form">
              <div className="form-group">
                <label>계좌 유형</label>
                <select 
                  value={newAccType}
                  onChange={(e) => {
                    setNewAccType(e.target.value);
                    if (e.target.value === 'STOCK') setNewAccBalance('');
                  }}
                  required
                >
                  <option value="">계좌 유형을 선택해 주세요</option>
                  <option value="STOCK">주식 (이미지 분석 자동 기입)</option>
                  <option value="SAVINGS">적금/일반 (금액 직접 입력)</option>
                </select>
              </div>
              <div className="form-group">
                <label>기관명</label>
                <input 
                  type="text" 
                  placeholder="예: 국민은행, KB 증권, 미래에셋"
                  value={newAccInstitution}
                  onChange={(e) => setNewAccInstitution(e.target.value)}
                  disabled={!newAccType}
                  required
                />
              </div>
              <div className="form-group">
                <label>계좌 종류</label>
                <input 
                  type="text" 
                  placeholder="예: 적금, ISA, 종합위탁계좌, CMA"
                  value={newAccAccountType}
                  onChange={(e) => setNewAccAccountType(e.target.value)}
                  disabled={!newAccType}
                  required
                />
              </div>
              <div className="form-group">
                <label>계좌/상품명</label>
                <input 
                  type="text" 
                  placeholder="예: KB청년도약계좌, 청년 DREAM 통장"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  disabled={!newAccType}
                  required
                />
              </div>
              {newAccType === 'SAVINGS' && (
                <>
                  <div className="form-group">
                    <label>종목명 (세부 상품명)</label>
                    <input 
                      type="text" 
                      placeholder="예: KB청년도약계좌, 청년 DREAM 통장"
                      value={newAccStockName}
                      onChange={(e) => setNewAccStockName(e.target.value)}
                      disabled={!newAccType}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>초기 잔액 (원)</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={newAccBalance}
                      onChange={(e) => setNewAccBalance(e.target.value)}
                      disabled={!newAccType}
                    />
                  </div>
                  <div className="form-group">
                    <label>구분</label>
                    <select
                      value={newAccCategory}
                      onChange={(e) => setNewAccCategory(e.target.value)}
                      disabled={!newAccType}
                    >
                      <option value="현금자산">현금자산</option>
                      <option value="배당자산">배당자산</option>
                      <option value="성장자산">성장자산</option>
                      <option value="채권">채권</option>
                      <option value="대체투자">대체투자</option>
                      <option value="금">금</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>비고</label>
                    <input 
                      type="text" 
                      placeholder="예: 필수 금액 등"
                      value={newAccNote}
                      onChange={(e) => setNewAccNote(e.target.value)}
                      disabled={!newAccType}
                    />
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => {
                  setNewAccName('');
                  setNewAccBalance('');
                  setNewAccInstitution('');
                  setNewAccAccountType('');
                  setNewAccCategory('현금자산');
                  setNewAccNote('');
                  setNewAccStockName('');
                  setNewAccType('');
                  setShowAddModal(false);
                }}>취소</button>
                <button type="submit" className="btn-submit" disabled={!newAccType}>추가</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
