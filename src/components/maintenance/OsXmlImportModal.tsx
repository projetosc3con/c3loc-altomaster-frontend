import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { formatDate } from '../../utils/date';
import type { ParsedNfeData, NfeInvoiceReference, ServiceOrderPart, MaterialCategory } from '../../types';

interface OsXmlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (nfeRef: NfeInvoiceReference, partsForOs: ServiceOrderPart[]) => void;
}

interface ItemOsConfig {
  selected_for_os: boolean;
  quantity_for_os: number;
  category: MaterialCategory;
  custom_name: string;
}

interface InstallmentItem {
  installment_number: number;
  due_date: string;
  value: number;
  amount?: number;
}

const OsXmlImportModal: React.FC<OsXmlImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xmlString, setXmlString] = useState<string>('');
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'xml' | 'pdf' | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedNfeData | null>(null);
  const [itemConfigs, setItemConfigs] = useState<Record<number, ItemOsConfig>>({});

  // Financeiro (opcional)
  const [paymentType, setPaymentType] = useState<'a_vista' | 'parcelado' | 'nenhum'>('nenhum');
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [installments, setInstallments] = useState<InstallmentItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isXml = lowerName.endsWith('.xml');
    const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';

    if (!isXml && !isPdf) {
      setError('Por favor, selecione um arquivo XML ou PDF (DANFE) de NF-e válido.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setFileName(file.name);

      let parsed: ParsedNfeData;

      if (isPdf) {
        setFileType('pdf');
        setXmlString('');
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const b64 = res.split(',')[1] || res;
            resolve(b64);
          };
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
        setPdfBase64(base64Data);

        const response = await api.post('/fiscal/nfe/parse', {
          pdf_base64: base64Data,
          file_name: file.name,
        });
        parsed = response.data;
      } else {
        setFileType('xml');
        setPdfBase64(null);
        const text = await file.text();
        setXmlString(text);

        const response = await api.post('/fiscal/nfe/parse', { xml: text });
        parsed = response.data;
      }

      setParsedData(parsed);

      // Pre-populate items configuration
      const initialConfigs: Record<number, ItemOsConfig> = {};
      parsed.items.forEach(item => {
        initialConfigs[item.item_index] = {
          selected_for_os: true, // Default to true for OS
          quantity_for_os: item.quantity,
          category: 'Peça',
          custom_name: item.description,
        };
      });
      setItemConfigs(initialConfigs);

      // Pre-populate installments from parsed data
      const total = Number(parsed.totals?.total_invoice || 0);
      if (parsed.installments && parsed.installments.length > 0) {
        setPaymentType('parcelado');
        setInstallmentsCount(parsed.installments.length);
        setInstallments(
          parsed.installments.map((p, idx) => {
            const instVal = Number(p.amount || (total > 0 ? total / parsed.installments.length : 0));
            return {
              installment_number: idx + 1,
              due_date: p.due_date || new Date().toISOString().split('T')[0],
              value: instVal,
              amount: instVal,
            };
          })
        );
      } else {
        setPaymentType('nenhum');
        setInstallmentsCount(1);
        setInstallments([
          {
            installment_number: 1,
            due_date: new Date().toISOString().split('T')[0],
            value: total,
            amount: total,
          },
        ]);
      }

      setStep('review');
    } catch (err: any) {
      console.error('Erro ao processar NF-e:', err);
      setError(err.response?.data?.error || 'Falha ao interpretar o arquivo da NF-e.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = (index: number) => {
    setItemConfigs(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        selected_for_os: !prev[index]?.selected_for_os,
      },
    }));
  };

  const handleUpdateQtyForOs = (index: number, val: number, maxQty: number) => {
    const safeVal = Math.max(0, Math.min(val, maxQty));
    setItemConfigs(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        quantity_for_os: safeVal,
      },
    }));
  };

  const handleUpdateCategory = (index: number, cat: MaterialCategory) => {
    setItemConfigs(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        category: cat,
      },
    }));
  };

  const handleGenerateInstallments = (count: number) => {
    if (!parsedData) return;
    const safeCount = Math.max(1, Math.min(count, 36));
    setInstallmentsCount(safeCount);
    const total = Number(parsedData.totals?.total_invoice || 0);

    // If matches original XML count and XML has installments
    if (parsedData.installments && parsedData.installments.length === safeCount) {
      setInstallments(
        parsedData.installments.map((p, idx) => {
          const instVal = Number(p.amount || (total > 0 ? total / safeCount : 0));
          return {
            installment_number: idx + 1,
            due_date: p.due_date || new Date().toISOString().split('T')[0],
            value: instVal,
            amount: instVal,
          };
        })
      );
      return;
    }

    const baseAmount = Math.floor((total / safeCount) * 100) / 100;
    const remainder = Number((total - baseAmount * safeCount).toFixed(2));
    const baseDate = new Date(parsedData.issue_date || new Date());
    const newInst: InstallmentItem[] = [];

    for (let i = 0; i < safeCount; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i + 1);
      const dateStr = d.toISOString().split('T')[0];
      const amount = i === safeCount - 1 ? Number((baseAmount + remainder).toFixed(2)) : baseAmount;
      newInst.push({
        installment_number: i + 1,
        due_date: dateStr,
        value: amount,
        amount,
      });
    }
    setInstallments(newInst);
  };

  const handlePaymentTypeChange = (newType: 'a_vista' | 'parcelado' | 'nenhum') => {
    setPaymentType(newType);
    if (!parsedData) return;

    const total = Number(parsedData.totals?.total_invoice || 0);
    const defaultDate = parsedData.issue_date ? parsedData.issue_date.split('T')[0] : new Date().toISOString().split('T')[0];

    if (newType === 'nenhum') {
      setInstallments([]);
      setInstallmentsCount(0);
    } else if (newType === 'a_vista') {
      setInstallmentsCount(1);
      setInstallments([
        {
          installment_number: 1,
          due_date: defaultDate,
          value: total,
          amount: total,
        },
      ]);
    } else if (newType === 'parcelado') {
      const defaultCount = parsedData.installments && parsedData.installments.length > 1
        ? parsedData.installments.length
        : 2;
      handleGenerateInstallments(defaultCount);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData || (!xmlString && !pdfBase64)) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Build destination payload for /fiscal/nfe/process
      const destinations: Record<number, any> = {};
      const itemsPayload: any[] = [];
      parsedData.items.forEach(item => {
        const cfg = itemConfigs[item.item_index];
        const cat = cfg?.category || 'Peça';
        let dest = 'part_peca';
        if (cat === 'Consumo') dest = 'part_consumo';
        else if (cat === 'EPI') dest = 'part_epi';
        else if (cat === 'Outros') dest = 'part_outros';

        const itemDest = {
          destination: dest,
          custom_name: cfg?.custom_name || item.description,
        };
        destinations[item.item_index] = itemDest;
        itemsPayload.push({
          item_index: item.item_index,
          ...itemDest,
        });
      });

      // 2. Call process endpoint to ingest into DB (parts & bills)
      const formattedInstallments = installments.map(inst => ({
        installment_number: inst.installment_number,
        due_date: inst.due_date,
        amount: Number(inst.value || inst.amount || 0),
        value: Number(inst.value || inst.amount || 0),
      }));

      const payload = {
        xml: xmlString || '',
        pdf_base64: pdfBase64 || null,
        parsed_data: parsedData,
        items_config: itemsPayload,
        destinations,
        payment_config: {
          type: paymentType,
          installments: paymentType !== 'nenhum' ? formattedInstallments : [],
        },
      };

      await api.post('/fiscal/nfe/process', payload);

      // 3. Fetch current parts from database to match the newly inserted/updated parts
      const { data: allParts } = await api.get('/parts');

      // 4. Build selected parts to be consumed in OS
      const partsForOs: ServiceOrderPart[] = [];

      parsedData.items.forEach(item => {
        const cfg = itemConfigs[item.item_index];
        if (cfg && cfg.selected_for_os && cfg.quantity_for_os > 0) {
          // Find matching part by part_number or description
          const foundPart = (allParts || []).find(
            (p: any) =>
              (p.part_number && p.part_number === item.product_code) ||
              p.description.toLowerCase().trim() === (cfg.custom_name || item.description).toLowerCase().trim() ||
              (p.invoice_number === parsedData.invoice_number && p.description.toLowerCase().includes(item.description.toLowerCase().slice(0, 10)))
          );

          if (foundPart) {
            partsForOs.push({
              id: '',
              service_order_id: '',
              part_id: foundPart.id,
              quantity_used: cfg.quantity_for_os,
              unit_value_at_use: Number(foundPart.unit_value || item.unit_value || 0),
              subtotal: cfg.quantity_for_os * Number(foundPart.unit_value || item.unit_value || 0),
              was_used: true,
              part_description: foundPart.description,
              internal_code: foundPart.internal_code,
              part_number: foundPart.part_number,
              parts: foundPart,
            });
          }
        }
      });

      // 5. Build linked NF reference
      const nfeRef: NfeInvoiceReference = {
        access_key: parsedData.access_key,
        invoice_number: parsedData.invoice_number,
        series: parsedData.series,
        issuer_name: parsedData.issuer?.name || 'Fornecedor',
        issuer_cnpj: parsedData.issuer?.cnpj,
        issue_date: parsedData.issue_date,
        total_invoice: parsedData.totals?.total_invoice || 0,
      };

      onSuccess(nfeRef, partsForOs);
      onClose();
    } catch (err: any) {
      console.error('Erro ao efetivar importação da NF-e para a OS:', err);
      setError(err.response?.data?.error || err.message || 'Falha ao salvar itens da NF-e.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-mustard-500/10 text-mustard-600 dark:text-mustard-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                Importar NF-e para Ordem de Serviço
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-mustard-100 dark:bg-mustard-500/20 text-mustard-700 dark:text-mustard-400">
                  XML ou PDF
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cadastre as peças no estoque e selecione os itens consumidos nesta OS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm flex items-start gap-3">
              <span className="material-symbols-outlined text-red-500 mt-0.5 text-lg">error</span>
              <div>
                <p className="font-bold">Erro ao processar NF-e</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-6 py-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-mustard-500 dark:hover:border-mustard-500 rounded-3xl p-10 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-800/20 hover:bg-mustard-50/30 dark:hover:bg-mustard-500/5 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xml,.pdf,application/pdf"
                  className="hidden"
                />
                <div className="w-16 h-16 mx-auto rounded-3xl bg-mustard-500/10 text-mustard-600 dark:text-mustard-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-3xl">upload_file</span>
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  Selecione o arquivo XML ou PDF (DANFE) da NF-e
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Clique ou arraste o arquivo XML ou PDF da nota fiscal emitida pelo fornecedor
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                  <span className="material-symbols-outlined text-sm text-mustard-500">description</span>
                  Formatos aceitos: .xml ou .pdf (DANFE da NF-e)
                </div>
              </div>
            </div>
          )}

          {step === 'review' && parsedData && (
            <div className="space-y-6">
              {/* Header NF-e Info Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-800/60 dark:to-slate-800/20 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">NF-e Nº</span>
                    <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                      {parsedData.invoice_number}
                    </span>
                    <span className="text-xs font-bold text-slate-500">Série {parsedData.series || '1'}</span>
                    {fileName && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                        {fileType?.toUpperCase()}: {fileName}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider mr-2">Valor Total</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {(parsedData.totals?.total_invoice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fornecedor / Emitente</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block" title={parsedData.issuer?.name}>
                      {parsedData.issuer?.name || 'N/A'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">{parsedData.issuer?.cnpj || ''}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data de Emissão</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(parsedData.issue_date)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chave de Acesso</span>
                    <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 select-all truncate block" title={parsedData.access_key}>
                      {parsedData.access_key}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Selection Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-mustard-500 text-lg">format_list_bulleted</span>
                    Itens da NF-e & Seleção para a OS ({parsedData.items.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Marque os itens e a quantidade consumida nesta manutenção
                  </p>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedData.items.map(item => {
                    const cfg = itemConfigs[item.item_index] || {
                      selected_for_os: true,
                      quantity_for_os: item.quantity,
                      category: 'Peça',
                      custom_name: item.description,
                    };

                    return (
                      <div
                        key={item.item_index}
                        className={`p-4 transition-colors ${
                          cfg.selected_for_os
                            ? 'bg-mustard-50/20 dark:bg-mustard-500/5'
                            : 'bg-white dark:bg-slate-900 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Checkbox and Desc */}
                          <div className="flex items-start gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={cfg.selected_for_os}
                              onChange={() => handleToggleItem(item.item_index)}
                              className="mt-1 w-4 h-4 rounded text-mustard-500 focus:ring-mustard-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                            />
                            <div className="space-y-1">
                              <p className="font-bold text-sm text-slate-900 dark:text-white">
                                {item.description}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                                  CÓD: {item.product_code || 'S/N'}
                                </span>
                                <span>•</span>
                                <span>Na NF: <b>{item.quantity} {item.unit || 'UN'}</b></span>
                                <span>•</span>
                                <span>Valor Unit: <b>{item.unit_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></span>
                                <span>•</span>
                                <span>Subtotal: <b>{item.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></span>
                              </div>
                            </div>
                          </div>

                          {/* Controls when item is checked */}
                          {cfg.selected_for_os && (
                            <div className="flex items-center gap-3 self-end sm:self-center bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                              <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                                  Categoria
                                </label>
                                <select
                                  value={cfg.category}
                                  onChange={e => handleUpdateCategory(item.item_index, e.target.value as MaterialCategory)}
                                  className="text-xs font-bold bg-transparent text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                                >
                                  <option value="Peça">Peça</option>
                                  <option value="Consumo">Consumo</option>
                                  <option value="EPI">EPI</option>
                                  <option value="Outros">Outros</option>
                                </select>
                              </div>

                              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

                              <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                                  Qtd na OS ({item.unit || 'UN'})
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  max={item.quantity}
                                  value={cfg.quantity_for_os}
                                  onChange={e => handleUpdateQtyForOs(item.item_index, parseFloat(e.target.value) || 0, item.quantity)}
                                  className="w-20 text-center font-black text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1 text-slate-800 dark:text-slate-200 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financeiro Config (Opcional) */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-mustard-500">payments</span>
                    Lançamento Financeiro (Contas a Pagar)
                  </span>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="payType"
                        value="nenhum"
                        checked={paymentType === 'nenhum'}
                        onChange={() => handlePaymentTypeChange('nenhum')}
                        className="text-mustard-500 focus:ring-mustard-500 cursor-pointer"
                      />
                      <span className={`font-medium ${paymentType === 'nenhum' ? 'text-mustard-600 dark:text-mustard-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>Não lançar</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="payType"
                        value="a_vista"
                        checked={paymentType === 'a_vista'}
                        onChange={() => handlePaymentTypeChange('a_vista')}
                        className="text-mustard-500 focus:ring-mustard-500 cursor-pointer"
                      />
                      <span className={`font-medium ${paymentType === 'a_vista' ? 'text-mustard-600 dark:text-mustard-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>À Vista</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="payType"
                        value="parcelado"
                        checked={paymentType === 'parcelado'}
                        onChange={() => handlePaymentTypeChange('parcelado')}
                        className="text-mustard-500 focus:ring-mustard-500 cursor-pointer"
                      />
                      <span className={`font-medium ${paymentType === 'parcelado' ? 'text-mustard-600 dark:text-mustard-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>Parcelado</span>
                    </label>
                  </div>
                </div>

                {paymentType === 'nenhum' && (
                  <p className="text-xs text-slate-400 italic">
                    Os materiais serão incluídos no estoque sem gerar títulos em contas a pagar.
                  </p>
                )}

                {paymentType === 'a_vista' && (
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Data de Vencimento (À Vista)
                      </span>
                      <input
                        type="date"
                        value={installments[0]?.due_date || ''}
                        onChange={e => {
                          const newInst = [...installments];
                          if (newInst[0]) {
                            newInst[0].due_date = e.target.value;
                            setInstallments(newInst);
                          }
                        }}
                        className="mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium text-xs outline-none"
                      />
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Valor a Pagar
                      </span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {(installments[0]?.value || Number(parsedData.totals?.total_invoice || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                )}

                {paymentType === 'parcelado' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        Número de Parcelas:
                      </span>
                      <select
                        value={installmentsCount}
                        onChange={e => handleGenerateInstallments(parseInt(e.target.value, 10))}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map(n => (
                          <option key={n} value={n}>
                            {n}x de {(Number(parsedData.totals?.total_invoice || 0) / n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {installments.map((inst, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-500">Parcela {inst.installment_number}</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                              {inst.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase">Vencimento</label>
                            <input
                              type="date"
                              value={inst.due_date}
                              onChange={e => {
                                const newInst = [...installments];
                                newInst[idx].due_date = e.target.value;
                                setInstallments(newInst);
                              }}
                              className="w-full mt-0.5 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 outline-none text-xs"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
          <button
            type="button"
            onClick={step === 'review' ? () => setStep('upload') : onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            disabled={loading}
          >
            {step === 'review' ? 'Voltar / Trocar Arquivo' : 'Cancelar'}
          </button>

          {step === 'review' && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-mustard-500 hover:bg-mustard-600 transition-all shadow-lg shadow-mustard-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Importando & Vinculando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Confirmar Importação & Vincular à OS
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default OsXmlImportModal;
