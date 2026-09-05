import React, { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import { financeiroService } from '../../../services/financeiro';
import { getApiErrorMessage } from '../../../utils/apiError';
import SearchableSelect from '../../../components/SearchableSelect';
import LancamentoManualModal from '../../../components/financeiro/LancamentoManualModal';
import BillDetailsModal from '../../../components/financeiro/BillDetailsModal';
import XmlImportModal from '../../../components/XmlImportModal';
import { formatDate } from '../../../utils/date';
import type { Client, StatementItem, BillType, BillStatus } from '../../../types';

const STATUS_OPTIONS: BillStatus[] = ['Pendente', 'Atrasado', 'Recebido', 'Divergente', 'No prazo'];
const ORIGIN_OPTIONS = ['ASAAS', 'MANUAL', 'NFE'];
const ITEMS_PER_PAGE = 20;

const isSettled = (item: StatementItem) =>
  item.source === 'payment'
    ? item.status === 'RECEIVED'
    : item.status === 'Recebido' || item.status === 'No prazo';

// Boleto confirmado pelo banco, mas ainda em compensação bancária — o valor
// ainda não está disponível no saldo Asaas (ver PAYMENT_CONFIRMED vs
// PAYMENT_RECEIVED em asaasWebhookController.ts). Só existe pra `payment`
// (um `bill` só é criado quando o valor já está disponível).
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

// `bills` já guarda status em português (Pendente/Recebido/...); `payments`
// guarda o status cru da Asaas (PENDING/CONFIRMED/RECEIVED/...) — traduzido
// aqui só pra exibição, sem mudar o valor armazenado.
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

const ExtratoTab: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [status, setStatus] = useState('');
  const [origin, setOrigin] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [items, setItems] = useState<StatementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [lancamentoModal, setLancamentoModal] = useState<BillType | null>(null);
  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<StatementItem | null>(null);

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

  const fetchExtrato = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await financeiroService.listarExtratoBancario({
        client_id: selectedClientId || undefined,
        status: status || undefined,
        origin: origin || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
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
  }, [selectedClientId, status, origin, dateFrom, dateTo, currentPage]);

  useEffect(() => {
    fetchExtrato();
  }, [fetchExtrato]);

  // Sempre que um filtro muda, volta pra página 1 (mesmo padrão de
  // Rentals.tsx) — sem isso, trocar de filtro numa página > 1 pode devolver
  // uma página vazia (menos itens que o esperado pro offset atual).
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId, status, origin, dateFrom, dateTo]);

  const handleClearFilters = () => {
    setSelectedClientId('');
    setStatus('');
    setOrigin('');
    setDateFrom('');
    setDateTo('');
  };

  // Refaz a busca no servidor em vez de inserir o item otimisticamente no
  // estado local: o backend é quem decide ordenação, status derivado
  // (is_reconciled) e demais campos calculados do merge bills+payments —
  // reconstruir isso no front duplicaria essa lógica e ficaria desatualizado
  // a cada mudança no critério de merge do backend.
  const handleBillCreated = () => {
    fetchExtrato();
  };

  const hasActiveFilters = Boolean(selectedClientId || status || origin || dateFrom || dateTo);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 bg-mustard-100 dark:bg-mustard-500/10 rounded-2xl flex items-center justify-center text-mustard-500 shadow-sm">
            <span className="material-symbols-outlined text-3xl">receipt_long</span>
          </div>
          <div className="flex-1 min-w-[200px]">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Extrato de lançamentos</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Incluir, consultar e validar conciliações de lançamentos de contas
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setIsXmlModalOpen(true)}
              className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px] text-mustard-600">receipt_long</span>
              Importar NF-e
            </button>
            <button
              type="button"
              onClick={() => setLancamentoModal('payable')}
              className="px-4 py-2.5 border border-mustard-500 text-mustard-600 dark:text-mustard-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
              Lançar Conta a Pagar
            </button>
            <button
              type="button"
              onClick={() => setLancamentoModal('receivable')}
              className="px-4 py-2.5 bg-mustard-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-mustard-600 transition-colors flex items-center gap-2 shadow-md shadow-mustard-500/10"
            >
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
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
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Origem</label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm cursor-pointer"
              >
                <option value="">Todas</option>
                {ORIGIN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
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

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-bold text-mustard-600 dark:text-mustard-400 uppercase tracking-widest hover:underline"
            >
              Limpar filtros
            </button>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl p-4 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-left">
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Conciliado</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vencimento</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cliente / Fatura</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Origem</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Valor Bruto</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Tipo</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Valor Líquido</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="w-8 h-8 border-4 border-mustard-500/20 border-t-mustard-500 rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-400 dark:text-slate-500 italic">
                      Nenhum lançamento encontrado para os filtros selecionados.
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
                          {formatDate(item.due_date)}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {item.client_name || item.counterparty_name || '—'}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                            {item.invoice_number || '—'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                          {item.gross_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {item.type === 'receivable' ? (
                            <span
                              title="Entrada (A Receber)"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                            >
                              <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                            </span>
                          ) : (
                            <span
                              title="Saída (A Pagar)"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                            >
                              <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-mustard-500 dark:text-mustard-400">
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
                            title="Ver detalhes do lançamento"
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
        isOpen={lancamentoModal !== null}
        type={lancamentoModal || 'receivable'}
        onClose={() => setLancamentoModal(null)}
        onCreated={handleBillCreated}
      />

      <XmlImportModal
        isOpen={isXmlModalOpen}
        onClose={() => setIsXmlModalOpen(false)}
        onSuccess={() => {
          fetchExtrato();
        }}
      />

      <BillDetailsModal
        isOpen={selectedBill !== null}
        item={selectedBill}
        onClose={() => setSelectedBill(null)}
        onUpdated={fetchExtrato}
      />
    </div>
  );
};

export default ExtratoTab;
