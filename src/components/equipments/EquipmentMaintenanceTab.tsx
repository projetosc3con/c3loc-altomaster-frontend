import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { ServiceOrder } from '../../types';

interface EquipmentMaintenanceTabProps {
  equipmentId: string;
}

export const EquipmentMaintenanceTab: React.FC<EquipmentMaintenanceTabProps> = ({ equipmentId }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServiceOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await api.get(`/equipments/${equipmentId}/service-orders`);
        setOrders(data || []);
      } catch (err: any) {
        console.error('Erro ao buscar ordens de serviço do equipamento:', err);
        setError('Não foi possível carregar o histórico de manutenções.');
      } finally {
        setLoading(false);
      }
    };

    if (equipmentId) {
      fetchServiceOrders();
    }
  }, [equipmentId]);

  const stats = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter(o => o.status === 'Concluída').length;
    const pending = orders.filter(o => o.status === 'Aberta' || o.status === 'Em Andamento' || o.status === 'Aguardando Peças').length;
    const totalCost = orders.reduce((acc, o) => acc + Number(o.cost_company || 0), 0);

    return { total, completed, pending, totalCost };
  }, [orders]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Concluída':
        return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30';
      case 'Em Andamento':
        return 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900/30';
      case 'Aberta':
        return 'bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-900/30';
      case 'Aguardando Peças':
        return 'bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-900/30';
      case 'Cancelada':
        return 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 border-red-200 dark:border-red-900/30';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="w-8 h-8 border-4 border-mustard-500/20 border-t-mustard-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 text-xs font-medium mt-3">Carregando histórico de manutenções...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mensagem de Erro */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-2xl text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Seção Superior: KPIs de Manutenção */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">build</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total de Ordens</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {stats.total} {stats.total === 1 ? 'OS' : 'OSs'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Concluídas</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {stats.completed}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">pending_actions</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Em Aberto / Andamento</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {stats.pending}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">attach_money</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custo Total da Empresa</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {stats.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      </div>

      {/* Lista de Ordens de Serviço */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
            <span className="material-symbols-outlined text-3xl">handyman</span>
          </div>
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
            Nenhuma ordem de serviço vinculada a este equipamento
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
            Esta máquina não possui registros de manutenções preventivas ou corretivas até o momento.
          </p>
          <button
            type="button"
            onClick={() => navigate('/manutencao')}
            className="mt-6 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            Ir para Manutenção
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-medium">
            <span>{orders.length} ordem(ns) de serviço encontrada(s)</span>
            <span className="text-[11px] text-slate-400">Ordenado por data de execução</span>
          </div>

          {orders.map(os => {
            const executorName = (os as any).executor?.full_name || os.signer_tech_name || null;
            return (
              <div
                key={os.id}
                onClick={() => navigate(`/manutencao/editar/${os.id}`)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-mustard-500/50 hover:shadow-md transition-all space-y-4 cursor-pointer group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 rounded-xl text-xs font-mono font-bold">
                      OS #{String(os.os_number).padStart(5, '0')}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-medium">
                      {os.order_type}
                    </span>
                    {os.client_name && (
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                        {os.client_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(os.status)}`}>
                      {os.status}
                    </span>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-mustard-500 group-hover:translate-x-1 transition-all text-xl">
                      chevron_right
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data de Execução</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5 block">
                      {os.execution_date ? new Date(os.execution_date + (os.execution_date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR') : new Date(os.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Técnico Responsável</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5 block">
                      {executorName || '-'}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horímetro na OS</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5 block">
                      {os.hour_meter_before != null || os.hour_meter_after != null
                        ? `${os.hour_meter_before ?? '-'}h → ${os.hour_meter_after ?? '-'}h`
                        : '-'}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custo Empresa</span>
                    <span className="text-mustard-600 dark:text-mustard-400 font-bold mt-0.5 block">
                      {Number(os.cost_company || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>

                {(os.services_executed || os.diagnosis || os.description) && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    {os.diagnosis && (
                      <p>
                        <strong className="text-slate-700 dark:text-slate-200">Diagnóstico:</strong> {os.diagnosis}
                      </p>
                    )}
                    {os.services_executed && (
                      <p>
                        <strong className="text-slate-700 dark:text-slate-200">Serviços:</strong> {os.services_executed}
                      </p>
                    )}
                    {!os.diagnosis && !os.services_executed && os.description && (
                      <p>
                        <strong className="text-slate-700 dark:text-slate-200">Descrição:</strong> {os.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
