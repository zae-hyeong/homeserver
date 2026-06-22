"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Link2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  PiggyBank, 
  Coins, 
  Save, 
  RefreshCw, 
  X, 
  AlertCircle, 
  Info,
  HelpCircle,
  DollarSign
} from "lucide-react";

// 초기 기본 노드 데이터 (월급 -> 생활비/적금/주식투자)
const DEFAULT_NODES = [
  { id: "n1", type: "income", label: "주계좌 (월급)", amount: 5000000, x: 80, y: 180, memo: "매월 25일 정기 급여일" },
  { id: "n2", type: "expense", label: "생활비 카드", amount: 1500000, x: 420, y: 60, memo: "식비, 교통비, 품위유지비" },
  { id: "n3", type: "expense", label: "고정비 (월세/공과금)", amount: 1200000, x: 420, y: 300, memo: "고정 자동이체 지출" },
  { id: "n4", type: "savings", label: "주택청약 및 비상금", amount: 1000000, x: 760, y: 100, memo: "카카오뱅크 세이프박스" },
  { id: "n5", type: "investment", label: "개인연금 및 주식", amount: 1300000, x: 760, y: 260, memo: "ISA 계좌 및 연금저축펀드" }
];

// 초기 기본 연결선 데이터
const DEFAULT_EDGES = [
  { id: "e1", source: "n1", target: "n2", label: "150만원" },
  { id: "e2", source: "n1", target: "n3", label: "120만원" },
  { id: "e3", source: "n1", target: "n4", label: "100만원" },
  { id: "e4", source: "n1", target: "n5", label: "130만원" }
];

// 숫자를 한글 통화 형식으로 포맷팅 (예: 5000000 -> 500만원, 1250000 -> 125만원)
const formatKoreanAmount = (num) => {
  if (isNaN(num) || num === null) return "0원";
  if (num === 0) return "0원";
  
  const unitWords = ["원", "만", "억", "조"];
  const splitUnit = 10000;
  let result = [];
  let temp = num;
  let unitIdx = 0;

  while (temp > 0) {
    let mod = temp % splitUnit;
    if (mod > 0) {
      // 10000원 -> "1만" 대신 "10,000" 느낌의 콤마 지원과 단위 한글 표기 조합
      const formattedMod = mod.toLocaleString();
      result.unshift(`${formattedMod}${unitWords[unitIdx]}`);
    }
    temp = Math.floor(temp / splitUnit);
    unitIdx++;
  }
  
  // 만 단위 미만은 제외하고 큰 단위 위주로 깔끔하게 정리 (원화 가치 고려)
  if (num >= 10000) {
    // 1500000 -> 150만원 형태로 끝에 '원'을 제외하고 억/만 조합
    let summary = "";
    let tempNum = num;
    const uk = Math.floor(tempNum / 100000000);
    tempNum = tempNum % 100000000;
    const man = Math.floor(tempNum / 10000);
    
    if (uk > 0) summary += `${uk}억 `;
    if (man > 0) summary += `${man}만`;
    summary += "원";
    return summary;
  }
  
  return num.toLocaleString() + "원";
};

// 노드 타입별 메타데이터 (아이콘, 스타일)
const NODE_TYPES = {
  income: {
    label: "수입",
    color: "emerald",
    bgClass: "bg-emerald-50/70 border-emerald-500/30 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-500/40 dark:text-emerald-300",
    glowClass: "shadow-emerald-500/10 hover:shadow-emerald-500/20 border-emerald-500",
    badgeClass: "bg-emerald-500 text-white",
    icon: ArrowDownLeft,
  },
  expense: {
    label: "지출",
    color: "rose",
    bgClass: "bg-rose-50/70 border-rose-500/30 text-rose-950 dark:bg-rose-950/20 dark:border-rose-500/40 dark:text-rose-300",
    glowClass: "shadow-rose-500/10 hover:shadow-rose-500/20 border-rose-500",
    badgeClass: "bg-rose-500 text-white",
    icon: ArrowUpRight,
  },
  savings: {
    label: "저축",
    color: "amber",
    bgClass: "bg-amber-50/70 border-amber-500/30 text-amber-950 dark:bg-amber-950/20 dark:border-amber-500/40 dark:text-amber-300",
    glowClass: "shadow-amber-500/10 hover:shadow-amber-500/20 border-amber-500",
    badgeClass: "bg-amber-500 text-white",
    icon: PiggyBank,
  },
  investment: {
    label: "투자",
    color: "blue",
    bgClass: "bg-blue-50/70 border-blue-500/30 text-blue-950 dark:bg-blue-950/20 dark:border-blue-500/40 dark:text-blue-300",
    glowClass: "shadow-blue-500/10 hover:shadow-blue-500/20 border-blue-500",
    badgeClass: "bg-blue-500 text-white",
    icon: Coins,
  }
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 76;

export default function FlowChartPage() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  
  // 연결 모드 상태
  const [connectingSourceId, setConnectingSourceId] = useState(null);
  
  // 드래그 중인 노드 상태
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // 알림 메시지 상태
  const [toast, setToast] = useState(null);
  
  // 캔버스 크기 측정용 ref
  const canvasRef = useRef(null);

  // 로컬스토리지 로딩
  useEffect(() => {
    const savedNodes = localStorage.getItem("finance_flow_nodes");
    const savedEdges = localStorage.getItem("finance_flow_edges");
    if (savedNodes && savedEdges) {
      try {
        setNodes(JSON.parse(savedNodes));
        setEdges(JSON.parse(savedEdges));
      } catch (e) {
        setNodes(DEFAULT_NODES);
        setEdges(DEFAULT_EDGES);
      }
    } else {
      setNodes(DEFAULT_NODES);
      setEdges(DEFAULT_EDGES);
    }
  }, []);

  // 상태 자동 저장
  const saveState = (updatedNodes, updatedEdges) => {
    localStorage.setItem("finance_flow_nodes", JSON.stringify(updatedNodes));
    localStorage.setItem("finance_flow_edges", JSON.stringify(updatedEdges));
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 신규 노드 추가
  const addNode = (type) => {
    // 캔버스 중심 근처에 노드 생성
    let spawnX = 150;
    let spawnY = 150;
    
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      spawnX = Math.max(50, Math.floor(rect.width / 2) - 100 + (Math.random() * 40 - 20));
      spawnY = Math.max(50, Math.floor(rect.height / 2) - 38 + (Math.random() * 40 - 20));
    }

    const newNode = {
      id: `node_${Date.now()}`,
      type,
      label: `새 ${NODE_TYPES[type].label}`,
      amount: type === "income" ? 1000000 : 200000,
      x: spawnX,
      y: spawnY,
      memo: ""
    };

    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
    saveState(newNodes, edges);
    showToast(`${NODE_TYPES[type].label} 노드가 추가되었습니다.`);
  };

  // 선택된 노드 또는 엣지 삭제
  const deleteSelected = () => {
    if (selectedNodeId) {
      // 노드 삭제 및 해당 노드와 연결된 엣지 청소
      const newNodes = nodes.filter(n => n.id !== selectedNodeId);
      const newEdges = edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId);
      setNodes(newNodes);
      setEdges(newEdges);
      setSelectedNodeId(null);
      saveState(newNodes, newEdges);
      showToast("선택한 노드와 연결선이 삭제되었습니다.", "info");
    } else if (selectedEdgeId) {
      // 엣지 삭제
      const newEdges = edges.filter(e => e.id !== selectedEdgeId);
      setEdges(newEdges);
      setSelectedEdgeId(null);
      saveState(nodes, newEdges);
      showToast("선택한 연결선이 삭제되었습니다.", "info");
    }
  };

  // 리셋
  const resetToDefault = () => {
    if (confirm("자금 흐름도를 기본 템플릿으로 초기화하시겠습니까? (현재 수정된 사항은 삭제됩니다.)")) {
      setNodes(DEFAULT_NODES);
      setEdges(DEFAULT_EDGES);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectingSourceId(null);
      saveState(DEFAULT_NODES, DEFAULT_EDGES);
      showToast("기본 템플릿으로 초기화되었습니다.", "info");
    }
  };

  // 수치 업데이트 핸들러
  const handleNodeUpdate = (id, fields) => {
    const newNodes = nodes.map(n => n.id === id ? { ...n, ...fields } : n);
    setNodes(newNodes);
    saveState(newNodes, edges);
  };

  const handleEdgeUpdate = (id, fields) => {
    const newEdges = edges.map(e => e.id === id ? { ...e, ...fields } : e);
    setEdges(newEdges);
    saveState(nodes, newEdges);
  };

  // 드래그 마우스 이벤트 핸들러
  const handleMouseDown = (e, nodeId) => {
    if (connectingSourceId) return; // 연결 모드일 때는 드래그 방지
    
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setDraggedNodeId(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setDragOffset({
        x: e.clientX - node.x,
        y: e.clientY - node.y
      });
    }
  };

  // 마우스 이동 및 마우스 업 이벤트는 전역으로 수신하여 드래깅 보장
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!draggedNodeId) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      // 경계값 가두기 (클램핑)
      const maxX = rect.width - NODE_WIDTH;
      const maxY = rect.height - NODE_HEIGHT;
      newX = Math.max(10, Math.min(maxX, newX));
      newY = Math.max(10, Math.min(maxY, newY));

      setNodes(prev => 
        prev.map(n => n.id === draggedNodeId ? { ...n, x: newX, y: newY } : n)
      );
    };

    const handleMouseUp = () => {
      if (draggedNodeId) {
        setDraggedNodeId(null);
        // 드래그 완료 후 스토리지 저장
        saveState(nodes, edges);
      }
    };

    if (draggedNodeId) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggedNodeId, dragOffset, nodes, edges]);

  // 노드 클릭 시 (연결 모드용)
  const handleNodeClick = (e, nodeId) => {
    e.stopPropagation();
    
    if (connectingSourceId) {
      // 연결선 생성 진행
      if (connectingSourceId === nodeId) {
        setConnectingSourceId(null);
        showToast("자기 자신으로 연결할 수 없습니다.", "error");
        return;
      }
      
      // 이미 연결선이 존재하는지 검사
      const edgeExists = edges.some(edge => 
        (edge.source === connectingSourceId && edge.target === nodeId) ||
        (edge.source === nodeId && edge.target === connectingSourceId)
      );
      
      if (edgeExists) {
        setConnectingSourceId(null);
        showToast("두 노드 간에 이미 연결선이 존재합니다.", "error");
        return;
      }

      const sourceNode = nodes.find(n => n.id === connectingSourceId);
      const targetNode = nodes.find(n => n.id === nodeId);
      
      const newEdge = {
        id: `edge_${Date.now()}`,
        source: connectingSourceId,
        target: nodeId,
        label: sourceNode && targetNode ? `${formatKoreanAmount(sourceNode.amount)}` : "자금 흐름"
      };

      const newEdges = [...edges, newEdge];
      setEdges(newEdges);
      setSelectedEdgeId(newEdge.id);
      setSelectedNodeId(null);
      setConnectingSourceId(null);
      saveState(nodes, newEdges);
      showToast("두 노드가 연결되었습니다.");
    } else {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
    }
  };

  // 캔버스 클릭 시 선택 해제 및 연결 취소
  const handleCanvasClick = () => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectingSourceId(null);
  };

  // 통계 계산
  const totals = {
    income: nodes.filter(n => n.type === "income").reduce((acc, curr) => acc + (curr.amount || 0), 0),
    expense: nodes.filter(n => n.type === "expense").reduce((acc, curr) => acc + (curr.amount || 0), 0),
    savings: nodes.filter(n => n.type === "savings").reduce((acc, curr) => acc + (curr.amount || 0), 0),
    investment: nodes.filter(n => n.type === "investment").reduce((acc, curr) => acc + (curr.amount || 0), 0),
  };
  
  const totalOutflows = totals.expense + totals.savings + totals.investment;
  const unallocated = Math.max(0, totals.income - totalOutflows);
  
  const savingsRate = totals.income > 0 
    ? Math.round(((totals.savings + totals.investment) / totals.income) * 100) 
    : 0;

  // 연결선 경로 정보 계산
  const computedEdges = edges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return null;

    // 가로 방향 흐름에 적절한 포인트 추출
    // 만약 소스 노드가 타겟 노드보다 왼쪽에 있으면 소스 오른쪽 -> 타겟 왼쪽으로 연결
    let startX = sourceNode.x + NODE_WIDTH;
    let startY = sourceNode.y + NODE_HEIGHT / 2;
    let endX = targetNode.x;
    let endY = targetNode.y + NODE_HEIGHT / 2;

    // 노드가 겹치거나 수직에 가까운 경우 포인트 조정
    if (sourceNode.x + NODE_WIDTH > targetNode.x && sourceNode.x < targetNode.x + NODE_WIDTH) {
      // 수직 배치 시
      startX = sourceNode.x + NODE_WIDTH / 2;
      startY = sourceNode.y + (sourceNode.y < targetNode.y ? NODE_HEIGHT : 0);
      endX = targetNode.x + NODE_WIDTH / 2;
      endY = targetNode.y + (sourceNode.y < targetNode.y ? 0 : NODE_HEIGHT);
    } else if (sourceNode.x > targetNode.x) {
      // 소스가 타겟보다 우측에 있는 경우 역방향
      startX = sourceNode.x;
      endX = targetNode.x + NODE_WIDTH;
    }

    const dx = Math.abs(endX - startX);
    const controlX = Math.max(80, dx * 0.5);
    const pathString = `M ${startX} ${startY} C ${startX + controlX} ${startY}, ${endX - controlX} ${endY}, ${endX} ${endY}`;

    // 중간 좌표 (라벨 렌더링용)
    const labelX = (startX + endX) / 2;
    const labelY = (startY + endY) / 2;

    return {
      ...edge,
      path: pathString,
      labelX,
      labelY
    };
  }).filter(Boolean);

  const activeNode = nodes.find(n => n.id === selectedNodeId);
  const activeEdge = edges.find(e => e.id === selectedEdgeId);

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1720px] mx-auto min-h-screen text-slate-800 dark:text-slate-200">
      {/* 토스트 알림 */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 animate-slide-in ${
          toast.type === "error" 
            ? "bg-rose-50/90 border-rose-500/30 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200" 
            : toast.type === "info" 
            ? "bg-blue-50/90 border-blue-500/30 text-blue-800 dark:bg-blue-950/80 dark:text-blue-200"
            : "bg-emerald-50/90 border-emerald-500/30 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200"
        }`}>
          <AlertCircle size={18} className="shrink-0" />
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* 헤더 및 기본 액션 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            자금 지출 흐름도
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            수입이 고정비, 저축, 투자로 흘러가는 경로를 가시화하고 흐름 비율을 파악합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={resetToDefault}
            className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 transition shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} />
            템플릿 리셋
          </button>
        </div>
      </div>

      {/* 실시간 요약 대시보드 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 p-5 rounded-2xl flex flex-col gap-1.5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            총 수입
          </span>
          <span className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatKoreanAmount(totals.income)}
          </span>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 p-5 rounded-2xl flex flex-col gap-1.5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            총 지출
          </span>
          <span className="text-lg font-bold tracking-tight text-rose-600 dark:text-rose-400">
            {formatKoreanAmount(totals.expense)}
          </span>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 p-5 rounded-2xl flex flex-col gap-1.5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            총 저축
          </span>
          <span className="text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {formatKoreanAmount(totals.savings)}
          </span>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 p-5 rounded-2xl flex flex-col gap-1.5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            총 투자
          </span>
          <span className="text-lg font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {formatKoreanAmount(totals.investment)}
          </span>
        </div>
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/10 dark:to-purple-950/10 border border-indigo-100 dark:border-indigo-950/30 p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="flex flex-col gap-1 z-10">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">저축 & 투자율</span>
            <span className="text-2xl font-extrabold tracking-tight text-indigo-900 dark:text-indigo-300">
              {savingsRate}%
            </span>
          </div>
          <span className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400/70 z-10 mt-2">
            남은 여유 자금: {formatKoreanAmount(unallocated)}
          </span>
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-2 translate-y-2 pointer-events-none">
            <DollarSign size={80} className="text-indigo-900 dark:text-white" />
          </div>
        </div>
      </div>

      {/* 에디터 공간 */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-stretch">
        
        {/* 캔버스 영역 (3/4 그리드) */}
        <div className="xl:col-span-3 flex flex-col gap-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/30 shadow-sm relative overflow-hidden min-h-[620px]">
          
          {/* 에디터 캔버스 툴바 */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 z-20 bg-white/70 dark:bg-slate-900/80 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2">도형 추가:</span>
              <button 
                onClick={() => addNode("income")}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                수입
              </button>
              <button 
                onClick={() => addNode("expense")}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                지출
              </button>
              <button 
                onClick={() => addNode("savings")}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                저축
              </button>
              <button 
                onClick={() => addNode("investment")}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                투자
              </button>
            </div>

            {connectingSourceId ? (
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/50 animate-pulse">
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                  <Link2 size={13} />
                  연결 대상을 선택하세요...
                </span>
                <button 
                  onClick={() => setConnectingSourceId(null)}
                  className="p-1 rounded hover:bg-indigo-100 text-indigo-600 dark:hover:bg-indigo-900 dark:text-indigo-400"
                  title="연결 취소"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Info size={13} />
                도형을 드래그해 옮길 수 있습니다.
              </div>
            )}
          </div>

          {/* 실제 다이어그램 캔버스 */}
          <div 
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="flex-grow w-full relative bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] dark:bg-[radial-gradient(#334155_1.5px,transparent_1.5px)] [background-size:24px_24px] cursor-default select-none overflow-auto"
            style={{ minHeight: "540px" }}
          >
            {/* 연결선 SVG 렌더러 */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                {/* 화살표 마커 정의 */}
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
                </marker>
                <marker
                  id="arrow-selected"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6366f1" />
                </marker>
              </defs>

              {/* 연결선 렌더링 */}
              {computedEdges.map(edge => {
                const isSelected = edge.id === selectedEdgeId;
                return (
                  <g key={edge.id}>
                    {/* 선택을 돕는 투명 더블 패스 */}
                    <path
                      d={edge.path}
                      stroke="transparent"
                      strokeWidth="12"
                      fill="none"
                      className="cursor-pointer pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                        setConnectingSourceId(null);
                      }}
                    />
                    {/* 실제 보이는 패스 */}
                    <path
                      d={edge.path}
                      stroke={isSelected ? "#6366f1" : "rgba(148, 163, 184, 0.5)"}
                      strokeWidth={isSelected ? "3" : "2"}
                      fill="none"
                      markerEnd={isSelected ? "url(#arrow-selected)" : "url(#arrow)"}
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}
            </svg>

            {/* 연결선 라벨 오버레이 (Absolute Divs) */}
            {computedEdges.map(edge => {
              const isSelected = edge.id === selectedEdgeId;
              return (
                <div
                  key={`label-${edge.id}`}
                  style={{
                    position: "absolute",
                    left: `${edge.labelX}px`,
                    top: `${edge.labelY}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                  className="z-20 pointer-events-auto"
                >
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                      setConnectingSourceId(null);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-tight border shadow-sm transition-all cursor-pointer select-none ${
                      isSelected 
                        ? "bg-indigo-600 text-white border-indigo-500 scale-105" 
                        : "bg-white/95 text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800/95 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>{edge.label || "자금 흐름"}</span>
                  </div>
                </div>
              );
            })}

            {/* 노드(도형) 렌더링 */}
            {nodes.map(node => {
              const isSelected = node.id === selectedNodeId;
              const typeInfo = NODE_TYPES[node.type];
              const IconComponent = typeInfo.icon;
              
              // 연결 모드일 때 포인터 설정
              let cursorStyle = "grab";
              if (connectingSourceId) {
                cursorStyle = connectingSourceId === node.id ? "not-allowed" : "pointer";
              }

              return (
                <div
                  key={node.id}
                  style={{
                    position: "absolute",
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${NODE_WIDTH}px`,
                    height: `${NODE_HEIGHT}px`,
                    cursor: cursorStyle
                  }}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onClick={(e) => handleNodeClick(e, node.id)}
                  className={`flex flex-col justify-between p-3.5 rounded-2xl border bg-white dark:bg-slate-800 transition-all select-none z-10 ${
                    isSelected 
                      ? `border-indigo-500 ring-2 ring-indigo-500/20 shadow-md ${typeInfo.glowClass}` 
                      : `shadow-sm ${typeInfo.bgClass} hover:border-slate-300 dark:hover:border-slate-600`
                  } ${connectingSourceId && connectingSourceId !== node.id ? "hover:scale-[1.02] hover:border-indigo-400 dark:hover:border-indigo-500" : ""}`}
                >
                  {/* 노드 헤더 */}
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase bg-black/5 dark:bg-white/10 opacity-75">
                      {typeInfo.label}
                    </span>
                    <div className={`p-1 rounded-lg ${typeInfo.badgeClass}`}>
                      <IconComponent size={12} />
                    </div>
                  </div>

                  {/* 노드 제목 및 설명 */}
                  <div className="flex flex-col gap-0.5 mt-1">
                    <span className="font-bold text-xs truncate max-w-[160px]" title={node.label}>
                      {node.label}
                    </span>
                    <span className="font-extrabold text-[13px] tracking-tight text-right opacity-95">
                      {formatKoreanAmount(node.amount)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* 노드가 없을 때의 안내 문구 */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500">
                <Info size={36} className="mb-2 opacity-50" />
                <span className="text-sm font-semibold">캔버스가 비어 있습니다.</span>
                <span className="text-xs mt-1">상단 툴바의 도형 추가 버튼을 눌러 자금 흐름을 그려보세요.</span>
              </div>
            )}
          </div>
        </div>

        {/* 편집기 속성 조절 사이드 패널 (1/4 그리드) */}
        <div className="flex flex-col gap-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/30 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3">
            속성 및 편집
          </h2>

          {activeNode ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">유형</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${NODE_TYPES[activeNode.type].badgeClass}`}>
                  {NODE_TYPES[activeNode.type].label}
                </span>
              </div>

              {/* 도형 이름 변경 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">도형 이름</label>
                <input 
                  type="text" 
                  value={activeNode.label}
                  onChange={(e) => handleNodeUpdate(activeNode.id, { label: e.target.value })}
                  placeholder="예: 용돈, 고정식비 등"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900 dark:text-slate-100 transition"
                />
              </div>

              {/* 금액 변경 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  자금 규모 (원)
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={activeNode.amount || ""}
                    onChange={(e) => handleNodeUpdate(activeNode.id, { amount: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full text-sm pl-3.5 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900 dark:text-slate-100 transition font-mono"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">원</span>
                </div>
                <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 text-right">
                  {formatKoreanAmount(activeNode.amount)}
                </div>
              </div>

              {/* 메모 입력 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">상세 설명 (메모)</label>
                <textarea 
                  value={activeNode.memo || ""}
                  onChange={(e) => handleNodeUpdate(activeNode.id, { memo: e.target.value })}
                  placeholder="메모를 작성하세요..."
                  rows={3}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900 dark:text-slate-100 transition resize-none"
                />
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2 flex flex-col gap-2">
                <button 
                  onClick={() => setConnectingSourceId(activeNode.id)}
                  className="w-full flex items-center justify-center gap-2 text-xs font-bold px-3 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400 transition cursor-pointer"
                >
                  <Link2 size={14} />
                  다른 노드에 연결
                </button>
                <button 
                  onClick={deleteSelected}
                  className="w-full flex items-center justify-center gap-2 text-xs font-bold px-3 py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400 transition cursor-pointer"
                >
                  <Trash2 size={14} />
                  이 노드 삭제
                </button>
              </div>
            </div>
          ) : activeEdge ? (
            <div className="flex flex-col gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">출발 노드</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {nodes.find(n => n.id === activeEdge.source)?.label || "없음"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">도착 노드</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {nodes.find(n => n.id === activeEdge.target)?.label || "없음"}
                  </span>
                </div>
              </div>

              {/* 연결선 라벨(흐름 액수 등) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">연결선 라벨 (비중/금액)</label>
                <input 
                  type="text" 
                  value={activeEdge.label || ""}
                  onChange={(e) => handleEdgeUpdate(activeEdge.id, { label: e.target.value })}
                  placeholder="예: 150만원, 10% 등"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900 dark:text-slate-100 transition"
                />
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <button 
                  onClick={deleteSelected}
                  className="w-full flex items-center justify-center gap-2 text-xs font-bold px-3 py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400 transition cursor-pointer"
                >
                  <Trash2 size={14} />
                  연결선 삭제
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 min-h-[220px]">
              <HelpCircle size={24} className="mb-2 opacity-50" />
              <span className="text-xs font-semibold">선택된 요소 없음</span>
              <span className="text-[10px] mt-1 opacity-75">편집하려면 노드나 연결선을 선택하세요.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
