import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { financeiroService } from '../services/financeiro';
import { getApiErrorMessage } from '../utils/apiError';
import { isPaidStatus } from '../utils/payment';
import { formatDate } from '../utils/date';
import { useTheme } from '../context/ThemeContext';
import logoLight from '../assets/logo-completo.png';
import logoDark from '../../config_files/logo-completo-dark.png';
import type { RentalInvoice, BillingStatus, ReconciliationStatus, AsaasChargeResult, Payment } from '../types';

const ITEMS_PER_PAGE = 15;
const BILLING_STATUSES: BillingStatus[] = ['Pendente', 'Faturado', 'Emitida', 'Cancelada'];
const RECONCILIATION_STATUSES: ReconciliationStatus[] = ['Pendente', 'Atrasado', 'Recebido', 'Divergente', 'No prazo'];

interface Filters {
  search: string;
  billing_status: BillingStatus | '';
  reconciliation_status: ReconciliationStatus | '';
  date_from: string;
  date_to: string;
  value_min: number;
  value_max: number;
}

const emptyFilters: Filters = {
  search: '', billing_status: '', reconciliation_status: '',
  date_from: '', date_to: '', value_min: 0, value_max: 0,
};

const buildParams = (page: number, f: Filters) => {
  const p: Record<string, string | number> = { page, limit: ITEMS_PER_PAGE };
  if (f.search) p.search = f.search;
  if (f.billing_status) p.billing_status = f.billing_status;
  if (f.reconciliation_status) p.reconciliation_status = f.reconciliation_status;
  if (f.date_from) p.date_from = f.date_from;
  if (f.date_to) p.date_to = f.date_to;
  if (f.value_min > 0) p.value_min = f.value_min;
  if (f.value_max > 0) p.value_max = f.value_max;
  return p;
};

const Rentals: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [rentals, setRentals] = useState<RentalInvoice[]>([]);
  const [selectedRental, setSelectedRental] = useState<RentalInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState({ pendingReconciliationCount: 0, monthlyReceivedTotal: 0 });
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const [charging, setCharging] = useState(false);
  const [chargeResult, setChargeResult] = useState<AsaasChargeResult | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [confirmChargeOpen, setConfirmChargeOpen] = useState(false);
  const [paidByInvoice, setPaidByInvoice] = useState<Record<string, Payment>>({});
  const [invoicePaid, setInvoicePaid] = useState(false);
  const debounceRef = useRef<any>(null);

  const fetchPaidPayments = useCallback(async () => {
    try {
      const [received, confirmed] = await Promise.all([
        financeiroService.listarExtrato({ status: 'RECEIVED' }),
        financeiroService.listarExtrato({ status: 'CONFIRMED' }),
      ]);
      const map: Record<string, Payment> = {};
      [...received, ...confirmed].forEach((p) => {
        const existing = map[p.invoice_id];
        if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
          map[p.invoice_id] = p;
        }
      });
      setPaidByInvoice(map);
    } catch (err) {
      console.error('Erro ao buscar status de pagamentos:', err);
    }
  }, []);

  useEffect(() => {
    fetchPaidPayments();
  }, [fetchPaidPayments]);

  useEffect(() => {
    if (location.state?.warning) {
      setFeedbackToast(`⚠️ ${location.state.warning}`);
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => setFeedbackToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  useEffect(() => {
    if (!selectedRental) {
      setInvoicePaid(false);
      return;
    }
    financeiroService.buscarPagamentosFatura(selectedRental.id)
      .then((payments) => setInvoicePaid(payments.some((p) => isPaidStatus(p.status))))
      .catch((err) => console.error('Erro ao buscar pagamentos da fatura:', err));
  }, [selectedRental]);

  const handleGerarCobranca = async () => {
    if (!selectedRental) return;
    setCharging(true);
    setFeedbackToast(null);
    try {
      const result = await financeiroService.gerarCobranca(selectedRental.id);
      setChargeResult(result);
      window.open(result.charge.invoiceUrl, '_blank');
      setFeedbackToast('✓ Cobrança gerada com sucesso!');
      setTimeout(() => setFeedbackToast(null), 5000);
      fetchRentals(currentPage, filters);
      fetchPaidPayments();
    } catch (err) {
      setFeedbackToast(`✗ ${getApiErrorMessage(err)}`);
      setTimeout(() => setFeedbackToast(null), 6000);
    } finally {
      setCharging(false);
      setConfirmChargeOpen(false);
    }
  };

  const activeFilterCount = [
    filters.billing_status, filters.reconciliation_status,
    filters.date_from, filters.date_to,
  ].filter(Boolean).length + (filters.value_min > 0 || filters.value_max > 0 ? 1 : 0);

  const fetchRentals = useCallback(async (page: number, f: Filters) => {
    try {
      setLoading(true);
      const { data: res } = await api.get('/rentals', { params: buildParams(page, f) });
      setRentals(res.data);
      setTotalItems(res.total);
      setTotalPages(res.totalPages);
      setStats(res.stats || { pendingReconciliationCount: 0, monthlyReceivedTotal: 0 });
      setCurrentPage(res.page);
      setError(null);
    } catch {
      setError('Não foi possível carregar a lista de locações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRentals(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = { ...filters, search: val };
      setFilters(next);
      fetchRentals(1, next);
    }, 400);
  };

  const applyFilters = () => {
    setShowFilters(false);
    fetchRentals(1, filters);
  };

  const clearAllFilters = () => {
    setSearchInput('');
    setFilters(emptyFilters);
    fetchRentals(1, emptyFilters);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    fetchRentals(page, filters);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = buildParams(1, filters);
      delete (params as any).page;
      delete (params as any).limit;
      const { data } = await api.get('/exports/rentals', { params });
      if (data.downloadUrl) window.open(data.downloadUrl, '_blank');
    } catch {
      alert('Erro ao exportar locações.');
    } finally {
      setExporting(false);
    }
  };

  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); return pages; }
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const rangeStart = totalItems > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const rangeEnd = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gestão de Locações</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Acompanhe contratos, faturamentos e períodos de locação.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/locacoes/novo')}
            className="flex items-center gap-2 bg-mustard-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-mustard-500/20 hover:bg-mustard-600 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Nova Fatura de Locação
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total de Locações', value: totalItems.toString(), color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400', icon: 'sync' },
          { label: 'Aguardando conciliação', value: stats.pendingReconciliationCount.toString(), color: 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400', icon: 'pending_actions' },
          { label: 'Total Faturado Mês', value: stats.monthlyReceivedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400', icon: 'payments' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.1 }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.color}`}>
              <span className="material-symbols-outlined">{stat.icon}</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">{stat.label}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar: Search + Filters + Export */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[20px]">search</span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-mustard-500 focus:ring-1 focus:ring-mustard-500 text-sm bg-white dark:bg-slate-800 dark:text-white transition-all"
              placeholder="Buscar por cliente, equipamento ou contrato..."
            />
            {searchInput && (
              <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(true)}
              className="relative px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              Filtros
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-mustard-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[18px]">download</span>
              )}
              {exporting ? 'Exportando...' : 'Exportar'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 text-[11px] uppercase font-bold tracking-widest border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
                <th className="px-6 py-4">Cliente / Obra</th>
                <th className="px-6 py-4">Equipamento</th>
                <th className="px-6 py-4 whitespace-nowrap">Período</th>
                <th className="px-6 py-4 text-right">Valor Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.tr key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-4 border-mustard-500/20 border-t-mustard-500 rounded-full animate-spin" />
                        <p className="text-slate-400 text-sm font-medium mt-4">Carregando novidade...</p>
                      </div>
                    </td>
                  </motion.tr>
                ) : error ? (
                  <motion.tr key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <td colSpan={6} className="px-6 py-12 text-center text-red-500 font-medium">{error}</td>
                  </motion.tr>
                ) : rentals.length === 0 ? (
                  <motion.tr key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">Nenhuma locação encontrada.</td>
                  </motion.tr>
                ) : (
                  rentals.map((rental, index) => (
                    <motion.tr key={rental.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 + index * 0.03 }} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors text-sm">
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">{rental.client_name}</div>
                        {rental.invoice_number && <span className="px-2 py-0.5 mb-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[10px] font-mono border border-slate-200 dark:border-slate-700 shrink-0">{rental.invoice_number}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-700 dark:text-slate-300">{rental.equipment_name}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{rental.asset_number}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap min-w-[180px]">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">date_range</span>
                          {formatDate(rental.billing_period_start)} - {formatDate(rental.billing_period_end)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-mustard-500 dark:text-mustard-400">
                        {Number(rental.total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-6 py-4">
                        {paidByInvoice[rental.id] ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            <span className="material-symbols-outlined text-[14px]">paid</span>
                            Pago
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${rental.billing_status === 'Faturado'
                            ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                            : rental.billing_status === 'Cancelada'
                              ? 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                              : 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                            }`}>
                            <span className="material-symbols-outlined text-[14px]">
                              {rental.billing_status === 'Faturado' ? 'check_circle' : rental.billing_status === 'Cancelada' ? 'cancel' : 'schedule'}
                            </span>
                            {rental.billing_status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { setChargeResult(null); setSelectedRental(rental); }}
                            className="p-1.5 text-slate-400 hover:text-mustard-500 hover:bg-mustard-50 dark:hover:bg-mustard-500/10 rounded-md transition-all"
                            title="Visualizar Fatura"
                          >
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                          <button
                            onClick={() => navigate(`/locacoes/editar/${rental.id}`)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md transition-all"
                            title="Editar Locação"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-800/20 flex justify-between items-center text-xs text-slate-500 dark:text-slate-500 font-medium">
          <span>{totalItems > 0 ? `Mostrando ${rangeStart}–${rangeEnd} de ${totalItems} locações` : 'Nenhuma locação'}</span>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className={`px-2 py-1 rounded border transition-colors ${currentPage === 1 ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300'}`}>Anterior</button>
              {getPageNumbers().map((pg, idx) =>
                pg === '...' ? (
                  <span key={`e-${idx}`} className="px-2 py-1 text-slate-400 select-none">…</span>
                ) : (
                  <button key={pg} onClick={() => handlePageChange(pg)} className={`px-2 py-1 rounded border transition-colors ${pg === currentPage ? 'border-mustard-500 bg-mustard-500 text-white font-bold' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}>{pg}</button>
                )
              )}
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className={`px-2 py-1 rounded border transition-colors ${currentPage === totalPages ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300'}`}>Próximo</button>
            </div>
          )}
        </div>
      </div>

      {/* Offcanvas Filtros Avançados */}
      <AnimatePresence>
        {showFilters && (
          <div className="fixed inset-0 z-50">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFilters(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Filtros Avançados</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Refine a busca de locações</p>
                </div>
                <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status de Faturamento</label>
                  <div className="grid grid-cols-2 gap-2">
                    {BILLING_STATUSES.map(s => (
                      <button key={s} onClick={() => setFilters(f => ({ ...f, billing_status: f.billing_status === s ? '' : s }))}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all ${filters.billing_status === s ? 'bg-mustard-500 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status de Conciliação */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status de Conciliação</label>
                  <div className="grid grid-cols-2 gap-2">
                    {RECONCILIATION_STATUSES.map(s => (
                      <button key={s} onClick={() => setFilters(f => ({ ...f, reconciliation_status: f.reconciliation_status === s ? '' : s }))}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all ${filters.reconciliation_status === s ? 'bg-mustard-500 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Período de Locação */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Período de Locação</label>
                  <div className="flex items-center gap-3">
                    <input type="date" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                      className="min-w-0 w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all" />
                    <span className="text-slate-300 dark:text-slate-600 font-bold shrink-0">—</span>
                    <input type="date" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                      className="min-w-0 w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all" />
                  </div>
                </div>

                {/* Faixa de Valor */}
                <div className="space-y-4">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Faixa de Valor (R$)</label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">R$</span>
                      <input type="number" min={0} step={100} value={filters.value_min || ''} onChange={e => setFilters(f => ({ ...f, value_min: parseFloat(e.target.value) || 0 }))} placeholder="Mín"
                        className="w-full pl-9 pr-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all" />
                    </div>
                    <span className="text-slate-300 dark:text-slate-600 font-bold shrink-0">—</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">R$</span>
                      <input type="number" min={0} step={100} value={filters.value_max || ''} onChange={e => setFilters(f => ({ ...f, value_max: parseFloat(e.target.value) || 0 }))} placeholder="Máx"
                        className="w-full pl-9 pr-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all" />
                    </div>
                  </div>
                </div>

                {/* Resumo */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-mustard-500 text-lg">info</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Filtros Ativos</span>
                  </div>
                  <p className="text-2xl font-black text-mustard-500">{activeFilterCount}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">filtro(s) selecionado(s)</p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button onClick={clearAllFilters} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                  Limpar Tudo
                </button>
                <button onClick={applyFilters} className="flex-[2] py-3 bg-mustard-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-mustard-600 transition-all shadow-lg shadow-mustard-500/20">
                  Aplicar Filtros
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast de Cobrança */}
      <AnimatePresence>
        {feedbackToast && (
          <motion.div
            key="charge-toast"
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold max-w-md ${feedbackToast.startsWith('✓')
              ? 'bg-emerald-900 text-white'
              : 'bg-red-600 text-white'
              }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {feedbackToast.startsWith('✓') ? 'check_circle' : 'error'}
            </span>
            {feedbackToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Visualização da Fatura */}
      <AnimatePresence>
        {selectedRental && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedRental(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
            >
              {/* Header Visualização */}
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="h-16 flex items-center justify-center overflow-hidden">
                    <img src={theme === 'dark' ? logoDark : logoLight} alt="Logo" className="h-full w-auto object-contain" />
                  </div>
                </div>
                <div className="text-right">
                  <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Fatura de Locação</h1>
                  <div className="mt-2 flex flex-col gap-1 text-slate-500 dark:text-slate-400 font-mono text-xs">
                    <span>Nº {selectedRental.invoice_number || 'S/N'}</span>
                    <span>Emissão: {formatDate(selectedRental.created_at)}</span>
                    <span>Vencimento: {formatDate(selectedRental.due_date)}</span>
                  </div>
                </div>
              </div>

              {/* Corpo Visualização */}
              <div className="flex-1 overflow-y-auto p-10 space-y-12">
                <div className="grid grid-cols-2 gap-12">
                  {/* Prestador */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Dados do Prestador</h3>
                    <div className="text-sm space-y-1 text-slate-600 dark:text-slate-400 font-medium">
                      <p className="text-slate-900 dark:text-white font-black">Guindaste Marthe LTDA</p>
                      <p>AC DEPUTADO GENESIO TURECK - ACESSO OESTE, 1169 -  COLONIAL -  SÃO BENTO DO SUL/SC - CEP 89288-215</p>
                      <div className="pt-2 text-xs flex gap-4 opacity-70">
                        <span>CNPJ: 95.856.936/0001-25</span>
                        <span>I.E.: 255.389.361</span>
                      </div>
                    </div>
                  </div>

                  {/* Cliente */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Dados do Cliente</h3>
                    <div className="text-sm space-y-1 text-slate-600 dark:text-slate-400 font-medium">
                      <p className="text-slate-900 dark:text-white font-black">{selectedRental.client_name}</p>
                      <p>{selectedRental.work_site || 'Obra não informada'}</p>
                      <div className="pt-2 text-xs flex gap-4 opacity-70">
                        <span>CNPJ: {selectedRental.cnpj || 'Não informado'}</span>
                        <span>I.E.: Isento</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Itens / Detalhamento */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Detalhamento da Fatura</h3>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1">
                        <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Equipamento</span>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedRental.equipment_name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{selectedRental.asset_number} — {selectedRental.equipment_type}</p>
                      </div>
                      <div className="text-center">
                        <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Período</span>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatDate(selectedRental.billing_period_start)} a {formatDate(selectedRental.billing_period_end)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Valor Total</span>
                        <p className="text-xl font-black text-mustard-500 dark:text-mustard-400">
                          {Number(selectedRental.total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observações */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">notes</span>
                    Observações
                  </h3>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-l-4 border-mustard-500 italic font-medium">
                    {selectedRental.notes || 'Nenhuma observação adicional cadastrada para esta fatura.'}
                  </div>
                </div>
              </div>

              {/* Footer Visualização */}
              <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
                <div className="flex gap-3">
                  <button onClick={() => setSelectedRental(null)} className="px-6 py-3 text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-all">Fechar</button>
                  {selectedRental.billing_method !== 'MANUAL' && (
                    invoicePaid ? (
                      <span className="flex items-center gap-2 px-6 py-3 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl font-bold text-xs uppercase tracking-widest border border-emerald-200 dark:border-emerald-500/20">
                        <span className="material-symbols-outlined text-[20px]">check_circle</span>
                        Pagamento Confirmado
                      </span>
                    ) : chargeResult ? (
                      <a
                        href={chargeResult.charge.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all"
                      >
                        <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                        Ver Boleto
                      </a>
                    ) : (
                      <button
                        onClick={() => setConfirmChargeOpen(true)}
                        disabled={charging}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                      >
                        {charging ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[20px]">payments</span>
                            {selectedRental.billing_status === 'Faturado' ? 'Gerar Segunda Via' : 'Gerar Cobrança'}
                          </>
                        )}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => {
                      const id = selectedRental.id;
                      setSelectedRental(null);
                      navigate(`/locacoes/editar/${id}`);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-mustard-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-mustard-600 shadow-lg shadow-mustard-500/20 transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                    Editar Fatura
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação — Gerar Cobrança */}
      <AnimatePresence>
        {confirmChargeOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !charging && setConfirmChargeOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-center"
            >
              <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
                <span className="material-symbols-outlined text-3xl">warning</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Atenção</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
                Esta ação irá gerar uma nova cobrança (boleto) para esta fatura. Se já existir uma cobrança em aberto, isso pode gerar duplicidade. Deseja continuar?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={charging}
                  onClick={() => setConfirmChargeOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={charging}
                  onClick={handleGerarCobranca}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {charging ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Confirmar'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Rentals;
