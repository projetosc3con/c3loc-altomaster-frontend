import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { crmService } from '../../services/crm';
import api from '../../services/api';

interface ContractFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  dealId: string;
  deal?: any;
  initialData?: any;
}

const ContractFormModal: React.FC<ContractFormModalProps> = ({ isOpen, onClose, onSuccess, dealId, deal, initialData }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialData || {});
  const [addressFetched, setAddressFetched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData && Object.keys(initialData).length > 0) {
        setFormData(initialData);
      } else if (dealId) {
        setLoading(true);
        crmService.getContractForm(dealId)
          .then((data) => {
            if (data) setFormData(data);
          })
          .catch((err) => console.error('Erro ao buscar dados do formulário de contrato:', err))
          .finally(() => setLoading(false));
      }
    }
  }, [isOpen, initialData, dealId]);

  useEffect(() => {
    const fetchClientDetails = async () => {
      if (addressFetched) return;

      if (deal?.client_id) {
        try {
          const { data } = await api.get(`/clients/${deal.client_id}`);
          if (data) {
            setFormData((prev: any) => {
              const fullAddr = prev.locatario_address_full || data.address_complement || [
                data.address_street,
                data.address_number,
                data.address_city && data.address_state ? `${data.address_city}/${data.address_state}` : data.address_city,
                data.address_zip ? `CEP: ${data.address_zip}` : ''
              ].filter(Boolean).join(', ');

              return {
                ...prev,
                locatario_address_full: fullAddr,
                site_contact_name: prev.site_contact_name || data.contact_name || '',
                site_contact_phone: prev.site_contact_phone || data.phone || ''
              };
            });
          }
        } catch (err) {
          console.error('Erro ao buscar dados do cliente', err);
        } finally {
          setAddressFetched(true);
        }
      } else if (deal?.lead_id && formData.locatario_cnpj && !formData.locatario_address_full) {
        try {
          const cleanCnpj = formData.locatario_cnpj.replace(/\D/g, '');
          if (cleanCnpj.length === 14) {
            const response = await fetch(`https://api.opencnpj.org/${cleanCnpj}`);
            if (response.ok) {
              const result = await response.json();
              const logradouro = result.logradouro || '';
              const numero = result.numero || 'S/N';
              const bairro = result.bairro || '';
              const municipio = result.municipio || result.cidade || '';
              const uf = result.uf || '';
              const cep = result.cep || '';

              const parts = [
                logradouro,
                numero,
                bairro,
                municipio || uf || cep ? `${municipio}/${uf} - CEP: ${cep}` : ''
              ].filter(Boolean);

              const fullAddress = parts.join(', ').replace(/^[,\s]+|[,\s]+$/g, '');
              setFormData((prev: any) => ({ ...prev, locatario_address_full: fullAddress }));
            }
          }
        } catch (err) {
          console.error('Erro ao buscar endereço do lead via CNPJ', err);
        } finally {
          setAddressFetched(true);
        }
      }
    };

    if (isOpen) {
      fetchClientDetails();
    }
  }, [deal, formData.locatario_cnpj, addressFetched, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => {
      const updated = { ...prev, [name]: value };

      // Recalculate total if cost changes
      if (name.startsWith('cost_') && name !== 'cost_total') {
        updated.cost_total =
          Number(updated.cost_rental || 0) +
          Number(updated.cost_insurance || 0) +
          Number(updated.cost_freight || 0) +
          Number(updated.cost_rcd || 0) +
          Number(updated.cost_third_party || 0) +
          Number(updated.cost_training || 0);
      }

      // Recalculate duration if dates change
      if (name === 'period_start' || name === 'period_end') {
        const start = updated.period_start;
        const end = updated.period_end;
        if (start && end) {
          const startDate = new Date(start + 'T00:00:00');
          const endDate = new Date(end + 'T00:00:00');
          const diffTime = endDate.getTime() - startDate.getTime();
          updated.contract_duration_days = diffTime >= 0 ? Math.round(diffTime / (1000 * 60 * 60 * 24)) : 0;
        }
      }

      return updated;
    });
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let rawValue = value.replace(/\D/g, '');
    const numValue = Number(rawValue) / 100;

    setFormData((prev: any) => {
      const next = { ...prev, [name]: numValue };
      // Recalculate total if cost changes
      next.cost_total =
        Number(next.cost_rental || 0) +
        Number(next.cost_insurance || 0) +
        Number(next.cost_freight || 0) +
        Number(next.cost_rcd || 0) +
        Number(next.cost_third_party || 0) +
        Number(next.cost_training || 0);
      return next;
    });
  };

  const handleSave = async (status: 'Rascunho' | 'Pronto para Gerar') => {
    try {
      setLoading(true);
      const dataToSave = { ...formData, form_status: status };

      // Basic validation if ready
      if (status === 'Pronto para Gerar') {
        if (!dataToSave.locatario_cnpj || !dataToSave.equipment_description || !dataToSave.period_start) {
          alert('Preencha os campos obrigatórios para gerar o contrato.');
          setLoading(false);
          return;
        }
      }

      // Sanitize data
      const cleanData = { ...dataToSave };
      if (!cleanData.contract_date) cleanData.contract_date = new Date().toISOString().split('T')[0];
      if (cleanData.period_start === '') cleanData.period_start = null;
      if (cleanData.period_end === '') cleanData.period_end = null;

      await crmService.saveContractForm(dealId, cleanData);
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar formulário de contrato');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Dados do Contrato</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-6">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Empresa/Locatário *</label>
              <input type="text" name="locatario_company_name" value={formData.locatario_company_name || ''} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">CNPJ *</label>
              <input type="text" name="locatario_cnpj" value={formData.locatario_cnpj || ''} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
            </div>
            <div className="col-span-12">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Endereço Completo *</label>
              <input type="text" name="locatario_address_full" value={formData.locatario_address_full || ''} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Equipamento *</label>
              <input type="text" name="equipment_description" value={formData.equipment_description || ''} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Modelo</label>
              <input type="text" name="equipment_model" value={formData.equipment_model || ''} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
            </div>
            <div className="col-span-12 md:col-span-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Data de Início *</label>
              <input type="date" name="period_start" value={formData.period_start || ''} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
            </div>
            <div className="col-span-12 md:col-span-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Data de Fim</label>
              <input type="date" name="period_end" value={formData.period_end || ''} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
            </div>
            <div className="col-span-12 md:col-span-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Duração (Dias)</label>
              <input type="number" name="contract_duration_days" value={formData.contract_duration_days || 0} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
            </div>

            <div className="col-span-12 my-2">
              <hr className="border-slate-200 dark:border-slate-700 mb-4" />
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Custos e Valores</h4>
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Valor Locação</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">R$</span>
                <input type="text" name="cost_rental" value={formData.cost_rental ? Number(formData.cost_rental).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} onChange={handleCurrencyChange} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
              </div>
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Seguro</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">R$</span>
                <input type="text" name="cost_insurance" value={formData.cost_insurance ? Number(formData.cost_insurance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} onChange={handleCurrencyChange} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
              </div>
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Frete</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">R$</span>
                <input type="text" name="cost_freight" value={formData.cost_freight ? Number(formData.cost_freight).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} onChange={handleCurrencyChange} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
              </div>
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">RCD</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">R$</span>
                <input type="text" name="cost_rcd" value={formData.cost_rcd ? Number(formData.cost_rcd).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} onChange={handleCurrencyChange} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
              </div>
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Treinamento</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">R$</span>
                <input type="text" name="cost_training" value={formData.cost_training ? Number(formData.cost_training).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} onChange={handleCurrencyChange} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
              </div>
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Pagamento</label>
              <select
                name="billing_interval_days"
                value={formData.billing_interval_days || '28 dias'}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-mustard-500/20"
              >
                <option value="7 dias">7 dias</option>
                <option value="15 dias">15 dias</option>
                <option value="28 dias">28 dias</option>
                <option value="A vista">A vista</option>
              </select>
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2 uppercase">Valor Total</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 text-xs font-bold">R$</span>
                <input type="text" readOnly value={formData.cost_total ? Number(formData.cost_total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} className="w-full pl-9 pr-4 py-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-300 cursor-not-allowed" />
              </div>
            </div>
            <div className="col-span-12">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Observações</label>
              <textarea name="notes" rows={2} value={formData.notes || ''} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none" placeholder="Detalhes adicionais sobre valores, condições especiais..." />
            </div>

            <div className="col-span-12">
              <hr className="my-4 border-slate-200 dark:border-slate-700" />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Local da Obra</label>
              <input type="text" name="work_site" value={formData.work_site || ''} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Contato da Obra</label>
              <input type="text" name="site_contact_name" placeholder="Nome do contato" value={formData.site_contact_name || ''} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Telefone do Contato</label>
              <input type="text" name="site_contact_phone" placeholder="(00) 00000-0000" value={formData.site_contact_phone || ''} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/50">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button disabled={loading} onClick={() => handleSave('Rascunho')} className="px-6 py-2.5 rounded-xl text-sm font-bold border border-mustard-500 text-mustard-600 hover:bg-mustard-50">
            Salvar Rascunho
          </button>
          <button disabled={loading} onClick={() => handleSave('Pronto para Gerar')} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-mustard-500 text-white hover:bg-mustard-600">
            {loading ? 'Salvando...' : 'Salvar e Pronto'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ContractFormModal;
