import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { crmService } from '../../services/crm';
import api from '../../services/api';

interface ContractEquipmentItem {
  tempId: string;
  equipment_name: string;
  equipment_size?: string;
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

const createDefaultEquipmentItem = (start = '', end = ''): ContractEquipmentItem => ({
  tempId: Math.random().toString(36).substring(2, 9),
  equipment_name: '',
  equipment_size: '',
  billing_period_start: start || new Date().toISOString().split('T')[0],
  billing_period_end: end || '',
  cost_rental: 0,
  cost_insurance: 0,
  cost_freight: 0,
  cost_rcd: 0,
  cost_third_party: 0,
  cost_training: 0,
  total_value: 0
});

interface ContractFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  dealId: string;
  deal?: any;
  initialData?: any;
}

const ContractFormModal: React.FC<ContractFormModalProps> = ({ isOpen, onClose, onSuccess, dealId, deal, initialData }) => {
  const [activeTab, setActiveTab] = useState<'equipments' | 'general'>('equipments');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>(initialData || {});
  const [addressFetched, setAddressFetched] = useState(false);

  // Multi-equipments list
  const [equipmentItems, setEquipmentItems] = useState<ContractEquipmentItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const loadFormAndEquipments = async () => {
      try {
        setLoading(true);
        let form = initialData;
        if (!form || Object.keys(form).length === 0 || !form.equipments || form.equipments.length === 0) {
          try {
            const fetched = await crmService.getContractForm(dealId);
            if (fetched) {
              form = { ...(form || {}), ...fetched };
            }
          } catch (e) {
            console.error('Erro ao buscar dados do formulário:', e);
          }
        }

        if (form) {
          setFormData(form);
        }

        // Initialize equipments array
        if (form?.equipments && Array.isArray(form.equipments) && form.equipments.length > 0) {
          setEquipmentItems(form.equipments.map((eq: any) => ({
            tempId: eq.tempId || eq.id || Math.random().toString(36).substring(2, 9),
            equipment_name: eq.equipment_name || eq.equipment_description || '',
            equipment_size: eq.equipment_size || '',
            billing_period_start: eq.billing_period_start || eq.period_start || form?.period_start || '',
            billing_period_end: eq.billing_period_end || eq.period_end || form?.period_end || '',
            cost_rental: Number(eq.cost_rental) || 0,
            cost_insurance: Number(eq.cost_insurance) || 0,
            cost_freight: Number(eq.cost_freight) || 0,
            cost_rcd: Number(eq.cost_rcd) || 0,
            cost_third_party: Number(eq.cost_third_party) || 0,
            cost_training: Number(eq.cost_training) || 0,
            total_value: Number(eq.total_value) || 0
          })));
          return;
        }

        const rentalId = deal?.rental_invoice_id || form?.rental_invoice_id;
        if (rentalId) {
          // Fetch rental invoice to populate multi-equipments
          try {
            const { data: rental } = await api.get(`/rentals/${rentalId}`);
            if (rental?.equipments && Array.isArray(rental.equipments) && rental.equipments.length > 0) {
              setEquipmentItems(rental.equipments.map((eq: any) => ({
                tempId: eq.id || Math.random().toString(36).substring(2, 9),
                equipment_name: eq.equipment_name || '',
                equipment_size: eq.equipment_size || '',
                billing_period_start: eq.billing_period_start ? eq.billing_period_start.split('T')[0] : '',
                billing_period_end: eq.billing_period_end ? eq.billing_period_end.split('T')[0] : '',
                cost_rental: Number(eq.cost_rental) || 0,
                cost_insurance: Number(eq.cost_insurance) || 0,
                cost_freight: Number(eq.cost_freight) || 0,
                cost_rcd: Number(eq.cost_rcd) || 0,
                cost_third_party: Number(eq.cost_third_party) || 0,
                cost_training: Number(eq.cost_training) || 0,
                total_value: Number(eq.total_value) || 0
              })));
              return;
            }
          } catch (e) {
            console.warn('Não foi possível buscar equipamentos da locação vinculada:', e);
          }
        }

        if (form?.equipment_description) {
          setEquipmentItems([{
            tempId: Math.random().toString(36).substring(2, 9),
            equipment_name: form.equipment_description,
            equipment_size: form.equipment_size || '',
            billing_period_start: form.period_start || '',
            billing_period_end: form.period_end || '',
            cost_rental: Number(form.cost_rental) || 0,
            cost_insurance: Number(form.cost_insurance) || 0,
            cost_freight: Number(form.cost_freight) || 0,
            cost_rcd: Number(form.cost_rcd) || 0,
            cost_third_party: Number(form.cost_third_party) || 0,
            cost_training: Number(form.cost_training) || 0,
            total_value: Number(form.cost_total) || 0
          }]);
        } else {
          setEquipmentItems([createDefaultEquipmentItem(form?.period_start, form?.period_end)]);
        }
      } catch (err) {
        console.error('Erro ao carregar dados do formulário de contrato:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFormAndEquipments();
  }, [isOpen, initialData, dealId, deal?.rental_invoice_id]);

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

  // Aggregate totals across all equipment items
  const totals = useMemo(() => {
    let cost_rental = 0;
    let cost_insurance = 0;
    let cost_freight = 0;
    let cost_rcd = 0;
    let cost_third_party = 0;
    let cost_training = 0;

    equipmentItems.forEach(item => {
      cost_rental += Number(item.cost_rental) || 0;
      cost_insurance += Number(item.cost_insurance) || 0;
      cost_freight += Number(item.cost_freight) || 0;
      cost_rcd += Number(item.cost_rcd) || 0;
      cost_third_party += Number(item.cost_third_party) || 0;
      cost_training += Number(item.cost_training) || 0;
    });

    const total_value = cost_rental + cost_insurance + cost_freight + cost_rcd + cost_third_party + cost_training;

    return {
      cost_rental,
      cost_insurance,
      cost_freight,
      cost_rcd,
      cost_third_party,
      cost_training,
      total_value
    };
  }, [equipmentItems]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleAddEquipment = () => {
    setEquipmentItems(prev => [...prev, createDefaultEquipmentItem()]);
  };

  const handleRemoveEquipment = (index: number) => {
    if (equipmentItems.length <= 1) {
      alert('O contrato deve conter pelo menos um equipamento.');
      return;
    }
    setEquipmentItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleEquipmentChange = (index: number, field: string, value: any) => {
    setEquipmentItems(prev => {
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

  const handleSave = async (status: 'Rascunho' | 'Pronto para Gerar') => {
    try {
      setLoading(true);

      if (equipmentItems.length === 0) {
        alert('Adicione pelo menos um equipamento ao contrato.');
        setLoading(false);
        return;
      }

      // Consolidate equipment descriptions
      const equipDescriptions = equipmentItems
        .map(e => `${e.equipment_name || 'Equipamento'}${e.equipment_size ? ` - ${e.equipment_size}` : ''}`.trim())
        .filter(Boolean)
        .join(', ');

      const starts = equipmentItems.map(e => e.billing_period_start).filter(Boolean).sort();
      const ends = equipmentItems.map(e => e.billing_period_end).filter(Boolean).sort();
      const earliestStart = starts.length > 0 ? starts[0] : (formData.period_start || null);
      const latestEnd = ends.length > 0 ? ends[ends.length - 1] : (formData.period_end || null);

      let durationDays = Number(formData.contract_duration_days) || 0;
      if (earliestStart && latestEnd) {
        const start = new Date(earliestStart + 'T00:00:00').getTime();
        const end = new Date(latestEnd + 'T00:00:00').getTime();
        const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
        if (diff > 0) durationDays = diff;
      }

      const cleanData: any = {
        ...formData,
        form_status: status,
        equipment_description: equipDescriptions,
        period_start: earliestStart,
        period_end: latestEnd,
        contract_duration_days: durationDays,
        cost_rental: totals.cost_rental,
        cost_insurance: totals.cost_insurance,
        cost_freight: totals.cost_freight,
        cost_rcd: totals.cost_rcd,
        cost_third_party: totals.cost_third_party,
        cost_training: totals.cost_training,
        cost_total: totals.total_value,
        billing_interval_days: formData.billing_interval_days || '28 dias',
        equipments: equipmentItems
      };

      if (status === 'Pronto para Gerar') {
        if (!cleanData.locatario_cnpj || !cleanData.equipment_description || !cleanData.period_start) {
          alert('Preencha os campos obrigatórios para gerar o contrato (Locatário, CNPJ, Equipamento e Início).');
          setLoading(false);
          return;
        }
      }

      if (!cleanData.contract_date) cleanData.contract_date = new Date().toISOString().split('T')[0];

      await crmService.saveContractForm(dealId, cleanData);

      // If deal is linked to a rental invoice, also sync rental_invoice_equipments
      if (deal?.rental_invoice_id) {
        try {
          await api.put(`/rentals/${deal.rental_invoice_id}`, {
            equipments: equipmentItems.map(item => ({
              equipment_name: item.equipment_name,
              equipment_size: item.equipment_size,
              billing_period_start: item.billing_period_start,
              billing_period_end: item.billing_period_end,
              cost_rental: item.cost_rental,
              cost_insurance: item.cost_insurance,
              cost_freight: item.cost_freight,
              cost_rcd: item.cost_rcd,
              cost_third_party: item.cost_third_party,
              cost_training: item.cost_training,
              total_value: item.total_value
            }))
          });
        } catch (syncErr) {
          console.warn('Aviso: Fatura de locação não sincronizada automaticamente:', syncErr);
        }
      }

      onSuccess();
    } catch (err) {
      console.error('Erro ao salvar formulário de contrato:', err);
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
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Formulário de Contrato de Locação</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Preencha os equipamentos, valores e dados cadastrais.</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 gap-6 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('equipments')}
            className={`py-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'equipments'
                ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-base">precision_manufacturing</span>
            Equipamentos & Valores
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-mustard-100 dark:bg-mustard-500/20 text-mustard-700 dark:text-mustard-300 font-mono">
              {equipmentItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'general'
                ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-base">business</span>
            Dados Cadastrais & Obra
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'equipments' && (
            <div className="space-y-6">
              {/* Header with Add Button */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Equipamentos do Contrato</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Descreva os equipamentos, altura de trabalho, períodos e valores individuais.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddEquipment}
                  className="px-4 py-2 bg-mustard-500 hover:bg-mustard-600 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Adicionar Equipamento
                </button>
              </div>

              {/* Dynamic Equipment Cards */}
              {equipmentItems.map((item, index) => (
                <motion.div
                  key={item.tempId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-5 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-mustard-500 text-white text-xs font-bold flex items-center justify-center font-mono">
                        {index + 1}
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {item.equipment_name || 'Novo Equipamento'}
                        {item.equipment_size ? ` (${item.equipment_size})` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-mustard-600 dark:text-mustard-400 font-mono">
                        Subtotal: {(Number(item.total_value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      {equipmentItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEquipment(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remover equipamento"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Name & Working Height */}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 md:col-span-8">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase">Descrição do Equipamento *</label>
                      <input
                        type="text"
                        value={item.equipment_name}
                        onChange={(e) => handleEquipmentChange(index, 'equipment_name', e.target.value)}
                        placeholder="Ex: Plataforma Tesoura Elétrica"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white outline-none focus:ring-2 focus:ring-mustard-500/10"
                      />
                    </div>

                    <div className="col-span-12 md:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase">Altura de Trabalho</label>
                      <input
                        type="text"
                        value={item.equipment_size || ''}
                        onChange={(e) => handleEquipmentChange(index, 'equipment_size', e.target.value)}
                        placeholder="Ex: 10m"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white outline-none focus:ring-2 focus:ring-mustard-500/10"
                      />
                    </div>
                  </div>

                  {/* Dates for this item */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase">Data de Início *</label>
                      <input
                        required
                        type="date"
                        value={item.billing_period_start}
                        onChange={(e) => handleEquipmentChange(index, 'billing_period_start', e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase">Data de Fim</label>
                      <input
                        type="date"
                        value={item.billing_period_end}
                        onChange={(e) => handleEquipmentChange(index, 'billing_period_end', e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Costs for this item */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2">
                    {[
                      { name: 'cost_rental', label: 'Locação' },
                      { name: 'cost_insurance', label: 'Seguro' },
                      { name: 'cost_freight', label: 'Frete' },
                      { name: 'cost_rcd', label: 'RCD' },
                      { name: 'cost_third_party', label: 'Terceiros' },
                      { name: 'cost_training', label: 'Treinamento' },
                    ].map(cost => (
                      <div key={cost.name}>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{cost.label}</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={(item as any)[cost.name] || ''}
                            onChange={(e) => handleEquipmentChange(index, cost.name, parseFloat(e.target.value) || 0)}
                            placeholder="0,00"
                            className="w-full pl-7 pr-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}

              {/* Aggregated Totals and Commercial Conditions Card */}
              <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Condições Comerciais Consolidadas</h4>
                
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase">Condição de Pagamento</label>
                    <select
                      name="billing_interval_days"
                      value={formData.billing_interval_days || '28 dias'}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-mustard-500/20 dark:text-white"
                    >
                      <option value="7 dias">7 dias</option>
                      <option value="15 dias">15 dias</option>
                      <option value="28 dias">28 dias</option>
                      <option value="A vista">A vista</option>
                    </select>
                  </div>

                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase">Duração do Contrato (Dias)</label>
                    <input
                      type="number"
                      name="contract_duration_days"
                      value={formData.contract_duration_days || 0}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white outline-none"
                    />
                  </div>

                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1.5 uppercase">Total do Investimento</label>
                    <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-base font-black text-emerald-700 dark:text-emerald-300">
                      {totals.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Empresa/Locatário *</label>
                <input
                  type="text"
                  name="locatario_company_name"
                  value={formData.locatario_company_name || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">CNPJ *</label>
                <input
                  type="text"
                  name="locatario_cnpj"
                  value={formData.locatario_cnpj || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              <div className="col-span-12">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Endereço Completo *</label>
                <input
                  type="text"
                  name="locatario_address_full"
                  value={formData.locatario_address_full || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              <div className="col-span-12">
                <hr className="my-2 border-slate-200 dark:border-slate-700" />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Local da Obra</label>
                <input
                  type="text"
                  name="work_site"
                  value={formData.work_site || ''}
                  onChange={handleChange}
                  placeholder="Ex: Condomínio Solar das Águas"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Contato da Obra</label>
                <input
                  type="text"
                  name="site_contact_name"
                  placeholder="Nome do contato"
                  value={formData.site_contact_name || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Telefone do Contato</label>
                <input
                  type="text"
                  name="site_contact_phone"
                  placeholder="(00) 00000-0000"
                  value={formData.site_contact_phone || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              <div className="col-span-12">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">Observações Internas</label>
                <textarea
                  name="notes"
                  rows={3}
                  value={formData.notes || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none dark:text-white"
                  placeholder="Detalhes adicionais sobre valores, condições especiais..."
                />
              </div>
            </div>
          )}
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
