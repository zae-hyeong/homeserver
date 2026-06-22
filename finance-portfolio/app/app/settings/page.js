"use client";

import { useState } from 'react';
import { Trash2, Calendar, Loader2, Settings } from 'lucide-react';
import { deleteAccountsByMonth } from '../accounts/actions';

export default function SettingsPage() {
  const [targetMonth, setTargetMonth] = useState(new Date().toISOString().slice(0, 7));
  const [deleting, setDeleting] = useState(false);

  const handleDeleteData = async () => {
    if (!targetMonth) {
      alert("삭제할 기준월을 선택해 주세요.");
      return;
    }

    const [year, month] = targetMonth.split('-');
    
    // 1차 보증 확인
    const confirm1 = confirm(`정말 ${year}년 ${month}월의 모든 계좌 및 주식 데이터를 일괄 삭제하시겠습니까?`);
    if (!confirm1) return;

    // 2차 정밀 경고 확인
    const confirm2 = confirm(`[주의] 이 작업은 즉시 데이터베이스에서 관련 데이터를 영구 삭제하며 복구할 수 없습니다.\n정말로 삭제하시겠습니까?`);
    if (!confirm2) return;

    setDeleting(true);
    try {
      const res = await deleteAccountsByMonth(targetMonth);
      if (res.success) {
        if (res.count > 0) {
          alert(`${year}년 ${month}월의 모든 데이터(계좌 ${res.count}건)가 안전하게 삭제되었습니다.`);
        } else {
          alert(`${year}년 ${month}월에 등록된 데이터가 존재하지 않습니다.`);
        }
      }
    } catch (err) {
      console.error("Failed to delete accounts by month:", err);
      alert("데이터 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', padding: '4px', animation: 'fadeIn 0.4s ease-out' }}>
      {/* 상단 헤더 */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.8px' }}>설정</h1>
          <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', marginTop: '6px' }}>자산 관리 시스템의 각종 환경 설정을 제어합니다.</p>
        </div>
        <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifycontent: 'center', color: 'var(--text-secondary)' }}>
          <Settings size={20} />
        </div>
      </header>

      {/* 설정 세부 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* 데이터 초기화 카드 */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '32px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={20} style={{ color: 'var(--color-danger)' }} />
              데이터 초기화 (월별 삭제)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
              특정 기준월에 수집 및 생성했던 모든 자산 계좌 정보와 주식 종목 리스트를 완전히 삭제합니다.<br />
              이 기능은 테스트 데이터를 비우거나 특정 월 현행화를 완전히 처음부터 다시 시작할 때 유용합니다.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'end' }}>
            {/* 기준월 선택 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px' }}>
              <label style={{ fontSize: '0.775rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} />
                초기화 대상 월 선택
              </label>
              <input 
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, outline: 'none', width: '100%', transition: 'border-color 0.2s', cursor: 'pointer' }}
                disabled={deleting}
              />
            </div>

            {/* 초기화 버튼 */}
            <button 
              onClick={handleDeleteData}
              disabled={deleting}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 24px', backgroundColor: deleting ? 'var(--border-color)' : 'var(--color-danger)', color: deleting ? 'var(--text-muted)' : 'white', fontWeight: 700, fontSize: '0.9rem', border: 'none', borderRadius: '8px', cursor: deleting ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', boxShadow: deleting ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.15)', height: '47px' }}
            >
              {deleting ? (
                <>
                  <Loader2 className="spinner" size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>삭제 중...</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>해당 월 초기화 실행</span>
                </>
              )}
            </button>
          </div>

          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.04)', border: '1px dashed rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '16px', display: 'flex', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <p style={{ fontSize: '0.775rem', color: 'var(--color-danger)', fontWeight: 650, lineHeight: 1.5, margin: 0 }}>
              주의: 초기화를 실행하면 선택된 기준월의 모든 계좌 잔액과 주식 현황 표에서 데이터가 사라집니다.<br />
              반드시 백업하시거나 더 이상 필요 없는 데이터인지 신중히 판단 후 진행해주시기 바랍니다.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
