import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../../services/api';
import { financeiroService } from '../../../services/financeiro';
import { getApiErrorMessage } from '../../../utils/apiError';
import SearchableSelect from '../../../components/SearchableSelect';
import LancamentoManualModal from '../../../components/financeiro/LancamentoManualModal';
import BillDetailsModal from '../../../components/financeiro/BillDetailsModal';
import { formatDate } from '../../../utils/date';
import type { Client, StatementItem, BillStatus } from '../../../types';

const STATUS_OPTIONS: BillStatus[] = ['Pendente', 'Atrasado', 'Recebido', 'Divergente', 'No prazo'];
const ITEMS_PER_PAGE = 20;

const STORAGE_KEY = 'c3loc_contas_receber_filters';
const PAGE_STORAGE_KEY = 'c3loc_contas_receber_page';

export type ContasReceberSortField = 'is_reconciled' | 'due_date' | 'client_name' | 'origin' | 'gross_value' | 'net_value' | 'status';
export type SortOrder = 'asc' | 'desc';

interface ContasReceberFiltersStorage {
  selectedClientId: string;
  invoiceNumber: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  groupNfe: boolean;
  sortBy: ContasReceberSortField;
  sortOrder: SortOrder;
}

const defaultReceberFilters: ContasReceberFiltersStorage = {
  selectedClientId: '',
  invoiceNumber: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  groupNfe: true,
  sortBy: 'due_date',
  sortOrder: 'desc',
};

const getInitialStoredFilters = (): ContasReceberFiltersStorage => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultReceberFilters,
        ...parsed,
      };
    }
  } catch (e) {
    console.warn('Erro ao carregar filtros de contas a receber do localStorage:', e);
  }
  return defaultReceberFilters;
};

const getInitialPage = (): number => {
  try {
    const saved = localStorage.getItem(PAGE_STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao carregar página de contas a receber do localStorage:', e);
  }
  return 1;
};

const isSettled = (item: StatementItem) =>
  item.source === 'payment'
    ? item.status === 'RECEIVED'
    : item.status === 'Recebido' || item.status === 'No prazo';

const isAwaitingCompensation = (item: StatementItem) =>
  item.source === 'payment' && item.status === 'CONFIRMED';

const isOverdueOrCancelled = (item: StatementItem) =>
  item.source === 'payment'
    ? item.status === 'OVERDUE' || item.status === 'CANCELLED'
    : item.status === 'Atrasado' || item.status === 'Divergente';

const AWAITING_COMPENSATION_CLASSES = 'bg-sky-100 dark:bg-sky-500/10 text-sky-800 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20';

const statusBadgeClass = (item: StatementItem) => {
  if (isSettled(item)) return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20';
  if (isAwaitingCompensation(item)) return AWAITING_COMPENSATION_CLASSES;
  if (isOverdueOrCancelled(item)) return 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-500/20';
  return 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20';
};

const statusIcon = (item: StatementItem) => {
  if (isSettled(item)) return 'check_circle';
  if (isAwaitingCompensation(item)) return 'hourglass_top';
  if (isOverdueOrCancelled(item)) return 'cancel';
  return 'schedule';
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  OVERDUE: 'Atrasado',
  CONFIRMED: 'Aguardando compensação',
  RECEIVED: 'Recebido',
  CANCELLED: 'Cancelado',
};

const statusLabel = (item: StatementItem) =>
  item.source === 'payment' ? (PAYMENT_STATUS_LABELS[item.status] ?? item.status) : item.status;

const sourceBadge = (item: StatementItem) => {
  if (item.source === 'payment') {
    return isAwaitingCompensation(item)
      ? { label: 'Aguardando compensação', className: AWAITING_COMPENSATION_CLASSES }
      : { label: 'Aguardando pagamento', className: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' };
  }
  if (item.origin === 'NFE') {
    return { label: 'NF-E', className: 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20' };
  }
  return item.origin === 'ASAAS'
    ? { label: 'ASAAS', className: 'bg-mustard-100 dark:bg-mustard-500/10 text-mustard-700 dark:text-mustard-400 border border-mustard-200 dark:border-mustard-500/20' }
    : { label: 'MANUAL', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700' };
};

const ContasReceberTab: React.FC = () => {
  const [initialFilters] = useState(getInitialStoredFilters);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(initialFilters.selectedClientId);
  const [invoiceNumber, setInvoiceNumber] = useState(initialFilters.invoiceNumber);
  const [status, setStatus] = useState(initialFilters.status);
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom);
  const [dateTo, setDateTo] = useState(initialFilters.dateTo);
  const [groupNfe, setGroupNfe] = useState<boolean>(initialFilters.groupNfe);
  const [sortBy, setSortBy] = useState<ContasReceberSortField>(initialFilters.sortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialFilters.sortOrder);

  const [items, setItems] = useState<StatementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(getInitialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<StatementItem | null>(null);

  const isMountedRef = useRef(false);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data } = await api.get('/clients');
        setClients(data);
      } catch (err) {
        console.error('Erro ao buscar clientes:', err);
      }
    };
    fetchClients();
  }, []);

  const fetchContasReceber = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await financeiroService.listarExtratoBancario({
        type: 'receivable',
        client_id: selectedClientId || undefined,
        invoice_number: invoiceNumber || undefined,
        status: status || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        group_nfe: groupNfe,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      const itemsList = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setItems(itemsList);
      setTotalItems(data?.total ?? itemsList.length);
      setTotalPages(data?.totalPages ?? 1);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, invoiceNumber, status, dateFrom, dateTo, groupNfe, currentPage, sortBy, sortOrder]);

  useEffect(() => {
    fetchContasReceber();
  }, [fetchContasReceber]);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    setCurrentPage(1);
  }, [selectedClientId, invoiceNumber, status, dateFrom, dateTo, groupNfe]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          selectedClientId,
          invoiceNumber,
          status,
          dateFrom,
          dateTo,
          groupNfe,
          sortBy,
          sortOrder,
        })
      );
      localStorage.setItem(PAGE_STORAGE_KEY, String(currentPage));
    } catch (e) {
      console.warn('Erro ao salvar filtros de contas a receber no localStorage:', e);
    }
  }, [selectedClientId, invoiceNumber, status, dateFrom, dateTo, groupNfe, sortBy, sortOrder, currentPage]);

  const handleClearFilters = () => {
    setSelectedClientId('');
    setInvoiceNumber('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setGroupNfe(true);
    setSortBy('due_date');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const handleSort = (field: ContasReceberSortField) => {
    let newOrder: SortOrder = 'desc';
    if (sortBy === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      newOrder = (field === 'gross_value' || field === 'net_value' || field === 'due_date') ? 'desc' : 'asc';
    }

    setSortBy(field);
    setSortOrder(newOrder);
    setCurrentPage(1);
  };

  const renderSortHeader = (
    label: string,
    field: ContasReceberSortField,
    align: 'left' | 'right' | 'center' = 'left',
    extraClass: string = ''
  ) => {
    const isSorted = sortBy === field;
    const isAsc = sortOrder === 'asc';

    return (
      <th
        onClick={() => handleSort(field)}
        className={`px-6 py-3 cursor-pointer select-none group transition-colors text-[11px] font-bold uppercase tracking-widest ${
          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
        } ${
          isSorted
            ? 'text-mustard-600 dark:text-mustard-400 font-extrabold'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        } ${extraClass}`}
        title={`Clique para ordenar por ${label} (${isSorted && isAsc ? 'decrescente' : 'crescente'})`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end w-full' : align === 'center' ? 'justify-center w-full' : ''}`}>
          <span>{label}</span>
          <span
            className={`material-symbols-outlined text-[16px] transition-all transform ${
              isSorted
                ? 'text-mustard-500 dark:text-mustard-400 opacity-100 scale-110'
                : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100'
            }`}
          >
            {isSorted
              ? (isAsc ? 'keyboard_arrow_up' : 'keyboard_arrow_down')
              : 'unfold_more'}
          </span>
        </div>
      </th>
    );
  };

  const handleBillCreated = () => {
    fetchContasReceber();
  };

  const hasActiveFilters = Boolean(selectedClientId || invoiceNumber || status || dateFrom || dateTo || sortBy !== 'due_date' || sortOrder !== 'desc' || !groupNfe);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
            <span className="material-symbols-outlined text-3xl">trending_up</span>
          </div>
          <div className="flex-1 min-w-[200px]">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Contas a Receber</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gestão e controle de faturas de locação, clientes e cobranças bancárias / Asaas
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setIsLancamentoModalOpen(true)}
              className="px-4 py-2.5 bg-mustard-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-mustard-600 transition-colors flex items-center gap-2 shadow-md shadow-mustard-500/10"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Lançar Conta a Receber
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <SearchableSelect
              label="Cliente"
              placeholder="Todos os clientes"
              items={clients}
              selectedId={selectedClientId}
              onSelect={setSelectedClientId}
              getDisplayValue={(c) => c.company_name}
              getSearchValue={(c) => `${c.company_name} ${c.cnpj}`}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                Nº Fatura
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Buscar por fatura..."
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                />
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  tag
                </span>
                {invoiceNumber && (
                  <button
                    type="button"
                    onClick={() => setInvoiceNumber('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    title="Limpar número da fatura"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm cursor-pointer"
              >
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Até</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setGroupNfe((prev) => !prev)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${groupNfe
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                title="Alternar entre visualizar o lançamento consolidado ou parcelas avulsas"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {groupNfe ? 'layers' : 'layers_clear'}
                </span>
                <span>{groupNfe ? 'Agrupar Parcelas' : 'Parcelas Individuais'}</span>
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-bold text-mustard-600 dark:text-mustard-400 uppercase tracking-widest hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl p-4 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-left">
                  {renderSortHeader('Conciliado', 'is_reconciled', 'center')}
                  {renderSortHeader('Vencimento', 'due_date', 'left')}
                  {renderSortHeader('Cliente / Contrato', 'client_name', 'left')}
                  {renderSortHeader('Origem', 'origin', 'left')}
                  {renderSortHeader('Valor Bruto', 'gross_value', 'right')}
                  {renderSortHeader('Valor Líquido', 'net_value', 'right')}
                  {renderSortHeader('Status', 'status', 'left')}
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center select-none">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="w-8 h-8 border-4 border-mustard-500/20 border-t-mustard-500 rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-400 dark:text-slate-500 italic">
                      Nenhuma conta a receber encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const badge = sourceBadge(item);
                    const isReconciled = item.is_reconciled || Boolean(item.settled_date);
                    return (
                      <tr key={`${item.source}-${item.id}`}>
                        <td className="px-6 py-4 text-center">
                          {isReconciled ? (
                            <span title="Conciliado" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              Conciliado
                            </span>
                          ) : (
                            <span title="Ainda não conciliado" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              <span className="material-symbols-outlined text-[14px]">radio_button_unchecked</span>
                              Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {formatDate(item.due_date)}
                            </p>
                            {item.installments_count && item.installments_count > 1 ? (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                {item.status === 'Recebido' ? 'Todas recebidas' : 'Próx. vencimento'}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {item.client_name || item.counterparty_name || '—'}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                              {item.invoice_number || item.description || '—'}
                            </span>
                            {item.installments_count && item.installments_count > 1 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
                                <span className="material-symbols-outlined text-[11px]">payments</span>
                                {item.paid_installments_count || 0}/{item.installments_count} recebidas
                              </span>
                            ) : null}
                            {item.fatura_numero && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                Fatura Nº {item.fatura_numero}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                          {item.gross_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {(item.net_value ?? item.gross_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${statusBadgeClass(item)}`}>
                            <span className="material-symbols-outlined text-[14px]">{statusIcon(item)}</span>
                            {statusLabel(item)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedBill(item)}
                            className="p-2 text-slate-400 hover:text-mustard-600 dark:hover:text-mustard-400 hover:bg-mustard-50 dark:hover:bg-mustard-500/10 rounded-xl transition-all inline-flex items-center justify-center"
                            title="Ver detalhes da conta a receber"
                          >
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalItems > 0 && (
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Mostrando {Math.min(totalItems, (currentPage - 1) * ITEMS_PER_PAGE + 1)} - {Math.min(totalItems, currentPage * ITEMS_PER_PAGE)} de {totalItems}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 text-slate-400 hover:text-mustard-600 dark:hover:text-mustard-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === pageNum
                          ? 'bg-mustard-500 text-white shadow-mustard-500/20'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 text-mustard-600 dark:text-mustard-400 hover:text-mustard-700 dark:hover:text-mustard-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <LancamentoManualModal
        isOpen={isLancamentoModalOpen}
        type="receivable"
        onClose={() => setIsLancamentoModalOpen(false)}
        onCreated={handleBillCreated}
      />

      <BillDetailsModal
        isOpen={selectedBill !== null}
        item={selectedBill}
        onClose={() => setSelectedBill(null)}
        onUpdated={fetchContasReceber}
      />
    </div>
  );
};

export default ContasReceberTab;
