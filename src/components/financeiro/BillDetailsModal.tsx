import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import api from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/date';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { financeiroService } from '../../services/financeiro';
import { getApiErrorMessage } from '../../utils/apiError';
import { FaturaLocacaoDocument } from '../logistics/FaturaLocacaoDocument';
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

  // Boleto PDF attachment state
  const [uploadingBoleto, setUploadingBoleto] = useState(false);
  const [deletingBoleto, setDeletingBoleto] = useState(false);
  const [confirmDeleteBoleto, setConfirmDeleteBoleto] = useState(false);
  const [boletoSuccessMessage, setBoletoSuccessMessage] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingInstallmentId, setUpdatingInstallmentId] = useState<string | null>(null);

  const [generatingFatura, setGeneratingFatura] = useState(false);
  const [faturaSuccessMessage, setFaturaSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setCurrentItem(item);
      setStatusValue(item.status || 'Pendente');
      setIsReconciledValue(Boolean(item.is_reconciled || item.settled_date || item.raw?.reconciled_at));
      setIsEditing(false);
      setConfirmDelete(false);
      setConfirmDeleteBoleto(false);
      setError(null);
      setFaturaSuccessMessage(null);
      setBoletoSuccessMessage(null);
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
  const canEdit = Boolean(profile && ['Administrador', 'Gerente', 'Diretoria', 'Financeiro'].includes(profile.access_level));
  const canDelete = isManual && profile?.access_level === 'Administrador';

  const rentalInvoiceId = currentItem.rental_invoice_id || raw.rental_invoice_id || raw.invoice_id || raw.invoice?.id;

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

  const handleGerarFaturaLocacao = async (action: 'view' | 'download' = 'view') => {
    if (!rentalInvoiceId) return;
    setGeneratingFatura(true);
    setError(null);
    setFaturaSuccessMessage(null);
    try {
      // 1. Carregar dados completos da locação e contrato/deal
      const [rentalRes, dealRes] = await Promise.all([
        api.get(`/rentals/${rentalInvoiceId}`),
        api.get(`/rentals/${rentalInvoiceId}/contract-deal`).catch(() => ({ data: null })),
      ]);

      const rental = rentalRes.data;
      const dealData = dealRes?.data;
      let contracts = dealData?.contracts || [];
      const deal = dealData?.deal;
      const contractForm = dealData?.contract_form;

      // Se a lista de contratos estiver vazia, buscar por deal.id
      if (contracts.length === 0 && deal?.id) {
        try {
          const { data: cData } = await api.get(`/crm/deals/${deal.id}/contracts`);
          if (cData && Array.isArray(cData) && cData.length > 0) {
            contracts = cData;
          }
        } catch {
          // ignore
        }
      }

      let clientObj = deal?.clients || deal?.client;
      if (!clientObj && rental.client_id) {
        try {
          const { data: clientData } = await api.get(`/clients/${rental.client_id}`);
          clientObj = clientData;
        } catch {
          // ignore
        }
      }

      // Número real do contrato em crm_deal_contracts (ex: "002")
      const realContractNumber = contracts[0]?.contract_number || null;

      const contractObj: any = {
        contract_number: realContractNumber,
        rental_invoice_id: rental.id,
        notes: rental.notes,
        deal: {
          ...deal,
          client: clientObj || {
            company_name: rental.client_name || currentItem.client_name,
            cnpj: rental.cnpj || raw.client?.cnpj,
            state_subscription: rental.state_subscription || raw.client?.state_subscription || '',
            state_registration: rental.state_subscription || raw.client?.state_subscription || '',
            phone: rental.phone || '',
            address_full: rental.delivery_address || rental.work_site || ''
          }
        },
        contract_form: {
          ...contractForm,
          notes: rental.notes || contractForm?.notes || '',
          observations: rental.notes || contractForm?.observations || '',
          locatario_company_name: rental.client_name || currentItem.client_name,
          locatario_cnpj: rental.cnpj || raw.client?.cnpj,
          locatario_state_registration: clientObj?.state_subscription || clientObj?.state_registration || contractForm?.locatario_state_registration || '',
          locatario_state_subscription: clientObj?.state_subscription || clientObj?.state_registration || contractForm?.locatario_state_subscription || '',
          locatario_phone: rental.phone || contractForm?.site_contact_phone || '',
          locatario_address: rental.delivery_address || rental.work_site || contractForm?.locatario_address_full || '',
          work_site: rental.work_site || rental.delivery_address || contractForm?.work_site || '',
          period_start: rental.equipments?.[0]?.billing_period_start || rental.billing_period_start || rental.due_date || currentItem.due_date,
          period_end: rental.equipments?.[0]?.billing_period_end || rental.billing_period_end || rental.due_date || currentItem.due_date,
          cost_rental: rental.cost_rental ?? rental.total_value ?? currentItem.gross_value,
          cost_total: rental.total_value ?? currentItem.gross_value,
          equipments: rental.equipments || []
        },
        snapshot: contracts[0]?.snapshot,
        equipments: rental.equipments || []
      };

      const invoiceNum = rental.invoice_number || currentItem.invoice_number || (realContractNumber ? `ND-${String(realContractNumber).padStart(6, '0')}` : undefined);
      const dueDateFormatted = rental.due_date || currentItem.due_date || undefined;
      const paymentMethodFormatted = rental.payment_method || (rental.billing_method === 'MANUAL' ? 'Lançamento Manual' : 'Boleto Bancário');

      // 2. Gerar PDF da Fatura de Locação
      const blob = await pdf(
        <FaturaLocacaoDocument
          contract={contractObj}
          invoiceNumber={invoiceNum}
          dueDate={dueDateFormatted}
          paymentMethod={paymentMethodFormatted}
        />
      ).toBlob();

      if (action === 'download') {
        saveAs(blob, `FATURA_LOCACAO - ${invoiceNum || 'ND'}.pdf`);
      } else {
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      }

      // 3. Atualizar status da locação para 'Faturado'
      await api.put(`/rentals/${rentalInvoiceId}`, { billing_status: 'Faturado' });

      // 4. Atualizar status do registro financeiro para 'Pendente'
      if (currentItem.source === 'bill') {
        const updatedBill = await financeiroService.atualizarLancamento(currentItem.id, { status: 'Pendente' });
        setCurrentItem(updatedBill);
        setStatusValue('Pendente');
        onUpdated?.(updatedBill);
      } else {
        setStatusValue('Pendente');
        const updatedItem = { ...currentItem, status: 'Pendente' };
        setCurrentItem(updatedItem);
        onUpdated?.(updatedItem);
      }

      setFaturaSuccessMessage('Fatura de locação gerada com sucesso! Status da locação atualizado para "Faturado" e financeiro para "Pendente".');
    } catch (err: any) {
      console.error('Erro ao gerar Fatura de Locação:', err);
      setError(getApiErrorMessage(err));
    } finally {
      setGeneratingFatura(false);
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

  const handleUploadBoleto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentItem) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor, selecione um arquivo em formato PDF.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('O arquivo PDF deve ter no máximo 20 MB.');
      return;
    }

    setUploadingBoleto(true);
    setError(null);
    setBoletoSuccessMessage(null);

    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `contas-pagar/boleto_${Date.now()}_${cleanName}`;

      const { error: uploadError } = await supabase.storage
        .from('boletos')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        throw new Error(`Erro ao enviar boleto: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage.from('boletos').getPublicUrl(filePath);
      const newBoletoUrl = urlData.publicUrl;

      const updated = await financeiroService.atualizarLancamento(currentItem.id, {
        bank_slip_url: newBoletoUrl,
      });

      setCurrentItem((prev) => (prev ? { ...prev, bank_slip_url: newBoletoUrl } : updated));
      onUpdated?.({ ...currentItem, bank_slip_url: newBoletoUrl });
      setBoletoSuccessMessage('Boleto bancário anexado com sucesso!');
      setTimeout(() => setBoletoSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Erro ao fazer upload do boleto:', err);
      setError(getApiErrorMessage(err));
    } finally {
      setUploadingBoleto(false);
      e.target.value = '';
    }
  };

  const handleRemoveBoleto = async () => {
    if (!currentItem) return;
    setDeletingBoleto(true);
    setError(null);
    setBoletoSuccessMessage(null);

    try {
      const updated = await financeiroService.atualizarLancamento(currentItem.id, {
        bank_slip_url: null,
      });

      setCurrentItem((prev) => (prev ? { ...prev, bank_slip_url: null } : updated));
      onUpdated?.({ ...currentItem, bank_slip_url: null });
      setConfirmDeleteBoleto(false);
      setBoletoSuccessMessage('Boleto bancário removido com sucesso.');
      setTimeout(() => setBoletoSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Erro ao remover boleto:', err);
      setError(getApiErrorMessage(err));
    } finally {
      setDeletingBoleto(false);
    }
  };

  const handleUpdateInstallmentStatus = async (instId: string, nextStatus: string, nextReconciled?: boolean) => {
    if (!currentItem) return;
    setUpdatingInstallmentId(instId);
    setError(null);
    try {
      await financeiroService.atualizarLancamento(instId, {
        status: nextStatus as any,
        ...(nextReconciled !== undefined ? { is_reconciled: nextReconciled } : {}),
      });

      const updatedInstallments = (currentItem.installments || []).map((i) => {
        if (i.id === instId) {
          return {
            ...i,
            status: nextStatus,
            is_reconciled: nextReconciled !== undefined ? nextReconciled : (nextStatus === 'Recebido' || nextStatus === 'No prazo'),
            settled_date: (nextStatus === 'Recebido' || nextStatus === 'No prazo') ? new Date().toISOString() : null,
          };
        }
        return i;
      });

      const totalCount = updatedInstallments.length;
      const paidCount = updatedInstallments.filter((i) => i.status === 'Recebido' || i.status === 'No prazo').length;
      const allReconciled = updatedInstallments.every((i) => i.is_reconciled);

      let consolidatedStatus = 'Pendente';
      if (paidCount === totalCount) {
        consolidatedStatus = 'Recebido';
      } else if (paidCount > 0) {
        consolidatedStatus = `Parcial (${paidCount}/${totalCount})`;
      } else {
        const anyOverdue = updatedInstallments.some((i) => i.status === 'Atrasado');
        if (anyOverdue) consolidatedStatus = 'Atrasado';
      }

      const pendingInst = updatedInstallments.find((i) => i.status !== 'Recebido' && i.status !== 'No prazo');
      const targetDueDate = pendingInst?.due_date || updatedInstallments[updatedInstallments.length - 1]?.due_date || currentItem.due_date;

      const newCurrentItem: StatementItem = {
        ...currentItem,
        installments: updatedInstallments,
        paid_installments_count: paidCount,
        status: consolidatedStatus,
        due_date: targetDueDate,
        is_reconciled: allReconciled,
      };

      setCurrentItem(newCurrentItem);
      onUpdated?.(newCurrentItem);
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    } finally {
      setUpdatingInstallmentId(null);
    }
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

            {faturaSuccessMessage && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {faturaSuccessMessage}
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

            {/* Ocorrências Mensais (Parcelas da NF-e) */}
            {currentItem.installments && currentItem.installments.length > 1 && (
              <div className="bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        {currentItem.origin === 'NFE' ? 'Ocorrências Mensais da NF-e' : 'Parcelas do Lançamento'}
                      </h4>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {currentItem.installments.length} parcelas registradas para este documento
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    {currentItem.paid_installments_count || 0} de {currentItem.installments.length} parcelas quitadas
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800">
                        <th className="px-4 py-3 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Parcela</th>
                        <th className="px-4 py-3 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Vencimento</th>
                        <th className="px-4 py-3 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Valor</th>
                        <th className="px-4 py-3 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Status</th>
                        <th className="px-4 py-3 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px] text-center">Conciliado</th>
                        {canEdit && (
                          <th className="px-4 py-3 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px] text-center">Ações</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {currentItem.installments.map((inst, index) => {
                        const rawInst = (inst.raw as any)?.bank_raw_snapshot || {};
                        const instNum = rawInst.installment_number || (index + 1);
                        const isPaid = inst.status === 'Recebido' || inst.status === 'No prazo';
                        const isOverdue = inst.status === 'Atrasado';
                        const isUpdating = updatingInstallmentId === inst.id;

                        return (
                          <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center">
                                  {instNum}
                                </span>
                                Parcela {instNum}/{currentItem.installments!.length}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap font-medium">
                              {formatDate(inst.due_date)}
                            </td>
                            <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                              {formatMoney(inst.gross_value)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isPaid
                                    ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                    : isOverdue
                                    ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                                    : 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px]">
                                  {isPaid ? 'check_circle' : isOverdue ? 'cancel' : 'schedule'}
                                </span>
                                {inst.status || 'Pendente'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              {inst.is_reconciled ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <span className="material-symbols-outlined text-[14px]">done_all</span>
                                  Sim
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                  Não
                                </span>
                              )}
                            </td>
                            {canEdit && (
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateInstallmentStatus(inst.id, isPaid ? 'Pendente' : 'Recebido', !isPaid)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 mx-auto ${
                                    isPaid
                                      ? 'bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 dark:text-slate-400 hover:text-rose-600 border border-slate-200 dark:border-slate-700'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                  }`}
                                  title={isPaid ? 'Marcar como Pendente' : 'Marcar como Paga/Recebida'}
                                >
                                  {isUpdating ? (
                                    <div className="w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    <>
                                      <span className="material-symbols-outlined text-[13px]">
                                        {isPaid ? 'undo' : 'check'}
                                      </span>
                                      <span>{isPaid ? 'Desfazer' : 'Dar Baixa'}</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Fatura de Locação (Bens Móveis) - Quando vinculado a rental_invoice */}
            {rentalInvoiceId && (
              <div className="bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">receipt_long</span>
                    Fatura de Locação (Bens Móveis)
                  </span>
                  {currentItem.invoice_number && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                      {currentItem.invoice_number}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Esta conta a receber está vinculada a uma locação. Ao gerar a fatura oficial, o status da locação será atualizado para <strong className="text-emerald-700 dark:text-emerald-300">Faturado</strong> e o status deste lançamento ficará como <strong className="text-amber-700 dark:text-amber-300">Pendente</strong>.
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={generatingFatura}
                    onClick={() => handleGerarFaturaLocacao('view')}
                    className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {generatingFatura ? (
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-800 dark:border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Visualizar Fatura
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={generatingFatura}
                    onClick={() => handleGerarFaturaLocacao('download')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {generatingFatura ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        Baixar Fatura (PDF)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

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

            {/* Boleto de Pagamento (PDF) */}
            {(!isReceivable || currentItem.bank_slip_url) && (
              <div className="bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-rose-500">picture_as_pdf</span>
                    Boleto de Pagamento (PDF)
                  </span>
                  {currentItem.bank_slip_url ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      Arquivo Anexado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                      <span className="material-symbols-outlined text-[13px]">warning</span>
                      Sem Boleto
                    </span>
                  )}
                </div>

                {currentItem.bank_slip_url ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[24px]">description</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          Boleto Bancário da Conta
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Disponível para download e liquidação pelo financeiro
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <a
                        href={currentItem.bank_slip_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-initial px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5 shadow-sm shadow-rose-500/20"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Visualizar / Baixar
                      </a>

                      {canEdit && (
                        <>
                          <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center justify-center gap-1 shadow-sm">
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              className="hidden"
                              disabled={uploadingBoleto || deletingBoleto}
                              onChange={handleUploadBoleto}
                            />
                            {uploadingBoleto ? (
                              <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                            )}
                            Substituir
                          </label>

                          {confirmDeleteBoleto ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={deletingBoleto}
                                onClick={handleRemoveBoleto}
                                className="px-2.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                                title="Confirmar remoção"
                              >
                                {deletingBoleto ? '...' : 'Confirmar'}
                              </button>
                              <button
                                type="button"
                                disabled={deletingBoleto}
                                onClick={() => setConfirmDeleteBoleto(false)}
                                className="px-2 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs transition-colors"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteBoleto(true)}
                              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                              title="Remover boleto"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : canEdit ? (
                  <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-mustard-500/60 dark:hover:border-mustard-500/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group">
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      disabled={uploadingBoleto}
                      onChange={handleUploadBoleto}
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-mustard-500/10 group-hover:text-mustard-600 dark:group-hover:text-mustard-400 flex items-center justify-center transition-colors">
                        {uploadingBoleto ? (
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-mustard-500 rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-[22px]">upload_file</span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-mustard-600 dark:group-hover:text-mustard-400 transition-colors block">
                          {uploadingBoleto ? 'Enviando arquivo do boleto...' : 'Anexar Boleto de Pagamento (PDF)'}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          Permite que o setor financeiro obtenha o PDF para pagamento diretamente do registro
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 px-4 py-2 rounded-xl bg-mustard-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm shadow-mustard-500/20 group-hover:bg-mustard-600 transition-colors">
                      Selecionar PDF
                    </span>
                  </label>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic p-2">
                    Nenhum boleto em PDF anexado a esta conta.
                  </p>
                )}

                {boletoSuccessMessage && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    {boletoSuccessMessage}
                  </div>
                )}
              </div>
            )}

            {/* External Links / Asaas */}
            {currentItem.invoice_url && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href={currentItem.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-mustard-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-mustard-600 transition-colors inline-flex items-center gap-2 shadow-sm shadow-mustard-500/20"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  Visualizar Fatura Asaas
                </a>
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
