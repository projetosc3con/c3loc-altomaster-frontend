import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { logisticsService, type LogisticsContract } from '../services/logistics';

const COLUMNS = [
  {
    key: 'Assinado',
    title: 'Pendentes Processamento',
    icon: 'pending_actions',
    accentBg: 'bg-amber-50 dark:bg-amber-500/10',
    accentText: 'text-amber-600 dark:text-amber-400',
    accentBorder: 'border-amber-200 dark:border-amber-500/20',
    badgeBg: 'bg-amber-100 dark:bg-amber-500/20',
    badgeText: 'text-amber-700 dark:text-amber-300',
    dotColor: 'bg-amber-500',
  },
  {
    key: 'Triagem',
    title: 'Em Triagem',
    icon: 'fact_check',
    accentBg: 'bg-blue-50 dark:bg-blue-500/10',
    accentText: 'text-blue-600 dark:text-blue-400',
    accentBorder: 'border-blue-200 dark:border-blue-500/20',
    badgeBg: 'bg-blue-100 dark:bg-blue-500/20',
    badgeText: 'text-blue-700 dark:text-blue-300',
    dotColor: 'bg-blue-500',
  },
  {
    key: 'Processado',
    title: 'Processados',
    icon: 'check_circle',
    accentBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    accentBorder: 'border-emerald-200 dark:border-emerald-500/20',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-500/20',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
  },
];

const Logistics: React.FC = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<LogisticsContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const data = await logisticsService.getContracts();
      setContracts(data);
      console.log(data);
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTriage = async (contractId: string) => {
    try {
      setActionLoading(contractId);
      await logisticsService.startTriage(contractId);
      // Navigate to triage page
      navigate(`/logistica/triagem/${contractId}`);
    } catch (error: any) {
      console.error('Erro ao iniciar triagem:', error);
      const apiMsg = error.response?.data?.error || error.message;
      if (error.response?.status === 400 && String(apiMsg).includes('Triagem')) {
        navigate(`/logistica/triagem/${contractId}`);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinishProcessing = (contractId: string) => {
    navigate(`/logistica/triagem/${contractId}`);
  };

  const handleViewDetails = (contractId: string) => {
    navigate(`/logistica/triagem/${contractId}`);
  };

  const getClientName = (contract: LogisticsContract): string => {
    if (contract.contract_form?.locatario_company_name) {
      return contract.contract_form.locatario_company_name;
    }
    if (contract.deal?.client?.company_name) {
      return contract.deal.client.company_name;
    }
    if (contract.deal?.lead?.company_name) {
      return contract.deal.lead.company_name;
    }
    if (contract.snapshot?.locatario?.company_name) {
      return contract.snapshot.locatario.company_name;
    }
    return 'Cliente não informado';
  };

  const getEquipmentInfo = (contract: LogisticsContract): string => {
    if (contract.contract_form?.equipment_description) {
      return contract.contract_form.equipment_description;
    }
    if (contract.snapshot?.equipment?.description) {
      return contract.snapshot.equipment.description;
    }
    return 'Equipamento não informado';
  };

  const getContractValue = (contract: LogisticsContract): number => {
    if (contract.contract_form?.cost_total) {
      return contract.contract_form.cost_total;
    }
    if (contract.snapshot?.costs?.total) {
      return contract.snapshot.costs.total;
    }
    return contract.deal?.value || 0;
  };

  const getColumnContracts = (status: string) => {
    return contracts.filter(c => c.status === status);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mustard-500"></div>
      </div>
    );
  }

  const totalContracts = contracts.length;
  const pendingCount = getColumnContracts('Assinado').length;
  const triageCount = getColumnContracts('Triagem').length;
  const processedCount = getColumnContracts('Processado').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 bg-mustard-50 dark:bg-mustard-500/10 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-400 text-2xl">local_shipping</span>
            </div>
            Logística
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 ml-[60px]">Gerencie o processamento e triagem de contratos assinados.</p>
        </div>
        <button
          onClick={loadContracts}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:border-mustard-500 hover:text-mustard-600 dark:hover:text-mustard-400 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Atualizar
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Contratos', value: totalContracts.toString(), icon: 'description', accent: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
          { label: 'Pendentes', value: pendingCount.toString(), icon: 'pending_actions', accent: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
          { label: 'Em Triagem', value: triageCount.toString(), icon: 'fact_check', accent: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
          { label: 'Processados', value: processedCount.toString(), icon: 'check_circle', accent: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${stat.accent} rounded-xl flex items-center justify-center`}>
                <span className="material-symbols-outlined text-xl">{stat.icon}</span>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                <p className="text-xl font-black text-slate-900 dark:text-white leading-none">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {COLUMNS.map((column, colIndex) => {
          const columnContracts = getColumnContracts(column.key);

          return (
            <div
              key={column.key}
              className={`p-6 ${colIndex < COLUMNS.length - 1 ? 'lg:border-r lg:border-dashed lg:border-slate-200 lg:dark:border-slate-700' : ''}`}
            >
              {/* Column Header */}
              <div className={`rounded-2xl p-4 border ${column.accentBg} ${column.accentBorder} flex items-center justify-between mb-5`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${column.dotColor}`} />
                  <h3 className={`text-xs font-black uppercase tracking-widest ${column.accentText}`}>
                    {column.title}
                  </h3>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${column.badgeBg} ${column.badgeText}`}>
                  {columnContracts.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-4 min-h-[200px]">
                <AnimatePresence>
                  {columnContracts.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-12 text-center"
                    >
                      <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-2xl text-slate-300 dark:text-slate-600">inbox</span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Nenhum contrato</p>
                    </motion.div>
                  ) : (
                    columnContracts.map((contract, index) => (
                      <motion.div
                        key={contract.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-md transition-all group"
                      >
                        {/* Contract Number + Date */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-black text-mustard-600 dark:text-mustard-400 uppercase tracking-wider bg-mustard-50 dark:bg-mustard-500/10 px-2.5 py-1 rounded-lg">
                            #{contract.contract_number}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                            {new Date(contract.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>

                        {/* Client */}
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight mb-1 truncate">
                          {getClientName(contract)}
                        </h4>

                        {/* Equipment */}
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-3 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-slate-400">precision_manufacturing</span>
                          {getEquipmentInfo(contract)}
                        </p>

                        {/* Value */}
                        <div className="flex items-center justify-between mb-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                            {getContractValue(contract).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            v{contract.version}
                          </span>
                        </div>

                        {/* Action Button */}
                        {column.key === 'Assinado' && (
                          <button
                            onClick={() => handleStartTriage(contract.id)}
                            disabled={actionLoading === contract.id}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50"
                          >
                            {actionLoading === contract.id ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                                Iniciar Triagem
                              </>
                            )}
                          </button>
                        )}

                        {column.key === 'Triagem' && (
                          <button
                            onClick={() => handleFinishProcessing(contract.id)}
                            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                          >
                            <span className="material-symbols-outlined text-[16px]">task_alt</span>
                            Finalizar Processamento
                          </button>
                        )}

                        {column.key === 'Processado' && (
                          <button
                            onClick={() => handleViewDetails(contract.id)}
                            className="w-full py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            Detalhes
                          </button>
                        )}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default Logistics;
