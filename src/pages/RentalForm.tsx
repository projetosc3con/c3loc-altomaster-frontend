import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import type { BillingStatus, ReconciliationStatus, Client, Equipment, RentalInvoiceEquipment } from '../types';

const BILLING_STATUSES: BillingStatus[] = ['Pendente', 'Faturado', 'Emitida', 'Cancelada'];
const RECONCILIATION_STATUSES: ReconciliationStatus[] = ['Pendente', 'Atrasado', 'Recebido', 'Divergente', 'No prazo'];

// Reusable Searchable Select Component
interface SearchableSelectProps<T> {
  label: string;
  placeholder: string;
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  getDisplayValue: (item: T) => string;
  getSearchValue: (item: T) => string;
  required?: boolean;
}

function SearchableSelect<T extends { id: string }>({
  label,
  placeholder,
  items,
  selectedId,
  onSelect,
  getDisplayValue,
  getSearchValue,
  required
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const lowerSearch = searchTerm.toLowerCase();
    return items.filter(item =>
      getSearchValue(item).toLowerCase().includes(lowerSearch)
    );
  }, [items, searchTerm, getSearchValue]);

  const selectedItem = useMemo(() =>
    items.find(i => i.id === selectedId),
    [items, selectedId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{label} {required && '*'}</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
          isOpen 
            ? 'border-mustard-500 ring-2 ring-mustard-500/10 dark:bg-slate-900' 
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <span className={`text-sm truncate ${selectedItem ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
          {selectedItem ? getDisplayValue(selectedItem) : placeholder}
        </span>
        <span className={`material-symbols-outlined text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''} text-[20px]`}>expand_more</span>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">search</span>
                <input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-mustard-500 transition-all dark:text-white"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelect(item.id);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`px-4 py-2.5 text-xs cursor-pointer hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors flex flex-col gap-0.5 ${
                      selectedId === item.id 
                        ? 'bg-mustard-50/50 dark:bg-mustard-500/20 border-l-4 border-mustard-500' 
                        : 'border-l-4 border-transparent'
                    }`}
                  >
                    <span className="font-bold text-slate-900 dark:text-white">{getDisplayValue(item)}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{getSearchValue(item)}</span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 italic">Nenhum resultado encontrado.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FormEquipmentItem extends RentalInvoiceEquipment {
  tempId: string;
}

const createDefaultEquipmentItem = (): FormEquipmentItem => ({
  tempId: Math.random().toString(36).substring(2, 9),
  equipment_id: '',
  equipment_name: '',
  equipment_type: '',
  equipment_size: '',
  asset_number: '',
  billing_period_start: new Date().toISOString().split('T')[0],
  billing_period_end: '',
  return_date: '',
  cost_rental: 0,
  cost_insurance: 0,
  cost_freight: 0,
  cost_rcd: 0,
  cost_third_party: 0,
  cost_training: 0,
  total_value: 0,
  notes: ''
});

const RentalForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'equipments' | 'general'>('equipments');
  const [clients, setClients] = useState<Client[]>([]);
  const [availableEquipments, setAvailableEquipments] = useState<Equipment[]>([]);

  // Multi-equipment list
  const [equipmentItems, setEquipmentItems] = useState<FormEquipmentItem[]>([createDefaultEquipmentItem()]);

  // General invoice fields
  const [generalData, setGeneralData] = useState({
    invoice_number: '',
    client_id: '',
    work_site: '',
    billing_status: 'Pendente' as BillingStatus,
    billing_method: 'MANUAL' as const,
    due_date: '',
    payment_method: '',
    reconciliation_status: 'Pendente' as ReconciliationStatus,
    notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [clientsRes, equipmentsRes] = await Promise.all([
          api.get('/clients'),
          api.get('/equipments')
        ]);

        setClients(clientsRes.data.filter((c: Client) => c.active !== false));
        setAvailableEquipments(equipmentsRes.data.filter((eq: Equipment) => eq.status === 'Disponível'));
      } catch (err: any) {
        console.error('Erro ao buscar dados para o formulário de locação:', err);
        setError('Erro ao carregar os clientes e equipamentos.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Totals calculations across all equipments
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

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGeneralData(prev => ({ ...prev, [name]: value }));
  };

  const handleClientSelect = (clientId: string) => {
    setGeneralData(prev => ({ ...prev, client_id: clientId }));
  };

  // Add Equipment Item
  const handleAddEquipment = () => {
    setEquipmentItems(prev => [...prev, createDefaultEquipmentItem()]);
  };

  // Remove Equipment Item
  const handleRemoveEquipment = (index: number) => {
    if (equipmentItems.length <= 1) {
      alert('A locação deve conter obrigatoriamente pelo menos um equipamento.');
      return;
    }
    setEquipmentItems(prev => prev.filter((_, i) => i !== index));
  };

  // Update Equipment Item Fields
  const handleEquipmentChange = (index: number, field: string, value: any) => {
    setEquipmentItems(prev => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };

      // Calculate item total_value
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

  // Select Equipment Entity
  const handleEquipmentSelect = (index: number, equipmentId: string) => {
    const selected = availableEquipments.find(e => e.id === equipmentId);
    if (!selected) return;

    setEquipmentItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        equipment_id: selected.id,
        equipment_name: selected.name,
        equipment_type: selected.type,
        equipment_size: selected.height ? `${selected.height}m` : '',
        asset_number: selected.asset_number
      };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!generalData.client_id) {
      setError('Por favor, selecione um cliente.');
      setActiveTab('general');
      return;
    }

    if (!generalData.due_date) {
      setError('Por favor, defina a data de vencimento da fatura.');
      return;
    }

    if (equipmentItems.length === 0) {
      setError('A locação deve conter pelo menos um equipamento.');
      setActiveTab('equipments');
      return;
    }

    for (let i = 0; i < equipmentItems.length; i++) {
      const item = equipmentItems[i];
      if (!item.equipment_id) {
        setError(`Por favor, selecione o equipamento no item #${i + 1}.`);
        setActiveTab('equipments');
        return;
      }
      if (!item.billing_period_start || !item.billing_period_end) {
        setError(`Por favor, defina o período de início e fim para o equipamento #${i + 1} (${item.equipment_name || 'Sem nome'}).`);
        setActiveTab('equipments');
        return;
      }
    }

    setSaving(true);

    try {
      const selectedClient = clients.find(c => c.id === generalData.client_id);
      if (!selectedClient) throw new Error('Cliente selecionado inválido.');

      const payload = {
        ...generalData,
        client_name: selectedClient.company_name,
        cnpj: selectedClient.cnpj,
        equipments: equipmentItems.map(item => ({
          equipment_id: item.equipment_id,
          equipment_name: item.equipment_name,
          equipment_type: item.equipment_type,
          equipment_size: item.equipment_size,
          asset_number: item.asset_number,
          billing_period_start: item.billing_period_start,
          billing_period_end: item.billing_period_end,
          return_date: item.return_date || null,
          cost_rental: Number(item.cost_rental) || 0,
          cost_insurance: Number(item.cost_insurance) || 0,
          cost_freight: Number(item.cost_freight) || 0,
          cost_rcd: Number(item.cost_rcd) || 0,
          cost_third_party: Number(item.cost_third_party) || 0,
          cost_training: Number(item.cost_training) || 0,
          total_value: item.total_value,
          notes: item.notes || null
        }))
      };

      const res = await api.post('/rentals', payload);
      navigate('/locacoes', { state: { warning: res.data?.warning } });
    } catch (err: any) {
      console.error('Erro ao cadastrar fatura de locação:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao cadastrar fatura de locação.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 dark:text-slate-500 gap-4">
        <div className="w-12 h-12 border-4 border-mustard-500/10 border-t-mustard-500 rounded-full animate-spin" />
        <p className="font-bold text-xs uppercase tracking-widest">Carregando dados...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/locacoes')}
            className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Nova Fatura de Locação</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Cadastre locações com um ou múltiplos equipamentos atrelados.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500">error</span>
          {error}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8">
        <button
          type="button"
          onClick={() => setActiveTab('equipments')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'equipments'
              ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-lg">precision_manufacturing</span>
          Equipamentos da Locação
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-mustard-100 dark:bg-mustard-500/20 text-mustard-700 dark:text-mustard-300 font-mono">
            {equipmentItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'general'
              ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-lg">business</span>
          Dados Gerais & Faturamento
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tab Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'equipments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Equipamentos Selecionados</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Adicione e configure cada equipamento com seus respectivos períodos e valores.</p>
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

              {equipmentItems.map((item, index) => {
                const selectedInOtherTabs = equipmentItems
                  .filter((_, i) => i !== index)
                  .map(e => e.equipment_id);
                const selectableEquips = availableEquipments.filter(e => !selectedInOtherTabs.includes(e.id) || e.id === item.equipment_id);

                return (
                  <motion.div
                    key={item.tempId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-mustard-500 text-white text-xs font-bold flex items-center justify-center font-mono">
                          {index + 1}
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {item.equipment_name ? `${item.equipment_name} (${item.asset_number || 'S/N'})` : 'Novo Equipamento'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
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

                    <div className="p-6 space-y-6">
                      {/* Equipment Selection */}
                      <SearchableSelect
                        label="Equipamento no Estoque"
                        placeholder="Pesquise por nome, patrimônio ou modelo..."
                        items={selectableEquips}
                        selectedId={item.equipment_id}
                        onSelect={(id) => handleEquipmentSelect(index, id)}
                        getDisplayValue={(eq) => `${eq.asset_number} - ${eq.name} (${eq.status})`}
                        getSearchValue={(eq) => `${eq.name} ${eq.asset_number} ${eq.type}`}
                        required
                      />

                      {/* Dates */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Início da Locação *</label>
                          <input
                            required
                            type="date"
                            value={item.billing_period_start}
                            onChange={(e) => handleEquipmentChange(index, 'billing_period_start', e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-mustard-500/10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Fim da Locação *</label>
                          <input
                            required
                            type="date"
                            value={item.billing_period_end}
                            onChange={(e) => handleEquipmentChange(index, 'billing_period_end', e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-mustard-500/10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Data de Devolução (Opcional)</label>
                          <input
                            type="date"
                            value={item.return_date || ''}
                            onChange={(e) => handleEquipmentChange(index, 'return_date', e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-mustard-500/10"
                          />
                        </div>
                      </div>

                      {/* Cost Composition for this equipment */}
                      <div>
                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Custos deste Equipamento (R$)</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {[
                            { name: 'cost_rental', label: 'Locação' },
                            { name: 'cost_insurance', label: 'Seguro' },
                            { name: 'cost_freight', label: 'Frete' },
                            { name: 'cost_rcd', label: 'RCD' },
                            { name: 'cost_third_party', label: 'Terceiros' },
                            { name: 'cost_training', label: 'Treinamento' },
                          ].map(cost => (
                            <div key={cost.name} className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{cost.label}</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={(item as any)[cost.name] || ''}
                                  onChange={(e) => handleEquipmentChange(index, cost.name, parseFloat(e.target.value) || 0)}
                                  placeholder="0,00"
                                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-mustard-500/10 outline-none"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Section: Client & Work Site */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-500 text-xl">person_pin_circle</span>
                  Cliente e Obra
                </h3>

                <SearchableSelect
                  label="Cliente"
                  placeholder="Selecione o cliente"
                  items={clients}
                  selectedId={generalData.client_id}
                  onSelect={handleClientSelect}
                  getDisplayValue={(c) => c.company_name}
                  getSearchValue={(c) => `${c.company_name} ${c.cnpj}`}
                  required
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">
                    Obra / Local de Uso
                  </label>
                  <input
                    type="text"
                    name="work_site"
                    value={generalData.work_site}
                    onChange={handleGeneralChange}
                    placeholder="Ex: Obra Shopping Center Sorriso / MT"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-mustard-500/10 outline-none text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">
                    Status Faturamento
                  </label>
                  <select
                    name="billing_status"
                    value={generalData.billing_status}
                    onChange={handleGeneralChange}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-mustard-500/10 cursor-pointer dark:text-white"
                  >
                    {BILLING_STATUSES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section: Notes */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-500 text-xl">description</span>
                  Observações Internas
                </h3>
                <textarea
                  name="notes"
                  value={generalData.notes}
                  onChange={handleGeneralChange}
                  rows={4}
                  placeholder="Detalhes adicionais sobre a locação, condições comerciais ou notas fiscais..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/10 resize-none outline-none dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Invoicing Summary */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6 sticky top-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Valor Total Consolidado
              </h3>
              <p className="text-4xl text-mustard-500 font-bold mt-1">
                {totals.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="material-symbols-outlined text-sm">precision_manufacturing</span>
                <span>{equipmentItems.length} equipamento(s) na locação</span>
              </div>
            </div>

            {/* Breakdown summary */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between">
                <span>Locação total:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{totals.cost_rental.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between">
                <span>Seguro total:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{totals.cost_insurance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between">
                <span>Frete total:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{totals.cost_freight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between">
                <span>RCD / Terceiros / Treinamento:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{(totals.cost_rcd + totals.cost_third_party + totals.cost_training).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Nº Fatura / Contrato
                </label>
                <input
                  type="text"
                  name="invoice_number"
                  value={generalData.invoice_number}
                  onChange={handleGeneralChange}
                  placeholder="Ex: FAT-2026-001"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-mustard-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Vencimento *
                </label>
                <input
                  required
                  type="date"
                  name="due_date"
                  value={generalData.due_date}
                  onChange={handleGeneralChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-mustard-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Forma de Pagamento
                </label>
                <select
                  name="payment_method"
                  value={generalData.payment_method}
                  onChange={handleGeneralChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-mustard-500/10 cursor-pointer dark:text-white"
                >
                  <option value="">Selecione</option>
                  <option value="BOLETO">BOLETO</option>
                  <option value="PIX">PIX</option>
                  <option value="DEPÓSITO BANCÁRIO">DEPÓSITO BANCÁRIO</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Status Conciliação
                </label>
                <select
                  name="reconciliation_status"
                  value={generalData.reconciliation_status}
                  onChange={handleGeneralChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-mustard-500/10 cursor-pointer dark:text-white"
                >
                  {RECONCILIATION_STATUSES.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 bg-mustard-500 hover:bg-mustard-600 active:scale-[0.98] text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-mustard-500/20 disabled:opacity-70"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Cadastrar Locação
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/locacoes')}
                className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 uppercase tracking-widest transition-colors text-center"
              >
                Cancelar e Voltar
              </button>
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  );
};

export default RentalForm;
