import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { RentalInvoice } from '../../types';

interface EquipmentRentalsTabProps {
  equipmentId: string;
}

export const EquipmentRentalsTab: React.FC<EquipmentRentalsTabProps> = ({ equipmentId }) => {
  const navigate = useNavigate();
  const [rentals, setRentals] = useState<RentalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRentals = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await api.get(`/equipments/${equipmentId}/rentals`);
        const sorted = (data || []).sort((a: RentalInvoice, b: RentalInvoice) => {
          if (!a.return_date && !b.return_date) {
            return new Date(b.billing_period_start || b.created_at || 0).getTime() - new Date(a.billing_period_start || a.created_at || 0).getTime();
          }
          if (!a.return_date) return -1;
          if (!b.return_date) return 1;
          return new Date(b.return_date).getTime() - new Date(a.return_date).getTime();
        });
        setRentals(sorted);
      } catch (err: any) {
        console.error('Erro ao buscar histórico de locações:', err);
        setError('Não foi possível carregar o histórico de locações do equipamento.');
      } finally {
        setLoading(false);
      }
    };

    if (equipmentId) {
      fetchRentals();
    }
  }, [equipmentId]);

  const stats = useMemo(() => {
    if (!rentals || rentals.length === 0) {
      return { avgDays: 0, avgValue: 0, totalRentals: 0, totalRevenue: 0 };
    }

    // 1. Média de dias locada
    const durations = rentals
      .map(r => {
        if (!r.billing_period_start) return null;
        const startDate = new Date(r.billing_period_start.includes('T') ? r.billing_period_start : `${r.billing_period_start}T00:00:00`);
        const endDateStr = r.return_date || r.billing_period_end;
        if (!endDateStr) return null;
        const endDate = new Date(endDateStr.includes('T') ? endDateStr : `${endDateStr}T00:00:00`);
        const diffTime = endDate.getTime() - startDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 ? Math.max(1, diffDays) : null;
      })
      .filter((d): d is number => d !== null);

    const avgDays = durations.length > 0
      ? Math.round(durations.reduce((acc, d) => acc + d, 0) / durations.length)
      : 0;

    // 2. Faturamento e média de receita
    const nonCancelled = rentals.filter(r => r.billing_status !== 'Cancelada');
    const totalRevenue = nonCancelled.reduce((acc, r) => acc + Number(r.total_value || 0), 0);
    const avgValue = nonCancelled.length > 0 ? totalRevenue / nonCancelled.length : 0;

    return {
      avgDays,
      avgValue,
      totalRentals: rentals.length,
      totalRevenue,
    };
  }, [rentals]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="w-8 h-8 border-4 border-mustard-500/20 border-t-mustard-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 text-xs font-medium mt-3">Carregando histórico de locações...</p>
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

      {/* Seção Superior: KPIs de Médias e Faturamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">date_range</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Média de Dias</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {stats.avgDays > 0 ? `${stats.avgDays} dias` : '-'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">payments</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Média por Fatura</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {stats.avgValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">receipt_long</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total de Locações</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {stats.totalRentals} {stats.totalRentals === 1 ? 'locação' : 'locações'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">trending_up</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receita Gerada</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {stats.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      </div>

      {/* Lista de Contratos / Locações */}
      {rentals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
            <span className="material-symbols-outlined text-3xl">history_toggle_off</span>
          </div>
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
            Nenhuma locação associada a este equipamento
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
            Este equipamento ainda não possui registros de contratos ou faturas de locação vinculados.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-medium">
            <span>{rentals.length} registro(s) encontrado(s)</span>
            <span className="text-[11px] text-slate-400">Ordenado da mais recente para a mais antiga</span>
          </div>

          {rentals.map(rental => (
            <div
              key={rental.id}
              onClick={() => navigate(`/locacoes/editar/${rental.id}`)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-mustard-500/50 hover:shadow-md transition-all space-y-4 cursor-pointer group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-900 dark:text-white group-hover:text-mustard-600 dark:group-hover:text-mustard-400 transition-colors">
                      {rental.client_name}
                    </span>
                    {rental.invoice_number && (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs font-mono font-bold">
                        #{rental.invoice_number}
                      </span>
                    )}
                  </div>
                  {rental.work_site && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-[14px] text-mustard-500">location_on</span>
                      {rental.work_site}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    rental.billing_status === 'Faturado'
                      ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400'
                      : rental.billing_status === 'Cancelada'
                      ? 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400'
                      : 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400'
                  }`}>
                    {rental.billing_status}
                  </span>
                  <span className="font-black text-base text-mustard-600 dark:text-mustard-400">
                    {Number(rental.total_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-mustard-500 group-hover:translate-x-1 transition-all text-xl">
                    chevron_right
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período de Locação</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5 block">
                    {rental.billing_period_start ? new Date(rental.billing_period_start + (rental.billing_period_start.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR') : '-'}
                    {' — '}
                    {rental.billing_period_end ? new Date(rental.billing_period_end + (rental.billing_period_end.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR') : '-'}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data de Retorno</span>
                  {rental.return_date ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[14px]">event_available</span>
                      {new Date(rental.return_date + (rental.return_date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR')}
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      Em andamento
                    </span>
                  )}
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vencimento</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5 block">
                    {rental.due_date ? new Date(rental.due_date + (rental.due_date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR') : '-'}
                  </span>
                </div>
              </div>

              {rental.notes && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  {rental.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
