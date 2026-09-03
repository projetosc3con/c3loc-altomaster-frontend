import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { logisticsService, type LogisticsContract, type TriagePhoto } from '../services/logistics';
import { financeiroService } from '../services/financeiro';
import SearchableSelect from '../components/SearchableSelect';
import type { Equipment, AsaasChargeResult } from '../types';
import { TriageChecklistDocument } from '../components/logistics/TriageChecklistDocument';
import { FaturaLocacaoDocument } from '../components/logistics/FaturaLocacaoDocument';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDate } from '../utils/date';
import { supabase } from '../lib/supabase';

const STEPS = [
  { key: 'triagem', label: 'Triagem', icon: 'fact_check' },
  { key: 'documentacao', label: 'Documentação', icon: 'photo_camera' },
  { key: 'emissao', label: 'Emissão', icon: 'receipt_long' },
];

const CHECKLIST_ITEMS = [
  { position: 1, label: 'Dianteira' },
  { position: 2, label: 'Traseira' },
  { position: 3, label: 'Lateral direita' },
  { position: 4, label: 'Lateral esquerda' },
  { position: 5, label: 'Tanque hidráulico' },
  { position: 6, label: 'Bloco hidráulico' },
  { position: 7, label: 'Baterias' },
  { position: 8, label: 'Roda lateral direita dianteira' },
  { position: 9, label: 'Roda lateral direita traseira' },
  { position: 10, label: 'Roda lateral esquerda dianteira' },
  { position: 11, label: 'Roda lateral esquerda traseira' },
  { position: 12, label: 'Deck dianteira' },
  { position: 13, label: 'Deck traseira' },
  { position: 14, label: 'Barra deck direita' },
  { position: 15, label: 'Barra deck esquerda' },
  { position: 16, label: 'Porta manual' },
  { position: 17, label: 'Joystick' },
  { position: 18, label: 'Painel de solo' },
  { position: 19, label: 'Horimetro' },
  { position: 20, label: 'Patrimonio' },
  { position: 21, label: 'Plugue tomada' },
  { position: 22, label: 'Placa de identificação' },
];

export interface TriagedEquipmentItem {
  tempId: string;
  intended_index?: number;
  intended_name?: string;
  equipment_id: string;
  equipment_name?: string;
  equipment_type?: string;
  equipment_size?: string;
  asset_number?: string;
  model?: string;
  serial_number?: string;
  hour_meter?: number;
  billing_period_start: string;
  billing_period_end: string;
  cost_rental: number;
  cost_insurance: number;
  cost_freight: number;
  cost_rcd: number;
  cost_third_party: number;
  cost_training: number;
  total_value: number;
}

const LogisticsTriagem: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<LogisticsContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Triage form data
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [triagedEquipments, setTriagedEquipments] = useState<TriagedEquipmentItem[]>([]);
  const [activeEquipmentTab, setActiveEquipmentTab] = useState<string>('');
  const [workSite, setWorkSite] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientCnpj, setClientCnpj] = useState('');

  // Checklist Photos State
  const [triagePhotos, setTriagePhotos] = useState<TriagePhoto[]>([]);
  const [uploadingPosition, setUploadingPosition] = useState<number | null>(null);

  // UI View Mode for checklist
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Faturamento & Documento Fiscal
  const [billingMethod, setBillingMethod] = useState<'ASAAS' | 'MANUAL'>('ASAAS');
  const [manualDueDate, setManualDueDate] = useState<string>('');
  const [documentType, setDocumentType] = useState<'FATURA_LOCACAO' | 'NFSE'>('FATURA_LOCACAO');
  const [companySettings, setCompanySettings] = useState<any>(null);

  // Boleto generation on finish
  const [chargeConfirmOpen, setChargeConfirmOpen] = useState(false);
  const [charging, setCharging] = useState(false);
  const [chargeResult, setChargeResult] = useState<AsaasChargeResult | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  // Save step 1 draft changes to localStorage
  useEffect(() => {
    if (!id || loading) return;
    const draft = {
      triagedEquipments,
      workSite
    };
    localStorage.setItem(`triage_draft_${id}`, JSON.stringify(draft));
  }, [id, triagedEquipments, workSite, loading]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [contractData, equipmentsRes, photosRes] = await Promise.all([
        logisticsService.getContractById(id!),
        api.get('/equipments'),
        logisticsService.getTriagePhotos(id!)
      ]);

      setContract(contractData);
      const allEquipments: Equipment[] = equipmentsRes.data || [];
      setEquipments(allEquipments);
      setTriagePhotos(photosRes || []);

      // Initialize manual due date from contract period end
      const initialDueDate = contractData.contract_form?.period_end || contractData.snapshot?.period_end || new Date().toISOString().split('T')[0];
      setManualDueDate(initialDueDate);

      // Load company settings for Fatura PDF
      try {
        const { data: settings } = await supabase
          .from('erp_company_settings')
          .select('*')
          .eq('active', true)
          .maybeSingle();
        if (settings) setCompanySettings(settings);
      } catch (sErr) {
        console.warn('Erro ao carregar erp_company_settings:', sErr);
      }

      // Check localStorage for saved draft first
      const draftStr = localStorage.getItem(`triage_draft_${id}`);
      let savedWorkSite = '';
      let savedTriagedEquipments: TriagedEquipmentItem[] | null = null;
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          savedWorkSite = draft.workSite || '';
          if (Array.isArray(draft.triagedEquipments) && draft.triagedEquipments.length > 0) {
            savedTriagedEquipments = draft.triagedEquipments;
          }
        } catch (e) {
          console.error('Erro ao fazer parse do localStorage draft:', e);
        }
      }

      // Pre-fill from contract_form data or draft
      const form = contractData.contract_form;

      let initialWorkSite = savedWorkSite;
      if (!initialWorkSite) {
        if (form) initialWorkSite = form.work_site || '';
        else if (contractData.snapshot) initialWorkSite = contractData.snapshot.work_site || '';
      }
      setWorkSite(initialWorkSite);

      let initialClientName = '';
      let initialClientCnpj = '';

      if (form) {
        initialClientName = form.locatario_company_name || '';
        initialClientCnpj = form.locatario_cnpj || '';
      } else if (contractData.snapshot) {
        initialClientName = contractData.snapshot.locatario?.company_name || '';
        initialClientCnpj = contractData.snapshot.locatario?.cnpj || '';
      }

      // Pre-fill from deal client if still empty
      if (contractData.deal?.client) {
        if (!initialClientName) initialClientName = contractData.deal.client.company_name || '';
        if (!initialClientCnpj) initialClientCnpj = contractData.deal.client.cnpj || '';
      }

      setClientName(initialClientName);
      setClientCnpj(initialClientCnpj);

      // Initialize Triaged Equipments list
      if (savedTriagedEquipments && savedTriagedEquipments.length > 0) {
        // Enriquecer com os dados atuais do estoque
        const enriched = savedTriagedEquipments.map(item => {
          const matched = allEquipments.find(e => e.id === item.equipment_id);
          return {
            ...item,
            equipment_name: matched?.name || item.equipment_name,
            equipment_type: matched?.type || item.equipment_type,
            asset_number: matched?.asset_number || item.asset_number,
            model: matched?.model || item.model,
            serial_number: matched?.serial_number || item.serial_number,
            hour_meter: (matched as any)?.hour_meter ?? item.hour_meter
          };
        });
        setTriagedEquipments(enriched);
        setActiveEquipmentTab(enriched[0].equipment_id || enriched[0].tempId);
      } else if (contractData.intended_equipments && contractData.intended_equipments.length > 0) {
        const initialList: TriagedEquipmentItem[] = contractData.intended_equipments.map((item, idx) => {
          const matched = item.equipment_id ? allEquipments.find(e => e.id === item.equipment_id) : undefined;
          return {
            tempId: item.tempId || `triaged-${idx}-${Math.random().toString(36).substring(2, 7)}`,
            intended_index: idx + 1,
            intended_name: item.equipment_name
              ? `${item.equipment_name}${item.equipment_size ? ' (' + item.equipment_size + ')' : ''}`
              : `Equipamento Pretendido #${idx + 1}`,
            equipment_id: item.equipment_id || '',
            equipment_name: matched?.name || item.equipment_name || '',
            equipment_type: matched?.type || item.equipment_type || '',
            equipment_size: item.equipment_size || '',
            asset_number: matched?.asset_number || item.asset_number || '',
            model: matched?.model || '',
            serial_number: matched?.serial_number || '',
            hour_meter: (matched as any)?.hour_meter,
            billing_period_start: item.billing_period_start || form?.period_start || contractData.snapshot?.period_start || '',
            billing_period_end: item.billing_period_end || form?.period_end || contractData.snapshot?.period_end || '',
            cost_rental: Number(item.cost_rental) || 0,
            cost_insurance: Number(item.cost_insurance) || 0,
            cost_freight: Number(item.cost_freight) || 0,
            cost_rcd: Number(item.cost_rcd) || 0,
            cost_third_party: Number(item.cost_third_party) || 0,
            cost_training: Number(item.cost_training) || 0,
            total_value: Number(item.total_value) || 0
          };
        });
        setTriagedEquipments(initialList);
        setActiveEquipmentTab(initialList[0].equipment_id || initialList[0].tempId);
      } else {
        // Fallback para único equipamento
        const defaultItem: TriagedEquipmentItem = {
          tempId: `triaged-0-${Math.random().toString(36).substring(2, 7)}`,
          intended_index: 1,
          intended_name: form?.equipment_description || 'Equipamento Principal',
          equipment_id: '',
          billing_period_start: form?.period_start || contractData.snapshot?.period_start || '',
          billing_period_end: form?.period_end || contractData.snapshot?.period_end || '',
          cost_rental: Number(form?.cost_rental) || 0,
          cost_insurance: Number(form?.cost_insurance) || 0,
          cost_freight: Number(form?.cost_freight) || 0,
          cost_rcd: Number(form?.cost_rcd) || 0,
          cost_third_party: Number(form?.cost_third_party) || 0,
          cost_training: Number(form?.cost_training) || 0,
          total_value: Number(form?.cost_total) || 0
        };
        setTriagedEquipments([defaultItem]);
        setActiveEquipmentTab(defaultItem.tempId);
      }

      // Se o contrato já foi processado, abre diretamente na última etapa (Emissão)
      if (contractData.status === 'Processado') {
        setCurrentStep(2);
      }
    } catch (err) {
      console.error('Erro ao carregar contrato:', err);
      setError('Erro ao carregar dados do contrato.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStockEquipment = (tempId: string, eqId: string) => {
    const selectedEq = equipments.find(e => e.id === eqId);
    setTriagedEquipments(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      return {
        ...item,
        equipment_id: eqId,
        equipment_name: selectedEq?.name || item.equipment_name,
        equipment_type: selectedEq?.type || item.equipment_type,
        asset_number: selectedEq?.asset_number || item.asset_number,
        model: selectedEq?.model || item.model,
        serial_number: selectedEq?.serial_number || item.serial_number,
        hour_meter: (selectedEq as any)?.hour_meter ?? item.hour_meter
      };
    }));

    if (!activeEquipmentTab || activeEquipmentTab === tempId) {
      setActiveEquipmentTab(eqId || tempId);
    }
  };

  const handleEquipmentFieldChange = (tempId: string, field: keyof TriagedEquipmentItem, value: any) => {
    setTriagedEquipments(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      const updated = { ...item, [field]: value };
      if (['cost_rental', 'cost_insurance', 'cost_freight', 'cost_rcd', 'cost_third_party', 'cost_training'].includes(field)) {
        updated.total_value = (
          (Number(updated.cost_rental) || 0) +
          (Number(updated.cost_insurance) || 0) +
          (Number(updated.cost_freight) || 0) +
          (Number(updated.cost_rcd) || 0) +
          (Number(updated.cost_third_party) || 0) +
          (Number(updated.cost_training) || 0)
        );
      }
      return updated;
    }));
  };

  const handleAddEquipmentRow = () => {
    const defaultStart = contract?.contract_form?.period_start || contract?.snapshot?.period_start || '';
    const defaultEnd = contract?.contract_form?.period_end || contract?.snapshot?.period_end || '';
    const newTempId = `extra-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newItem: TriagedEquipmentItem = {
      tempId: newTempId,
      intended_name: `Equipamento Adicional #${triagedEquipments.length + 1}`,
      equipment_id: '',
      billing_period_start: defaultStart,
      billing_period_end: defaultEnd,
      cost_rental: 0,
      cost_insurance: 0,
      cost_freight: 0,
      cost_rcd: 0,
      cost_third_party: 0,
      cost_training: 0,
      total_value: 0
    };
    setTriagedEquipments(prev => [...prev, newItem]);
  };

  const handleRemoveEquipmentRow = (tempId: string) => {
    if (triagedEquipments.length <= 1) {
      alert('A triagem deve conter pelo menos um equipamento.');
      return;
    }
    setTriagedEquipments(prev => prev.filter(item => item.tempId !== tempId));
  };

  // Identificar o equipamento ativo para checklist
  const currentActiveEquipment = triagedEquipments.find(e => e.equipment_id === activeEquipmentTab || e.tempId === activeEquipmentTab) || triagedEquipments[0];

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, position: number, label: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!currentActiveEquipment?.equipment_id) {
      alert('Por favor, selecione uma máquina física do estoque para este item antes de tirar fotos do checklist.');
      return;
    }

    try {
      setUploadingPosition(position);
      setError(null);

      const targetEquipmentId = currentActiveEquipment.equipment_id;
      const newPhoto = await logisticsService.uploadTriagePhoto(id!, position, label, file, targetEquipmentId);

      setTriagePhotos(prev => {
        const filtered = prev.filter(p => !(
          p.position === position &&
          (p.equipment_id === targetEquipmentId || (!p.equipment_id && currentActiveEquipment === triagedEquipments[0]))
        ));
        return [...filtered, newPhoto].sort((a, b) => a.position - b.position);
      });
    } catch (err: any) {
      console.error('Erro ao fazer upload da foto:', err);
      setError('Erro ao enviar a foto do checklist.');
    } finally {
      setUploadingPosition(null);
    }
  };

  const handlePhotoDelete = async (photoId: string, filePath: string) => {
    try {
      setError(null);
      await logisticsService.deleteTriagePhoto(id!, photoId, filePath);
      setTriagePhotos(prev => prev.filter(p => p.id !== photoId));
    } catch (err: any) {
      console.error('Erro ao deletar foto:', err);
      setError('Erro ao excluir a foto do checklist.');
    }
  };

  const gerarBoleto = async (invoiceId: string) => {
    setCharging(true);
    setChargeError(null);
    try {
      const result = await financeiroService.gerarCobranca(invoiceId);
      setChargeResult(result);
      setResultModalOpen(true);
    } catch (err) {
      setChargeError(getApiErrorMessage(err));
    } finally {
      setCharging(false);
    }
  };

  const handleFinish = async () => {
    if (!contract) return;
    setChargeConfirmOpen(false);
    try {
      setSubmitting(true);
      setError(null);
      setChargeError(null);

      const updatedContract = await logisticsService.finishProcessing(contract.id, {
        equipments: triagedEquipments,
        equipment_id: triagedEquipments[0]?.equipment_id || undefined,
        billing_method: billingMethod,
        manual_due_date: billingMethod === 'MANUAL' ? manualDueDate : undefined,
        document_type: documentType,
      });

      // Clear localStorage draft upon successful completion
      localStorage.removeItem(`triage_draft_${id}`);
      setContract(updatedContract);
      setSuccess(true);

      // Se for fluxo Asaas, gera cobrança e boleto no Asaas
      if (billingMethod === 'ASAAS' && updatedContract.rental_invoice_id) {
        await gerarBoleto(updatedContract.rental_invoice_id);
      }
    } catch (err: any) {
      console.error('Erro ao finalizar processamento:', err);
      setError(err.response?.data?.error || 'Erro ao finalizar processamento.');
    } finally {
      setSubmitting(false);
    }
  };

  const isStepValid = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      if (!workSite.trim()) return false;
      if (triagedEquipments.length === 0) return false;
      for (const item of triagedEquipments) {
        if (!item.equipment_id) return false;
        if (!item.billing_period_start || !item.billing_period_end) return false;
        if (item.billing_period_end < item.billing_period_start) return false;
      }
      return true;
    }
    if (stepIndex === 1) {
      return true;
    }
    return true;
  };

  const nextStep = () => {
    if (!isStepValid(currentStep)) {
      if (currentStep === 0) {
        setError('Por favor, associe uma máquina física do estoque para cada equipamento e preencha as datas de locação e o local de uso antes de avançar.');
      } else {
        setError(`Por favor, preencha todos os dados obrigatórios da Etapa ${currentStep + 1} antes de avançar.`);
      }
      return;
    }
    setError(null);
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    setError(null);
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mustard-500"></div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <span className="material-symbols-outlined text-4xl text-slate-300">error</span>
        <p className="text-slate-500">Contrato não encontrado.</p>
        <button onClick={() => navigate('/logistica')} className="text-mustard-500 font-bold text-sm underline">
          Voltar para Logística
        </button>
      </div>
    );
  }

  const isProcessed = contract.status === 'Processado';
  const isTriage = contract.status === 'Triagem';

  const getContractValue = (): number => {
    const sumTriaged = triagedEquipments.reduce((acc, e) => acc + (Number(e.total_value) || 0), 0);
    if (sumTriaged > 0) return sumTriaged;
    if (contract.contract_form?.cost_total) return Number(contract.contract_form.cost_total);
    if (contract.snapshot?.costs?.total) return Number(contract.snapshot.costs.total);
    return contract.deal?.value || 0;
  };

  // Obter datas extremas
  const ends = triagedEquipments.map(e => e.billing_period_end).filter(Boolean).sort();
  const periodEnd: string | null = ends.length > 0 ? ends[ends.length - 1] : (contract.contract_form?.period_end || contract.snapshot?.period_end || null);

  const missingDueDate = !isProcessed && isTriage && billingMethod === 'ASAAS' && !periodEnd;
  const missingManualDate = !isProcessed && isTriage && billingMethod === 'MANUAL' && !manualDueDate;

  // Filtrar fotos do equipamento ativo na etapa 2
  const activeEqPhotos = triagePhotos.filter(p => {
    if (p.equipment_id) return p.equipment_id === currentActiveEquipment?.equipment_id;
    return currentActiveEquipment === triagedEquipments[0];
  });

  // Estrutura de dados para o documento PDF de checklist consolidado
  const equipmentsChecklistDataForPdf = triagedEquipments.map((item, idx) => ({
    equipmentLabel: item.asset_number ? `#${item.asset_number} - ${item.equipment_name || 'Equipamento'}` : (item.equipment_name || `Máquina #${idx + 1}`),
    assetNumber: item.asset_number,
    model: item.model,
    period: item.billing_period_start && item.billing_period_end ? `${formatDate(item.billing_period_start)} a ${formatDate(item.billing_period_end)}` : undefined,
    photos: triagePhotos.filter(p => p.equipment_id === item.equipment_id || (!p.equipment_id && idx === 0))
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8 pb-20"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/logistica')}
          className="p-2.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {isProcessed ? 'Detalhes da Triagem e Contrato' : 'Triagem de Contrato e Equipamentos'}
            </h1>
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${contract.status === 'Assinado' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
              contract.status === 'Triagem' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' :
                'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              }`}>
              {contract.status}
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Contrato #{contract.contract_number} — {clientName || 'Cliente'}
          </p>
        </div>
      </div>

      {/* Success Message */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-5 py-4 rounded-2xl text-sm flex items-center gap-3 font-medium"
          >
            <span className="material-symbols-outlined text-emerald-500 text-xl">check_circle</span>
            Contrato processado com sucesso! Equipamentos atualizados para Locado.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 px-5 py-4 rounded-2xl text-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500">error</span>
          {error}
        </div>
      )}

      {/* Stepper */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.key}>
              <div
                className={`flex items-center gap-3 cursor-pointer group ${index <= currentStep ? '' : 'opacity-40'}`}
                onClick={() => {
                  if (isProcessed) {
                    setError(null);
                    setCurrentStep(index);
                    return;
                  }
                  if (index > currentStep) {
                    for (let i = currentStep; i < index; i++) {
                      if (!isStepValid(i)) {
                        setError(`Por favor, preencha todos os dados obrigatórios da Etapa ${i + 1} antes de avançar.`);
                        return;
                      }
                    }
                  }
                  setError(null);
                  setCurrentStep(index);
                }}
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${index < currentStep
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : index === currentStep
                    ? 'bg-mustard-500 text-white shadow-lg shadow-mustard-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  }`}>
                  {index < currentStep ? (
                    <span className="material-symbols-outlined text-xl">check</span>
                  ) : (
                    <span className="material-symbols-outlined text-xl">{step.icon}</span>
                  )}
                </div>
                <div className="hidden md:block">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Etapa {index + 1}
                  </p>
                  <p className={`text-sm font-bold ${index <= currentStep ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                    {step.label}
                  </p>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div className="flex-1 mx-4">
                  <div className={`h-0.5 rounded-full transition-all ${index < currentStep
                    ? 'bg-emerald-500'
                    : 'bg-slate-100 dark:bg-slate-800'
                    }`} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {currentStep === 0 && (
          <motion.div
            key="triagem"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* 1. Dados do Contrato e Obra */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="material-symbols-outlined text-mustard-500 text-xl">person_pin_circle</span>
                <h3 className="font-bold text-slate-900 dark:text-white">Dados do Cliente & Local de Entrega</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Cliente</label>
                  <div className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white font-medium truncate">
                    {clientName || 'Não informado'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">CNPJ</label>
                  <div className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white font-medium font-mono">
                    {clientCnpj || 'Não informado'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Obra / Local de Uso *</label>
                  <input
                    type="text"
                    value={workSite}
                    onChange={(e) => setWorkSite(e.target.value)}
                    disabled={isProcessed}
                    placeholder="Ex: Condomínio Solar das Águas"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* 2. Equipamentos Pretendidos no Contrato (Informativo do CRM) */}
            {contract.intended_equipments && contract.intended_equipments.length > 0 && (
              <div className="bg-amber-50/40 dark:bg-amber-500/5 border border-amber-200/60 dark:border-amber-500/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-lg">contract</span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      Equipamentos Pretendidos no Contrato ({contract.intended_equipments.length})
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Definidos na Negociação Comercial
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {contract.intended_equipments.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800/80 border border-amber-200/40 dark:border-amber-500/20 rounded-xl p-3.5 space-y-2 shadow-sm">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          Item #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {(Number(item.total_value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {item.equipment_name || 'Equipamento'} {item.equipment_size ? `(${item.equipment_size})` : ''}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="material-symbols-outlined text-sm text-slate-400">event</span>
                        <span>
                          {item.billing_period_start ? formatDate(item.billing_period_start) : 'Início'} até {item.billing_period_end ? formatDate(item.billing_period_end) : 'Fim'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Seleção de Máquinas Físicas do Estoque */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-mustard-500 text-xl">precision_manufacturing</span>
                    Equipamentos do Estoque para Entrega ({triagedEquipments.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Selecione a máquina física específica do estoque para cada item e confirme seu período de locação.
                  </p>
                </div>
                {!isProcessed && (
                  <button
                    type="button"
                    onClick={handleAddEquipmentRow}
                    className="px-3.5 py-2 bg-mustard-50 dark:bg-mustard-500/10 hover:bg-mustard-100 dark:hover:bg-mustard-500/20 text-mustard-700 dark:text-mustard-300 border border-mustard-200 dark:border-mustard-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Adicionar Equipamento
                  </button>
                )}
              </div>

              <div className="p-6 space-y-6">
                {triagedEquipments.map((item, index) => {
                  const selectedEq = equipments.find(e => e.id === item.equipment_id);
                  // Filtra máquinas que já foram selecionadas em outro item desta triagem
                  const availableOptions = equipments.filter(eq =>
                    eq.id === item.equipment_id || !triagedEquipments.some(other => other.tempId !== item.tempId && other.equipment_id === eq.id)
                  );

                  return (
                    <div
                      key={item.tempId}
                      className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/40 dark:bg-slate-800/20 space-y-4"
                    >
                      {/* Top Bar of item card */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-mustard-500 text-white text-xs font-black flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {item.intended_name || `Equipamento #${index + 1}`}
                          </span>
                          {selectedEq && (
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              selectedEq.status === 'Disponível' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
                              selectedEq.status === 'Locado' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' :
                              'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                            }`}>
                              {selectedEq.status}
                            </span>
                          )}
                        </div>
                        {!isProcessed && triagedEquipments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEquipmentRow(item.tempId)}
                            className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                            Remover
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* SearchableSelect for Stock Equipment */}
                        <div className="md:col-span-2">
                          <SearchableSelect
                            label="Máquina Física do Estoque"
                            placeholder="Selecione o equipamento correspondente pelo patrimônio ou nome"
                            items={availableOptions}
                            selectedId={item.equipment_id}
                            onSelect={(eqId) => handleSelectStockEquipment(item.tempId, eqId)}
                            getDisplayValue={(eq) => `${eq.asset_number ? '#' + eq.asset_number + ' - ' : ''}${eq.name} (${eq.status})`}
                            getSearchValue={(eq) => `${eq.name} ${eq.asset_number || ''} ${eq.type || ''} ${eq.status} ${eq.model || ''}`}
                            disabled={isProcessed}
                          />
                        </div>

                        {/* Equipment details badge if selected */}
                        {selectedEq && (
                          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Patrimônio</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{selectedEq.asset_number || 'S/N'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Modelo</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{selectedEq.model || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Nº de Série</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{selectedEq.serial_number || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Horímetro Atual</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{(selectedEq as any)?.hour_meter ?? item.hour_meter ?? '0'}h</span>
                            </div>
                          </div>
                        )}

                        {/* Individual Billing Period Start */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
                            Data Início da Locação *
                          </label>
                          <input
                            type="date"
                            value={item.billing_period_start || ''}
                            onChange={(e) => handleEquipmentFieldChange(item.tempId, 'billing_period_start', e.target.value)}
                            disabled={isProcessed}
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-mustard-500"
                          />
                        </div>

                        {/* Individual Billing Period End */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
                            Data Término da Locação *
                          </label>
                          <input
                            type="date"
                            value={item.billing_period_end || ''}
                            onChange={(e) => handleEquipmentFieldChange(item.tempId, 'billing_period_end', e.target.value)}
                            disabled={isProcessed}
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-mustard-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {currentStep === 1 && (
          <motion.div
            key="documentacao"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Selector de Abas dos Equipamentos */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-500">checklist</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Selecione o Equipamento para Realizar o Checklist Fotográfico
                  </h4>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  Total de Fotos: {triagePhotos.length} fotos salvas
                </span>
              </div>

              {/* Abas horizontais dos equipamentos */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {triagedEquipments.map((item, idx) => {
                  const eqPhotos = triagePhotos.filter(p => p.equipment_id === item.equipment_id || (!p.equipment_id && idx === 0));
                  const isComplete = eqPhotos.length === CHECKLIST_ITEMS.length;
                  const isTabActive = (activeEquipmentTab === item.equipment_id) || (!activeEquipmentTab && idx === 0);

                  return (
                    <button
                      key={item.tempId}
                      type="button"
                      onClick={() => setActiveEquipmentTab(item.equipment_id || item.tempId)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 whitespace-nowrap border ${
                        isTabActive
                          ? 'bg-mustard-500 text-white border-mustard-500 shadow-md shadow-mustard-500/20'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">precision_manufacturing</span>
                      <span>{item.asset_number ? `Patrimônio #${item.asset_number}` : `Máquina #${idx + 1}`}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                        isTabActive
                          ? 'bg-black/20 text-white'
                          : isComplete
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {eqPhotos.length}/{CHECKLIST_ITEMS.length} fotos {isComplete && '✓'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Photo Upload Section for Active Equipment */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 rounded-t-2xl flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-mustard-500 text-xl">photo_camera</span>
                    Checklist de Saída: {currentActiveEquipment?.asset_number ? `Patrimônio #${currentActiveEquipment.asset_number} — ` : ''}{currentActiveEquipment?.equipment_name || 'Equipamento'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Confira e registre as 22 fotos de inspeção obrigatórias antes da expedição desta máquina.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* View Mode Toggle */}
                  <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg flex items-center transition-all ${viewMode === 'grid'
                        ? 'bg-white dark:bg-slate-700 text-mustard-500 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      title="Visualização em Grade"
                    >
                      <span className="material-symbols-outlined text-[18px]">grid_view</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-lg flex items-center transition-all ${viewMode === 'list'
                        ? 'bg-white dark:bg-slate-700 text-mustard-500 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      title="Visualização em Lista"
                    >
                      <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                    </button>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-700 dark:text-slate-300">
                    Progresso: {activeEqPhotos.length} / {CHECKLIST_ITEMS.length}
                  </div>
                </div>
              </div>
              <div className="p-6">
                {viewMode === 'grid' ? (
                  /* Photo Checklist Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {CHECKLIST_ITEMS.map((item) => {
                      const photo = activeEqPhotos.find(p => p.position === item.position);
                      const isUploading = uploadingPosition === item.position;

                      return (
                        <div
                          key={item.position}
                          className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
                        >
                          {/* Title and Badge */}
                          <div className="flex justify-between items-start gap-2 mb-3">
                            <div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Item {item.position}
                              </span>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                {item.label}
                              </h4>
                            </div>
                            <div>
                              {photo ? (
                                <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-100/50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                  <span className="material-symbols-outlined text-[12px] font-black">check</span>
                                  Concluído
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                  Pendente
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Image Preview / Placeholder */}
                          <div className="relative aspect-video w-full bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200/60 dark:border-slate-700/40 mb-4">
                            {isUploading ? (
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-2 border-mustard-500/30 border-t-mustard-500 rounded-full animate-spin" />
                                <span className="text-[11px] font-medium text-slate-500">Enviando...</span>
                              </div>
                            ) : photo ? (
                              <>
                                <img
                                  src={photo.file_url}
                                  alt={item.label}
                                  className="w-full h-full object-cover"
                                />
                                {!isProcessed && (
                                  <button
                                    type="button"
                                    onClick={() => handlePhotoDelete(photo.id, photo.file_path)}
                                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                  </button>
                                )}
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-600">
                                <span className="material-symbols-outlined text-3xl">photo_camera</span>
                                <span className="text-[11px]">Nenhuma foto registrada</span>
                              </div>
                            )}
                          </div>

                          {/* Upload Controls */}
                          {!isProcessed && !photo && !isUploading && (
                            <div className="flex gap-2">
                              {/* Option 1: Direct Camera Capture (Mobile) */}
                              <label className="flex-1 py-2 px-3 bg-mustard-500 hover:bg-mustard-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest text-center cursor-pointer transition-all flex items-center justify-center gap-1 shadow-md shadow-mustard-500/10">
                                <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                                Câmera
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={(e) => handlePhotoUpload(e, item.position, item.label)}
                                />
                              </label>

                              {/* Option 2: Gallery Upload (Desktop/Fallback) */}
                              <label className="py-2 px-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-widest text-center cursor-pointer transition-all flex items-center justify-center">
                                <span className="material-symbols-outlined text-[16px]">file_upload</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handlePhotoUpload(e, item.position, item.label)}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Photo Checklist List */
                  <div className="space-y-3">
                    {CHECKLIST_ITEMS.map((item) => {
                      const photo = activeEqPhotos.find(p => p.position === item.position);
                      const isUploading = uploadingPosition === item.position;

                      return (
                        <div
                          key={item.position}
                          className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            {photo ? (
                              <span className="material-symbols-outlined text-emerald-500 text-xl font-bold shrink-0">check_box</span>
                            ) : (
                              <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-xl shrink-0">check_box_outline_blank</span>
                            )}
                            <div className="min-w-0">
                              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                                Item {item.position}
                              </span>
                              <span className="text-sm font-bold text-slate-750 dark:text-slate-200 truncate block">
                                {item.label}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            {isUploading ? (
                              <div className="w-10 h-10 flex items-center justify-center">
                                <div className="w-6 h-6 border-2 border-mustard-500/30 border-t-mustard-500 rounded-full animate-spin" />
                              </div>
                            ) : photo ? (
                              <div className="relative group/thumb w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0">
                                <img
                                  src={photo.file_url}
                                  alt={item.label}
                                  className="w-full h-full object-cover"
                                />
                                <div
                                  onClick={() => window.open(photo.file_url, '_blank')}
                                  className="absolute inset-0 bg-black/45 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-white text-xs font-black">visibility</span>
                                </div>
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 shrink-0">
                                <span className="material-symbols-outlined text-lg">image</span>
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              {isUploading ? null : photo ? (
                                !isProcessed && (
                                  <button
                                    type="button"
                                    onClick={() => handlePhotoDelete(photo.id, photo.file_path)}
                                    className="w-9 h-9 bg-red-50 hover:bg-red-500 dark:bg-red-500/10 dark:hover:bg-red-600 text-red-500 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-sm"
                                    title="Excluir foto"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                )
                              ) : (
                                !isProcessed && (
                                  <div className="flex items-center gap-2">
                                    <label className="py-2 px-3 bg-mustard-500 hover:bg-mustard-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1 shadow-md shadow-mustard-500/10 active:scale-[0.97]">
                                      <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                                      Câmera
                                      <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={(e) => handlePhotoUpload(e, item.position, item.label)}
                                      />
                                    </label>

                                    <label className="py-2 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center active:scale-[0.97]">
                                      <span className="material-symbols-outlined text-[14px]">file_upload</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handlePhotoUpload(e, item.position, item.label)}
                                      />
                                    </label>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {currentStep === 2 && (
          <motion.div
            key="emissao"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Summary Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-500 text-xl">receipt_long</span>
                  Resumo Geral da Locação
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Confira todos os equipamentos triados, seus checklists fotográficos e os valores finais.
                </p>
              </div>

              {/* Tabela de Equipamentos Triados */}
              <div className="p-6 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Equipamentos Triados ({triagedEquipments.length})
                </h4>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-black tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Patrimônio / Nome</th>
                        <th className="py-3 px-4">Modelo</th>
                        <th className="py-3 px-4">Período</th>
                        <th className="py-3 px-4">Checklist de Saída</th>
                        <th className="py-3 px-4 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {triagedEquipments.map((item, idx) => {
                        const photosCount = triagePhotos.filter(p => p.equipment_id === item.equipment_id || (!p.equipment_id && idx === 0)).length;
                        const isComplete = photosCount === CHECKLIST_ITEMS.length;

                        return (
                          <tr key={item.tempId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                              {item.asset_number ? `#${item.asset_number} — ` : ''}{item.equipment_name || 'Equipamento'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                              {item.model || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                              {item.billing_period_start && item.billing_period_end ? (
                                `${formatDate(item.billing_period_start)} a ${formatDate(item.billing_period_end)}`
                              ) : 'Não informado'}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${
                                isComplete
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              }`}>
                                <span className="material-symbols-outlined text-xs">{isComplete ? 'check_circle' : 'pending'}</span>
                                {photosCount} / {CHECKLIST_ITEMS.length} fotos
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                              {(Number(item.total_value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Contrato</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">#{contract.contract_number} (v{contract.version})</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Cliente</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">{clientName || 'N/A'}</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Local de Uso</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">{workSite || 'N/A'}</span>
                  </div>
                  <div className="p-3.5 bg-mustard-50/50 dark:bg-mustard-500/10 rounded-xl border border-mustard-200/60 dark:border-mustard-500/20">
                    <span className="text-[10px] font-black text-mustard-600 dark:text-mustard-400 uppercase tracking-widest block">Valor Total Geral</span>
                    <span className="text-base font-black text-mustard-700 dark:text-mustard-300">
                      {getContractValue().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuração de Faturamento & Documento Fiscal */}
            {!isProcessed && isTriage && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="w-10 h-10 rounded-2xl bg-mustard-500/10 text-mustard-600 dark:text-mustard-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Condições de Faturamento & Documento Fiscal
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Selecione como será cobrado e qual documento será emitido ao cliente.
                    </p>
                  </div>
                </div>

                {/* 1. Forma de Cobrança */}
                <div className="space-y-3">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    1. Método de Cobrança / Financeiro
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setBillingMethod('ASAAS')}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${billingMethod === 'ASAAS'
                          ? 'border-mustard-500 bg-mustard-50/20 dark:bg-mustard-500/5 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="billingMethod"
                          checked={billingMethod === 'ASAAS'}
                          onChange={() => setBillingMethod('ASAAS')}
                          className="mt-0.5 w-4 h-4 text-mustard-500 focus:ring-mustard-500 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            Fluxo Completo pelo Gateway
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            Gera cobrança bancária e boleto/PIX automaticamente pela API do Asaas.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setBillingMethod('MANUAL')}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${billingMethod === 'MANUAL'
                          ? 'border-mustard-500 bg-mustard-50/20 dark:bg-mustard-500/5 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="billingMethod"
                          checked={billingMethod === 'MANUAL'}
                          onChange={() => setBillingMethod('MANUAL')}
                          className="mt-0.5 w-4 h-4 text-mustard-500 focus:ring-mustard-500 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            Lançamento Manual
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            Registra diretamente no Contas a Receber (Bills) sem gerar cobrança no gateway.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Campo de Vencimento se for Lançamento Manual */}
                  {billingMethod === 'MANUAL' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                          Data de Vencimento do Lançamento
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Preenchida automaticamente com a data de término do contrato.
                        </p>
                      </div>
                      <input
                        type="date"
                        value={manualDueDate}
                        onChange={e => setManualDueDate(e.target.value)}
                        className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-mustard-500 shadow-sm"
                      />
                    </motion.div>
                  )}
                </div>

                {/* 2. Tipo de Documento Fiscal */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    2. Documento Fiscal / Comprovante
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setDocumentType('FATURA_LOCACAO')}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${documentType === 'FATURA_LOCACAO'
                          ? 'border-mustard-500 bg-mustard-50/20 dark:bg-mustard-500/5 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="documentType"
                          checked={documentType === 'FATURA_LOCACAO'}
                          onChange={() => setDocumentType('FATURA_LOCACAO')}
                          className="mt-0.5 w-4 h-4 text-mustard-500 focus:ring-mustard-500 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-slate-900 dark:text-white">
                              Fatura de Locação de Bens Móveis
                            </p>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                              Padrão
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            Gera e envia o PDF de Fatura de Locação da Alto Master ao cliente.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setDocumentType('NFSE')}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${documentType === 'NFSE'
                          ? 'border-mustard-500 bg-mustard-50/20 dark:bg-mustard-500/5 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="documentType"
                          checked={documentType === 'NFSE'}
                          onChange={() => setDocumentType('NFSE')}
                          className="mt-0.5 w-4 h-4 text-mustard-500 focus:ring-mustard-500 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            Nota Fiscal de Serviço (NFS-e)
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            Emite NFS-e na prefeitura via integração Asaas após confirmação do pagamento.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Documentos & Relatórios em PDF */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                Documentos & Relatórios para Visualização e Download
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* 1. Checklist de Triagem Consolidado */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-mustard-500 text-xl">photo_camera</span>
                    <div>
                      <h5 className="font-bold text-xs text-slate-900 dark:text-white">Relatório de Checklist Fotográfico</h5>
                      <p className="text-[11px] text-slate-400">Documento com as 22 fotos de cada equipamento</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const blob = await pdf(
                            <TriageChecklistDocument
                              contract={contract}
                              equipmentsWithPhotos={equipmentsChecklistDataForPdf}
                              clientName={clientName}
                              workSite={workSite}
                            />
                          ).toBlob();
                          const blobUrl = URL.createObjectURL(blob);
                          window.open(blobUrl, '_blank');
                        } catch (err) {
                          console.error('Erro ao gerar PDF', err);
                          alert('Erro ao abrir PDF do checklist.');
                        }
                      }}
                      className="px-3.5 py-2 border border-mustard-500 text-mustard-600 dark:text-mustard-400 rounded-lg text-xs font-bold hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Visualizar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const blob = await pdf(
                            <TriageChecklistDocument
                              contract={contract}
                              equipmentsWithPhotos={equipmentsChecklistDataForPdf}
                              clientName={clientName}
                              workSite={workSite}
                            />
                          ).toBlob();
                          saveAs(blob, `CHECKLIST_TRIAGEM - Contrato ${contract.contract_number}.pdf`);
                        } catch (err) {
                          console.error('Erro ao gerar PDF', err);
                          alert('Erro ao baixar PDF.');
                        }
                      }}
                      className="px-3.5 py-2 bg-mustard-500 text-white rounded-lg text-xs font-bold hover:bg-mustard-600 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      Baixar
                    </button>
                  </div>
                </div>

                {/* 2. Fatura de Locação */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-500 text-xl">receipt_long</span>
                    <div>
                      <h5 className="font-bold text-xs text-slate-900 dark:text-white">Fatura de Locação de Bens Móveis</h5>
                      <p className="text-[11px] text-slate-400">Documento oficial com discriminação e valores</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const blob = await pdf(
                            <FaturaLocacaoDocument
                              contract={contract}
                              invoiceNumber={contract.rental_invoice_id ? undefined : `ND-${String(contract.contract_number || '1').padStart(6, '0')}`}
                              dueDate={billingMethod === 'MANUAL' ? manualDueDate : (periodEnd || undefined)}
                              paymentMethod={billingMethod === 'MANUAL' ? 'Lançamento Manual' : 'Boleto Bancário'}
                              companySettings={companySettings}
                            />
                          ).toBlob();
                          const blobUrl = URL.createObjectURL(blob);
                          window.open(blobUrl, '_blank');
                        } catch (err) {
                          console.error('Erro ao gerar PDF da Fatura de Locação', err);
                          alert('Erro ao abrir PDF da Fatura.');
                        }
                      }}
                      className="px-3.5 py-2 border border-emerald-600 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Visualizar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const blob = await pdf(
                            <FaturaLocacaoDocument
                              contract={contract}
                              invoiceNumber={contract.rental_invoice_id ? undefined : `ND-${String(contract.contract_number || '1').padStart(6, '0')}`}
                              dueDate={billingMethod === 'MANUAL' ? manualDueDate : (periodEnd || undefined)}
                              paymentMethod={billingMethod === 'MANUAL' ? 'Lançamento Manual' : 'Boleto Bancário'}
                              companySettings={companySettings}
                            />
                          ).toBlob();
                          saveAs(blob, `FATURA_LOCACAO - Contrato ${contract.contract_number}.pdf`);
                        } catch (err) {
                          console.error('Erro ao gerar PDF da Fatura de Locação', err);
                          alert('Erro ao baixar PDF da Fatura.');
                        }
                      }}
                      className="px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      Baixar
                    </button>
                  </div>
                </div>
              </div>

              {/* Already processed info */}
              {isProcessed && contract.rental_invoice_id && (
                <div className="mt-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-500">verified</span>
                  <div>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Contrato Processado com Sucesso</p>
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200 font-mono">ID da Fatura: {contract.rental_invoice_id}</p>
                  </div>
                </div>
              )}

              {/* Charge (boleto) retry after failure */}
              {chargeError && isProcessed && contract.rental_invoice_id && billingMethod === 'ASAAS' && (
                <div className="mt-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-red-500">error</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-red-700 dark:text-red-300">Contrato processado, mas houve um erro ao gerar o boleto</p>
                      <p className="text-sm text-red-800 dark:text-red-200 mt-1">{chargeError}</p>
                      <button
                        type="button"
                        onClick={() => gerarBoleto(contract.rental_invoice_id!)}
                        disabled={charging}
                        className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                      >
                        {charging ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Tentar Gerar Boleto Novamente'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Emit Button */}
            {!isProcessed && isTriage && (
              <div className="bg-mustard-600 dark:bg-mustard-500 rounded-2xl p-6 text-white shadow-xl shadow-mustard-500/20">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">rocket_launch</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Pronto para Emitir e Finalizar?</h3>
                    <p className="text-sm opacity-70">
                      O contrato será processado com {triagedEquipments.length} equipamento(s), método: <b>{billingMethod === 'MANUAL' ? 'Lançamento Manual (Bills)' : 'Cobrança Asaas'}</b> e documento: <b>{documentType === 'FATURA_LOCACAO' ? 'Fatura de Locação' : 'NFS-e'}</b>.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setChargeConfirmOpen(true)}
                  disabled={submitting || charging || missingDueDate || missingManualDate}
                  title={missingDueDate ? 'Preencha a Data de Fim do contrato antes de finalizar.' : missingManualDate ? 'Preencha a data de vencimento manual.' : undefined}
                  className="w-full py-4 bg-white text-mustard-600 dark:text-mustard-500 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(submitting || charging) ? (
                    <div className="w-5 h-5 border-2 border-mustard-500/30 border-t-mustard-500 rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">check_circle</span>
                      Emitir e Finalizar Processamento ({triagedEquipments.length} Equipamento{triagedEquipments.length > 1 ? 's' : ''})
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Processed Status Info Card */}
            {isProcessed && (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-2xl">verified</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">Processamento Finalizado</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Este contrato já foi triado e faturado. Você pode consultar e baixar todos os documentos gerados acima.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled
                  className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-xl font-bold text-xs uppercase tracking-widest cursor-not-allowed flex items-center gap-2 shrink-0 self-end sm:self-center"
                >
                  <span className="material-symbols-outlined text-base">lock</span>
                  Finalizado
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${currentStep === 0
            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
            : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.98]'
            }`}
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Anterior
        </button>

        {currentStep < STEPS.length - 1 && (
          <button
            onClick={nextStep}
            disabled={!isProcessed && !isStepValid(currentStep)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${isProcessed || isStepValid(currentStep)
              ? 'bg-mustard-500 hover:bg-mustard-600 text-white shadow-lg shadow-mustard-500/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none opacity-60'
              }`}
          >
            Próximo
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        )}

        {currentStep === STEPS.length - 1 && isProcessed && (
          <button
            onClick={() => navigate('/logistica')}
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Voltar para Logística
          </button>
        )}
      </div>

      {/* Modal de Confirmação — Finalizar Triagem */}
      <AnimatePresence>
        {chargeConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !(submitting || charging) && setChargeConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-center space-y-4"
            >
              <div className="w-14 h-14 mx-auto bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-3xl">verified</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Confirmar Finalização</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Revise as definições de faturamento para esta locação ({triagedEquipments.length} equipamento(s)):
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-xs text-left space-y-2 border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total de Equipamentos:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {triagedEquipments.length} máquina(s)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cobrança:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {billingMethod === 'MANUAL' ? 'Lançamento Manual em Bills' : 'Cobrança Automática Asaas'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vencimento:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatDate(billingMethod === 'MANUAL' ? manualDueDate : (periodEnd || ''))}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                  <span className="text-slate-400">Documento:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {documentType === 'FATURA_LOCACAO' ? 'Fatura de Locação de Bens Móveis' : 'Nota Fiscal de Serviço (NFS-e)'}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting || charging}
                  onClick={() => setChargeConfirmOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={submitting || charging}
                  onClick={handleFinish}
                  className="flex-1 py-3 rounded-xl bg-mustard-500 hover:bg-mustard-600 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-mustard-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {(submitting || charging) ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Confirmar e Emitir'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Resultado — Boleto Gerado */}
      <AnimatePresence>
        {resultModalOpen && chargeResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setResultModalOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6"
            >
              <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white text-center">Boleto Gerado</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4 text-center">Cobrança sincronizada com o Asaas.</p>

              {chargeResult.breakdown && (
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 space-y-2 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Valor total do contrato</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {chargeResult.breakdown.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Taxa Asaas (descontada)</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      - {chargeResult.breakdown.fee_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                    <span className="text-slate-500 dark:text-slate-400">Valor do boleto emitido</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {chargeResult.charge.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Líquido a receber</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {chargeResult.breakdown.net_value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'}
                    </span>
                  </div>
                </div>
              )}

              {chargeResult.warning && (
                <div className="mb-4 px-4 py-3 rounded-xl text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">warning</span>
                  {chargeResult.warning}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <a
                  href={chargeResult.charge.bankSlipUrl || chargeResult.charge.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-5 py-3 bg-mustard-500 text-white rounded-xl text-sm font-bold hover:bg-mustard-600 transition-colors flex items-center justify-center gap-2 shadow-md shadow-mustard-500/10"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Baixar Boleto
                </a>
                <a
                  href={chargeResult.charge.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-5 py-3 border border-mustard-500 text-mustard-600 dark:text-mustard-400 rounded-xl text-sm font-bold hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  Ver Fatura no Asaas
                </a>
              </div>

              <button
                type="button"
                onClick={() => { setResultModalOpen(false); navigate('/logistica'); }}
                className="w-full mt-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                Ir para Logística
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LogisticsTriagem;
