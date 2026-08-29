import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, formatDateTime } from '../../utils/date';
import { useAuth } from '../../contexts/AuthContext';
import { financeiroService } from '../../services/financeiro';
import { getApiErrorMessage } from '../../utils/apiError';
import type { StatementItem, BillStatus } from '../../types';

interface BillDetailsModalProps {
  isOpen: boolean;
  item: StatementItem | null;
  onClose: () => void;
  onUpdated?: (updatedItem: StatementItem) => void;
}

const STATUS_OPTIONS: BillStatus[] = ['Pendente', 'Atrasado', 'Recebido', 'Divergente', 'No prazo'];

const formatMoney = (val?: number | null): string => {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const BillDetailsModal: React.FC<BillDetailsModalProps> = ({ isOpen, item, onClose, onUpdated }) => {
  const { profile } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [copiedBarcode, setCopiedBarcode] = useState(false);

  const [currentItem, setCurrentItem] = useState<StatementItem | null>(item);
  const [isEditing, setIsEditing] = useState(false);
  const [statusValue, setStatusValue] = useState<string>('Pendente');
  const [isReconciledValue, setIsReconciledValue] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (item) {
      setCurrentItem(item);
      setStatusValue(item.status || 'Pendente');
      setIsReconciledValue(Boolean(item.is_reconciled || item.settled_date || item.raw?.reconciled_at));
      setIsEditing(false);
      setConfirmDelete(false);
      setError(null);
    }
  }, [item]);

  if (!isOpen || !currentItem) return null;

  const raw = currentItem.raw || {};
  const isReceivable = currentItem.type === 'receivable';
  const isReconciled = Boolean(currentItem.is_reconciled || currentItem.settled_date || raw.reconciled_at);
  const settledDate = currentItem.settled_date || raw.reconciled_at || raw.payment_date;
  const bankDate = raw.bank_transaction_date;
  const barcode = raw.barcode;
  const cnpj = raw.client?.cnpj;

  const isManual = currentItem.origin === 'MANUAL';
  const canEdit = isManual && Boolean(profile && ['Administrador', 'Gerente', 'Diretoria'].includes(profile.access_level));
  const canDelete = isManual && profile?.access_level === 'Administrador';

  const creatorName = currentItem.created_by_name || raw.creator?.full_name || null;
  const creatorPhoto = currentItem.created_by_photo || raw.creator?.photo_url || null;
  const createdAt = currentItem.created_at || raw.created_at;
  const updatedAt = currentItem.updated_at || raw.updated_at;

  const handleCopyId = () => {
    if (currentItem.id) {
      navigator.clipboard.writeText(String(currentItem.id));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleCopyBarcode = () => {
    if (barcode) {
      navigator.clipboard.writeText(String(barcode));
      setCopiedBarcode(true);
      setTimeout(() => setCopiedBarcode(false), 2000);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await financeiroService.atualizarLancamento(currentItem.id, {
        status: statusValue,
        is_reconciled: isReconciledValue,
      });
      setCurrentItem(updated);
      setIsEditing(false);
      onUpdated?.(updated);
      onClose();
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setStatusValue(currentItem.status || 'Pendente');
    setIsReconciledValue(isReconciled);
    setIsEditing(false);
    setError(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await financeiroService.excluirLancamento(currentItem.id);
      setConfirmDelete(false);
      onClose();
      onUpdated?.(currentItem);
    } catch (err: any) {
      setError(getApiErrorMessage(err));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isReceivable
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}
              >
                <span className="material-symbols-outlined text-2xl">
                  {isReceivable ? 'trending_up' : 'trending_down'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                    Detalhes do Lançamento
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isReceivable
                        ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                        : 'bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                    }`}
                  >
                    {isReceivable ? 'Conta a Receber' : 'Conta a Pagar'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                    ID: {currentItem.id}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title="Copiar ID"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedId ? 'check' : 'content_copy'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            )}

            {/* Financial Values Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Valor Bruto
                </span>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1">
                  {formatMoney(currentItem.gross_value)}
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Taxas / Deduções
                </span>
                <p className="text-lg font-bold text-slate-500 dark:text-slate-400 mt-1">
                  {formatMoney(currentItem.fee_amount)}
                </p>
              </div>

              <div className="p-4 bg-mustard-50/50 dark:bg-mustard-500/10 border border-mustard-200 dark:border-mustard-500/20 rounded-2xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-mustard-600 dark:text-mustard-400">
                  Valor Líquido
                </span>
                <p className="text-lg font-bold text-mustard-600 dark:text-mustard-400 mt-1">
                  {formatMoney(currentItem.net_value ?? currentItem.gross_value)}
                </p>
              </div>
            </div>

            {/* General Info Grid */}
            <div className="bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-mustard-500">info</span>
                  Informações Principais
                </h4>
                {isEditing && (
                  <span className="text-[11px] font-bold text-mustard-600 dark:text-mustard-400 uppercase tracking-wider">
                    Modo de Edição Ativo
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Cliente / Favorecido</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {currentItem.client_name || currentItem.counterparty_name || raw.counterparty_name || '—'}
                  </p>
                  {cnpj && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono block mt-0.5">
                      CNPJ: {cnpj}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Nº Fatura / Contrato</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5 font-mono">
                    {currentItem.invoice_number || raw.invoice?.invoice_number || '—'}
                  </p>
                </div>

                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Vencimento</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {formatDate(currentItem.due_date)}
                  </p>
                </div>

                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Origem do Registro</span>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {currentItem.origin || (currentItem.source === 'payment' ? 'ASAAS' : 'MANUAL')}
                    </span>
                  </div>
                </div>

                {/* Status Financeiro (Editable) */}
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Status Financeiro</span>
                  {isEditing ? (
                    <select
                      value={statusValue}
                      onChange={(e) => setStatusValue(e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-mustard-500/50 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mustard-500/20"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {currentItem.status || 'Pendente'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status de Conciliação (Editable) */}
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Status de Conciliação</span>
                  {isEditing ? (
                    <div className="mt-1 flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isReconciledValue}
                          onChange={(e) => setIsReconciledValue(e.target.checked)}
                          className="w-4 h-4 text-mustard-500 rounded border-slate-300 dark:border-slate-700 focus:ring-mustard-500"
                        />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {isReconciledValue ? 'Conciliado (gravar data atual)' : 'Pendente (desconciliar)'}
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="mt-1">
                      {isReconciled ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Conciliado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          <span className="material-symbols-outlined text-[14px]">radio_button_unchecked</span>
                          Pendente
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {settledDate && (
                  <div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Data de Conciliação / Quitação</span>
                    <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                      {formatDate(settledDate)}
                    </p>
                  </div>
                )}

                {bankDate && (
                  <div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Data Transação Bancária</span>
                    <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                      {formatDate(bankDate)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Description / Notes */}
            <div className="bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-mustard-500">description</span>
                Descrição / Histórico
              </span>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {currentItem.description || raw.description || 'Nenhuma observação ou descrição registrada.'}
              </p>
            </div>

            {/* Audit & Creator Card */}
            <div className="bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-mustard-500">history_edu</span>
                Logs de auditoria
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                {/* Creator Profile */}
                <div className="sm:col-span-1">
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Criado por</span>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    {creatorPhoto ? (
                      <img
                        src={creatorPhoto}
                        alt={creatorName || 'Usuário'}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 border border-mustard-500/20 flex items-center justify-center font-bold text-xs uppercase">
                        {creatorName ? String(creatorName).charAt(0) : <span className="material-symbols-outlined text-sm">person</span>}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {creatorName || 'Sistema / Não identificado'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Created At */}
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Cadastrado em</span>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                    {formatDateTime(createdAt)}
                  </p>
                </div>

                {/* Updated At */}
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">Última atualização</span>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                    {formatDateTime(updatedAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Barcode / Linha Digitavel (if present) */}
            {barcode && (
              <div className="bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-mustard-500">barcode</span>
                  Código de Barras
                </span>
                <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all">
                    {barcode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyBarcode}
                    className="shrink-0 p-1.5 text-slate-400 hover:text-mustard-600 dark:hover:text-mustard-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Copiar código de barras"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {copiedBarcode ? 'check' : 'content_copy'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* External Links / Asaas */}
            {(currentItem.invoice_url || currentItem.bank_slip_url) && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {currentItem.invoice_url && (
                  <a
                    href={currentItem.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-mustard-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-mustard-600 transition-colors inline-flex items-center gap-2 shadow-sm shadow-mustard-500/20"
                  >
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    Visualizar Fatura Asaas
                  </a>
                )}
                {currentItem.bank_slip_url && (
                  <a
                    href={currentItem.bank_slip_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">receipt</span>
                    Visualizar Boleto Bancário
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2">
            <div>
              {canDelete && !isEditing && (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      Confirmar exclusão?
                    </span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1"
                    >
                      {deleting ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-[14px]">delete_forever</span>
                      )}
                      Sim, Excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all flex items-center gap-1.5"
                    title="Excluir lançamento permanentemente"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Excluir
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-6 py-2 bg-mustard-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-mustard-600 transition-colors shadow-md shadow-mustard-500/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                    Salvar Alterações
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                  >
                    Fechar
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-5 py-2.5 bg-mustard-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-mustard-600 transition-colors shadow-md shadow-mustard-500/20 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Editar Lançamento
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BillDetailsModal;
