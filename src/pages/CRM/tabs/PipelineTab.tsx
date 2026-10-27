import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { crmService, type CRMPipeline, type CRMPipelineStage } from '../../../services/crm';
import NewDealModal from '../../../components/crm-modals/NewDealModal';
import EditDealModal from '../../../components/crm-modals/EditDealModal';
import ContractFormModal from '../../../components/crm-modals/ContractFormModal';
import { useAuth } from '../../../contexts/AuthContext';

const getStageColor = (index: number) => {
  const colors = [
    { bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-400' },
    { bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-100 dark:border-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
    { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-100 dark:border-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
    { bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-100 dark:border-green-500/20', text: 'text-green-600 dark:text-green-400' },
    { bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-100 dark:border-red-500/20', text: 'text-red-600 dark:text-red-400' },
  ];
  return colors[index % colors.length];
};

const formatShortDate = (date: Date) => {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
};

const getWeekRange = (date: Date) => {
  const day = date.getDay(); // 0 (Sunday) to 6 (Saturday)
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const PipelineTab: React.FC = () => {
  const [, setPipelines] = useState<(CRMPipeline & { stageList: CRMPipelineStage[] })[]>([]);
  const [activePipeline, setActivePipeline] = useState<(CRMPipeline & { stageList: CRMPipelineStage[] }) | null>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewDealModalOpen, setIsNewDealModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [showKpis, setShowKpis] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_pipeline_show_kpis');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const { profile } = useAuth();

  useEffect(() => {
    try {
      localStorage.setItem('crm_pipeline_show_kpis', String(showKpis));
    } catch {
      // ignore
    }
  }, [showKpis]);

  // Won celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [wonDealTitle, setWonDealTitle] = useState('');

  // Lost reason modal state
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [pendingLostDeal, setPendingLostDeal] = useState<{ dealId: string; stageId: string; probability: number } | null>(null);
  const [lostLoading, setLostLoading] = useState(false);

  // Contract form state
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [pendingContractDeal, setPendingContractDeal] = useState<any>(null);

  const isUserComercial = profile?.access_level === 'Comercial';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pipelinesData, dealsData, activitiesData] = await Promise.all([
        crmService.getPipelines(),
        crmService.getDeals(),
        crmService.getDealActivities()
      ]);

      setPipelines(pipelinesData);

      const active = pipelinesData.find((p: any) => p.active) || pipelinesData[0];
      setActivePipeline(active || null);
      setDeals(dealsData);
      setActivities(activitiesData);
    } catch (error) {
      console.error('Erro ao carregar dados do pipeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceStageId = result.source.droppableId;
    const destStageId = result.destination.droppableId;
    const dealId = result.draggableId;

    if (sourceStageId === destStageId) return;

    const newStage = activePipeline?.stageList.find(s => s.id === destStageId);
    if (!newStage) return;

    // If target is is_lost, show lost reason modal instead of moving immediately
    if (newStage.is_lost) {
      setPendingLostDeal({ dealId, stageId: destStageId, probability: newStage.probability_pct || 0 });
      setLostReason('');
      setShowLostModal(true);
      return;
    }

    // Optimistic UI update
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_id: destStageId, probability_pct: newStage.probability_pct } : d));

    try {
      await crmService.updateDeal(dealId, {
        stage_id: destStageId,
        probability_pct: newStage.probability_pct
      });

      // If target is is_won, trigger celebration
      if (newStage.is_won) {
        const deal = deals.find(d => d.id === dealId);

        try {
          const contracts = await crmService.getContracts(dealId);
          if (!contracts || contracts.length === 0) {
            setPendingContractDeal(deal);
            setIsContractModalOpen(true);
          } else {
            setWonDealTitle(deal?.title || 'Negócio');
            setShowCelebration(true);
            setTimeout(() => setShowCelebration(false), 4000);
          }
        } catch (error) {
          // If contract check fails, we assume no contract and show the modal
          setPendingContractDeal(deal);
          setIsContractModalOpen(true);
        }
      }

      const activitiesData = await crmService.getDealActivities();
      setActivities(activitiesData);
    } catch (error) {
      console.error('Erro ao atualizar etapa do negócio:', error);
      loadData();
    }
  };

  const handleConfirmLost = async () => {
    if (!pendingLostDeal || !lostReason.trim()) return;
    setLostLoading(true);
    const { dealId, stageId, probability } = pendingLostDeal;

    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_id: stageId, probability_pct: probability } : d));

    try {
      await crmService.updateDeal(dealId, {
        stage_id: stageId,
        probability_pct: probability,
        lost_reason: lostReason.trim()
      });
      const activitiesData = await crmService.getDealActivities();
      setActivities(activitiesData);
    } catch (error) {
      console.error('Erro ao registrar perda:', error);
      loadData();
    } finally {
      setShowLostModal(false);
      setPendingLostDeal(null);
      setLostReason('');
      setLostLoading(false);
    }
  };

  const handleCancelLost = () => {
    setShowLostModal(false);
    setPendingLostDeal(null);
    setLostReason('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mustard-500"></div>
      </div>
    );
  }

  if (!activePipeline) {
    return (
      <div className="text-center py-12">
        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">view_kanban</span>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">Nenhum pipeline ativo</h3>
        <p className="text-slate-500">Configure um pipeline nas configurações do CRM.</p>
      </div>
    );
  }

  const { start: weekStart, end: weekEnd } = getWeekRange(currentWeekDate);
  const wonStageIds = (activePipeline.stageList || []).filter(s => s.is_won).map(s => s.id);
  const lostStageIds = (activePipeline.stageList || []).filter(s => s.is_lost).map(s => s.id);

  const pipelineDeals = deals.filter(d => {
    if (d.pipeline_id !== activePipeline.id) return false;

    // Filtro por semana (domingo a sábado)
    const created = new Date(d.created_at);
    if (created > weekEnd) return false; // Criado no futuro em relação à semana selecionada

    const isClosed = wonStageIds.includes(d.stage_id) || lostStageIds.includes(d.stage_id);

    if (isClosed) {
      // Se está finalizado, só exibe na semana se foi fechado nesta semana ou depois
      const closedAt = d.closed_at ? new Date(d.closed_at) : new Date(d.updated_at);
      if (closedAt < weekStart) return false;
    }

    // Filtro por termo de pesquisa (combinado com o período selecionado)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const titleMatch = d.title ? String(d.title).toLowerCase().includes(term) : false;
      const clientMatch = d.client?.company_name ? String(d.client.company_name).toLowerCase().includes(term) : false;
      const leadMatch = d.lead?.company_name ? String(d.lead.company_name).toLowerCase().includes(term) : false;
      const ownerMatch = d.owner?.full_name ? String(d.owner.full_name).toLowerCase().includes(term) : false;
      const descMatch = d.description ? String(d.description).toLowerCase().includes(term) : false;
      const valueMatch = d.value ? String(d.value).includes(term) : false;

      if (!titleMatch && !clientMatch && !leadMatch && !ownerMatch && !descMatch && !valueMatch) {
        return false;
      }
    }

    return true;
  });

  const totalValue = pipelineDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  // Compute conversion rate: won / (won + lost)
  const wonCount = pipelineDeals.filter(d => wonStageIds.includes(d.stage_id)).length;
  const lostCount = pipelineDeals.filter(d => lostStageIds.includes(d.stage_id)).length;
  const closedTotal = wonCount + lostCount;
  const conversionRate = closedTotal > 0 ? `${Math.round((wonCount / closedTotal) * 100)}%` : 'N/D';

  // Compute average cycle: mean days between created_at and closed_at for deals with closed_at
  const closedDeals = pipelineDeals.filter(d => d.closed_at);
  let avgCycle = 'N/D';
  if (closedDeals.length > 0) {
    const totalDays = closedDeals.reduce((sum, d) => {
      const diffMs = new Date(d.closed_at).getTime() - new Date(d.created_at).getTime();
      return sum + Math.max(Math.floor(diffMs / (1000 * 3600 * 24)), 0);
    }, 0);
    const avg = Math.round(totalDays / closedDeals.length);
    avgCycle = `${avg} dia${avg !== 1 ? 's' : ''}`;
  }

  return (
    <div className="space-y-4">
      {/* Row 1: Full-width compact KPIs */}
      <AnimatePresence initial={false}>
        {showKpis && (
          <motion.div
            key="kpis-row"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full pb-0.5">
              {[
                { label: 'Ativas', value: pipelineDeals.length.toString(), icon: 'handshake', accent: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                { label: 'Valor', value: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: 'payments', accent: 'bg-mustard-50 dark:bg-mustard-500/10 text-mustard-600 dark:text-mustard-400' },
                { label: 'Conversão', value: conversionRate, icon: 'trending_up', accent: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
                { label: 'Ciclo', value: avgCycle, icon: 'schedule', accent: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 shadow-xs flex items-center gap-3">
                  <div className={`w-7 h-7 ${stat.accent} rounded-lg flex items-center justify-center shrink-0`}>
                    <span className="material-symbols-outlined text-[16px]">{stat.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-0.5 truncate">{stat.label}</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white leading-tight truncate">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Row 2: Search, Toggle KPIs, Period Filter & Action Button on the same line */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Pesquisar propostas por título, cliente, responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-16 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs h-[40px] transition-all"
          />
          {searchTerm && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md pointer-events-none">
                {pipelineDeals.length}
              </span>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Limpar pesquisa"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            </div>
          )}
        </div>

        {/* Toggle Top KPIs Row Button */}
        <button
          type="button"
          onClick={() => setShowKpis((prev) => !prev)}
          className={`h-[40px] px-3 rounded-xl border flex items-center gap-1.5 transition-all text-xs font-bold shrink-0 cursor-pointer shadow-xs select-none ${showKpis
            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
            : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          title={showKpis ? 'Ocultar indicadores superiores' : 'Exibir indicadores superiores'}
        >
          <span className="material-symbols-outlined text-[18px]">query_stats</span>
          <span className="text-[11px] font-black uppercase tracking-widest hidden sm:inline">
            KPIs
          </span>
          <span
            className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform duration-200 ${showKpis ? 'rotate-180' : ''
              }`}
          >
            expand_more
          </span>
        </button>

        {/* Period Selector */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 rounded-xl px-2 py-1 border border-slate-200 dark:border-slate-800 shadow-xs h-[40px] shrink-0">
          <button
            type="button"
            onClick={() => { const d = new Date(currentWeekDate); d.setDate(d.getDate() - 7); setCurrentWeekDate(d); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer"
            title="Semana anterior"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 min-w-[95px] text-center select-none">
            {formatShortDate(weekStart)} - {formatShortDate(weekEnd)}
          </span>
          <button
            type="button"
            onClick={() => { const d = new Date(currentWeekDate); d.setDate(d.getDate() + 7); setCurrentWeekDate(d); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer"
            title="Próxima semana"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        {/* New Deal Button */}
        <button
          type="button"
          onClick={() => setIsNewDealModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-mustard-500 hover:bg-mustard-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-md shadow-mustard-500/20 transition-all active:scale-95 h-[40px] shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Novo Negócio</span>
        </button>
      </div>

      {/* Kanban Board Area */}
      <div className="w-full">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-5 overflow-x-auto pb-4 snap-x custom-scrollbar">
            {activePipeline.stageList.map((stage, index) => {
              const colors = getStageColor(index);
              const stageDeals = pipelineDeals.filter(d => d.stage_id === stage.id);

              return (
                <div key={stage.id} className="w-60 shrink-0 snap-center">
                  <div className="space-y-3">
                    {/* Stage Header */}
                    <div className={`rounded-xl px-4 py-2 border ${colors.bg} ${colors.border} flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <h3 className={`text-xs font-black uppercase tracking-widest ${colors.text}`}>{stage.name}</h3>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${colors.bg} ${colors.text} border ${colors.border}`}>
                        {stageDeals.length}
                      </span>
                    </div>

                    {/* Droppable Area */}
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={`min-h-[200px] space-y-3 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-slate-50 dark:bg-slate-800/50' : ''
                            }`}
                        >
                          {stageDeals.map((deal, index) => {
                            const isOwner = deal.owner_id === profile?.id;
                            const canEditOrDrag = !isUserComercial || isOwner;

                            return (
                              <Draggable
                                key={deal.id}
                                draggableId={deal.id}
                                index={index}
                                isDragDisabled={!canEditOrDrag}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`bg-white dark:bg-slate-900 rounded-xl border ${snapshot.isDragging ? 'border-mustard-500 shadow-xl' : 'border-slate-200 dark:border-slate-800'} p-5 shadow-sm hover:shadow-md transition-all ${canEditOrDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} group select-none relative`}
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-mustard-500 dark:group-hover:text-mustard-400 transition-colors leading-tight">{deal.title}</h4>
                                      {canEditOrDrag && (
                                        <button
                                          onClick={() => {
                                            setSelectedDeal(deal);
                                            setIsEditModalOpen(true);
                                          }}
                                          className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-mustard-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                        >
                                          <span className="material-symbols-outlined text-lg">edit</span>
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                                      {deal.client?.company_name || deal.lead?.company_name || 'Sem Empresa Vinculada'}
                                    </p>

                                    <div className="flex items-center justify-between mt-4">
                                      <span className="text-xs font-black text-mustard-600 dark:text-mustard-400">
                                        {(Number(deal.value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{deal.probability_pct || 0}%</span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
                                      <div className="h-full bg-mustard-500 rounded-full transition-all duration-500" style={{ width: `${deal.probability_pct || 0}%` }} />
                                    </div>

                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50 dark:border-slate-800">
                                      <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                                        <div className="w-7 h-7 bg-mustard-100 dark:bg-mustard-500/20 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                                          {deal.owner?.photo_url ? (
                                            <img
                                              src={deal.owner.photo_url}
                                              alt={deal.owner.full_name}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <span className="text-[8px] font-black text-mustard-700 dark:text-mustard-400">
                                              {(deal.owner?.full_name || 'U').charAt(0).toUpperCase()}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                                          {deal.owner?.full_name || 'Sem Dono'}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-slate-300 dark:text-slate-600 font-bold shrink-0">
                                        {Math.floor((new Date().getTime() - new Date(deal.created_at).getTime()) / (1000 * 3600 * 24))}d
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Recent Activities Section - Full Width below Kanban */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 flex flex-col mt-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-mustard-50 dark:bg-mustard-500/10 rounded-2xl flex items-center justify-center text-mustard-600 dark:text-mustard-400">
              <span className="material-symbols-outlined text-2xl">history</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">
                Histórico de Atividades
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Últimas movimentações do pipeline</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-6 max-h-[600px] overflow-y-auto p-4 custom-scrollbar">
          {activities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-slate-400">Nenhuma atividade recente.</p>
            </div>
          ) : (
            activities.map((activity, index) => (
              <div key={activity.id} className={`relative pl-8 pb-6 ${index !== activities.length - 1 ? 'border-l-2 border-slate-100 dark:border-slate-800' : ''}`}>
                <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-mustard-500 z-10 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-mustard-500" />
                </div>

                <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-2.5 border border-slate-100 dark:border-slate-800/50 hover:border-mustard-500/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-mustard-100 dark:bg-mustard-500/20 flex items-center justify-center overflow-hidden shrink-0">
                        {activity.performer?.photo_url ? (
                          <img src={activity.performer.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] font-black text-mustard-600">{(activity.performer?.full_name || 'U').charAt(0)}</span>
                        )}
                      </div>
                      <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-wider truncate max-w-[120px]">
                        {activity.performer?.full_name || 'Usuário'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800 shadow-sm">
                      <span className="material-symbols-outlined text-[12px] text-slate-400">schedule</span>
                      <span className="text-[9px] font-bold text-slate-500">
                        {new Date(activity.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 leading-tight">
                    {activity.activity_type === 'stage_change' ? (
                      <div className="flex flex-col gap-2">
                        <p className="truncate">
                          Moveu <span className="font-bold text-slate-900 dark:text-white">{activity.deal?.title}</span>
                        </p>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm self-start">
                          <span className="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[9px] font-bold text-slate-500">{activity.stage_from?.name || 'Início'}</span>
                          <span className="material-symbols-outlined text-[14px] text-mustard-500">trending_flat</span>
                          <span className="px-1.5 py-0.5 bg-mustard-500 text-white rounded text-[9px] font-black">{activity.stage_to?.name}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="font-medium">{activity.description}</p>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {new Date(activity.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <NewDealModal
        isOpen={isNewDealModalOpen}
        onClose={() => setIsNewDealModalOpen(false)}
        onSuccess={() => loadData()}
        pipelineId={activePipeline.id}
        stages={activePipeline.stageList}
      />

      {selectedDeal && (
        <EditDealModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedDeal(null);
          }}
          onSuccess={() => loadData()}
          deal={selectedDeal}
          stages={activePipeline.stageList}
        />
      )}

      {/* ═══ Won Celebration Overlay ═══ */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
          >
            {/* Confetti particles */}
            {Array.from({ length: 40 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  opacity: 1,
                  x: 0, y: 0,
                  scale: Math.random() * 0.5 + 0.5
                }}
                animate={{
                  opacity: [1, 1, 0],
                  x: (Math.random() - 0.5) * 800,
                  y: (Math.random() - 0.5) * 800 - 200,
                  rotate: Math.random() * 720,
                }}
                transition={{ duration: 2.5 + Math.random(), ease: 'easeOut' }}
                className="absolute rounded-sm"
                style={{
                  width: Math.random() * 10 + 6,
                  height: Math.random() * 10 + 6,
                  backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'][i % 6],
                }}
              />
            ))}
            {/* Center badge */}
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: [0, 1.2, 1], rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'backOut' }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-mustard-500 p-8 flex flex-col items-center text-center pointer-events-auto max-w-sm"
            >
              <div className="w-20 h-20 bg-mustard-50 dark:bg-mustard-500/10 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-5xl text-mustard-500">emoji_events</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Negócio Fechado!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
                <span className="font-bold text-mustard-600 dark:text-mustard-400">{wonDealTitle}</span>
              </p>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Parabéns pela conquista 🎉</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Lost Reason Modal ═══ */}
      <AnimatePresence>
        {showLostModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md mx-4 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
                  <span className="material-symbols-outlined text-2xl">heart_broken</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Negócio Perdido</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Informe o motivo da perda para registro.</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Motivo da Perda</label>
                  <textarea
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    rows={4}
                    placeholder="Descreva o motivo pelo qual o negócio foi perdido..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all outline-none resize-none placeholder:text-slate-400"
                    autoFocus
                  />
                </div>
              </div>
              <div className="p-6 pt-0 flex justify-end gap-3">
                <button
                  onClick={handleCancelLost}
                  disabled={lostLoading}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-xs uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmLost}
                  disabled={lostLoading || !lostReason.trim()}
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {lostLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                  Confirmar Perda
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contract Form Modal */}
      {isContractModalOpen && pendingContractDeal && (
        <ContractFormModal
          isOpen={isContractModalOpen}
          onClose={() => {
            setIsContractModalOpen(false);
            setPendingContractDeal(null);
          }}
          onSuccess={() => {
            setIsContractModalOpen(false);
            if (pendingContractDeal) {
              setWonDealTitle(pendingContractDeal.title || 'Negócio');
              setShowCelebration(true);
              setTimeout(() => setShowCelebration(false), 4000);
            }
            setPendingContractDeal(null);
          }}
          dealId={pendingContractDeal.id}
          deal={pendingContractDeal}
        />
      )}
    </div>
  );
};

export default PipelineTab;
