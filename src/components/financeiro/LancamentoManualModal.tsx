import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { financeiroService } from '../../services/financeiro';
import { getApiErrorMessage } from '../../utils/apiError';
import type { Bill, BillType, BillStatus } from '../../types';

interface LancamentoManualModalInitialValues {
  counterparty_name?: string;
  description?: string;
  gross_value?: number;
  due_date?: string;
}

// Quando presente, indica que este lançamento está sendo criado a partir de
// uma linha do extrato bancário já conciliada (ver ConciliacaoTab) — o
// lançamento nasce já marcado como conciliado com o banco.
interface LancamentoManualModalPresetSettlement {
  settled_date: string;
  bank_transaction_date: string;
  bank_raw_snapshot: Record<string, unknown>;
}

interface LancamentoManualModalProps {
  isOpen: boolean;
  type: BillType;
  onClose: () => void;
  onCreated: (bill: Bill) => void;
  initialValues?: LancamentoManualModalInitialValues;
  presetSettlement?: LancamentoManualModalPresetSettlement;
}

interface InstallmentRow {
  installment_number: number;
  due_date: string;
  amount: number;
}

const STATUS_OPTIONS: BillStatus[] = ['Pendente', 'Atrasado', 'Recebido', 'Divergente', 'No prazo'];

const LancamentoManualModal: React.FC<LancamentoManualModalProps> = ({
  isOpen,
  type,
  onClose,
  onCreated,
  initialValues,
  presetSettlement,
}) => {
  const { user } = useAuth();
  const [counterpartyName, setCounterpartyName] = useState('');
  const [description, setDescription] = useState('');
  const [barcode, setBarcode] = useState('');
  const [grossValue, setGrossValue] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<BillStatus>('Pendente');
  const [isReconciled, setIsReconciled] = useState(false);
  const [settledDate, setSettledDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Boleto PDF attachment state
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [uploadingBoleto, setUploadingBoleto] = useState(false);

  // Parcelamento states
  const [paymentType, setPaymentType] = useState<'a_vista' | 'parcelado'>('a_vista');
  const [numInstallments, setNumInstallments] = useState<number>(2);
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialValues) {
      if (initialValues.counterparty_name !== undefined) setCounterpartyName(initialValues.counterparty_name);
      if (initialValues.description !== undefined) setDescription(initialValues.description);
      if (initialValues.gross_value !== undefined) setGrossValue(initialValues.gross_value);
      if (initialValues.due_date !== undefined) setDueDate(initialValues.due_date);
    }
    if (presetSettlement) {
      setIsReconciled(true);
      setStatus('Recebido');
      setSettledDate(presetSettlement.settled_date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isReceivable = type === 'receivable';
  const title = isReceivable ? 'Lançar Conta a Receber' : 'Lançar Conta a Pagar';
  const icon = isReceivable ? 'trending_up' : 'trending_down';

  const resetForm = () => {
    setCounterpartyName('');
    setDescription('');
    setBarcode('');
    setBoletoFile(null);
    setUploadingBoleto(false);
    setGrossValue(0);
    setDueDate('');
    setStatus('Pendente');
    setIsReconciled(false);
    setSettledDate('');
    setPaymentType('a_vista');
    setNumInstallments(2);
    setInstallments([]);
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const generateInstallments = (count: number, total: number, firstDueDate: string) => {
    setNumInstallments(count);
    if (count <= 1) {
      setInstallments([]);
      return;
    }
    const baseAmount = Math.floor((total / count) * 100) / 100;
    const remainder = Number((total - baseAmount * count).toFixed(2));
    const newInst: InstallmentRow[] = [];

    let baseDate = new Date();
    if (firstDueDate) {
      const [y, m, d] = firstDueDate.split('-').map(Number);
      baseDate = new Date(y, m - 1, d);
    }

    for (let i = 0; i < count; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const amount = i === count - 1 ? Number((baseAmount + remainder).toFixed(2)) : baseAmount;

      newInst.push({
        installment_number: i + 1,
        due_date: dateStr,
        amount,
      });
    }
    setInstallments(newInst);
  };

  const handleSelectPaymentType = (pType: 'a_vista' | 'parcelado') => {
    setPaymentType(pType);
    if (pType === 'parcelado') {
      const count = numInstallments > 1 ? numInstallments : 2;
      generateInstallments(count, grossValue, dueDate);
    } else {
      setInstallments([]);
    }
  };

  const handleGrossValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const val = Number(rawValue) / 100;
    setGrossValue(val);
    if (paymentType === 'parcelado' && numInstallments > 1) {
      generateInstallments(numInstallments, val, dueDate);
    }
  };

  const handleDueDateChange = (newDate: string) => {
    setDueDate(newDate);
    if (paymentType === 'parcelado' && installments.length > 0) {
      let baseDate = new Date();
      if (newDate) {
        const [y, m, d] = newDate.split('-').map(Number);
        baseDate = new Date(y, m - 1, d);
      }
      setInstallments((prev) =>
        prev.map((inst, idx) => {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + idx);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return {
            ...inst,
            due_date: `${yyyy}-${mm}-${dd}`,
          };
        })
      );
    }
  };

  const handleInstallmentChange = (index: number, field: 'due_date' | 'amount', value: any) => {
    setInstallments((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: field === 'amount' ? (parseFloat(value) || 0) : value,
      };
      return updated;
    });
  };

  const handleAdjustDifference = () => {
    if (installments.length === 0) return;
    setInstallments((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      const currentLastAmount = Number(updated[lastIdx].amount) || 0;
      updated[lastIdx] = {
        ...updated[lastIdx],
        amount: Number((currentLastAmount + difference).toFixed(2)),
      };
      return updated;
    });
  };

  const totalInstallmentsAmount = installments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const difference = Number((grossValue - totalInstallmentsAmount).toFixed(2));

  const handleSubmit = async () => {
    setError(null);

    if (!grossValue || grossValue <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    if (!dueDate) {
      setError('Informe a data de vencimento.');
      return;
    }

    if (!isReceivable && paymentType === 'parcelado') {
      if (installments.length < 2) {
        setError('O parcelamento deve conter no mínimo 2 parcelas.');
        return;
      }
      if (Math.abs(difference) > 0.01) {
        setError(
          `A soma das parcelas (R$ ${totalInstallmentsAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) deve ser igual ao valor total informado (R$ ${grossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`
        );
        return;
      }
      for (let i = 0; i < installments.length; i++) {
        if (!installments[i].due_date) {
          setError(`Informe a data de vencimento da parcela ${i + 1}.`);
          return;
        }
        if (installments[i].amount <= 0) {
          setError(`O valor da parcela ${i + 1} deve ser maior que zero.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      let bankSlipUrl: string | undefined = undefined;

      if (!isReceivable && boletoFile) {
        setUploadingBoleto(true);
        const cleanName = boletoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `contas-pagar/boleto_${Date.now()}_${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from('boletos')
          .upload(filePath, boletoFile, { cacheControl: '3600', upsert: true });

        if (uploadError) {
          throw new Error(`Erro ao fazer upload do boleto: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage.from('boletos').getPublicUrl(filePath);
        bankSlipUrl = urlData.publicUrl;
      }

      const isParcelado = !isReceivable && paymentType === 'parcelado' && installments.length > 1;
      const bill = await financeiroService.criarLancamentoManual({
        type,
        counterparty_name: counterpartyName.trim() || undefined,
        description: description.trim() || undefined,
        barcode: isReceivable ? undefined : barcode.trim() || undefined,
        bank_slip_url: bankSlipUrl,
        gross_value: grossValue,
        due_date: dueDate,
        status,
        is_reconciled: isReconciled,
        already_settled: isReconciled,
        settled_date: isReconciled ? (settledDate || dueDate || new Date().toISOString().split('T')[0]) : undefined,
        bank_transaction_date: presetSettlement?.bank_transaction_date,
        bank_raw_snapshot: presetSettlement?.bank_raw_snapshot,
        created_by: user?.id,
        payment_type: isParcelado ? 'parcelado' : 'a_vista',
        installments: isParcelado
          ? installments.map((inst, idx) => ({
              installment_number: inst.installment_number || idx + 1,
              due_date: inst.due_date,
              gross_value: Number(inst.amount),
            }))
          : undefined,
      });
      onCreated(bill);
      resetForm();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
      setUploadingBoleto(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center gap-3 mb-5 shrink-0">
              <div className="w-12 h-12 bg-mustard-100 dark:bg-mustard-500/10 rounded-2xl flex items-center justify-center text-mustard-500">
                <span className="material-symbols-outlined text-2xl">{icon}</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {isReceivable
                    ? 'Registro de receita manual avulsa'
                    : 'Registro de despesa com suporte a parcelas e vencimentos'}
                </p>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {!isReceivable && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                    Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleSelectPaymentType('a_vista')}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                        paymentType === 'a_vista'
                          ? 'border-mustard-500 bg-mustard-50/50 dark:bg-mustard-500/10 ring-2 ring-mustard-500/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/40'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-xl ${
                          paymentType === 'a_vista' ? 'text-mustard-600 dark:text-mustard-400' : 'text-slate-400'
                        }`}
                      >
                        monetization_on
                      </span>
                      <div>
                        <span className="block font-bold text-xs text-slate-900 dark:text-white">À Vista (1x)</span>
                        <span className="text-[11px] text-slate-500">Lançamento integral</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectPaymentType('parcelado')}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                        paymentType === 'parcelado'
                          ? 'border-mustard-500 bg-mustard-50/50 dark:bg-mustard-500/10 ring-2 ring-mustard-500/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/40'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-xl ${
                          paymentType === 'parcelado' ? 'text-mustard-600 dark:text-mustard-400' : 'text-slate-400'
                        }`}
                      >
                        view_agenda
                      </span>
                      <div>
                        <span className="block font-bold text-xs text-slate-900 dark:text-white">Parcelado</span>
                        <span className="text-[11px] text-slate-500">Divide em N parcelas</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {isReceivable ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={counterpartyName}
                    onChange={(e) => setCounterpartyName(e.target.value)}
                    placeholder="Nome de quem vai pagar (opcional)"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                      Descrição
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Detalhes ou identificador da despesa (ex: Aluguel Galpão, Manutenção)"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                        Fornecedor / Favorecido
                      </label>
                      <input
                        type="text"
                        value={counterpartyName}
                        onChange={(e) => setCounterpartyName(e.target.value)}
                        placeholder="Nome do fornecedor (opcional)"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                        Código de Barras / Boleto
                      </label>
                      <input
                        type="text"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder="Linha digitável ou código de barras"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm font-mono"
                      />
                    </div>
                  </div>

                  {/* Anexo do Boleto Bancário (PDF) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-rose-500">picture_as_pdf</span>
                        Anexar Boleto Bancário (PDF)
                      </label>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">Opcional</span>
                    </div>

                    {boletoFile ? (
                      <div className="flex items-center justify-between p-3 bg-rose-50/60 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[22px]">description</span>
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {boletoFile.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {(boletoFile.size / 1024).toFixed(1)} KB • Pronto para envio
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBoletoFile(null)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-100/60 dark:hover:bg-rose-500/20 transition-colors"
                          title="Remover anexo"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-mustard-500/60 dark:hover:border-mustard-500/60 rounded-2xl p-3 flex items-center justify-between gap-3 cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group">
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                                setError('Por favor, selecione apenas arquivos em formato PDF para o boleto.');
                                return;
                              }
                              if (file.size > 20 * 1024 * 1024) {
                                setError('O arquivo PDF deve ter no máximo 20 MB.');
                                return;
                              }
                              setError(null);
                              setBoletoFile(file);
                            }
                          }}
                        />
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-200/70 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:bg-mustard-500/10 group-hover:text-mustard-600 dark:group-hover:text-mustard-400 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-[20px]">upload_file</span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-mustard-600 dark:group-hover:text-mustard-400 transition-colors block">
                              Clique para anexar o PDF do boleto
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              O financeiro poderá consultar e pagar diretamente pelo sistema
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-sm group-hover:border-mustard-500/50">
                          Procurar
                        </span>
                      </label>
                    )}
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                    {paymentType === 'parcelado' ? 'Valor Total *' : 'Valor *'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm font-bold">
                      R$
                    </span>
                    <input
                      type="text"
                      value={grossValue.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      onChange={handleGrossValueChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                    {paymentType === 'parcelado' ? '1º Vencimento *' : 'Vencimento *'}
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm font-mono [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>

              {/* SEÇÃO DE PARCELAMENTO */}
              {!isReceivable && paymentType === 'parcelado' && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Quantidade de Parcelas:
                      </label>
                      <select
                        value={numInstallments}
                        onChange={(e) => {
                          const count = parseInt(e.target.value, 10);
                          generateInstallments(count, grossValue, dueDate);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                      >
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 24].map((n) => (
                          <option key={n} value={n}>
                            {n}x Parcelas
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="text-xs font-bold">
                      Soma das Parcelas:{' '}
                      <span
                        className={
                          Math.abs(difference) <= 0.01
                            ? 'text-emerald-600 dark:text-emerald-400 font-mono font-black'
                            : 'text-red-500 font-mono font-black'
                        }
                      >
                        R$ {totalInstallmentsAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      {Math.abs(difference) > 0.01 && (
                        <span className="text-red-500 ml-1.5 font-normal">
                          (Diferença: R$ {difference.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                        </span>
                      )}
                    </div>
                  </div>

                  {Math.abs(difference) > 0.01 && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-xs">
                      <span className="text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">info</span>
                        A soma das parcelas difere do valor total informado.
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAdjustDifference}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors"
                        >
                          Ajustar na última
                        </button>
                        <button
                          type="button"
                          onClick={() => generateInstallments(numInstallments, grossValue, dueDate)}
                          className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-[11px] transition-colors"
                        >
                          Dividir igualmente
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5 max-h-60 overflow-y-auto">
                    <div className="grid grid-cols-12 gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                      <div className="col-span-3">Parcela</div>
                      <div className="col-span-5">Vencimento</div>
                      <div className="col-span-4 text-right">Valor (R$)</div>
                    </div>

                    {installments.map((inst, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-3 items-center bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium"
                      >
                        <div className="col-span-3 font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <span className="w-5 h-5 rounded-full bg-mustard-50 dark:bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 text-[10px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span>
                            {inst.installment_number || idx + 1}/{installments.length}
                          </span>
                        </div>
                        <div className="col-span-5">
                          <input
                            type="date"
                            value={inst.due_date}
                            onChange={(e) => handleInstallmentChange(idx, 'due_date', e.target.value)}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs [color-scheme:light] dark:[color-scheme:dark]"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="number"
                            step="0.01"
                            value={inst.amount}
                            onChange={(e) => handleInstallmentChange(idx, 'amount', e.target.value)}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-right text-xs font-bold"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Financeiro */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                  Status Financeiro
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as BillStatus)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm font-semibold cursor-pointer"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conciliação */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isReconciled}
                    onChange={(e) => setIsReconciled(e.target.checked)}
                    className="w-4 h-4 text-mustard-500 rounded border-slate-300 dark:border-slate-600 focus:ring-mustard-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Marcar como já conciliado
                  </span>
                </label>
                {isReconciled && (
                  <div className="pt-1">
                    <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                      Data da Conciliação / Quitação
                    </label>
                    <input
                      type="date"
                      value={settledDate || dueDate}
                      onChange={(e) => setSettledDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                )}
              </div>

              {isReceivable && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                    Descrição
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detalhes adicionais (opcional)"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm resize-none"
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl p-3 text-xs font-medium">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                type="button"
                disabled={submitting}
                onClick={handleClose}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl bg-mustard-500 hover:bg-mustard-600 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-mustard-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{uploadingBoleto ? 'Enviando boleto...' : 'Salvando...'}</span>
                  </div>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LancamentoManualModal;
