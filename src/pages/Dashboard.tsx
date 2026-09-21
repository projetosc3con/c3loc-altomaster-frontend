import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import ComercialDashboard from './dashboards/ComercialDashboard';
import { formatDate } from '../utils/date';

// ═══════════════════════════════════════
// Admin Dashboard Data Interface
// ═══════════════════════════════════════
// Admin Dashboard Data Interface
// ═══════════════════════════════════════
interface AdminDashboardData {
  type: 'admin';
  kpis: {
    currentMonthTotal: number;
    prevMonthTotal: number;
    variation: number;
    overdueBillsCount?: number;
    pendingReconciliationCount?: number;
    rentedEquipmentCount: number;
    serviceOrderCount: number;
  };
  revenueByMonth: { month: string; label: string; total: number }[];
  fleetStatus: {
    disponivel: number;
    locado: number;
    manutencao: number;
    inativo: number;
    total: number;
  };
  upcomingPayables: {
    id: string;
    counterparty_name: string;
    description: string;
    due_date: string;
    gross_value: number;
    net_value: number;
    status: string;
    origin: string;
    diff_days: number;
    invoice_number?: string | null;
  }[];
  endingRentals?: {
    id: string;
    client_name: string;
    equipment_name: string;
    asset_number?: string | null;
    billing_period_start?: string | null;
    billing_period_end: string;
    total_value: number;
    billing_status: string;
    invoice_number?: string | null;
    work_site?: string | null;
    diff_days: number;
  }[];
}

interface ComercialDashboardData {
  type: 'comercial';
  tasks: any[];
  closedDeals: {
    totalValue: number;
    totalCount: number;
    userValue: number;
    userCount: number;
    userPercentage: number;
  };
  leadSources: { name: string; count: number }[];
  activities: any[];
}

type DashboardData = AdminDashboardData | ComercialDashboardData;

// ═══════════════════════════════════════
// Main Dashboard (Router)
// ═══════════════════════════════════════
const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard');
        setData(res.data);
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-4">
        <div className="w-12 h-12 border-4 border-mustard-500/10 border-t-mustard-500 rounded-full animate-spin" />
        <p className="font-bold text-xs uppercase tracking-widest">Carregando dados...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        <p className="font-bold text-sm">Não foi possível carregar os dados do dashboard.</p>
      </div>
    );
  }

  // Roteamento por tipo de dashboard
  if (data.type === 'comercial') {
    return <ComercialDashboard data={data as ComercialDashboardData} />;
  }

  // Dashboard Admin / Diretoria / Gerente (padrão)
  return <AdminDashboard data={data as AdminDashboardData} />;
};

// ═══════════════════════════════════════
// Admin Dashboard Component
// ═══════════════════════════════════════
const AdminDashboard: React.FC<{ data: AdminDashboardData }> = ({ data }) => {
  const navigate = useNavigate();
  const { kpis, revenueByMonth, fleetStatus, upcomingPayables = [], endingRentals = [] } = data;

  const maxRevenue = useMemo(() => {
    return Math.max(...revenueByMonth.map(m => m.total), 1);
  }, [revenueByMonth]);

  const variationLabel = kpis.variation > 0
    ? `+${kpis.variation}% vs mês anterior`
    : kpis.variation < 0
      ? `${kpis.variation}% vs mês anterior`
      : 'Sem variação';

  const getDueBadge = (diffDays: number) => {
    if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
          <span className="material-symbols-outlined text-[12px]">today</span>
          Hoje
        </span>
      );
    }
    if (diffDays < 0) {
      const d = Math.abs(diffDays);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20">
          <span className="material-symbols-outlined text-[12px]">history</span>
          {d === 1 ? 'Ontem' : `${d}d atrás`}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        <span className="material-symbols-outlined text-[12px]">schedule</span>
        {diffDays === 1 ? 'Amanhã' : `Em ${diffDays}d`}
      </span>
    );
  };

  const getRentalDueBadge = (diffDays: number) => {
    if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
          <span className="material-symbols-outlined text-[12px]">warning</span>
          Termina hoje
        </span>
      );
    }
    if (diffDays < 0) {
      const d = Math.abs(diffDays);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20">
          <span className="material-symbols-outlined text-[12px]">event_busy</span>
          {d === 1 ? 'Venceu ontem' : `Vencido há ${d}d`}
        </span>
      );
    }
    if (diffDays === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
          <span className="material-symbols-outlined text-[12px]">schedule</span>
          Termina amanhã
        </span>
      );
    }
    if (diffDays <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
          <span className="material-symbols-outlined text-[12px]">schedule</span>
          Em {diffDays}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        <span className="material-symbols-outlined text-[12px]">calendar_today</span>
        Em {diffDays}d
      </span>
    );
  };

  const getBillingStatusBadge = (status: string) => {
    switch (status) {
      case 'Faturado':
      case 'Emitida':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <span className="material-symbols-outlined text-[12px]">check_circle</span>
            {status}
          </span>
        );
      case 'Cancelada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20">
            <span className="material-symbols-outlined text-[12px]">cancel</span>
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
            <span className="material-symbols-outlined text-[12px]">hourglass_empty</span>
            {status || 'Pendente'}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pago':
      case 'Recebido':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <span className="material-symbols-outlined text-[12px]">check_circle</span>
            {status}
          </span>
        );
      case 'Atrasado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20">
            <span className="material-symbols-outlined text-[12px]">error</span>
            {status}
          </span>
        );
      case 'No prazo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
            <span className="material-symbols-outlined text-[12px]">schedule</span>
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
            <span className="material-symbols-outlined text-[12px]">hourglass_empty</span>
            {status || 'Pendente'}
          </span>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 pb-12"
    >
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          index={0}
          title="Saldo Mensal"
          value={kpis.currentMonthTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          trend={variationLabel}
          trendPositive={kpis.variation >= 0}
          icon="payments"
          color="bg-mustard-500/10 text-mustard-600 dark:text-mustard-400"
        />
        <KpiCard
          index={1}
          title="Contas Vencidas"
          value={String(kpis.overdueBillsCount ?? kpis.pendingReconciliationCount ?? 0)}
          trend="Status Atrasado"
          icon="event_busy"
          color="bg-red-500/10 text-red-600 dark:text-red-400"
        />
        <KpiCard
          index={2}
          title="Locações Ativas"
          value={String(kpis.rentedEquipmentCount)}
          trend="Equipamentos locados"
          icon="agriculture"
          color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          index={3}
          title="Status da Frota"
          value={String(fleetStatus.total)}
          trend={`${fleetStatus.total > 0 ? Math.round((fleetStatus.locado / fleetStatus.total) * 100) : 0}% em uso`}
          trendPositive={fleetStatus.locado > 0 ? true : undefined}
          subtitle={`${fleetStatus.locado} locados • ${fleetStatus.disponivel} disp.`}
          icon="donut_large"
          color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-mustard-500"></span>
              Saldo Financeiro (6 meses)
            </h3>
          </div>
          <div className="h-64 flex items-end justify-between gap-3 border-b border-slate-100 dark:border-slate-800/50 pb-2 relative">
            {revenueByMonth.map((month, i) => {
              const heightPct = maxRevenue > 0 ? (month.total / maxRevenue) * 100 : 0;
              return (
                <div key={month.month} className="w-full h-full flex flex-col justify-end items-center gap-1 group relative">
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 absolute -top-10 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap z-10 shadow-xl border border-white/10 pointer-events-none">
                    {month.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45 border-r border-b border-white/10"></div>
                  </div>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(heightPct, 4)}%` }}
                    transition={{ delay: 0.5 + i * 0.05, duration: 0.8, ease: "circOut" }}
                    whileHover={{ backgroundColor: '#f59e0b' }}
                    className="w-full bg-mustard-500/20 dark:bg-mustard-500/10 rounded-t-lg cursor-pointer transition-colors"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-4 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest px-1">
            {revenueByMonth.map(m => <span key={m.month}>{m.label}</span>)}
          </div>
        </motion.div>

        {/* Contas a Pagar - Vencimentos Próximos */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between"
        >
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-widest flex items-center gap-2 truncate">
              <span className="material-symbols-outlined text-mustard-500 text-lg flex-shrink-0">payments</span>
              <span className="truncate">Contas Vencendo</span>
            </h3>
            <button
              onClick={() => navigate('/financeiro?tab=contas-pagar')}
              className="text-mustard-600 dark:text-mustard-400 text-xs font-bold uppercase tracking-widest hover:text-mustard-700 transition-colors whitespace-nowrap flex-shrink-0"
            >
              Ver Todas
            </button>
          </div>
          <div className="overflow-x-auto flex-1 max-h-[320px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] border-b border-slate-50 dark:border-slate-800/50">
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/30">
                {upcomingPayables.length > 0 ? (
                  upcomingPayables.map((payable, index) => (
                    <motion.tr
                      key={payable.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 + index * 0.03 }}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors text-xs"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-slate-200 truncate max-w-[180px] sm:max-w-[220px]" title={payable.description}>
                          {payable.description || payable.counterparty_name || '—'}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[180px] sm:max-w-[220px] mt-0.5 flex items-center gap-1.5" title={payable.counterparty_name}>
                          <span className="font-semibold text-slate-600 dark:text-slate-400">{payable.counterparty_name || '—'}</span>
                          {payable.invoice_number && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">•</span>
                              <span className="uppercase text-[10px] font-bold text-slate-400 dark:text-slate-500">NF: {payable.invoice_number}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-slate-600 dark:text-slate-400 font-medium text-xs">
                            {formatDate(payable.due_date)}
                          </span>
                          {getDueBadge(payable.diff_days)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {Number(payable.gross_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-center">
                          {getStatusBadge(payable.status)}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest">
                      Nenhuma conta a pagar encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Locações Terminando (Ending Rentals Table - Full Row) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-mustard-500/10 flex items-center justify-center text-mustard-600 dark:text-mustard-400 shrink-0">
              <span className="material-symbols-outlined text-xl">event_upcoming</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-widest">
                  Locações Terminando
                </h3>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/locacoes')}
            className="inline-flex items-center gap-1.5 text-mustard-600 dark:text-mustard-400 text-xs font-bold uppercase tracking-widest hover:text-mustard-700 dark:hover:text-mustard-300 transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <span>Ver Todas as Locações</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20">
                <th className="px-6 py-3.5">Cliente / Obra</th>
                <th className="px-6 py-3.5">Equipamento</th>
                <th className="px-6 py-3.5">Período de Vigência</th>
                <th className="px-6 py-3.5">Prazo / Término</th>
                <th className="px-6 py-3.5 text-right">Valor Total</th>
                <th className="px-6 py-3.5 text-center">Faturamento</th>
                <th className="px-6 py-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
              {endingRentals.length > 0 ? (
                endingRentals.map((rental, index) => (
                  <motion.tr
                    key={rental.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + index * 0.03 }}
                    onClick={() => navigate(`/locacoes/editar/${rental.id}`)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors text-xs cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-200 group-hover:text-mustard-600 dark:group-hover:text-mustard-400 transition-colors truncate max-w-[200px] sm:max-w-[260px]" title={rental.client_name}>
                          {rental.client_name}
                        </span>
                        {rental.invoice_number && (
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[10px] font-mono border border-slate-200 dark:border-slate-700 shrink-0">
                            {rental.invoice_number}
                          </span>
                        )}
                      </div>
                      {rental.work_site && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[240px] mt-0.5" title={rental.work_site}>
                          {rental.work_site}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[180px] sm:max-w-[220px]" title={rental.equipment_name}>
                        {rental.equipment_name}
                      </div>
                      {rental.asset_number && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                          <span className="font-medium text-slate-400">Patrimônio:</span>
                          <span className="font-bold text-slate-600 dark:text-slate-400">{rental.asset_number}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                        <span className="material-symbols-outlined text-[15px] text-slate-400 dark:text-slate-500">date_range</span>
                        <span>{formatDate(rental.billing_period_start)}</span>
                        <span className="text-slate-300 dark:text-slate-600">→</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(rental.billing_period_end)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRentalDueBadge(rental.diff_days)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap font-mono">
                      {rental.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        {getBillingStatusBadge(rental.billing_status)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/locacoes/editar/${rental.id}`)}
                        className="p-1.5 text-slate-400 hover:text-mustard-600 dark:hover:text-mustard-400 hover:bg-mustard-50 dark:hover:bg-mustard-500/10 rounded-lg transition-all"
                        title="Ver / Editar Locação"
                        aria-label="Ver / Editar Locação"
                      >
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                      </button>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest">
                    Nenhuma locação ativa com término próximo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ═══════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════
const KpiCard = ({ title, value, trend, trendPositive, icon, color, index, subtitle }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    whileHover={{ y: -5 }}
    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/20 transition-all cursor-default flex flex-col justify-between"
  >
    <div className="flex justify-between items-start mb-6">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <div className={`text-[10px] font-bold px-2 py-1 rounded-lg ${trendPositive === true ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : trendPositive === false ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
        {trendPositive === true ? '+' : ''}{trend}
      </div>
    </div>
    <div>
      <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{title}</h3>
      <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</div>
      {subtitle && (
        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
          {subtitle}
        </div>
      )}
    </div>
  </motion.div>
);

export default Dashboard;
