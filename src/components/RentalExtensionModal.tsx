import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { formatDate } from '../utils/date';
import { resolveLatestMachinesWithSwapStatus } from '../utils/rentalPeriods';
import SearchableSelect from './SearchableSelect';
import type { Equipment, RentalInvoiceEquipment } from '../types';

function addDaysToDateStr(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

interface MachineExtensionItem {
  tempId: string;
  original_equipment_id: string;
  original_asset_number?: string;
  original_equipment_name?: string;
  equipment_id: string;
  equipment_name: string;
  equipment_type?: string;
  equipment_size?: string;
  asset_number?: string;
  serial_number?: string;
  last_period_start?: string;
  last_period_end?: string;
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
  availableEquipments?: Equipment[];
  onSuccess: (result: any) => void;
}

function buildExtensionItem(
  eq: RentalInvoiceEquipment & { tempId?: string },
  catalog: Equipment[]
): MachineExtensionItem {
  const lastStart = eq.billing_period_start ? String(eq.billing_period_start).split('T')[0] : '';
  const lastEnd = eq.billing_period_end ? String(eq.billing_period_end).split('T')[0] : '';

  let durationDays = 30;
  if (lastStart && lastEnd) {
    const s = new Date(lastStart).getTime();
    const e = new Date(lastEnd).getTime();
    const d = Math.round((e - s) / (1000 * 60 * 60 * 24));
    if (d > 0) durationDays = d + 1;
  }

  const suggestedStart = lastEnd ? addDaysToDateStr(lastEnd, 1) : new Date().toISOString().split('T')[0];
  const suggestedEnd = addDaysToDateStr(suggestedStart, durationDays - 1);

  const r = Number(eq.cost_rental) || 0;
  const i = Number(eq.cost_insurance) || 0;
  const f = 0; // Frete zerado por padrão no novo período
  const rcd = Number(eq.cost_rcd) || 0;
  const tp = Number(eq.cost_third_party) || 0;
  const tr = Number(eq.cost_training) || 0;
  const total = r + i + f + rcd + tp + tr;

  const catalogMatch = catalog.find((c) => c.id === eq.equipment_id);

  return {
    tempId: Math.random().toString(36).substring(2, 9),
    original_equipment_id: eq.equipment_id,
    original_asset_number: eq.asset_number || catalogMatch?.asset_number || '',
    original_equipment_name: eq.equipment_name || catalogMatch?.name || 'Equipamento',
    equipment_id: eq.equipment_id,
    equipment_name: eq.equipment_name || catalogMatch?.name || 'Equipamento',
    equipment_type: eq.equipment_type || catalogMatch?.type || '',
    equipment_size: eq.equipment_size || (catalogMatch?.height ? `${catalogMatch.height}m` : ''),
    asset_number: eq.asset_number || catalogMatch?.asset_number || '',
    serial_number: eq.serial_number || catalogMatch?.serial_number || '',
    last_period_start: lastStart,
    last_period_end: lastEnd,
    billing_period_start: suggestedStart,
    billing_period_end: suggestedEnd,
    cost_rental: r,
    cost_insurance: i,
    cost_freight: f,
    cost_rcd: rcd,
    cost_third_party: tp,
    cost_training: tr,
    total_value: total,
    notes: 'Prorrogação de locação',
  };
}

export const RentalExtensionModal: React.FC<RentalExtensionModalProps> = ({
  isOpen,
  onClose,
  rentalId,
  invoiceNumber,
  equipments,
  availableEquipments,
  onSuccess,
}) => {
  const [items, setItems] = useState<MachineExtensionItem[]>([]);
  const [removedItems, setRemovedItems] = useState<MachineExtensionItem[]>([]);
  const [supersededMachines, setSupersededMachines] = useState<(RentalInvoiceEquipment & { tempId?: string })[]>([]);
  const [catalogEquipments, setCatalogEquipments] = useState<Equipment[]>(availableEquipments || []);
  const [billDueDate, setBillDueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sincronizar catálogo de equipamentos para permitir troca de máquina na prorrogação
  useEffect(() => {
    if (availableEquipments && availableEquipments.length > 0) {
      setCatalogEquipments(availableEquipments);
      return;
    }
    if (isOpen && catalogEquipments.length === 0) {
      api
        .get('/equipments')
        .then((res) => {
          if (Array.isArray(res.data)) {
            setCatalogEquipments(res.data);
          }
        })
        .catch((err) => {
          console.warn('Não foi possível carregar catálogo de equipamentos para prorrogação:', err);
        });
    }
  }, [isOpen, availableEquipments, catalogEquipments.length]);

  // Valor total anterior consolidado de toda a locação
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

  // Inicializa os itens de extensão apenas com as máquinas ativas do ciclo atual (descartando máquinas substituídas)
  useEffect(() => {
    if (isOpen && equipments && equipments.length > 0) {
      setErrorMessage(null);
      setRemovedItems([]);
      setBillDueDate(new Date().toISOString().split('T')[0]);

      const catalog = availableEquipments && availableEquipments.length > 0
        ? availableEquipments
        : catalogEquipments;

      const { activeMachines, supersededMachines: superseded } =
        resolveLatestMachinesWithSwapStatus(equipments);

      setSupersededMachines(superseded);

      if (activeMachines.length === 0) {
        setErrorMessage('Todas as máquinas desta locação já foram devolvidas.');
        setItems([]);
        return;
      }

      setItems(activeMachines.map((eq) => buildExtensionItem(eq, catalog)));
    }
  }, [isOpen, equipments]);

  // Total deste novo período de prorrogação (a lançar em bills)
  const extensionTotal = useMemo(() => {
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

  const newConsolidatedTotal = previousTotal + extensionTotal;

  const hasInvalidDates = useMemo(() => {
    return items.some((item) => {
      if (!item.billing_period_start || !item.billing_period_end) return true;
      if (item.billing_period_end < item.billing_period_start) return true;
      return false;
    });
  }, [items]);

  const handleFieldChange = (index: number, field: keyof MachineExtensionItem, value: any) => {
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

  const handleMachineChange = (index: number, newEquipmentId: string) => {
    const selected = catalogEquipments.find((e) => e.id === newEquipmentId);
    if (!selected) return;

    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        equipment_id: selected.id,
        equipment_name: selected.name,
        equipment_type: selected.type || '',
        equipment_size: selected.height ? `${selected.height}m` : '',
        asset_number: selected.asset_number || '',
        serial_number: selected.serial_number || '',
      };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    const target = items[index];
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    if (target) {
      setRemovedItems((prev) => [...prev, target]);
    }
  };

  const handleRestoreRemoved = () => {
    if (removedItems.length === 0) return;
    setItems((prev) => [...prev, ...removedItems]);
    setRemovedItems([]);
  };

  const handleIncludeSuperseded = () => {
    if (supersededMachines.length === 0) return;
    const extraItems = supersededMachines.map((eq) => buildExtensionItem(eq, catalogEquipments));
    setItems((prev) => [...prev, ...extraItems]);
    setSupersededMachines([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      setErrorMessage('Nenhum equipamento disponível para prorrogação.');
      return;
    }

    if (hasInvalidDates) {
      setErrorMessage('Verifique as datas da prorrogação. As datas de início e fim devem estar preenchidas e a data final deve ser posterior ou igual à inicial.');
      return;
    }

    if (extensionTotal <= 0) {
      setErrorMessage('O valor do novo período de prorrogação deve ser superior a zero.');
      return;
    }

    if (!billDueDate) {
      setErrorMessage('Informe a data de vencimento da conta a receber.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = {
        extensions: items.map((it) => ({
          equipment_id: it.equipment_id,
          equipment_name: it.equipment_name,
          equipment_type: it.equipment_type,
          equipment_size: it.equipment_size,
          asset_number: it.asset_number,
          replaced_from_equipment_id:
            it.original_equipment_id && it.original_equipment_id !== it.equipment_id
              ? it.original_equipment_id
              : undefined,
          previous_period_end: it.last_period_end || undefined,
          billing_period_start: it.billing_period_start,
          billing_period_end: it.billing_period_end,
          cost_rental: Number(it.cost_rental) || 0,
          cost_insurance: Number(it.cost_insurance) || 0,
          cost_freight: Number(it.cost_freight) || 0,
          cost_rcd: Number(it.cost_rcd) || 0,
          cost_third_party: Number(it.cost_third_party) || 0,
          cost_training: Number(it.cost_training) || 0,
          total_value: it.total_value,
          notes: it.notes || 'Prorrogação de locação',
        })),
        due_date: billDueDate,
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
                  <span>Lançar Prorrogação de Período</span>
                  {invoiceNumber && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                      #{invoiceNumber}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Adicione um novo período para os equipamentos da locação. Você pode alterar a máquina ou excluir períodos excedentes antes de confirmar.
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
            <div className="p-6 pb-10 overflow-y-auto space-y-6 flex-1">
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-xs font-medium flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl flex-shrink-0">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Configuração de Vencimento da Conta a Receber */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl">payments</span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">Conta a Receber do Novo Período</h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Defina a data de vencimento para a cobrança gerada desta prorrogação.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Vencimento:
                  </label>
                  <input
                    type="date"
                    required
                    value={billDueDate}
                    onChange={(e) => setBillDueDate(e.target.value)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-500/40 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>

              {/* Avisos de máquinas substituídas / períodos removidos */}
              {supersededMachines.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 text-sky-800 dark:text-sky-300 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-sky-600 dark:text-sky-400">swap_horiz</span>
                    <span>
                      Equipamento(s) substituído(s) em período anterior omitido(s) automaticamente:{' '}
                      <strong className="font-mono">
                        {supersededMachines.map((m) => m.asset_number || m.equipment_name).join(', ')}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleIncludeSuperseded}
                    className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 dark:bg-sky-500/20 dark:hover:bg-sky-500/30 text-sky-700 dark:text-sky-200 transition-colors cursor-pointer"
                  >
                    Incluir mesmo assim
                  </button>
                </div>
              )}

              {removedItems.length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {removedItems.length}{' '}
                    {removedItems.length === 1 ? 'período removido desta prorrogação.' : 'períodos removidos desta prorrogação.'}
                  </span>
                  <button
                    type="button"
                    onClick={handleRestoreRemoved}
                    className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    Restaurar removidos
                  </button>
                </div>
              )}

              {/* Lista de Máquinas a Prorrogar */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">precision_manufacturing</span>
                  Equipamentos da Locação ({items.length})
                </h4>

                {items.map((item, index) => {
                  const isSwapped = Boolean(
                    item.original_equipment_id &&
                      item.equipment_id &&
                      item.equipment_id !== item.original_equipment_id
                  );

                  const selectOptions: Equipment[] = catalogEquipments.some((e) => e.id === item.equipment_id)
                    ? catalogEquipments
                    : [
                        ...catalogEquipments,
                        ...(item.equipment_id
                          ? [
                              {
                                id: item.equipment_id,
                                asset_number: item.asset_number || '',
                                name: item.equipment_name || 'Equipamento',
                                type: item.equipment_type || '',
                                model: '',
                                serial_number: item.serial_number || '',
                                status: 'Locado' as const,
                                manufacture_year: 0,
                                value: 0,
                                unit: 'UN',
                                created_at: '',
                                updated_at: '',
                              },
                            ]
                          : []),
                      ];

                  return (
                    <div
                      key={item.tempId || index}
                      className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-4 shadow-sm"
                    >
                      {/* Header do Equipamento */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            #{index + 1}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {item.asset_number ? `${item.asset_number} - ` : ''}
                            {item.equipment_name}
                          </span>
                          {item.serial_number && (
                            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                              Série: {item.serial_number}
                            </span>
                          )}
                          {(item.equipment_type || item.equipment_size) && (
                            <span className="text-xs text-slate-400 font-mono">
                              ({[item.equipment_type, item.equipment_size].filter(Boolean).join(' - ')})
                            </span>
                          )}
                          {item.last_period_end && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              Último término: {formatDate(item.last_period_end)}
                            </span>
                          )}
                          {isSwapped && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
                              Substituindo {item.original_asset_number || item.original_equipment_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs font-bold text-mustard-600 dark:text-mustard-400 font-mono">
                            Subtotal do Período: {item.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveItem(index)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              items.length > 1
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer'
                                : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                            }`}
                            title={
                              items.length > 1
                                ? 'Excluir este período da prorrogação'
                                : 'A prorrogação deve manter ao menos 1 período'
                            }
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Seletor de Equipamento (Permite trocar a máquina diretamente na prorrogação) */}
                      <div>
                        <SearchableSelect
                          label="Máquina / Equipamento deste Período"
                          placeholder="Selecione o equipamento..."
                          searchPlaceholder="Buscar por patrimônio, nome, modelo ou série..."
                          items={selectOptions}
                          selectedId={item.equipment_id}
                          onSelect={(eId) => handleMachineChange(index, eId)}
                          getDisplayValue={(e) =>
                            `${e.asset_number ? `${e.asset_number} - ` : ''}${e.name}${e.serial_number ? ` (Série: ${e.serial_number})` : ''}`
                          }
                          getSearchValue={(e) =>
                            `${e.name} ${e.asset_number || ''} ${e.serial_number || ''} ${e.model || ''} ${e.type || ''}`
                          }
                          labelClassName="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block ml-0.5"
                          required
                        />
                      </div>

                      {/* Period Section (Totalmente Editável: Início e Fim) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                            <span>Novo Início do Período *</span>
                            <span className="text-[10px] text-amber-500 font-normal">livre escolha</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={item.billing_period_start}
                            onChange={(e) => handleFieldChange(index, 'billing_period_start', e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                            <span>Novo Fim do Período *</span>
                            <span className="text-[10px] text-amber-500 font-normal">livre escolha</span>
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
                          <span>Valores para Este Novo Período (R$)</span>
                          <span className="text-[10px] text-amber-500 font-normal">ajustáveis</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                          {[
                            { key: 'cost_rental', label: 'Locação' },
                            { key: 'cost_insurance', label: 'Seguro' },
                            { key: 'cost_freight', label: 'Frete' },
                            { key: 'cost_rcd', label: 'RCD' },
                            { key: 'cost_third_party', label: 'Terceiros' },
                            { key: 'cost_training', label: 'Treinamento' },
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total da Locação Anterior</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
                    {previousTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <div className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                    Valor a Lançar (Novo Período)
                  </span>
                  <span className="text-sm font-bold flex items-center gap-1 font-mono">
                    +{extensionTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    <span className="text-[10px] font-normal opacity-80">(Conta a Receber)</span>
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Novo Total Acumulado</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                    {newConsolidatedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                  disabled={submitting || hasInvalidDates || extensionTotal <= 0}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                      <span>Lançar Prorrogação</span>
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
