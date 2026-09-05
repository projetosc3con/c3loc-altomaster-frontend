import React, { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import type { ParsedNfeData, ParsedNfeItem, NfeItemDestination } from '../types';

interface XmlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ItemConfigState {
  item_index: number;
  destination: NfeItemDestination;
  custom_name?: string;
  custom_model?: string;
  custom_serial_number?: string;
  custom_asset_number?: string;
  custom_unit?: string;
  custom_quantity?: number;
  custom_unit_value?: number;
  expanded?: boolean;
}

interface InstallmentState {
  installment_number: string | number;
  due_date: string;
  amount: number;
}

const DESTINATION_OPTIONS: { value: NfeItemDestination; label: string; icon: string; color: string }[] = [
  { value: 'equipment', label: 'Ativo / Equipamento', icon: 'precision_manufacturing', color: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' },
  { value: 'part_peca', label: 'Peça de Reposição', icon: 'build', color: 'bg-mustard-100 text-mustard-800 dark:bg-mustard-500/20 dark:text-mustard-300' },
  { value: 'part_consumo', label: 'Material de Consumo', icon: 'science', color: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300' },
  { value: 'part_epi', label: 'EPI / Segurança', icon: 'health_and_safety', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' },
  { value: 'part_outros', label: 'Outros Insumos', icon: 'category', color: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300' },
  { value: 'ignore', label: 'Ignorar (Não incluir no estoque)', icon: 'block', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
];

export const XmlImportModal: React.FC<XmlImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'upload' | 'items' | 'payment' | 'success'>('upload');
  const [xmlContent, setXmlContent] = useState<string>('');
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [fileType, setFileType] = useState<'xml' | 'pdf' | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parsedData, setParsedData] = useState<ParsedNfeData | null>(null);
  const [itemsConfig, setItemsConfig] = useState<Record<number, ItemConfigState>>({});

  // Payment states
  const [paymentType, setPaymentType] = useState<'a_vista' | 'parcelado' | 'nenhum'>('a_vista');
  const [installments, setInstallments] = useState<InstallmentState[]>([]);
  const [numInstallments, setNumInstallments] = useState<number>(1);

  // Success summary
  const [importSummary, setImportSummary] = useState<any>(null);

  if (!isOpen) return null;

  // Handle File Upload (XML or PDF)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isXml = lowerName.endsWith('.xml');
    const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';

    if (!isXml && !isPdf) {
      setError('Por favor, selecione um arquivo válido com extensão .xml ou .pdf.');
      return;
    }

    setFileName(file.name);
    setError(null);

    if (isXml) {
      setFileType('xml');
      setPdfBase64('');
      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target?.result as string;
        setXmlContent(content);
      };
      reader.onerror = () => {
        setError('Erro ao ler o arquivo XML selecionado.');
      };
      reader.readAsText(file);
    } else {
      setFileType('pdf');
      setXmlContent('');
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target?.result as string;
        const base64 = dataUrl.split(',')[1] || dataUrl;
        setPdfBase64(base64);
      };
      reader.onerror = () => {
        setError('Erro ao ler o arquivo PDF selecionado.');
      };
      reader.readAsDataURL(file);
    }
  };

  // Step 1 -> Parse Document (XML or PDF)
  const handleParseXml = async () => {
    if (!xmlContent.trim() && !pdfBase64) {
      setError('Selecione um arquivo XML ou PDF (ou cole o XML) antes de prosseguir.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = pdfBase64
        ? { pdf_base64: pdfBase64, file_name: fileName }
        : { xml: xmlContent };

      const { data } = await api.post('/fiscal/nfe/parse', payload);
      setParsedData(data);

      // Initialize items config
      const initialConfig: Record<number, ItemConfigState> = {};
      (data.items || []).forEach((item: ParsedNfeItem) => {
        initialConfig[item.item_index] = {
          item_index: item.item_index,
          destination: item.suggested_destination,
          custom_name: item.description,
          custom_model: item.extracted_model || '',
          custom_serial_number: item.extracted_serial_number || '',
          custom_unit: item.unit || 'UN',
          custom_quantity: item.quantity,
          custom_unit_value: item.unit_value,
          expanded: false,
        };
      });
      setItemsConfig(initialConfig);

      // Initialize installments from XML if present
      if (data.installments && data.installments.length > 0) {
        setInstallments(
          data.installments.map((dup: any) => ({
            installment_number: dup.installment_number,
            due_date: dup.due_date,
            amount: Number(dup.amount),
          }))
        );
        if (data.installments.length > 1) {
          setPaymentType('parcelado');
          setNumInstallments(data.installments.length);
        } else {
          setPaymentType('a_vista');
          setNumInstallments(1);
        }
      } else {
        const today = new Date().toISOString().split('T')[0];
        setInstallments([
          {
            installment_number: 1,
            due_date: data.issue_date ? data.issue_date.split('T')[0] : today,
            amount: data.totals?.total_invoice || 0,
          },
        ]);
        setPaymentType('a_vista');
        setNumInstallments(1);
      }

      setStep('items');
    } catch (err: any) {
      console.error('Erro ao analisar XML:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao processar o arquivo XML.');
    } finally {
      setLoading(false);
    }
  };

  // Re-generate installments when number changes
  const handleGenerateInstallments = (count: number) => {
    if (!parsedData) return;
    setNumInstallments(count);
    const total = parsedData.totals.total_invoice || 0;
    const baseAmount = Math.floor((total / count) * 100) / 100;
    const remainder = Number((total - baseAmount * count).toFixed(2));

    const newInst: InstallmentState[] = [];
    const baseDate = new Date(parsedData.issue_date || new Date());

    for (let i = 0; i < count; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i + 1); // +30 days / next months
      const dateStr = d.toISOString().split('T')[0];
      const amount = i === count - 1 ? Number((baseAmount + remainder).toFixed(2)) : baseAmount;

      newInst.push({
        installment_number: i + 1,
        due_date: dateStr,
        amount,
      });
    }

    setInstallments(newInst);
  };

  const handleInstallmentChange = (index: number, field: 'due_date' | 'amount', value: any) => {
    setInstallments((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: field === 'amount' ? parseFloat(value) || 0 : value,
      };
      return updated;
    });
  };

  // Confirm and Process Import
  const handleProcessImport = async () => {
    if (!parsedData) return;

    try {
      setLoading(true);
      setError(null);

      const itemsPayload = Object.values(itemsConfig).map((cfg) => ({
        item_index: cfg.item_index,
        destination: cfg.destination,
        custom_name: cfg.custom_name,
        custom_model: cfg.custom_model,
        custom_serial_number: cfg.custom_serial_number,
        custom_asset_number: cfg.custom_asset_number,
        custom_unit: cfg.custom_unit,
        custom_quantity: cfg.custom_quantity,
        custom_unit_value: cfg.custom_unit_value,
      }));

      const payload = {
        xml: xmlContent,
        parsed_data: parsedData,
        items_config: itemsPayload,
        payment_config: {
          type: paymentType,
          installments: paymentType === 'nenhum' ? [] : installments,
        },
      };

      const { data } = await api.post('/fiscal/nfe/process', payload);
      setImportSummary(data.summary);
      setStep('success');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Erro ao processar importação:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao processar a importação da NF-e.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setXmlContent('');
    setPdfBase64('');
    setFileType(null);
    setFileName('');
    setParsedData(null);
    setItemsConfig({});
    setInstallments([]);
    setError(null);
    setImportSummary(null);
  };

  // Sum of installments
  const totalInstallmentsAmount = installments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalInvoice = parsedData?.totals?.total_invoice || 0;
  const difference = Number((totalInvoice - totalInstallmentsAmount).toFixed(2));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="p-6 md:px-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">receipt_long</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Importar Nota Fiscal Eletrônica (NF-e - XML ou PDF)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Entrada de equipamentos, peças, consumo, EPIs e geração de contas a pagar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Step Indicator */}
        {step !== 'success' && (
          <div className="px-8 py-3 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold shrink-0">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step === 'upload' ? 'bg-mustard-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                1
              </span>
              <span className={step === 'upload' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}>Upload (XML ou PDF)</span>
            </div>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-[16px]">chevron_right</span>
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step === 'items' ? 'bg-mustard-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                2
              </span>
              <span className={step === 'items' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}>Classificação dos Itens</span>
            </div>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-[16px]">chevron_right</span>
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step === 'payment' ? 'bg-mustard-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                3
              </span>
              <span className={step === 'payment' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}>Contas a Pagar</span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 p-4 rounded-2xl text-sm flex items-center gap-3 font-medium">
              <span className="material-symbols-outlined text-red-500">error</span>
              <span className="whitespace-pre-line">{error}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-8 text-center hover:border-mustard-500 dark:hover:border-mustard-500 transition-all bg-slate-50/50 dark:bg-slate-800/20">
                <div className="w-16 h-16 rounded-2xl bg-mustard-100 dark:bg-mustard-500/20 text-mustard-600 dark:text-mustard-400 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">upload_file</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Selecione ou Arraste o arquivo XML ou PDF (DANFE) da NF-e
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto font-medium">
                  Aceita arquivos no padrão SEFAZ em formato .xml ou .pdf (DANFE gerada digitalmente), contendo dados de fornecedor, produtos e duplicatas.
                </p>

                <div className="mt-6 flex items-center justify-center gap-4">
                  <label className="cursor-pointer bg-mustard-500 hover:bg-mustard-600 active:scale-[0.98] text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-mustard-500/20 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">folder_open</span>
                    <span>Escolher Arquivo (XML ou PDF)</span>
                    <input type="file" accept=".xml,.pdf,application/pdf,text/xml" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                {fileName && (
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                    <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                    <span>{fileName} ({fileType?.toUpperCase()})</span>
                  </div>
                )}
              </div>

              {/* Paste XML Fallback */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Ou cole o conteúdo XML diretamente:
                </label>
                <textarea
                  value={xmlContent}
                  onChange={(e) => setXmlContent(e.target.value)}
                  rows={4}
                  placeholder="<?xml version='1.0' encoding='UTF-8'?>..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 2: ITEMS & DESTINATIONS */}
          {step === 'items' && parsedData && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Número NF-e</span>
                  <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                    {parsedData.invoice_number} (Série {parsedData.series})
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Emitente / Fornecedor</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate block" title={parsedData.issuer?.name}>
                    {parsedData.issuer?.fantasy_name || parsedData.issuer?.name}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">{parsedData.issuer?.cnpj}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data de Emissão</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {new Date(parsedData.issue_date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor Total da NF</span>
                  <span className="text-base font-black text-mustard-600 dark:text-mustard-400 font-mono">
                    R$ {parsedData.totals?.total_invoice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {parsedData.already_imported && (
                <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <span className="material-symbols-outlined text-[20px]">warning</span>
                  <span>Atenção: Esta chave de acesso já consta como importada no banco de dados.</span>
                </div>
              )}

              {/* Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                    Itens da Nota Fiscal ({parsedData.items.length})
                  </h4>
                  <span className="text-xs text-slate-400 font-medium">
                    Revise e selecione o destino de cada produto
                  </span>
                </div>

                <div className="space-y-3">
                  {parsedData.items.map((item) => {
                    const cfg = itemsConfig[item.item_index] || { destination: item.suggested_destination };
                    const currentDest = DESTINATION_OPTIONS.find((d) => d.value === cfg.destination) || DESTINATION_OPTIONS[0];

                    return (
                      <div
                        key={item.item_index}
                        className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                #{item.item_index}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                Cód: {item.product_code}
                              </span>
                              {item.ncm && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                                  NCM: {item.ncm}
                                </span>
                              )}
                              {item.cfop && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                                  CFOP: {item.cfop}
                                </span>
                              )}
                            </div>
                            <h5 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                              {item.description}
                            </h5>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                              <span>Qtd: <strong>{item.quantity} {item.unit}</strong></span>
                              <span>Vl. Unit: <strong>R$ {item.unit_value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                              <span>Total: <strong className="text-slate-900 dark:text-white">R$ {item.total_value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                              {item.icms_rate ? <span>ICMS: {item.icms_rate}% (R$ {item.icms_value?.toFixed(2)})</span> : null}
                            </div>
                          </div>

                          {/* Destination Selector */}
                          <div className="shrink-0 flex items-center gap-2">
                            <select
                              value={cfg.destination}
                              onChange={(e) => {
                                const newDest = e.target.value as NfeItemDestination;
                                setItemsConfig((prev) => ({
                                  ...prev,
                                  [item.item_index]: {
                                    ...prev[item.item_index],
                                    destination: newDest,
                                  },
                                }));
                              }}
                              className={`px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-mustard-500 ${currentDest.color}`}
                            >
                              {DESTINATION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => {
                                setItemsConfig((prev) => ({
                                  ...prev,
                                  [item.item_index]: {
                                    ...prev[item.item_index],
                                    expanded: !prev[item.item_index]?.expanded,
                                  },
                                }));
                              }}
                              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Ajustar Detalhes"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {cfg.expanded ? 'expand_less' : 'tune'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Edit Fields */}
                        {cfg.expanded && (
                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                              <label className="font-bold text-slate-500">Nome / Descrição Customizada:</label>
                              <input
                                type="text"
                                value={cfg.custom_name ?? item.description}
                                onChange={(e) => {
                                  setItemsConfig((prev) => ({
                                    ...prev,
                                    [item.item_index]: { ...prev[item.item_index], custom_name: e.target.value },
                                  }));
                                }}
                                className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                              />
                            </div>
                            {cfg.destination === 'equipment' && (
                              <>
                                <div>
                                  <label className="font-bold text-slate-500">Modelo:</label>
                                  <input
                                    type="text"
                                    value={cfg.custom_model ?? item.extracted_model ?? ''}
                                    onChange={(e) => {
                                      setItemsConfig((prev) => ({
                                        ...prev,
                                        [item.item_index]: { ...prev[item.item_index], custom_model: e.target.value },
                                      }));
                                    }}
                                    placeholder="Ex: 450AJ"
                                    className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="font-bold text-slate-500">Nº de Série / Chassi:</label>
                                  <input
                                    type="text"
                                    value={cfg.custom_serial_number ?? item.extracted_serial_number ?? ''}
                                    onChange={(e) => {
                                      setItemsConfig((prev) => ({
                                        ...prev,
                                        [item.item_index]: { ...prev[item.item_index], custom_serial_number: e.target.value },
                                      }));
                                    }}
                                    placeholder="Ex: B300031616"
                                    className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT & BILLS */}
          {step === 'payment' && parsedData && (
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor a Faturar na NF-e</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                    R$ {totalInvoice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fornecedor / Credor</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {parsedData.issuer?.fantasy_name || parsedData.issuer?.name}
                  </span>
                </div>
              </div>

              {/* Payment Type Tabs */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Forma de Pagamento (Contas a Pagar)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('a_vista');
                      handleGenerateInstallments(1);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      paymentType === 'a_vista'
                        ? 'border-mustard-500 bg-mustard-50/50 dark:bg-mustard-500/10 ring-2 ring-mustard-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold text-sm text-slate-900 dark:text-white">À Vista (1x)</span>
                    <span className="text-xs text-slate-500">Gera 1 lançamento integral em Contas a Pagar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('parcelado');
                      handleGenerateInstallments(numInstallments > 1 ? numInstallments : 2);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      paymentType === 'parcelado'
                        ? 'border-mustard-500 bg-mustard-50/50 dark:bg-mustard-500/10 ring-2 ring-mustard-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold text-sm text-slate-900 dark:text-white">Parcelado</span>
                    <span className="text-xs text-slate-500">Divide o valor em N parcelas com vencimentos customizáveis</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentType('nenhum')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      paymentType === 'nenhum'
                        ? 'border-slate-600 bg-slate-100 dark:bg-slate-800 ring-2 ring-slate-400'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold text-sm text-slate-700 dark:text-slate-300">Não Gerar Financeiro</span>
                    <span className="text-xs text-slate-500">Apenas registra/atualiza os itens no estoque</span>
                  </button>
                </div>
              </div>

              {/* Installments Table if Parcelado */}
              {paymentType === 'parcelado' && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Quantidade de Parcelas:</label>
                      <select
                        value={numInstallments}
                        onChange={(e) => handleGenerateInstallments(parseInt(e.target.value, 10))}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
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
                      <span className={difference === 0 ? 'text-emerald-600 font-mono font-black' : 'text-red-500 font-mono font-black'}>
                        R$ {totalInstallmentsAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      {difference !== 0 && (
                        <span className="text-red-500 ml-2">(Diferença de R$ {difference})</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="grid grid-cols-12 gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                      <div className="col-span-2">Parcela</div>
                      <div className="col-span-5">Data de Vencimento</div>
                      <div className="col-span-5 text-right">Valor da Parcela (R$)</div>
                    </div>

                    {installments.map((inst, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium">
                        <div className="col-span-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {inst.installment_number || `${idx + 1}/${installments.length}`}
                        </div>
                        <div className="col-span-5">
                          <input
                            type="date"
                            value={inst.due_date}
                            onChange={(e) => handleInstallmentChange(idx, 'due_date', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                          />
                        </div>
                        <div className="col-span-5">
                          <input
                            type="number"
                            step="0.01"
                            value={inst.amount}
                            onChange={(e) => handleInstallmentChange(idx, 'amount', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-right text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Single Installment Date if A Vista */}
              {paymentType === 'a_vista' && installments.length > 0 && (
                <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Data de Vencimento do Pagamento:</label>
                  <input
                    type="date"
                    value={installments[0]?.due_date || ''}
                    onChange={(e) => handleInstallmentChange(0, 'due_date', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUCCESS SUMMARY */}
          {step === 'success' && importSummary && (
            <div className="py-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <span className="material-symbols-outlined text-4xl">verified</span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  NF-e Importada e Processada com Sucesso!
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  Os registros de estoque e lançamentos financeiros foram consolidados no sistema.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto pt-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipamentos</span>
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    +{importSummary.equipments_created || 0}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Novos Materiais</span>
                  <span className="text-2xl font-black text-mustard-600 dark:text-mustard-400">
                    +{importSummary.parts_created || 0}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estoque Atualizado</span>
                  <span className="text-2xl font-black text-sky-600 dark:text-sky-400">
                    {importSummary.parts_updated || 0} itens
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contas a Pagar</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {importSummary.bills_created || 0} faturas
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between shrink-0">
          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleParseXml}
                disabled={loading || (!xmlContent.trim() && !pdfBase64)}
                className="px-8 py-2.5 rounded-xl font-bold text-sm text-white bg-mustard-500 hover:bg-mustard-600 active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-mustard-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analisando {fileType === 'pdf' ? 'PDF (DANFE)' : 'XML'}...</span>
                  </>
                ) : (
                  <>
                    <span>Avançar para Itens</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'items' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Voltar</span>
              </button>
              <button
                type="button"
                onClick={() => setStep('payment')}
                className="px-8 py-2.5 rounded-xl font-bold text-sm text-white bg-mustard-500 hover:bg-mustard-600 active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-mustard-500/20"
              >
                <span>Avançar para Pagamento</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </>
          )}

          {step === 'payment' && (
            <>
              <button
                type="button"
                onClick={() => setStep('items')}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Voltar</span>
              </button>
              <button
                type="button"
                onClick={handleProcessImport}
                disabled={loading}
                className="px-8 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processando e Lançando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Confirmar e Lançar NF-e</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="w-full flex justify-end gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              >
                Importar Outra NF-e
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-2.5 rounded-xl font-bold text-sm text-white bg-mustard-500 hover:bg-mustard-600"
              >
                Concluir e Fechar
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default XmlImportModal;
