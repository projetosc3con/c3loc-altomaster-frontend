import React, { useState, useEffect, useMemo } from 'react';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import api from '../../services/api';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../utils/date';
import type { ServiceOrder, ServiceOrderRcd, RcdPartItem, RcdServiceItem, RcdInstallment } from '../../types';
import RcdReportDocument from './RcdReportDocument';
import FaturaRcdDocument from './FaturaRcdDocument';

export interface RcdTabContentProps {
  serviceOrderId?: string;
  formData: Partial<ServiceOrder>;
  osParts: Array<{
    part_id: string;
    description: string;
    internal_code: string;
    quantity_used: number;
    unit_value_at_use: number;
    subtotal: number;
    was_used?: boolean;
  }>;
  onUpdateFormData: (field: string, value: any) => void;
  onSaveOsFirst?: () => Promise<string | null>;
}

export const RcdTabContent: React.FC<RcdTabContentProps> = ({
  serviceOrderId,
  formData,
  osParts,
  onUpdateFormData,
  onSaveOsFirst,
}) => {
  const [loading, setLoading] = useState(false);
  const [savingRcd, setSavingRcd] = useState(false);
  const [launchingBills, setLaunchingBills] = useState(false);
  const [unlinkingBills, setUnlinkingBills] = useState(false);
  const [uploadingSignedDoc, setUploadingSignedDoc] = useState(false);
  const [generatingRcdPdf, setGeneratingRcdPdf] = useState(false);
  const [generatingFaturaPdf, setGeneratingFaturaPdf] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // RCD Form State
  const [rcd, setRcd] = useState<Partial<ServiceOrderRcd>>({
    issue_date: new Date().toISOString().split('T')[0],
    validity_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    payment_terms: '15 DIAS PARA PAGAMENTO',
    origin_description: 'Contrato de locação',
    notes: '',
    payment_method: 'Boleto Bancário',
    payment_type: 'a_vista',
    installments_count: 1,
    installments_data: [],
    parts: [],
    services: [],
    status: 'Pendente',
  });

  // Track which OS parts are selected for billing: { [part_id]: boolean }
  const [selectedPartIds, setSelectedPartIds] = useState<Record<string, boolean>>({});

  // 1. Fetch RCD when serviceOrderId is available
  useEffect(() => {
    const loadRcd = async () => {
      if (!serviceOrderId) {
        // Pre-fill initial client and equipment data from OS formData
        setRcd(prev => ({
          ...prev,
          client_name: formData.client_name || '',
          client_address: formData.client_address || '',
          client_contact: formData.client_contact_name || '',
          client_phone: formData.client_phone || '',
          equipment_name: formData.equipment_name || '',
          equipment_asset_number: formData.equipment_asset_number || '',
          equipment_model: formData.equipment_model || '',
          problem_description: formData.diagnosis || formData.client_request || '',
          rcd_number: `RCD-${String(formData.os_number || '001').padStart(3, '0')}`,
        }));
        return;
      }

      try {
        setLoading(true);
        const { data } = await api.get(`/service-orders/${serviceOrderId}/rcd`);
        if (data) {
          setRcd(data);
          // Pre-select parts that exist in saved RCD
          const selMap: Record<string, boolean> = {};
          if (Array.isArray(data.parts)) {
            data.parts.forEach((p: RcdPartItem) => {
              selMap[p.part_id] = true;
            });
          }
          setSelectedPartIds(selMap);
        } else {
          // Initialize new RCD template with OS formData
          setRcd(prev => ({
            ...prev,
            client_name: formData.client_name || '',
            client_address: formData.client_address || '',
            client_contact: formData.client_contact_name || '',
            client_phone: formData.client_phone || '',
            equipment_name: formData.equipment_name || '',
            equipment_asset_number: formData.equipment_asset_number || '',
            equipment_model: formData.equipment_model || '',
            problem_description: formData.diagnosis || formData.client_request || '',
            rcd_number: `RCD-${String(formData.os_number || '001').padStart(3, '0')}`,
          }));
        }
      } catch (err: any) {
        console.error('Erro ao carregar RCD:', err);
      } finally {
        setLoading(false);
      }
    };

    loadRcd();
  }, [serviceOrderId]);

  // Keep client/equipment info updated from OS if empty in RCD
  useEffect(() => {
    setRcd(prev => ({
      ...prev,
      client_name: prev.client_name || formData.client_name || '',
      client_address: prev.client_address || formData.client_address || '',
      client_contact: prev.client_contact || formData.client_contact_name || '',
      client_phone: prev.client_phone || formData.client_phone || '',
      equipment_name: prev.equipment_name || formData.equipment_name || '',
      equipment_asset_number: prev.equipment_asset_number || formData.equipment_asset_number || '',
      equipment_model: prev.equipment_model || formData.equipment_model || '',
      problem_description: prev.problem_description || formData.diagnosis || formData.client_request || '',
    }));
  }, [formData]);

  // 2. Synchronize selected OS parts with rcd.parts
  const handleTogglePart = (partId: string) => {
    const nextState = !selectedPartIds[partId];
    setSelectedPartIds(prev => ({ ...prev, [partId]: nextState }));

    const targetOsPart = osParts.find(p => p.part_id === partId);
    if (!targetOsPart) return;

    setRcd(prev => {
      const currentParts = prev.parts || [];
      if (nextState) {
        // Add part if not present
        if (!currentParts.some(p => p.part_id === partId)) {
          return {
            ...prev,
            parts: [
              ...currentParts,
              {
                part_id: targetOsPart.part_id,
                internal_code: targetOsPart.internal_code,
                description: targetOsPart.description,
                quantity: targetOsPart.quantity_used,
                unit_value: targetOsPart.unit_value_at_use,
                subtotal: targetOsPart.quantity_used * targetOsPart.unit_value_at_use,
              },
            ],
          };
        }
      } else {
        // Remove part
        return {
          ...prev,
          parts: currentParts.filter(p => p.part_id !== partId),
        };
      }
      return prev;
    });
  };

  const handleSelectAllParts = (select: boolean) => {
    const selMap: Record<string, boolean> = {};
    if (select) {
      const allRcdParts: RcdPartItem[] = osParts.map(p => {
        selMap[p.part_id] = true;
        return {
          part_id: p.part_id,
          internal_code: p.internal_code,
          description: p.description,
          quantity: p.quantity_used,
          unit_value: p.unit_value_at_use,
          subtotal: p.quantity_used * p.unit_value_at_use,
        };
      });
      setSelectedPartIds(selMap);
      setRcd(prev => ({ ...prev, parts: allRcdParts }));
    } else {
      setSelectedPartIds({});
      setRcd(prev => ({ ...prev, parts: [] }));
    }
  };

  const handleUpdatePartField = (partId: string, field: 'quantity' | 'unit_value', value: number) => {
    setRcd(prev => {
      const updated = (prev.parts || []).map(p => {
        if (p.part_id === partId) {
          const qty = field === 'quantity' ? value : p.quantity;
          const uv = field === 'unit_value' ? value : p.unit_value;
          return {
            ...p,
            [field]: value,
            subtotal: Number((qty * uv).toFixed(2)),
          };
        }
        return p;
      });
      return { ...prev, parts: updated };
    });
  };

  // 3. Services Management
  const handleAddService = (type: 'deslocamento' | 'mao_de_obra' | 'outro') => {
    const newService: RcdServiceItem = {
      id: crypto.randomUUID(),
      type,
      description:
        type === 'deslocamento'
          ? 'DESLOCAMENTO TÉCNICO'
          : type === 'mao_de_obra'
            ? 'MÃO DE OBRA MANUTENÇÃO E INSPEÇÃO'
            : 'SERVIÇO ESPECIALIZADO',
      km: type === 'deslocamento' ? 50 : undefined,
      quantity: 1,
      unit_value: type === 'deslocamento' ? 3.5 : 280,
      subtotal: type === 'deslocamento' ? 175 : 280,
    };

    setRcd(prev => ({
      ...prev,
      services: [...(prev.services || []), newService],
    }));
  };

  const handleUpdateServiceField = (serviceId: string, field: string, value: any) => {
    setRcd(prev => {
      const updated = (prev.services || []).map(s => {
        if (s.id === serviceId) {
          const current = { ...s, [field]: value };
          if (field === 'km' || field === 'unit_value' || field === 'quantity') {
            const qty = current.type === 'deslocamento' && current.km ? current.km : current.quantity;
            current.subtotal = Number((qty * (current.unit_value || 0)).toFixed(2));
          }
          return current;
        }
        return s;
      });
      return { ...prev, services: updated };
    });
  };

  const handleRemoveService = (serviceId: string) => {
    setRcd(prev => ({
      ...prev,
      services: (prev.services || []).filter(s => s.id !== serviceId),
    }));
  };

  // 4. Totals Calculations
  const totalParts = useMemo(() => {
    return (rcd.parts || []).reduce((acc, p) => acc + (Number(p.subtotal) || 0), 0);
  }, [rcd.parts]);

  const totalServices = useMemo(() => {
    return (rcd.services || []).reduce((acc, s) => acc + (Number(s.subtotal) || 0), 0);
  }, [rcd.services]);

  const totalValue = useMemo(() => {
    return Number((totalParts + totalServices).toFixed(2));
  }, [totalParts, totalServices]);

  // 5. Installments generator
  const handleGenerateInstallments = (count: number) => {
    const effectiveCount = Math.max(1, count);
    const partValue = Number((totalValue / effectiveCount).toFixed(2));
    const baseDate = rcd.validity_date ? new Date(rcd.validity_date) : new Date();

    const installments: RcdInstallment[] = [];
    let sum = 0;

    for (let i = 1; i <= effectiveCount; i++) {
      const instDueDate = new Date(baseDate);
      instDueDate.setMonth(baseDate.getMonth() + (i - 1));

      // Last installment adjusts remainder cents
      const isLast = i === effectiveCount;
      const thisVal = isLast ? Number((totalValue - sum).toFixed(2)) : partValue;
      sum += thisVal;

      installments.push({
        installment_number: i,
        due_date: instDueDate.toISOString().split('T')[0],
        gross_value: thisVal,
      });
    }

    setRcd(prev => ({
      ...prev,
      installments_count: effectiveCount,
      installments_data: installments,
    }));
  };

  const handleUpdateInstallment = (index: number, field: 'due_date' | 'gross_value', val: any) => {
    setRcd(prev => {
      const updated = [...(prev.installments_data || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: val };
      }
      return { ...prev, installments_data: updated };
    });
  };

  const installmentsSum = useMemo(() => {
    return (rcd.installments_data || []).reduce((acc, inst) => acc + (Number(inst.gross_value) || 0), 0);
  }, [rcd.installments_data]);

  const installmentsDiff = useMemo(() => {
    return Number((totalValue - installmentsSum).toFixed(2));
  }, [totalValue, installmentsSum]);

  // 6. Save RCD
  const handleSaveRcd = async () => {
    let effectiveOsId = serviceOrderId;
    if (!effectiveOsId && onSaveOsFirst) {
      // First save OS to get an ID
      effectiveOsId = (await onSaveOsFirst()) || undefined;
    }

    if (!effectiveOsId) {
      setFeedback({
        type: 'error',
        message: 'Por favor, salve a Ordem de Serviço antes de gravar o RCD.',
      });
      return null;
    }

    try {
      setSavingRcd(true);
      setFeedback(null);

      const payload = {
        ...rcd,
        service_order_id: effectiveOsId,
        total_parts: totalParts,
        total_services: totalServices,
        total_value: totalValue,
      };

      const { data } = await api.post(`/service-orders/${effectiveOsId}/rcd`, payload);
      setRcd(data);
      onUpdateFormData('rcd_total_value', totalValue);
      if (data.signed_document_url) {
        onUpdateFormData('signed_rcd_url', data.signed_document_url);
      }

      setFeedback({
        type: 'success',
        message: 'RCD salvo com sucesso!',
      });
      return data;
    } catch (err: any) {
      console.error('Erro ao salvar RCD:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Erro ao salvar o RCD.',
      });
      return null;
    } finally {
      setSavingRcd(false);
    }
  };

  // 7. Launch Bills in Financial module
  const handleLaunchBills = async () => {
    if (!serviceOrderId) {
      setFeedback({
        type: 'error',
        message: 'É necessário salvar a Ordem de Serviço antes de faturar no financeiro.',
      });
      return;
    }

    if (totalValue <= 0) {
      setFeedback({
        type: 'error',
        message: 'O valor total do RCD deve ser maior que zero para faturamento.',
      });
      return;
    }

    if (rcd.payment_type === 'parcelado' && Math.abs(installmentsDiff) > 0.05) {
      setFeedback({
        type: 'error',
        message: `A soma das parcelas (R$ ${installmentsSum.toFixed(2)}) não confere com o Total do RCD (R$ ${totalValue.toFixed(2)}). Diferença: R$ ${installmentsDiff.toFixed(2)}.`,
      });
      return;
    }

    const confirmLaunch = window.confirm(
      `Deseja lançar este RCD no valor de R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em Contas a Receber?\n\nForma: ${rcd.payment_method || 'Boleto'}\nCondição: ${rcd.payment_type === 'parcelado' ? `${rcd.installments_count || 1} parcelas` : 'À Vista'}`
    );
    if (!confirmLaunch) return;

    try {
      setLaunchingBills(true);
      setFeedback(null);

      // Save first to ensure sync
      await handleSaveRcd();

      const { data } = await api.post(`/service-orders/${serviceOrderId}/rcd/launch-bills`);
      setRcd(data.rcd);
      setFeedback({
        type: 'success',
        message: data.message || 'Faturamento concluído com sucesso!',
      });
    } catch (err: any) {
      console.error('Erro ao faturar RCD:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Erro ao lançar faturamento no financeiro.',
      });
    } finally {
      setLaunchingBills(false);
    }
  };

  // 8. Unlink Bills
  const handleUnlinkBills = async () => {
    if (!serviceOrderId) return;
    const confirmCancel = window.confirm(
      'Tem certeza que deseja cancelar o faturamento deste RCD e remover os títulos pendentes em Contas a Receber?'
    );
    if (!confirmCancel) return;

    try {
      setUnlinkingBills(true);
      setFeedback(null);
      const { data } = await api.post(`/service-orders/${serviceOrderId}/rcd/unlink-bills`);
      setRcd(data.rcd);
      setFeedback({
        type: 'success',
        message: data.message || 'Faturamento desvinculado com sucesso.',
      });
    } catch (err: any) {
      console.error('Erro ao desvincular faturamento:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Erro ao desvincular faturamento.',
      });
    } finally {
      setUnlinkingBills(false);
    }
  };

  // 9. Upload Signed Document
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingSignedDoc(true);
      setFeedback(null);

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `rcd-signed/os_${serviceOrderId || 'new'}_${Date.now()}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('service-orders')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('service-orders')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      setRcd(prev => ({
        ...prev,
        signed_document_url: publicUrl,
        signed_at: new Date().toISOString(),
      }));

      onUpdateFormData('signed_rcd_url', publicUrl);

      if (serviceOrderId) {
        await api.post(`/service-orders/${serviceOrderId}/rcd`, {
          ...rcd,
          service_order_id: serviceOrderId,
          signed_document_url: publicUrl,
          signed_at: new Date().toISOString(),
        });
      }

      setFeedback({
        type: 'success',
        message: 'Relatório assinado anexado com sucesso!',
      });
    } catch (err: any) {
      console.error('Erro no upload do documento assinado:', err);
      setFeedback({
        type: 'error',
        message: 'Erro ao fazer upload do relatório assinado: ' + (err.message || ''),
      });
    } finally {
      setUploadingSignedDoc(false);
    }
  };

  const handleRemoveSignedDoc = async () => {
    const confirmRemove = window.confirm('Deseja remover o anexo do relatório assinado?');
    if (!confirmRemove) return;

    setRcd(prev => ({
      ...prev,
      signed_document_url: undefined,
      signed_at: undefined,
    }));
    onUpdateFormData('signed_rcd_url', null);

    if (serviceOrderId) {
      await api.post(`/service-orders/${serviceOrderId}/rcd`, {
        ...rcd,
        service_order_id: serviceOrderId,
        signed_document_url: null,
        signed_at: null,
      });
    }
  };

  // 10. PDF Generators
  const handleDownloadRcdPdf = async () => {
    try {
      setGeneratingRcdPdf(true);
      const fullRcdData: ServiceOrderRcd = {
        ...(rcd as ServiceOrderRcd),
        service_order_id: serviceOrderId || '',
        total_parts: totalParts,
        total_services: totalServices,
        total_value: totalValue,
      };

      const blob = await pdf(<RcdReportDocument rcd={fullRcdData} />).toBlob();
      saveAs(blob, `${rcd.rcd_number || 'RCD'}_${rcd.client_name || 'Cliente'}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF do RCD:', err);
      alert('Erro ao gerar o PDF do Relatório RCD.');
    } finally {
      setGeneratingRcdPdf(false);
    }
  };

  const handleViewRcdPdf = async () => {
    try {
      setGeneratingRcdPdf(true);
      const fullRcdData: ServiceOrderRcd = {
        ...(rcd as ServiceOrderRcd),
        service_order_id: serviceOrderId || '',
        total_parts: totalParts,
        total_services: totalServices,
        total_value: totalValue,
      };

      const blob = await pdf(<RcdReportDocument rcd={fullRcdData} />).toBlob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Erro ao abrir PDF do RCD:', err);
      alert('Erro ao abrir visualização do PDF do RCD.');
    } finally {
      setGeneratingRcdPdf(false);
    }
  };

  const handleDownloadFaturaPdf = async () => {
    try {
      setGeneratingFaturaPdf(true);
      const fullRcdData: ServiceOrderRcd = {
        ...(rcd as ServiceOrderRcd),
        service_order_id: serviceOrderId || '',
        total_parts: totalParts,
        total_services: totalServices,
        total_value: totalValue,
      };

      const blob = await pdf(<FaturaRcdDocument rcd={fullRcdData} os={formData} />).toBlob();
      saveAs(blob, `FATURA_${rcd.rcd_number || 'RCD'}_${rcd.client_name || 'Cliente'}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF da Fatura:', err);
      alert('Erro ao gerar o PDF da Fatura.');
    } finally {
      setGeneratingFaturaPdf(false);
    }
  };

  const handleViewFaturaPdf = async () => {
    try {
      setGeneratingFaturaPdf(true);
      const fullRcdData: ServiceOrderRcd = {
        ...(rcd as ServiceOrderRcd),
        service_order_id: serviceOrderId || '',
        total_parts: totalParts,
        total_services: totalServices,
        total_value: totalValue,
      };

      const blob = await pdf(<FaturaRcdDocument rcd={fullRcdData} os={formData} />).toBlob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Erro ao abrir PDF da Fatura:', err);
      alert('Erro ao abrir visualização da Fatura.');
    } finally {
      setGeneratingFaturaPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-6 h-6 border-2 border-mustard-500/30 border-t-mustard-500 rounded-full animate-spin mr-3" />
        Carregando informações do RCD...
      </div>
    );
  }

  const isBilled = rcd.status === 'Faturado';

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-2xl text-sm flex items-center justify-between font-medium border ${feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
              : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
            }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">
              {feedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            {feedback.message}
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-bold uppercase tracking-wider opacity-70 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Top Banner & Status */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-mustard-500 text-2xl">receipt_long</span>
            <h3 className="text-lg font-black tracking-wide text-slate-900 dark:text-white">
              {rcd.rcd_number || 'RESSARCIMENTO DE DANOS'}
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase border ${isBilled
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                }`}
            >
              {rcd.status || 'Pendente'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestão de despesas e peças cobradas do cliente com emissão de Relatório de Danos e Fatura.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveRcd}
            disabled={savingRcd}
            className="px-4 py-2 bg-mustard-500 hover:bg-mustard-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-mustard-500/20 flex items-center gap-1.5 disabled:opacity-50"
          >
            {savingRcd ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-base">save</span>
            )}
            Salvar RCD
          </button>

          {isBilled ? (
            <button
              type="button"
              onClick={handleUnlinkBills}
              disabled={unlinkingBills}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {unlinkingBills ? (
                <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-500 rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-base">cancel</span>
              )}
              Cancelar Faturamento
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLaunchBills}
              disabled={launchingBills}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              {launchingBills ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-base">payments</span>
              )}
              Lançar em Contas a Receber
            </button>
          )}
        </div>
      </div>

      {/* 1. Metadados do RCD e Cliente */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
          <span className="material-symbols-outlined text-mustard-500 text-lg">description</span>
          Identificação & Dados do Cliente
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Número do RCD
            </label>
            <input
              type="text"
              value={rcd.rcd_number || ''}
              onChange={e => setRcd(prev => ({ ...prev, rcd_number: e.target.value }))}
              placeholder="Ex: RCD-001"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Data de Emissão
            </label>
            <input
              type="date"
              value={rcd.issue_date || ''}
              onChange={e => setRcd(prev => ({ ...prev, issue_date: e.target.value }))}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Validade do Orçamento
            </label>
            <input
              type="date"
              value={rcd.validity_date || ''}
              onChange={e => setRcd(prev => ({ ...prev, validity_date: e.target.value }))}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Origem
            </label>
            <input
              type="text"
              value={rcd.origin_description || ''}
              onChange={e => setRcd(prev => ({ ...prev, origin_description: e.target.value }))}
              placeholder="Ex: Contrato de locação"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
            />
          </div>
        </div>

        {/* Informações do Tomador */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Cliente (Tomador)
            </label>
            <input
              type="text"
              value={rcd.client_name || ''}
              onChange={e => setRcd(prev => ({ ...prev, client_name: e.target.value }))}
              placeholder="Nome / Razão Social"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              CNPJ / CPF
            </label>
            <input
              type="text"
              value={rcd.client_cnpj || ''}
              onChange={e => setRcd(prev => ({ ...prev, client_cnpj: e.target.value }))}
              placeholder="00.000.000/0000-00"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Inscrição Estadual / RG
            </label>
            <input
              type="text"
              value={rcd.client_ie || ''}
              onChange={e => setRcd(prev => ({ ...prev, client_ie: e.target.value }))}
              placeholder="Inscrição estadual"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Endereço do Cliente
            </label>
            <input
              type="text"
              value={rcd.client_address || ''}
              onChange={e => setRcd(prev => ({ ...prev, client_address: e.target.value }))}
              placeholder="Rua, número, bairro, cidade - UF, CEP"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Contato
              </label>
              <input
                type="text"
                value={rcd.client_contact || ''}
                onChange={e => setRcd(prev => ({ ...prev, client_contact: e.target.value }))}
                placeholder="Pessoa de contato"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Telefone
              </label>
              <input
                type="text"
                value={rcd.client_phone || ''}
                onChange={e => setRcd(prev => ({ ...prev, client_phone: e.target.value }))}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
              />
            </div>
          </div>
        </div>

        {/* Descrição do Problema / Diagnóstico */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
            Descrição do Problema / Inspeção
          </label>
          <textarea
            rows={2}
            value={rcd.problem_description || ''}
            onChange={e => setRcd(prev => ({ ...prev, problem_description: e.target.value }))}
            placeholder="Descreva as avarias e o motivo da cobrança das despesas..."
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none resize-none focus:border-mustard-500"
          />
        </div>
      </div>

      {/* 2. Seleção de Peças da OS para Cobrança */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
              <span className="material-symbols-outlined text-mustard-500 text-lg">inventory_2</span>
              Peças a Serem Cobradas do Cliente
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecione quais peças lançadas na OS farão parte do ressarcimento.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAllParts(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold tracking-wider transition-colors"
            >
              Cobrar Todas
            </button>
            <button
              type="button"
              onClick={() => handleSelectAllParts(false)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-bold tracking-wider transition-colors"
            >
              Desmarcar Todas
            </button>
          </div>
        </div>

        {osParts.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
            Nenhuma peça lançada na aba &quot;Peças&quot; desta Ordem de Serviço. Adicione peças na aba de Peças para cobrá-las no RCD.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="py-2.5 px-3 text-center w-12">Cobrar</th>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Material / Descrição</th>
                  <th className="py-2.5 px-3 text-center w-28">Qtd OS</th>
                  <th className="py-2.5 px-3 text-center w-28">Qtd Cobrar</th>
                  <th className="py-2.5 px-3 text-right w-32">Valor Unit. (R$)</th>
                  <th className="py-2.5 px-3 text-right w-32">Subtotal (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {osParts.map(p => {
                  const isChecked = Boolean(selectedPartIds[p.part_id]);
                  const rcdPart = (rcd.parts || []).find(rp => rp.part_id === p.part_id);
                  const currentQty = rcdPart ? rcdPart.quantity : p.quantity_used;
                  const currentUnit = rcdPart ? rcdPart.unit_value : p.unit_value_at_use;
                  const currentSubtotal = rcdPart ? rcdPart.subtotal : p.quantity_used * p.unit_value_at_use;

                  return (
                    <tr
                      key={p.part_id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${isChecked ? 'bg-amber-50/20 dark:bg-amber-500/5' : ''
                        }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePart(p.part_id)}
                          className="w-4 h-4 text-mustard-600 rounded border-slate-300 focus:ring-mustard-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-500">
                        {p.internal_code || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {p.description}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500">
                        {p.quantity_used}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isChecked ? (
                          <input
                            type="number"
                            min="1"
                            max={p.quantity_used}
                            value={currentQty}
                            onChange={e => handleUpdatePartField(p.part_id, 'quantity', Number(e.target.value))}
                            className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center text-sm font-semibold outline-none focus:border-mustard-500"
                          />
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isChecked ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentUnit}
                            onChange={e => handleUpdatePartField(p.part_id, 'unit_value', Number(e.target.value))}
                            className="w-24 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right text-sm font-semibold outline-none focus:border-mustard-500"
                          />
                        ) : (
                          <span className="text-slate-400">
                            {p.unit_value_at_use.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                        {isChecked ? (
                          `R$ ${currentSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        ) : (
                          <span className="text-slate-400 font-normal">R$ 0,00</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Subtotal Peças */}
        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-right">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-3">
              Total das Peças Selecionadas:
            </span>
            <span className="text-base font-black text-slate-900 dark:text-white">
              R$ {totalParts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Serviços e Despesas Adicionais */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
              <span className="material-symbols-outlined text-mustard-500 text-lg">engineering</span>
              Relação de Serviços e Despesas
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Adicione deslocamento (com KM), mão de obra de manutenção ou outras despesas para o cliente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddService('deslocamento')}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold tracking-wider transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">distance</span>
              + Deslocamento
            </button>
            <button
              type="button"
              onClick={() => handleAddService('mao_de_obra')}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold tracking-wider transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">build</span>
              + Mão de Obra
            </button>
            <button
              type="button"
              onClick={() => handleAddService('outro')}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold tracking-wider transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              + Outro Serviço
            </button>
          </div>
        </div>

        {(rcd.services || []).length === 0 ? (
          <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
            Nenhum serviço ou deslocamento adicionado. Use os botões acima para incluir mão de obra ou quilometragem.
          </div>
        ) : (
          <div className="space-y-3">
            {(rcd.services || []).map((s, idx) => (
              <div
                key={s.id || idx}
                className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Descrição do Serviço
                    </label>
                    <input
                      type="text"
                      value={s.description}
                      onChange={e => handleUpdateServiceField(s.id!, 'description', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500 font-medium"
                    />
                  </div>

                  {s.type === 'deslocamento' ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Quilometragem (KM)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={s.km || ''}
                        onChange={e => handleUpdateServiceField(s.id!, 'km', Number(e.target.value))}
                        placeholder="KM rodados"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-center text-slate-900 dark:text-white outline-none focus:border-mustard-500 font-medium"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Quantidade / Horas
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={s.quantity}
                        onChange={e => handleUpdateServiceField(s.id!, 'quantity', Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-center text-slate-900 dark:text-white outline-none focus:border-mustard-500 font-medium"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {s.type === 'deslocamento' ? 'Valor por KM (R$)' : 'Valor Unitário (R$)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={s.unit_value}
                      onChange={e => handleUpdateServiceField(s.id!, 'unit_value', Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-right text-slate-900 dark:text-white outline-none focus:border-mustard-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-2 md:pt-0 border-slate-200 dark:border-slate-700">
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Subtotal
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      R$ {s.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveService(s.id!)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Remover serviço"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Subtotal Serviços */}
        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-right">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-3">
              Total dos Serviços:
            </span>
            <span className="text-base font-black text-slate-900 dark:text-white">
              R$ {totalServices.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Total Consolidado, Condições de Pagamento & Parcelamento */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-mustard-500/10 via-amber-500/5 to-transparent dark:from-mustard-500/20 rounded-2xl border border-mustard-500/20">
          <div>
            <span className="text-xs font-black text-mustard-700 dark:text-mustard-400 uppercase tracking-widest">
              Total Consolidado do RCD
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5">
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Peças: R$ {totalParts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Serviços: R$ {totalServices.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Condição de Pagamento (Texto)
            </label>
            <input
              type="text"
              value={rcd.payment_terms || ''}
              onChange={e => setRcd(prev => ({ ...prev, payment_terms: e.target.value }))}
              placeholder="Ex: 15 DIAS PARA PAGAMENTO"
              className="w-full sm:w-64 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-mustard-500"
            />
          </div>
        </div>

        {/* Observações */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
            Observações do Orçamento / RCD
          </label>
          <textarea
            rows={2}
            value={rcd.notes || ''}
            onChange={e => setRcd(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Observações que constarão no relatório..."
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none resize-none focus:border-mustard-500"
          />
        </div>

        {/* Configuração de Faturamento em Bills */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                <span className="material-symbols-outlined text-mustard-500 text-lg">credit_card</span>
                Forma de Pagamento & Parcelamento para Faturamento
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Defina como o valor consolidado será lançado em Contas a Receber.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={rcd.payment_method || 'Boleto Bancário'}
                onChange={e => setRcd(prev => ({ ...prev, payment_method: e.target.value }))}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="Boleto Bancário">Boleto Bancário</option>
                <option value="PIX">PIX</option>
                <option value="Transferência Bancária">Transferência Bancária</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
              </select>

              <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setRcd(prev => ({
                      ...prev,
                      payment_type: 'a_vista',
                      installments_count: 1,
                      installments_data: [
                        {
                          installment_number: 1,
                          due_date: prev.validity_date || new Date().toISOString().split('T')[0],
                          gross_value: totalValue,
                        },
                      ],
                    }));
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${rcd.payment_type !== 'parcelado'
                      ? 'bg-mustard-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  À Vista
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRcd(prev => ({
                      ...prev,
                      payment_type: 'parcelado',
                      installments_count: prev.installments_count && prev.installments_count > 1 ? prev.installments_count : 2,
                    }));
                    handleGenerateInstallments(rcd.installments_count && rcd.installments_count > 1 ? rcd.installments_count : 2);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${rcd.payment_type === 'parcelado'
                      ? 'bg-mustard-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  Parcelado
                </button>
              </div>
            </div>
          </div>

          {/* Grade de Parcelas */}
          {rcd.payment_type === 'parcelado' && (
            <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Dividir em:</span>
                  <select
                    value={rcd.installments_count || 2}
                    onChange={e => handleGenerateInstallments(Number(e.target.value))}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    {[2, 3, 4, 5, 6, 10, 12].map(n => (
                      <option key={n} value={n}>
                        {n} vezes
                      </option>
                    ))}
                  </select>
                </div>

                {Math.abs(installmentsDiff) > 0.05 && (
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    Soma das parcelas: R$ {installmentsSum.toFixed(2)} (Diferença: R$ {installmentsDiff.toFixed(2)})
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(rcd.installments_data || []).map((inst, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Parcela {inst.installment_number}</span>
                      <span className="text-[10px] font-black uppercase text-mustard-600 dark:text-mustard-500">
                        {Math.round(((inst.gross_value || 0) / (totalValue || 1)) * 100)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Vencimento
                        </label>
                        <input
                          type="date"
                          value={inst.due_date ? inst.due_date.split('T')[0] : ''}
                          onChange={e => handleUpdateInstallment(idx, 'due_date', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-mustard-500 font-medium"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Valor (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={inst.gross_value}
                          onChange={e => handleUpdateInstallment(idx, 'gross_value', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-right outline-none focus:border-mustard-500 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Geração de Documentos (PDF) & Anexo do Relatório Assinado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bloco de Emissão de Documentos */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
            <span className="material-symbols-outlined text-mustard-500 text-lg">print</span>
            Documentos em PDF
          </h4>
          <p className="text-xs text-slate-400">
            Gere o Relatório de Danos oficial para aprovação ou a Fatura corporativa de cobrança.
          </p>

          <div className="space-y-3 pt-1">
            {/* Relatório RCD */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  Relatório de Danos e Despesas (RCD)
                </div>
                <div className="text-xs text-slate-400">
                  Modelo oficial com detalhamento de peças, serviços e termo de aprovação.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleViewRcdPdf}
                  disabled={generatingRcdPdf}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:text-mustard-600 dark:hover:text-mustard-400 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700"
                  title="Visualizar em nova aba"
                >
                  <span className="material-symbols-outlined text-lg">visibility</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadRcdPdf}
                  disabled={generatingRcdPdf}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold tracking-wider transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Baixar RCD
                </button>
              </div>
            </div>

            {/* Fatura RCD */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  Fatura de Ressarcimento
                </div>
                <div className="text-xs text-slate-400">
                  Modelo padrão corporativo (Fatura de Locação) com parcelas e dados bancários.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleViewFaturaPdf}
                  disabled={generatingFaturaPdf}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700"
                  title="Visualizar em nova aba"
                >
                  <span className="material-symbols-outlined text-lg">visibility</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFaturaPdf}
                  disabled={generatingFaturaPdf}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Baixar Fatura
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bloco de Anexo do Relatório Assinado */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
            <span className="material-symbols-outlined text-mustard-500 text-lg">attachment</span>
            Relatório Assinado pelo Cliente
          </h4>
          <p className="text-xs text-slate-400">
            Anexe o arquivo (PDF ou imagem) do relatório assinado e aprovado pelo cliente na OS.
          </p>

          {rcd.signed_document_url ? (
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-2xl">
                    verified
                  </span>
                  <div>
                    <div className="font-bold text-sm text-emerald-950 dark:text-emerald-300">
                      Relatório Assinado Anexado
                    </div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-400">
                      {rcd.signed_at ? `Anexado em ${formatDate(rcd.signed_at)}` : 'Disponível na OS'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={rcd.signed_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    Abrir
                  </a>
                  <button
                    type="button"
                    onClick={handleRemoveSignedDoc}
                    className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Remover anexo"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-mustard-400 dark:hover:border-mustard-500 rounded-2xl transition-colors flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-slate-400 text-3xl mb-1">
                cloud_upload
              </span>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {uploadingSignedDoc ? 'Enviando arquivo...' : 'Clique para selecionar o relatório assinado'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Formatos suportados: PDF, JPEG ou PNG
              </p>

              <label className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow-sm">
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  onChange={handleFileUpload}
                  disabled={uploadingSignedDoc}
                  className="hidden"
                />
                <span className="material-symbols-outlined text-base">upload</span>
                Selecionar Arquivo
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RcdTabContent;
