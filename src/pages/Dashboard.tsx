import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import ComercialDashboard from './dashboards/ComercialDashboard';
import { formatDate } from '../utils/date';

// ═══════════════════════════════════════
// Admin Dashboard Data Interface
// ═══════════════════════════════════════
interface AdminDashboardData {
  type: 'admin';
  kpis: {
    currentMonthTotal: number;
    prevMonthTotal: number;
    variation: number;
    pendingReconciliationCount: number;
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
  recentInvoices: {
    id: string;
    client_name: string;
    equipment_name: string;
    asset_number: string;
    due_date: string;
    total_value: number;
    billing_status: string;
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
  const { kpis, revenueByMonth, fleetStatus, recentInvoices } = data;

  const maxRevenue = useMemo(() => {
    return Math.max(...revenueByMonth.map(m => m.total), 1);
  }, [revenueByMonth]);

  const variationLabel = kpis.variation > 0
    ? `+${kpis.variation}% vs mês anterior`
    : kpis.variation < 0
      ? `${kpis.variation}% vs mês anterior`
      : 'Sem variação';

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
          title="Pendências"
          value={String(kpis.pendingReconciliationCount)}
          trend="Conciliações em aberto"
          icon="receipt_long"
          color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
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
          title="Manutenção"
          value={String(kpis.serviceOrderCount)}
          trend="Ordens de serviço"
          icon="build"
          color="bg-red-500/10 text-red-600 dark:text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex justify-between items-center mb-10">
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

        {/* Fleet Status */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm"
        >
          <h3 className="font-bold text-slate-900 dark:text-white mb-8 uppercase text-xs tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-mustard-500 text-lg">donut_large</span>
            Status da Frota
          </h3>
          <div className="flex flex-col items-center justify-center h-48 mb-8">
            <div className="relative w-36 h-36 rounded-full border-[14px] border-slate-50 dark:border-slate-800/50 flex items-center justify-center shadow-inner">
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tighter">{fleetStatus.total}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest mt-0.5">Total</p>
              </div>
              {/* Visual ring proportional to "Locado" */}
              {fleetStatus.total > 0 && (
                <motion.div
                  initial={{ rotate: 0, opacity: 0 }}
                  animate={{ rotate: (fleetStatus.locado / fleetStatus.total) * 360, opacity: 1 }}
                  transition={{ delay: 0.6, duration: 1.5, ease: "easeInOut" }}
                  className="absolute inset-[-14px] rounded-full border-[14px] border-mustard-500 border-t-transparent border-l-transparent shadow-lg shadow-mustard-500/10"
                />
              )}
            </div>
          </div>
          <div className="space-y-4">
            <StatusRow label={`Locado (${fleetStatus.locado})`} value={fleetStatus.total > 0 ? `${Math.round((fleetStatus.locado / fleetStatus.total) * 100)}%` : '0%'} color="bg-mustard-500" />
            <StatusRow label={`Disponível (${fleetStatus.disponivel})`} value={fleetStatus.total > 0 ? `${Math.round((fleetStatus.disponivel / fleetStatus.total) * 100)}%` : '0%'} color="bg-slate-400 dark:bg-slate-600" />
            <StatusRow label={`Manutenção (${fleetStatus.manutencao})`} value={fleetStatus.total > 0 ? `${Math.round((fleetStatus.manutencao / fleetStatus.total) * 100)}%` : '0%'} color="bg-amber-400" />
            <StatusRow label={`Inativo (${fleetStatus.inativo})`} value={fleetStatus.total > 0 ? `${Math.round((fleetStatus.inativo / fleetStatus.total) * 100)}%` : '0%'} color="bg-red-400" />
          </div>
        </motion.div>
      </div>

      {/* Recent Invoices */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-mustard-500 text-lg">receipt_long</span>
            Faturas Recentes
          </h3>
          <button
            onClick={() => navigate('/locacoes')}
            className="text-mustard-600 dark:text-mustard-400 text-xs font-bold uppercase tracking-widest hover:text-mustard-700 transition-colors"
          >
            Ver Relatório Completo
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-[0.2em] border-b border-slate-50 dark:border-slate-800/50">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Equipamento</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4 text-right">Valor Total</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/30">
              {recentInvoices.length > 0 ? (
                recentInvoices.map((invoice, index) => (
                  <motion.tr
                    key={invoice.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 + index * 0.05 }}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors text-sm"
                  >
                    <td className="px-6 py-5 font-bold text-slate-900 dark:text-slate-200">{invoice.client_name}</td>
                    <td className="px-6 py-5">
                      <div className="text-slate-700 dark:text-slate-300 font-medium">{invoice.equipment_name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">{invoice.asset_number}</div>
                    </td>
                    <td className="px-6 py-5 text-slate-600 dark:text-slate-400 font-medium">{formatDate(invoice.due_date)}</td>
                    <td className="px-6 py-5 text-right font-bold text-slate-900 dark:text-white">
                      {Number(invoice.total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${invoice.billing_status === 'Faturado' || invoice.billing_status === 'Emitida'
                          ? 'bg-mustard-50 dark:bg-mustard-500/10 text-mustard-700 dark:text-mustard-400'
                          : invoice.billing_status === 'Cancelada'
                            ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                            : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          }`}>
                          <span className="material-symbols-outlined text-[14px]">
                            {invoice.billing_status === 'Faturado' || invoice.billing_status === 'Emitida' ? 'check_circle' : invoice.billing_status === 'Cancelada' ? 'cancel' : 'schedule'}
                          </span>
                          {invoice.billing_status}
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest">Nenhuma fatura encontrada no período.</td>
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
const KpiCard = ({ title, value, trend, trendPositive, icon, color, index }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    whileHover={{ y: -5 }}
    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/20 transition-all cursor-default"
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
    </div>
  </motion.div>
);

const StatusRow = ({ label, value, color }: any) => (
  <div className="flex justify-between items-center">
    <div className="flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm`}></div>
      <span className="text-slate-600 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider">{label}</span>
    </div>
    <span className="font-bold text-slate-900 dark:text-white text-xs">{value}</span>
  </div>
);

export default Dashboard;
