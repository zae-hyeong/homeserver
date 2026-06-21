"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Globe, 
  ArrowRight, 
  Activity, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink,
  Power,
  X,
  PlusCircle,
  Server,
  ToggleLeft,
  ToggleRight
} from "lucide-react";

interface ProxyRoute {
  id: string;
  name: string;
  sourceHost: string;
  destinationUrl: string;
  active: boolean;
  description: string;
}

interface HealthStatus {
  [id: string]: "online" | "offline";
}

export default function Home() {
  const [routes, setRoutes] = useState<ProxyRoute[]>([]);
  const [health, setHealth] = useState<HealthStatus>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<ProxyRoute | null>(null);
  
  // 폼 상태
  const [name, setName] = useState("");
  const [sourceHost, setSourceHost] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [description, setDescription] = useState("");
  
  // UI 상태
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [validationError, setValidationError] = useState("");

  const fetchRoutes = async () => {
    try {
      const res = await fetch("/api/routes");
      if (res.ok) {
        const data = await res.json();
        setRoutes(data);
      }
    } catch (err) {
      console.error("Failed to fetch routes", err);
    }
  };

  const fetchHealth = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.error("Failed to fetch health status", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
    fetchHealth();
    
    // 15초마다 헬스체크 폴링
    const timer = setInterval(() => {
      fetchHealth();
    }, 15000);
    
    return () => clearInterval(timer);
  }, []);

  const resetForm = () => {
    setName("");
    setSourceHost("");
    setDestinationUrl("");
    setDescription("");
    setEditingRoute(null);
    setValidationError("");
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (route: ProxyRoute) => {
    setEditingRoute(route);
    setName(route.name);
    setSourceHost(route.sourceHost);
    setDestinationUrl(route.destinationUrl);
    setDescription(route.description);
    setValidationError("");
    setIsModalOpen(true);
  };

  const handleToggleActive = async (route: ProxyRoute) => {
    try {
      const res = await fetch("/api/routes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: route.id, active: !route.active })
      });
      if (res.ok) {
        fetchRoutes();
        // 토글 후 헬스체크 갱신
        setTimeout(fetchHealth, 500);
      }
    } catch (err) {
      console.error("Failed to toggle route status", err);
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (!confirm("정말 이 라우팅 설정을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/routes?id=${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchRoutes();
      } else {
        const errData = await res.json();
        alert(errData.error || "삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error("Failed to delete route", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    // 유효성 검사
    if (!name.trim() || !sourceHost.trim() || !destinationUrl.trim()) {
      setValidationError("필수 입력란을 모두 채워주세요.");
      return;
    }

    if (!/^https?:\/\//.test(destinationUrl)) {
      setValidationError("대상 주소는 http:// 또는 https:// 로 시작해야 합니다.");
      return;
    }

    const payload = {
      name: name.trim(),
      sourceHost: sourceHost.trim(),
      destinationUrl: destinationUrl.trim(),
      description: description.trim()
    };

    try {
      let res;
      if (editingRoute) {
        // 수정 모드
        res = await fetch("/api/routes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingRoute.id, ...payload })
        });
      } else {
        // 추가 모드
        res = await fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setIsModalOpen(false);
        resetForm();
        fetchRoutes();
        setTimeout(fetchHealth, 500);
      } else {
        const errData = await res.json();
        setValidationError(errData.error || "저장에 실패했습니다.");
      }
    } catch (err) {
      setValidationError("서버와 통신하는 중 오류가 발생했습니다.");
    }
  };

  const activeRoutesCount = routes.filter(r => r.active).length;
  const onlineRoutesCount = routes.filter(r => r.active && health[r.id] === "online").length;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      
      {/* 백그라운드 그라데이션 오라 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-950/10 blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        
        {/* 헤더 영역 */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 pb-6 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Globe className="w-5 h-5 animate-pulse" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Home Server Gateway</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Reverse Proxy Dashboard
            </h1>
            <p className="text-sm text-slate-400 mt-1">도메인 유입 요청을 내부 서비스 포트로 실시간 리버스 프록시 처리합니다.</p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={fetchHealth} 
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-white/5 text-slate-300 hover:text-white hover:border-white/10 transition duration-200 disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              상태 갱신
            </button>
            
            <button 
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-sm shadow-lg shadow-indigo-600/15 border border-indigo-500/30 transition duration-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              라우팅 추가
            </button>
          </div>
        </header>

        {/* 대시보드 요약 위젯 */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-white/[0.02] backdrop-blur-md border border-white/5 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">전체 프록시 설정</p>
              <h2 className="text-3xl font-bold mt-1 text-slate-200">{routes.length} <span className="text-xs text-slate-500 font-normal">개</span></h2>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-xl border border-white/5 text-slate-400">
              <Server className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-md border border-white/5 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">활성화 서비스</p>
              <h2 className="text-3xl font-bold mt-1 text-indigo-400">
                {activeRoutesCount} <span className="text-xs text-slate-500 font-normal">/ {routes.length}개</span>
              </h2>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/10 text-indigo-400">
              <Power className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-md border border-white/5 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">정상 가동 (Online)</p>
              <h2 className="text-3xl font-bold mt-1 text-emerald-400">
                {onlineRoutesCount} <span className="text-xs text-slate-500 font-normal">/ {activeRoutesCount}개</span>
              </h2>
            </div>
            <div className={`p-3 rounded-xl border transition-colors duration-300 ${
              onlineRoutesCount === activeRoutesCount && activeRoutesCount > 0
                ? "bg-emerald-500/10 border-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/10 text-amber-400"
            }`}>
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
          </div>
        </section>

        {/* 프록시 라우팅 목록 리스트 */}
        <main>
          {routes.length === 0 ? (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-content-center mx-auto mb-4 border border-white/5 flex justify-center items-center">
                <Globe className="w-6 h-6 text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-300">등록된 프록시 설정이 없습니다</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">새로운 서브도메인을 지정하고 포워딩할 타겟 서버를 등록해 보세요.</p>
              <button 
                onClick={handleOpenAddModal}
                className="mt-4 px-4 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 text-xs font-semibold transition cursor-pointer"
              >
                첫 라우팅 규칙 추가
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <AnimatePresence mode="popLayout">
                {routes.map((route) => {
                  const isOnline = health[route.id] === "online";
                  const isRouteActive = route.active;
                  
                  return (
                    <motion.div
                      key={route.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`bg-white/[0.02] backdrop-blur-lg border p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all duration-300 ${
                        isRouteActive 
                          ? "border-white/5 hover:border-white/10 hover:bg-white/[0.03]" 
                          : "border-white/5 opacity-60"
                      }`}
                    >
                      <div className="flex-1 space-y-2">
                        {/* 헤더 정보 */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-base font-bold text-slate-100">{route.name}</h3>
                          
                          {/* 헬스 정보 뱃지 */}
                          {!isRouteActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-900 border border-white/5 text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                              비활성화됨
                            </span>
                          ) : isOnline ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Offline
                            </span>
                          )}
                        </div>

                        {/* 도메인 매핑 시각화 */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-slate-300">
                          <a 
                            href={`https://${route.sourceHost}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline font-medium transition"
                          >
                            {route.sourceHost}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <div className="hidden sm:block text-slate-600">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                          <code className="text-xs px-2 py-1 bg-slate-950/70 border border-white/5 rounded-md text-emerald-400 font-mono self-start sm:self-auto">
                            {route.destinationUrl}
                          </code>
                        </div>

                        {/* 상세 설명 */}
                        {route.description && (
                          <p className="text-xs text-slate-400 mt-1">{route.description}</p>
                        )}
                      </div>

                      {/* 컨트롤 영역 */}
                      <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t border-white/5 pt-3 md:border-t-0 md:pt-0">
                        {/* 토글 스위치 */}
                        <button
                          onClick={() => handleToggleActive(route)}
                          className="text-slate-400 hover:text-slate-200 transition focus:outline-none cursor-pointer"
                          title={isRouteActive ? "프록시 비활성화" : "프록시 활성화"}
                        >
                          {isRouteActive ? (
                            <ToggleRight className="w-10 h-10 text-indigo-500" />
                          ) : (
                            <ToggleLeft className="w-10 h-10 text-slate-600" />
                          )}
                        </button>

                        <div className="h-6 w-[1px] bg-white/5" />

                        {/* 수정 버튼 */}
                        <button 
                          onClick={() => handleOpenEditModal(route)}
                          className="p-2 rounded-lg bg-slate-900 border border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10 transition cursor-pointer"
                          title="수정"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* 삭제 버튼 */}
                        <button 
                          onClick={() => handleDeleteRoute(route.id)}
                          className="p-2 rounded-lg bg-red-950/30 border border-red-500/20 text-red-400 hover:text-red-300 hover:border-red-500/40 transition cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>

      {/* 라우팅 추가/수정 모달 다이얼로그 */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 오버레이 */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            {/* 모달 박스 */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#0c0f17] border border-white/10 rounded-2xl w-full max-w-lg p-6 relative z-10 shadow-2xl shadow-black/50"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-100">
                  {editingRoute ? "라우팅 설정 수정" : "새로운 라우팅 추가"}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {validationError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">서비스 이름</label>
                  <input 
                    type="text" 
                    placeholder="예: Portfolio App" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-white/5 focus:border-indigo-500/50 rounded-lg text-sm text-slate-200 focus:outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">요청 도메인 (Source Host)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="예: portfolio.zaehyeong.cloud" 
                      value={sourceHost}
                      onChange={(e) => setSourceHost(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-white/5 focus:border-indigo-500/50 rounded-lg text-sm text-slate-200 focus:outline-none transition"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">접속 시 사용할 호스트 이름(서브도메인 포함)을 입력해 주세요.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">대상 서버 주소 (Destination URL)</label>
                  <input 
                    type="text" 
                    placeholder="예: http://nextjs-app:3000" 
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-white/5 focus:border-indigo-500/50 rounded-lg text-sm text-slate-200 focus:outline-none transition font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">포워딩할 내부 Docker 컨테이너명과 포트, 혹은 외부 IP 주소를 입력해 주세요.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">설명 (선택)</label>
                  <textarea 
                    placeholder="서비스에 대한 간단한 메모를 입력해 주세요." 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-white/5 focus:border-indigo-500/50 rounded-lg text-sm text-slate-200 focus:outline-none transition resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
                  >
                    취소
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2 text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 rounded-lg text-white font-semibold shadow-lg shadow-indigo-600/10 transition duration-200 border border-indigo-500/20 cursor-pointer"
                  >
                    {editingRoute ? "수정 완료" : "추가"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
