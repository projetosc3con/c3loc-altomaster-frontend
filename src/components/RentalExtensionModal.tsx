import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { formatDate } from '../utils/date';
import type { RentalInvoiceEquipment } from '../types';

interface EquipmentExtensionItem {
  id?: string;
  tempId?: string;
  equipment_id: string;
  equipment_name: string;
  equipment_type?: string;
  equipment_size?: string;
  asset_number?: string;
  billing_period_start: string;
  billing_period_end: string;
  cost_rental: number;
  cost_insurance: number;
  cost_freight: number;
  cost_rcd: number;
  cost_third_party: number;
  cost_training: number;
  total_value: number;
  notes?: string;
}

interface RentalExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  rentalId: string;
  invoiceNumber?: string;
  equipments: (RentalInvoiceEquipment & { tempId?: string })[];
  onSuccess: (result: any) => void;
}

export const RentalExtensionModal: React.FC<RentalExtensionModalProps> = ({
  isOpen,
  onClose,
  rentalId,
  invoiceNumber,
  equipments,
  onSuccess
}) => {
  const [items, setItems] = useState<EquipmentExtensionItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inicializa a lista de equipamentos clonando os dados recebidos
  useEffect(() => {
    if (isOpen && equipments && equipments.length > 0) {
      setErrorMessage(null);
      setItems(
        equipments.map((eq) => {
          const r = Number(eq.cost_rental) || 0;
          const i = Number(eq.cost_insurance) || 0;
          const f = Number(eq.cost_freight) || 0;
          const rcd = Number(eq.cost_rcd) || 0;
          const tp = Number(eq.cost_third_party) || 0;
          const tr = Number(eq.cost_training) || 0;
          const total = r + i + f + rcd + tp + tr;

          return {
            id: eq.id || (eq as any).tempId,
            tempId: (eq as any).tempId,
            equipment_id: eq.equipment_id,
            equipment_name: eq.equipment_name || 'Equipamento',
            equipment_type: eq.equipment_type || '',
            equipment_size: eq.equipment_size || '',
            asset_number: eq.asset_number || '',
            billing_period_start: eq.billing_period_start ? String(eq.billing_period_start).split('T')[0] : '',
            billing_period_end: eq.billing_period_end ? String(eq.billing_period_end).split('T')[0] : '',
            cost_rental: r,
            cost_insurance: i,
            cost_freight: f,
            cost_rcd: rcd,
            cost_third_party: tp,
            cost_training: tr,
            total_value: total,
            notes: eq.notes || ''
          };
        })
      );
    }
  }, [isOpen, equipments]);

  // Valor total anterior da locação
  const previousTotal = useMemo(() => {
    return equipments.reduce((acc, eq) => {
      const r = Number(eq.cost_rental) || 0;
      const i = Number(eq.cost_insurance) || 0;
      const f = Number(eq.cost_freight) || 0;
      const rcd = Number(eq.cost_rcd) || 0;
      const tp = Number(eq.cost_third_party) || 0;
      const tr = Number(eq.cost_training) || 0;
      return acc + (r + i + f + rcd + tp + tr);
    }, 0);
  }, [equipments]);

  // Novo valor total consolidado
  const newTotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const r = Number(item.cost_rental) || 0;
      const i = Number(item.cost_insurance) || 0;
      const f = Number(item.cost_freight) || 0;
      const rcd = Number(item.cost_rcd) || 0;
      const tp = Number(item.cost_third_party) || 0;
      const tr = Number(item.cost_training) || 0;
      return acc + (r + i + f + rcd + tp + tr);
    }, 0);
  }, [items]);

  const difference = Math.round((newTotal - previousTotal) * 100) / 100;
  const isValueDecreased = newTotal < previousTotal;

  // Validação das datas de fim
  const hasInvalidDates = useMemo(() => {
    return items.some((item) => {
      if (!item.billing_period_end) return true;
      if (item.billing_period_start && item.billing_period_end < item.billing_period_start) return true;
      return false;
    });
  }, [items]);

  const handleFieldChange = (index: number, field: keyof EquipmentExtensionItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };

      const r = Number(current.cost_rental) || 0;
      const i = Number(current.cost_insurance) || 0;
      const f = Number(current.cost_freight) || 0;
      const rcd = Number(current.cost_rcd) || 0;
      const tp = Number(current.cost_third_party) || 0;
      const tr = Number(current.cost_training) || 0;

      current.total_value = r + i + f + rcd + tp + tr;
      updated[index] = current;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isValueDecreased) {
      setErrorMessage(
        `O valor total da prorrogação não pode ser inferior ao valor anterior (${previousTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`
      );
      return;
    }

    if (hasInvalidDates) {
      setErrorMessage('Verifique as datas de fim da locação. Todas devem ser preenchidas e posteriores à data de início.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = {
        equipments: items.map((it) => ({
          id: it.id,
          equipment_id: it.equipment_id,
          equipment_name: it.equipment_name,
          equipment_type: it.equipment_type,
          equipment_size: it.equipment_size,
          asset_number: it.asset_number,
          billing_period_start: it.billing_period_start,
          billing_period_end: it.billing_period_end,
          cost_rental: Number(it.cost_rental) || 0,
          cost_insurance: Number(it.cost_insurance) || 0,
          cost_freight: Number(it.cost_freight) || 0,
          cost_rcd: Number(it.cost_rcd) || 0,
          cost_third_party: Number(it.cost_third_party) || 0,
          cost_training: Number(it.cost_training) || 0,
          total_value: it.total_value,
          notes: it.notes || null
        }))
      };

      const res = await api.post(`/rentals/${rentalId}/extend`, payload);
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      console.error('Erro ao prorrogar locação:', err);
      const msg = err.response?.data?.error || err.message || 'Erro ao prorrogar locação. Verifique os dados e tente novamente.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !submitting && onClose()}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 my-8 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">more_time</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Prorrogação de Locação</span>
                  {invoiceNumber && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                      #{invoiceNumber}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Altere a data de término e os valores dos equipamentos para prorrogar a vigência da locação.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-xs font-medium flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl flex-shrink-0">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Lista de Equipamentos */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">precision_manufacturing</span>
                  Equipamentos da Locação ({items.length})
                </h4>

                {items.map((item, index) => {
                  return (
                    <div
                      key={item.id || item.tempId || index}
                      className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-4 shadow-sm"
                    >
                      {/* Equipment Header (Read-only) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {item.asset_number ? `${item.asset_number} - ` : ''}
                            {item.equipment_name}
                          </span>
                          {(item.equipment_type || item.equipment_size) && (
                            <span className="text-xs text-slate-400 font-mono ml-2">
                              ({[item.equipment_type, item.equipment_size].filter(Boolean).join(' - ')})
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-mustard-600 dark:text-mustard-400">
                          Subtotal: {item.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </div>

                      {/* Period Section */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Início da Locação (Fixo)
                          </label>
                          <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300">
                            {item.billing_period_start ? formatDate(item.billing_period_start) : 'Não definido'}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                            <span>Nova Data de Término *</span>
                            <span className="text-[10px] text-amber-500 lowercase font-normal">editável</span>
                          </label>
                          <input
                            type="date"
                            required
                            min={item.billing_period_start || undefined}
                            value={item.billing_period_end}
                            onChange={(e) => handleFieldChange(index, 'billing_period_end', e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                          />
                        </div>
                      </div>

                      {/* Cost Inputs */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                          <span>Valores deste Equipamento (R$)</span>
                          <span className="text-[10px] text-amber-500 lowercase font-normal">ajustáveis</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                          {[
                            { key: 'cost_rental', label: 'Locação' },
                            { key: 'cost_insurance', label: 'Seguro' },
                            { key: 'cost_freight', label: 'Frete' },
                            { key: 'cost_rcd', label: 'RCD' },
                            { key: 'cost_third_party', label: 'Terceiros' },
                            { key: 'cost_training', label: 'Treinamento' }
                          ].map(({ key, label }) => (
                            <div key={key} className="space-y-1">
                              <span className="text-[10px] font-medium text-slate-400 block truncate">{label}</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={(item as any)[key]}
                                onChange={(e) => handleFieldChange(index, key as any, parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Summary & Actions */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex-shrink-0 space-y-4">
              {/* Financial Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Valor Anterior</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {previousTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Novo Valor Total</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {newTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-xl border ${isValueDecreased
                      ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400'
                      : difference > 0
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                    Diferença a Lançar (Hoje)
                  </span>
                  <span className="text-sm font-bold flex items-center gap-1">
                    {difference > 0 ? '+' : ''}
                    {difference.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    {difference > 0 && (
                      <span className="text-[10px] font-normal opacity-80">(Conta a Receber)</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submitting || isValueDecreased || hasInvalidDates}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>Confirmar Prorrogação</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RentalExtensionModal;
