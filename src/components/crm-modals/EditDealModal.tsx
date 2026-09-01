import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { crmService, type CRMPipelineStage } from '../../services/crm';
import api from '../../services/api';
import NewTaskModal from './NewTaskModal';
import { useAuth } from '../../contexts/AuthContext';

// Contract Form Modal
import ContractFormModal from './ContractFormModal';
import ContractDocument from './ContractDocument';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';

interface EditDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deal: any;
  stages: CRMPipelineStage[];
}

export interface CRMContractForm {
  id?: string;
  deal_id: string;
  contract_date: string;
  locatario_company_name: string;
  locatario_cnpj: string;
  locatario_state_registration?: string;
  locatario_address_full: string;
  equipment_description: string;
  equipment_model?: string;
  contract_duration_days?: number;
  period_start?: string | null;
  period_end?: string | null;
  cost_rental?: number;
  cost_insurance?: number;
  cost_freight?: number;
  cost_rcd?: number;
  cost_third_party?: number;
  cost_training?: number;
  cost_total?: number;
  billing_interval_days?: number;
  work_site?: string;
  site_contact_name?: string;
  site_contact_phone?: string;
  form_status: 'Rascunho' | 'Pronto para Gerar' | 'PDF Gerado';
  created_at?: string;
  updated_at?: string;
}

export interface CRMContract {
  id: string;
  deal_id: string;
  contract_form_id: string;
  contract_number: string;
  version: number;
  status: 'Gerado' | 'Assinado' | 'Cancelado';
  snapshot: any;
  pdf_file_url?: string;
  signed_file_url?: string;
  generated_by?: string;
  generated_at: string;
  signed_at?: string;
}

const EditDealModal: React.FC<EditDealModalProps> = ({ isOpen, onClose, onSuccess, deal, stages }) => {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);

  // Contract Data
  const [contractForm, setContractForm] = useState<CRMContractForm | null>(null);
  const [contracts, setContracts] = useState<CRMContract[]>([]);
  const [contractLoading, setContractLoading] = useState(false);
  const [showContractDeleteConfirm, setShowContractDeleteConfirm] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ type: 'success' | 'warning' | 'error'; title: string; message: string } | null>(null);

  const [linkType, setLinkType] = useState<'lead' | 'client'>('lead');
  const [leads, setLeads] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    stage_id: '',
    lead_id: '',
    client_id: '',
    value: 0,
    probability_pct: 0,
    expected_close_date: '',
    description: '',
  });

  const [formattedValue, setFormattedValue] = useState('');

  useEffect(() => {
    if (isOpen && deal) {
      setFormData({
        title: deal.title || '',
        stage_id: deal.stage_id || '',
        lead_id: deal.lead_id || '',
        client_id: deal.client_id || '',
        value: Number(deal.value) || 0,
        probability_pct: deal.probability_pct || 0,
        expected_close_date: deal.expected_close_date ? new Date(deal.expected_close_date).toISOString().split('T')[0] : '',
        description: deal.description || '',
      });

      const numValue = Number(deal.value) || 0;
      setFormattedValue(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
      setLinkType(deal.client_id ? 'client' : 'lead');
      loadLinkData();
      loadContractData();
    }
  }, [isOpen, deal]);

  const loadContractData = async () => {
    try {
      setContractLoading(true);
      const form = await crmService.getContractForm(deal.id);
      setContractForm(form);
      const generated = await crmService.getContracts(deal.id);
      setContracts(generated);
    } catch (err) {
      console.error('Erro ao carregar dados do contrato:', err);
    } finally {
      setContractLoading(false);
    }
  };

  const openContractModal = async () => {
    if (deal?.id) {
      try {
        setContractLoading(true);
        const form = await crmService.getContractForm(deal.id);
        if (form) {
          setContractForm(form);
        }
      } catch (e) {
        console.error('Erro ao buscar formulário antes de abrir modal:', e);
      } finally {
        setContractLoading(false);
      }
    }
    setIsContractModalOpen(true);
  };

  const handleDeleteContract = () => {
    setShowContractDeleteConfirm(true);
    setContractError(null);
  };

  const executeDeleteContract = async () => {
    if (!deal || contracts.length === 0) return;

    try {
      setContractLoading(true);
      setContractError(null);
      setShowContractDeleteConfirm(false);
      await crmService.deleteContract(deal.id, contracts[0].id);
      await loadContractData();
    } catch (err: any) {
      console.error(err);
      setContractError(err.response?.data?.error || 'Erro ao excluir contrato');
    } finally {
      setContractLoading(false);
    }
  };

  const loadLinkData = async () => {
    try {
      const [leadsRes, clientsRes] = await Promise.all([
        crmService.getLeads(),
        api.get('/clients')
      ]);
      setLeads(leadsRes);
      setClients(clientsRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStageId = e.target.value;
    const stage = stages.find(s => s.id === newStageId);
    setFormData(prev => ({
      ...prev,
      stage_id: newStageId,
      probability_pct: stage?.probability_pct || prev.probability_pct
    }));
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) rawValue = '0';
    const numValue = Number(rawValue) / 100;
    setFormData(prev => ({ ...prev, value: numValue }));
    setFormattedValue(numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.stage_id) return;

    try {
      setLoading(true);
      const payload = { ...formData };

      if (linkType === 'lead') {
        payload.client_id = null as any;
      } else {
        payload.lead_id = null as any;
      }

      if (!payload.expected_close_date) {
        (payload as any).expected_close_date = null;
      }

      await crmService.updateDeal(deal.id, payload);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar deal:', error);
      alert('Erro ao atualizar negociação.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      await crmService.deleteDeal(deal.id);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao excluir deal:', error);
      alert('Erro ao excluir negociação.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div key="edit-deal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            <motion.div
              key="modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-mustard-50 dark:bg-mustard-500/10 rounded-2xl flex items-center justify-center text-mustard-600 dark:text-mustard-400">
                    <span className="material-symbols-outlined text-2xl">edit_note</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Editar Negociação</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Atualize os detalhes desta oportunidade.</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Form */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {deal && contractLoading && (
                  <div className="space-y-4 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                      <div className="flex gap-3 pt-2">
                        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl w-32"></div>
                        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl w-32"></div>
                      </div>
                    </div>
                  </div>
                )}

                {deal && !contractLoading && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-mustard-500">description</span>
                      Contrato de Locação
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 relative">
                      {contracts.length > 0 && deal && !showContractDeleteConfirm && (
                        (deal.owner_id === user?.id || ['Administrador', 'Diretoria', 'Gerente'].includes(profile?.access_level || '')) && (
                          <button
                            type="button"
                            onClick={handleDeleteContract}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-lg transition-colors"
                            title="Excluir Contrato"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        )
                      )}

                      {showContractDeleteConfirm ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <span className="material-symbols-outlined">warning</span>
                            <p className="text-sm font-bold">Deseja realmente excluir este contrato?</p>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Esta ação é irreversível e removerá o arquivo e o registro do contrato gerado.
                          </p>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setShowContractDeleteConfirm(false)}
                              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={executeDeleteContract}
                              className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors"
                            >
                              Sim, Excluir
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {contractError && (
                            <div className="mb-4 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs flex items-center justify-between">
                              <span>{contractError}</span>
                              <button type="button" onClick={() => setContractError(null)}>
                                <span className="material-symbols-outlined text-[16px]">close</span>
                              </button>
                            </div>
                          )}
                          {!contractForm?.id && contracts.length === 0 ? (
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Nenhum formulário de contrato criado. Preencha os dados para gerar o PDF.
                              </p>
                              <button
                                type="button"
                                onClick={openContractModal}
                                className="px-4 py-2 bg-mustard-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-mustard-500/20 hover:bg-mustard-600 transition-colors"
                              >
                                Preencher Dados do Contrato
                              </button>
                            </div>
                          ) : contractForm?.id && contractForm.form_status === 'Rascunho' && contracts.length === 0 ? (
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Rascunho Salvo</p>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Você possui um rascunho de contrato salvo. Finalize o preenchimento para gerar o PDF.
                              </p>
                              <button
                                type="button"
                                onClick={openContractModal}
                                className="px-4 py-2 border border-mustard-500 text-mustard-600 dark:text-mustard-400 rounded-xl text-sm font-bold hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors"
                              >
                                Continuar Edição
                              </button>
                            </div>
                          ) : contractForm?.form_status === 'Pronto para Gerar' && contracts.length === 0 ? (
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Pronto para Gerar PDF</p>
                              </div>
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={openContractModal}
                                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                  Editar Formulário
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      setContractLoading(true);
                                      await crmService.generateContractRecord(deal.id);
                                      await loadContractData();
                                      /* STANDBY: Disparo de e-mail ao cliente desativado temporariamente
                                      try {
                                        const snapshot = result.snapshot || result.record?.snapshot;
                                        if (snapshot && result.record?.id) {
                                          const blob = await pdf(<ContractDocument data={snapshot} generatedAt={result.record.generated_at} />).toBlob();
                                          const reader = new FileReader();
                                          reader.onloadend = async () => {
                                            const base64 = (reader.result as string).split(',')[1];
                                            try {
                                              const emailResult = await crmService.sendContractEmail(deal.id, result.record.id, base64);
                                              setToast({ type: 'success', title: 'Contrato gerado com sucesso!', message: `Proposta enviada por e-mail para ${emailResult.sentTo}` });
                                            } catch (emailErr: any) {
                                              const msg = emailErr?.response?.data?.error || 'Erro ao enviar e-mail';
                                              setToast({ type: 'warning', title: 'Contrato gerado', message: `Não foi possível enviar o e-mail: ${msg}` });
                                            }
                                          };
                                          reader.readAsDataURL(blob);
                                        }
                                      } catch (pdfErr) {
                                        console.error('Erro ao gerar PDF para envio:', pdfErr);
                                      }
                                      */
                                      setToast({ type: 'success', title: 'Contrato gerado com sucesso!', message: 'O contrato foi gerado e está disponível para download e visualização.' });
                                    } catch (e) {
                                      setToast({ type: 'error', title: 'Erro', message: 'Não foi possível gerar o contrato. Tente novamente.' });
                                    } finally {
                                      setContractLoading(false);
                                    }
                                  }}
                                  className="px-4 py-2 bg-mustard-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-mustard-500/20 hover:bg-mustard-600 transition-colors"
                                >
                                  Gerar PDF
                                </button>
                              </div>
                            </div>
                          ) : contracts.length > 0 ? (
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <span className={`w-2 h-2 rounded-full ${contracts[0].status === 'Assinado' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                  Contrato Nº {contracts[0].contract_number} • {contracts[0].status}
                                </p>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                Gerado em {new Date(contracts[0].generated_at).toLocaleDateString('pt-BR')}
                              </p>
                              <div className="flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={openContractModal}
                                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                  Editar e Regerar
                                </button>
                                {contracts[0].status !== 'Assinado' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const blob = await pdf(<ContractDocument data={contracts[0].snapshot} generatedAt={contracts[0].generated_at} />).toBlob();
                                        const blobUrl = URL.createObjectURL(blob);
                                        window.open(blobUrl, '_blank');
                                      } catch (err) {
                                        console.error('Erro ao gerar PDF', err);
                                        alert('Erro ao abrir PDF.');
                                      }
                                    }}
                                    className="px-4 py-2 border border-mustard-500 text-mustard-600 dark:text-mustard-400 rounded-xl text-sm font-bold hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors flex items-center gap-2"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                                    Visualizar PDF
                                  </button>
                                )}
                                {contracts[0].status !== 'Assinado' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const blob = await pdf(<ContractDocument data={contracts[0].snapshot} generatedAt={contracts[0].generated_at} />).toBlob();
                                        saveAs(blob, `PROPOSTA DE LOCAÇÃO - ${contracts[0].snapshot?.locatario.company_name || 'Contrato'}.pdf`);
                                      } catch (err) {
                                        console.error('Erro ao gerar PDF', err);
                                        alert('Erro ao gerar arquivo PDF.');
                                      }
                                    }}
                                    className="px-4 py-2 border border-mustard-500 text-mustard-600 dark:text-mustard-400 rounded-xl text-sm font-bold hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors flex items-center gap-2"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                  </button>
                                )}
                                {contracts[0].status !== 'Assinado' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Trigger file input
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'application/pdf';
                                      input.onchange = async (e: any) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                          try {
                                            setContractLoading(true);
                                            await crmService.uploadSignedContract(deal.id, contracts[0].id, file);
                                            await loadContractData();
                                            onSuccess();
                                          } catch (err) {
                                            alert('Erro ao enviar contrato');
                                          } finally {
                                            setContractLoading(false);
                                          }
                                        }
                                      };
                                      input.click();
                                    }}
                                    className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
                                  >
                                    Anexar Assinado
                                  </button>
                                )}
                                {contracts[0].status === 'Assinado' && contracts[0].signed_file_url && (
                                  <a
                                    href={contracts[0].signed_file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-2"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                    Ver Assinado
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <form id="edit-deal-form" onSubmit={handleSubmit} className="space-y-6">

                  {/* Vinculação */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-mustard-500">link</span>
                      Vinculação do Negócio
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Vincular a</label>
                        <select
                          value={linkType}
                          onChange={(e) => {
                            setLinkType(e.target.value as 'lead' | 'client');
                            setFormData(prev => ({ ...prev, lead_id: '', client_id: '' }));
                          }}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/20 outline-none transition-all dark:text-white"
                        >
                          <option value="lead">Lead (Prospecção)</option>
                          <option value="client">Cliente Base</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                          {linkType === 'lead' ? 'Selecione o Lead *' : 'Selecione o Cliente *'}
                        </label>
                        <select
                          value={linkType === 'lead' ? formData.lead_id : formData.client_id}
                          onChange={(e) => {
                            if (linkType === 'lead') setFormData(prev => ({ ...prev, lead_id: e.target.value, client_id: '' }));
                            else setFormData(prev => ({ ...prev, client_id: e.target.value, lead_id: '' }));
                          }}
                          required
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/20 outline-none transition-all dark:text-white"
                        >
                          <option value="">Selecione...</option>
                          {linkType === 'lead'
                            ? leads.map((l, index) => <option key={l.id || `lead-${index}`} value={l.id}>{l.company_name}</option>)
                            : clients.map((c, index) => <option key={c.id || `client-${index}`} value={c.id}>{c.company_name}</option>)
                          }
                        </select>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800" />

                  {/* Dados Principais */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-mustard-500">request_quote</span>
                      Detalhes do Negócio
                    </h3>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Título da Oportunidade *</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/20 outline-none transition-all dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Etapa (Pipeline) *</label>
                        <select
                          value={formData.stage_id}
                          onChange={handleStageChange}
                          required
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/20 outline-none transition-all dark:text-white"
                        >
                          {stages.map((s, index) => (
                            <option key={s.id || `stage-${index}`} value={s.id}>{s.name} ({s.probability_pct}%)</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Probabilidade (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.probability_pct}
                          onChange={(e) => setFormData(prev => ({ ...prev, probability_pct: Number(e.target.value) }))}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/20 outline-none transition-all dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Valor Estimado</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">R$</span>
                          <input
                            type="text"
                            value={formattedValue}
                            onChange={handleValueChange}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/20 outline-none transition-all dark:text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Fechamento Previsto</label>
                        <input
                          type="date"
                          value={formData.expected_close_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, expected_close_date: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/20 outline-none transition-all dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Descrição / Observações</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/20 outline-none transition-all resize-none dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    <div className="bg-red-50 dark:bg-red-500/5 rounded-2xl p-6 border border-red-100 dark:border-red-500/20">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="material-symbols-outlined text-red-500">warning</span>
                        <h4 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Zona de Perigo</h4>
                      </div>

                      {showDeleteConfirm ? (
                        <div className="space-y-4">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            Tem certeza que deseja excluir esta negociação? Esta ação não pode ser desfeita.
                          </p>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setShowDeleteConfirm(false)}
                              className="px-4 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleDelete}
                              disabled={deleteLoading}
                              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
                            >
                              {deleteLoading ? 'Excluindo...' : 'Sim, Excluir'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="flex items-center gap-2 text-red-500 hover:text-red-600 font-bold text-xs transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                          Excluir Negociação
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(true)}
                  className="mr-auto px-4 py-2.5 rounded-xl text-sm font-bold text-mustard-600 dark:text-mustard-400 hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors flex items-center gap-2 border border-mustard-100 dark:border-mustard-500/20"
                >
                  <span className="material-symbols-outlined text-[18px]">add_task</span>
                  Nova Tarefa
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  form="edit-deal-form"
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-mustard-500 hover:bg-mustard-600 text-white shadow-lg shadow-mustard-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onSuccess={() => {
          setIsNewTaskModalOpen(false);
          // Opcionalmente recarregar algo, mas tarefas são independentes aqui
        }}
        initialDealId={deal?.id}
      />

      {isContractModalOpen && (
        <ContractFormModal
          isOpen={isContractModalOpen}
          onClose={() => setIsContractModalOpen(false)}
          onSuccess={() => {
            setIsContractModalOpen(false);
            loadContractData();
          }}
          dealId={deal?.id}
          deal={deal} // Pass the deal down to fetch linked contacts
          initialData={contractForm}
        />
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed bottom-6 right-6 z-[9999] w-[380px] max-w-[90vw]"
          >
            <div className={`rounded-2xl border shadow-2xl backdrop-blur-sm overflow-hidden ${
              toast.type === 'success' ? 'bg-white dark:bg-slate-900 border-green-200 dark:border-green-500/30' :
              toast.type === 'warning' ? 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-500/30' :
              'bg-white dark:bg-slate-900 border-red-200 dark:border-red-500/30'
            }`}>
              <div className={`h-1 ${
                toast.type === 'success' ? 'bg-green-500' :
                toast.type === 'warning' ? 'bg-amber-500' :
                'bg-red-500'
              }`} />
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    toast.type === 'success' ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400' :
                    toast.type === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                    'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    <span className="material-symbols-outlined text-xl">
                      {toast.type === 'success' ? 'check_circle' : toast.type === 'warning' ? 'warning' : 'error'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{toast.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{toast.message}</p>
                  </div>
                  <button
                    onClick={() => setToast(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EditDealModal;
