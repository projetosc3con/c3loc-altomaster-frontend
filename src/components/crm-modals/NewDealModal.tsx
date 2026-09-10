import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { crmService, type CRMPipelineStage } from '../../services/crm';
import api from '../../services/api';
import SearchableSelect from '../SearchableSelect';
import { formatCnpjOrCpf } from '../../utils/formatters';

interface NewDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pipelineId: string;
  stages: CRMPipelineStage[];
}

const NewDealModal: React.FC<NewDealModalProps> = ({ isOpen, onClose, onSuccess, pipelineId, stages }) => {
  const [loading, setLoading] = useState(false);
  
  const [linkType, setLinkType] = useState<'lead' | 'client'>('lead');
  const [leads, setLeads] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    pipeline_id: pipelineId,
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
    if (isOpen) {
      setFormData({
        title: '',
        pipeline_id: pipelineId,
        stage_id: stages.length > 0 ? stages[0].id : '',
        lead_id: '',
        client_id: '',
        value: 0,
        probability_pct: stages.length > 0 ? (stages[0].probability_pct || 0) : 0,
        expected_close_date: '',
        description: '',
      });
      setFormattedValue('');
      loadLinkData();
    }
  }, [isOpen, pipelineId, stages]);

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
    
    if (linkType === 'lead' && !formData.lead_id) {
      alert('Selecione um Lead para vincular.');
      return;
    }
    if (linkType === 'client' && !formData.client_id) {
      alert('Selecione um Cliente para vincular.');
      return;
    }

    try {
      setLoading(true);
      const payload = { ...formData };
      
      if (linkType === 'lead') {
        payload.client_id = null as any; 
      } else {
        payload.lead_id = null as any; 
      }
      
      // Clean up empty foreign keys
      const finalPayload: any = { ...payload };
      if (!finalPayload.lead_id && linkType === 'lead') finalPayload.lead_id = null;
      if (!finalPayload.client_id && linkType === 'client') finalPayload.client_id = null;
      if (!finalPayload.expected_close_date) delete finalPayload.expected_close_date;

      await crmService.createDeal(finalPayload);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao criar deal:', error);
      alert('Erro ao criar negociação. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-mustard-50 dark:bg-mustard-500/10 rounded-2xl flex items-center justify-center text-mustard-600 dark:text-mustard-400">
                <span className="material-symbols-outlined text-2xl">handshake</span>
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Nova Negociação</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Cadastre um novo negócio no pipeline.</p>
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
          <form id="new-deal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            
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
                  <SearchableSelect
                    label={linkType === 'lead' ? 'Selecione o Lead' : 'Selecione o Cliente'}
                    placeholder={linkType === 'lead' ? 'Pesquisar lead por nome ou CNPJ...' : 'Pesquisar cliente por nome ou CNPJ...'}
                    searchPlaceholder="Buscar por nome ou CNPJ..."
                    items={linkType === 'lead' ? leads : clients}
                    selectedId={linkType === 'lead' ? formData.lead_id : formData.client_id}
                    onSelect={(id) => {
                      if (linkType === 'lead') {
                        setFormData(prev => ({ ...prev, lead_id: id, client_id: '' }));
                      } else {
                        setFormData(prev => ({ ...prev, client_id: id, lead_id: '' }));
                      }
                    }}
                    getDisplayValue={(item: any) => item.company_name || 'Sem Razão Social'}
                    getTriggerDisplayValue={(item: any) => {
                      const name = item.company_name || 'Sem Razão Social';
                      const doc = formatCnpjOrCpf(item.cnpj);
                      return doc ? `${name} • ${doc}` : name;
                    }}
                    getSearchValue={(item: any) => `${item.company_name || ''} ${item.trading_name || ''} ${item.cnpj || ''}`}
                    getSubtext={(item: any) => {
                      const doc = formatCnpjOrCpf(item.cnpj);
                      return doc ? `CNPJ: ${doc}` : 'Sem CNPJ cadastrado';
                    }}
                    required
                    clearable
                    labelClassName="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider"
                    triggerClassName="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none transition-all dark:text-white flex items-center justify-between cursor-pointer"
                  />
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
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Título da Oportunidade *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Locação de 2 Guindastes 30t"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/20 outline-none transition-all dark:text-white"
                  />
                </div>
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
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.probability_pct}%)</option>
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
                      placeholder="0,00"
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
                  placeholder="Detalhes adicionais sobre a oportunidade..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/20 outline-none transition-all resize-none dark:text-white"
                />
              </div>
            </div>

          </form>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              form="new-deal-form"
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
                  Cadastrar Negócio
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NewDealModal;
