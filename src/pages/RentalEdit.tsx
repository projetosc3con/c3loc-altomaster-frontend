import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { financeiroService } from '../services/financeiro';
import { getApiErrorMessage } from '../utils/apiError';
import { isPaidStatus } from '../utils/payment';
import type { BillingStatus, ReconciliationStatus, Client, Equipment, AsaasChargeResult, InvoiceNfse, NfseStatus } from '../types';

const BILLING_STATUSES: BillingStatus[] = ['Pendente', 'Faturado', 'Emitida', 'Cancelada'];
const RECONCILIATION_STATUSES: ReconciliationStatus[] = ['Pendente', 'Atrasado', 'Recebido', 'Divergente', 'No prazo'];

const nfseBadgeClass = (status: NfseStatus) => {
  if (status === 'AUTHORIZED' || status === 'SYNCHRONIZED') return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
  if (status === 'ERROR' || status === 'ERRO' || status === 'CANCELLED' || status === 'CANCELLATION_DENIED') return 'bg-red-500/10 text-red-300 border border-red-500/20';
  return 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
};

const nfseStatusIcon = (status: NfseStatus) => {
  if (status === 'AUTHORIZED' || status === 'SYNCHRONIZED') return 'check_circle';
  if (status === 'ERROR' || status === 'ERRO' || status === 'CANCELLED' || status === 'CANCELLATION_DENIED') return 'cancel';
  return 'schedule';
};

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
        className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${isOpen ? 'border-mustard-500 ring-2 ring-mustard-500/10 dark:bg-slate-900' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
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
                    className={`px-4 py-2.5 text-xs cursor-pointer hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors flex flex-col gap-0.5 ${selectedId === item.id ? 'bg-mustard-50/50 dark:bg-mustard-500/20 border-l-4 border-mustard-500' : 'border-l-4 border-transparent'}`}
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

const RentalEdit: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);

  const [charging, setCharging] = useState(false);
  const [chargeResult, setChargeResult] = useState<AsaasChargeResult | null>(null);
  const [chargeConfirmOpen, setChargeConfirmOpen] = useState(false);
  const [chargeMessage, setChargeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [invoicePaid, setInvoicePaid] = useState(false);

  const [hasCharge, setHasCharge] = useState(false);
  const [nfse, setNfse] = useState<InvoiceNfse | null>(null);
  const [nfseLoading, setNfseLoading] = useState(false);
  const [emittingNfse, setEmittingNfse] = useState(false);
  const [nfseMessage, setNfseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    invoice_number: '',
    client_id: '',
    equipment_id: '',
    work_site: '',
    billing_period_start: '',
    billing_period_end: '',
    billing_status: 'Pendente' as BillingStatus,
    billing_method: '',
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
        const [clientsRes, equipmentsRes, rentalRes] = await Promise.all([
          api.get('/clients'),
          api.get('/equipments'),
          api.get(`/rentals/${id}`)
        ]);

        setClients(clientsRes.data.filter((c: Client) => c.active || c.id === rentalRes.data.client_id));
        setEquipments(equipmentsRes.data.filter((eq: Equipment) => eq.status === 'Disponível' || eq.id === rentalRes.data.equipment_id));

        const rental = rentalRes.data;
        setFormData({
          invoice_number: rental.invoice_number || '',
          client_id: rental.client_id,
          equipment_id: rental.equipment_id,
          work_site: rental.work_site || '',
          billing_period_start: rental.billing_period_start ? rental.billing_period_start.split('T')[0] : '',
          billing_period_end: rental.billing_period_end ? rental.billing_period_end.split('T')[0] : '',
          billing_status: rental.billing_status,
          billing_method: rental.billing_method || 'ASAAS',
          return_date: rental.return_date ? rental.return_date.split('T')[0] : '',
          cost_rental: rental.cost_rental || 0,
          cost_insurance: rental.cost_insurance || 0,
          cost_freight: rental.cost_freight || 0,
          cost_rcd: rental.cost_rcd || 0,
          cost_third_party: rental.cost_third_party || 0,
          cost_training: rental.cost_training || 0,
          due_date: rental.due_date ? rental.due_date.split('T')[0] : '',
          payment_method: rental.payment_method || '',
          reconciliation_status: rental.reconciliation_status,
          notes: rental.notes || '',
        });
      } catch (err: any) {
        console.error('Erro ao buscar dados:', err);
        setError('Erro ao carregar os dados da locação.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!id || formData.billing_method === 'MANUAL') return;
    financeiroService.buscarPagamentosFatura(id)
      .then((payments) => {
        setInvoicePaid(payments.some((p) => isPaidStatus(p.status)));
        setHasCharge(payments.length > 0);
      })
      .catch((err) => console.error('Erro ao buscar pagamentos da fatura:', err));
  }, [id, formData.billing_method]);

  useEffect(() => {
    if (!id || formData.billing_method === 'MANUAL') return;
    financeiroService.buscarNfseFatura(id)
      .then(setNfse)
      .catch((err) => {
        if (err?.response?.status !== 404) console.error('Erro ao buscar NFS-e da fatura:', err);
      });
  }, [id, formData.billing_method]);

  const totalValue = useMemo(() => {
    return (
      Number(formData.cost_rental) +
      Number(formData.cost_insurance) +
      Number(formData.cost_freight) +
      Number(formData.cost_rcd) +
      Number(formData.cost_third_party) +
      Number(formData.cost_training)
    );
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
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
        total_value: totalValue,
      };

      await api.put(`/rentals/${id}`, payload);
      navigate('/locacoes');
    } catch (err: any) {
      console.error('Erro ao salvar locação:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao salvar locação.');
    } finally {
      setSaving(false);
    }
  };

  const handleGerarCobranca = async () => {
    if (!id) return;
    setCharging(true);
    setChargeMessage(null);
    try {
      const result = await financeiroService.gerarCobranca(id);
      setChargeResult(result);
      setHasCharge(true);
      window.open(result.charge.invoiceUrl, '_blank');
      setChargeMessage({ type: 'success', text: 'Cobrança gerada com sucesso!' });
    } catch (err) {
      setChargeMessage({ type: 'error', text: getApiErrorMessage(err) });
    } finally {
      setCharging(false);
      setChargeConfirmOpen(false);
    }
  };

  const handleEmitirNfse = async () => {
    if (!id) return;
    setEmittingNfse(true);
    setNfseMessage(null);
    try {
      const result = await financeiroService.emitirNfse(id);
      setNfse(result.nfse);
      setNfseMessage({ type: 'success', text: 'NFS-e emitida com sucesso!' });
    } catch (err) {
      setNfseMessage({ type: 'error', text: getApiErrorMessage(err) });
    } finally {
      setEmittingNfse(false);
    }
  };

  const handleAtualizarStatusNfse = async () => {
    if (!id) return;
    setNfseLoading(true);
    try {
      const updated = await financeiroService.buscarNfseFatura(id);
      setNfse(updated);
    } catch (err) {
      setNfseMessage({ type: 'error', text: getApiErrorMessage(err) });
    } finally {
      setNfseLoading(false);
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
        <button onClick={() => navigate('/locacoes')} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Editar Locação</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Atualize as informações do faturamento Nº {formData.invoice_number}.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
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
                getDisplayValue={(eq) => `${eq.asset_number} - ${eq.name}`}
                getSearchValue={(eq) => `${eq.name} ${eq.asset_number}`}
                required
              />
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Obra / Local de Uso</label>
                <input type="text" name="work_site" value={formData.work_site} onChange={handleChange} placeholder="Ex: Condomínio Solar das Águas" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600" />
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
                <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Início do Período *</label>
                <input required type="date" name="billing_period_start" value={formData.billing_period_start} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm [color-scheme:light] dark:[color-scheme:dark]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Fim do Período *</label>
                <input required type="date" name="billing_period_end" value={formData.billing_period_end} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm [color-scheme:light] dark:[color-scheme:dark]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  Status Faturamento
                  {formData.billing_method !== 'MANUAL' && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black normal-case tracking-normal ${invoicePaid
                      ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      }`}>
                      <span className="material-symbols-outlined text-[12px]">{invoicePaid ? 'check_circle' : 'schedule'}</span>
                      {invoicePaid ? 'Pago' : 'Aguardando pagamento'}
                    </span>
                  )}
                </label>
                <select name="billing_status" value={formData.billing_status} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-mustard-500/10 transition-all cursor-pointer dark:text-white">
                  {BILLING_STATUSES.map(s => <option key={s} value={s} className="dark:bg-slate-900">{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Data de Devolução (se houver)</label>
                <input type="date" name="return_date" value={formData.return_date} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm [color-scheme:light] dark:[color-scheme:dark]" />
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
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">{cost.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold">R$</span>
                    <input type="number" step="0.01" name={cost.name} value={(formData as any)[cost.name]} onChange={handleChange} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all dark:text-white" />
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
                rows={5}
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
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">Valor Total da Fatura</h3>
              <p className="text-4xl text-mustard-500 font-bold mt-1">
                {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Nº Fatura / Contrato</label>
                <input type="text" name="invoice_number" value={formData.invoice_number} onChange={handleChange} placeholder="Nº da Fatura" className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:bg-white/20 transition-all placeholder:text-white/40" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Vencimento *</label>
                <input required type="date" name="due_date" value={formData.due_date} onChange={handleChange} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:bg-white/20 transition-all [color-scheme:dark]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Forma de Pagamento</label>
                <select name="payment_method" value={formData.payment_method} onChange={handleChange} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:bg-white/20 transition-all appearance-none cursor-pointer">
                  <option value="" className="text-slate-900">Selecione</option>
                  <option value="BOLETO" className="text-slate-900">BOLETO</option>
                  <option value="PIX" className="text-slate-900">PIX</option>
                  <option value="DEPÓSITO BANCÁRIO" className="text-slate-900">DEPÓSITO BANCÁRIO</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Status Conciliação</label>
                <select name="reconciliation_status" value={formData.reconciliation_status} onChange={handleChange} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:bg-white/20 transition-all appearance-none cursor-pointer">
                  {RECONCILIATION_STATUSES.map(s => <option key={s} value={s} className="text-slate-900">{s}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <button type="submit" disabled={saving} className="w-full py-4 bg-mustard-500 hover:bg-mustard-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-mustard-500/20 disabled:opacity-70">
                {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar Alterações'}
              </button>

              {formData.billing_method !== 'MANUAL' && (
                <>
                  {chargeMessage && (
                    <div className={`px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 ${chargeMessage.type === 'success' ? 'bg-emerald-900/20 text-emerald-100' : 'bg-red-900/30 text-red-100'
                      }`}>
                      <span className="material-symbols-outlined text-base">{chargeMessage.type === 'success' ? 'check_circle' : 'error'}</span>
                      {chargeMessage.text}
                    </div>
                  )}

                  {invoicePaid ? (
                    <span className="w-full py-3 bg-emerald-900/20 text-emerald-100 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      Pagamento Confirmado
                    </span>
                  ) : chargeResult ? (
                    <a
                      href={chargeResult.charge.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                      <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                      Ver Boleto
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setChargeConfirmOpen(true)}
                      disabled={charging}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70"
                    >
                      {charging ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">payments</span>
                          {formData.billing_status === 'Faturado' ? 'Gerar Segunda Via do Boleto' : 'Gerar Cobrança'}
                        </>
                      )}
                    </button>
                  )}

                  <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">request_quote</span>
                      Nota Fiscal
                    </h4>

                    {nfseMessage && (
                      <div className={`px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 ${nfseMessage.type === 'success' ? 'bg-emerald-900/20 text-emerald-100' : 'bg-red-900/30 text-red-100'
                        }`}>
                        <span className="material-symbols-outlined text-base">{nfseMessage.type === 'success' ? 'check_circle' : 'error'}</span>
                        {nfseMessage.text}
                      </div>
                    )}

                    {nfse ? (
                      <>
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${nfseBadgeClass(nfse.status)}`}>
                          <span className="material-symbols-outlined text-[14px]">{nfseStatusIcon(nfse.status)}</span>
                          {nfse.status}
                        </div>

                        {(nfse.status === 'ERROR' || nfse.status === 'ERRO') && nfse.return_message && (
                          <p className="text-xs text-red-300">{nfse.return_message}</p>
                        )}

                        {(nfse.status === 'ERROR' || nfse.status === 'ERRO') && (
                          <button
                            type="button"
                            onClick={handleEmitirNfse}
                            disabled={!hasCharge || emittingNfse}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {emittingNfse ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                                Tentar Emitir Novamente
                              </>
                            )}
                          </button>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {nfse.nfse_link && (
                            <a
                              href={nfse.nfse_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[16px]">description</span>
                              Ver Nota
                            </a>
                          )}
                          {nfse.xml_url && (
                            <a
                              href={nfse.xml_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[16px]">code</span>
                              XML
                            </a>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleAtualizarStatusNfse}
                          disabled={nfseLoading}
                          className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                          {nfseLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[16px]">refresh</span>
                              Atualizar Status
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleEmitirNfse}
                          disabled={!hasCharge || emittingNfse}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                        >
                          {emittingNfse ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[18px]">request_quote</span>
                              Emitir NFS-e
                            </>
                          )}
                        </button>
                        {!hasCharge && (
                          <p className="text-[11px] text-white/50 text-center">Gere a cobrança antes de emitir a nota fiscal.</p>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}

              <button type="button" onClick={() => navigate('/locacoes')} className="w-full py-2 text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
                Cancelar e Voltar
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Modal de Confirmação — Gerar Cobrança */}
      <AnimatePresence>
        {chargeConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !charging && setChargeConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-center"
            >
              <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
                <span className="material-symbols-outlined text-3xl">warning</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Atenção</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
                Esta ação irá gerar uma nova cobrança (boleto) para esta fatura. Se já existir uma cobrança em aberto, isso pode gerar duplicidade. Deseja continuar?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={charging}
                  onClick={() => setChargeConfirmOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={charging}
                  onClick={handleGerarCobranca}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {charging ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Confirmar'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RentalEdit;
