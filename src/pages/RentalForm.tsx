import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import type { BillingStatus, ReconciliationStatus, Client, Equipment } from '../types';

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
        <span className={`text-sm ${selectedItem ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
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

const RentalForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);

  const [formData, setFormData] = useState({
    invoice_number: '',
    client_id: '',
    equipment_id: '',
    work_site: '',
    billing_period_start: '',
    billing_period_end: '',
    billing_status: 'Pendente' as BillingStatus,
    billing_method: 'MANUAL' as const,
    return_date: '',
    cost_rental: 0,
    cost_insurance: 0,
    cost_freight: 0,
    cost_rcd: 0,
    cost_third_party: 0,
    cost_training: 0,
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
        setEquipments(equipmentsRes.data);
      } catch (err: any) {
        console.error('Erro ao buscar dados para o formulário de locação:', err);
        setError('Erro ao carregar os clientes e equipamentos.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalValue = useMemo(() => {
    return (
      Number(formData.cost_rental || 0) +
      Number(formData.cost_insurance || 0) +
      Number(formData.cost_freight || 0) +
      Number(formData.cost_rcd || 0) +
      Number(formData.cost_third_party || 0) +
      Number(formData.cost_training || 0)
    );
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value
    }));
  };

  const handleSelectChange = (name: string, id: string) => {
    setFormData(prev => ({ ...prev, [name]: id }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id || !formData.equipment_id) {
      setError('Por favor, selecione um cliente e um equipamento.');
      return;
    }
    if (!formData.billing_period_start || !formData.billing_period_end) {
      setError('Por favor, defina o período de início e fim da locação.');
      return;
    }
    if (!formData.due_date) {
      setError('Por favor, defina a data de vencimento da fatura.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const selectedClient = clients.find(c => c.id === formData.client_id);
      const selectedEquip = equipments.find(eq => eq.id === formData.equipment_id);

      if (!selectedClient || !selectedEquip) {
        throw new Error('Selecione um cliente e um equipamento válidos.');
      }

      const payload = {
        ...formData,
        return_date: formData.return_date || null,
        client_name: selectedClient.company_name,
        cnpj: selectedClient.cnpj,
        equipment_name: selectedEquip.name,
        equipment_type: selectedEquip.type,
        asset_number: selectedEquip.asset_number,
        billing_method: 'MANUAL',
        total_value: totalValue,
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header */}
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
          <p className="text-slate-500 dark:text-slate-400 mt-1">Cadastre diretamente uma nova fatura e contrato de locação.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500">error</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Main Data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section: Client & Equipment */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 rounded-t-2xl">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-mustard-500 text-xl">person_pin_circle</span>
                Vínculos Principais
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <SearchableSelect
                label="Cliente"
                placeholder="Selecione o cliente"
                items={clients}
                selectedId={formData.client_id}
                onSelect={(id) => handleSelectChange('client_id', id)}
                getDisplayValue={(c) => c.company_name}
                getSearchValue={(c) => `${c.company_name} ${c.cnpj}`}
                required
              />
              <SearchableSelect
                label="Equipamento"
                placeholder="Selecione o equipamento"
                items={equipments}
                selectedId={formData.equipment_id}
                onSelect={(id) => handleSelectChange('equipment_id', id)}
                getDisplayValue={(eq) => `${eq.asset_number} - ${eq.name} (${eq.status})`}
                getSearchValue={(eq) => `${eq.name} ${eq.asset_number} ${eq.type}`}
                required
              />
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Obra / Local de Uso
                </label>
                <input
                  type="text"
                  name="work_site"
                  value={formData.work_site}
                  onChange={handleChange}
                  placeholder="Ex: Condomínio Solar das Águas"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>

          {/* Section: Dates & Status */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 rounded-t-2xl">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-mustard-500 text-xl">event_available</span>
                Período e Status
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Início do Período *
                </label>
                <input
                  required
                  type="date"
                  name="billing_period_start"
                  value={formData.billing_period_start}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Fim do Período *
                </label>
                <input
                  required
                  type="date"
                  name="billing_period_end"
                  value={formData.billing_period_end}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Status Faturamento
                </label>
                <select
                  name="billing_status"
                  value={formData.billing_status}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-mustard-500/10 transition-all cursor-pointer dark:text-white"
                >
                  {BILLING_STATUSES.map(s => (
                    <option key={s} value={s} className="dark:bg-slate-900">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Data de Devolução (se houver)
                </label>
                <input
                  type="date"
                  name="return_date"
                  value={formData.return_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Section: Costs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 rounded-t-2xl">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-mustard-500 text-xl">monetization_on</span>
                Composição de Valores (R$)
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'cost_rental', label: 'Valor Locação' },
                { name: 'cost_insurance', label: 'Seguro' },
                { name: 'cost_freight', label: 'Frete' },
                { name: 'cost_rcd', label: 'RCD' },
                { name: 'cost_third_party', label: 'Terceiros' },
                { name: 'cost_training', label: 'Treinamento' },
              ].map(cost => (
                <div key={cost.name} className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">
                    {cost.label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name={cost.name}
                      value={(formData as any)[cost.name] || ''}
                      onChange={handleChange}
                      placeholder="0,00"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all dark:text-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Notes */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 rounded-t-2xl">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-mustard-500 text-xl">description</span>
                Observações Internas
              </h3>
            </div>
            <div className="p-6">
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                placeholder="Detalhes sobre a negociação, descontos ou condições especiais..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all resize-none outline-none dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Invoicing Summary */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6 sticky top-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Valor Total da Fatura
              </h3>
              <p className="text-4xl text-mustard-500 font-bold mt-1">
                {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Nº Fatura / Contrato
                </label>
                <input
                  type="text"
                  name="invoice_number"
                  value={formData.invoice_number}
                  onChange={handleChange}
                  placeholder="Ex: FAT-2026-001"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
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
                  value={formData.due_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Forma de Pagamento
                </label>
                <select
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-mustard-500/10 transition-all cursor-pointer dark:text-white"
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
                  value={formData.reconciliation_status}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-mustard-500/10 transition-all cursor-pointer dark:text-white"
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
                    Cadastrar Fatura
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
