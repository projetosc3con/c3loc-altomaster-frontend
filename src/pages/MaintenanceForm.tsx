import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import api from '../services/api';
import { formatDate } from '../utils/date';
import type { Equipment, UserProfile, Part, ServiceOrder, ServiceOrderStatus, ServiceOrderType, ServiceOrderLabor, NfeInvoiceReference, ServiceOrderPart } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import ServiceOrderDocument from '../components/maintenance/ServiceOrderDocument';
import OsXmlImportModal from '../components/maintenance/OsXmlImportModal';
import { PartCreateModal } from '../components/maintenance/PartCreateModal';

interface OSPartItem {
  part_id: string;
  description: string;
  internal_code: string;
  quantity_used: number;
  unit_value_at_use: number;
  subtotal: number;
  was_used: boolean;
}

type TabKey = 'geral' | 'diagnostico' | 'pecas' | 'mao_de_obra' | 'observacoes' | 'analise';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'geral', label: 'Informações Gerais', icon: 'info' },
  { key: 'diagnostico', label: 'Diagnóstico', icon: 'troubleshoot' },
  { key: 'pecas', label: 'Peças', icon: 'inventory_2' },
  { key: 'mao_de_obra', label: 'Mão de Obra', icon: 'engineering' },
  { key: 'observacoes', label: 'Observações', icon: 'checklist' },
  { key: 'analise', label: 'Análise Crítica', icon: 'assessment' },
];

const InputField = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <input
      {...props}
      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white outline-none transition-all focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500"
    />
  </div>
);

const TextareaField = ({ label, rows = 4, ...props }: { label: string; rows?: number } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <textarea
      rows={rows}
      {...props}
      className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white outline-none resize-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-600"
    />
  </div>
);

const BooleanToggle = ({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between py-3 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${value === true ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
      >Sim</button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${value === false ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
      >Não</button>
    </div>
  </div>
);

const SectionCard = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
      <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-500 text-xl">{icon}</span>
      {title}
    </h3>
    {children}
  </div>
);

const MaintenanceForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('geral');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [viewingPdf, setViewingPdf] = useState(false);
  const [isNfeModalOpen, setIsNfeModalOpen] = useState(false);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<ServiceOrder>>({
    order_type: 'Interna',
    status: 'Aberta',
    execution_date: new Date().toISOString().split('T')[0],
    execution_location: '',
    nfe_invoices: [],
    nfe_access_keys: [],
  });

  const [partsUsed, setPartsUsed] = useState<OSPartItem[]>([]);
  const [laborEntries, setLaborEntries] = useState<ServiceOrderLabor[]>([]);

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [allParts, setAllParts] = useState<Part[]>([]);

  const [partSearch, setPartSearch] = useState('');
  const [showPartResults, setShowPartResults] = useState(false);
  const partContainerRef = useRef<HTMLDivElement>(null);

  const updateField = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [eqRes, techRes, partsRes] = await Promise.all([
          api.get('/equipments'),
          api.get('/users'),
          api.get('/parts')
        ]);

        setEquipments(eqRes.data);
        setTechnicians(techRes.data.filter((u: UserProfile) =>
          u.access_level === 'Manutenção' || u.access_level === 'Administrador' || u.access_level === 'Diretoria'
        ));
        setAllParts(partsRes.data);

        if (isEdit && id) {
          const { data } = await api.get(`/service-orders/${id}`);
          setFormData({
            ...data,
            execution_date: data.execution_date ? new Date(data.execution_date).toISOString().split('T')[0] : '',
            nfe_invoices: data.nfe_invoices || [],
            nfe_access_keys: data.nfe_access_keys || [],
          });

          if (data.service_order_parts) {
            setPartsUsed(data.service_order_parts.map((p: any) => ({
              part_id: p.part_id,
              description: p.parts?.description || p.part_description || '',
              internal_code: p.parts?.internal_code || p.internal_code || '',
              quantity_used: p.quantity_used,
              unit_value_at_use: p.unit_value_at_use,
              subtotal: p.quantity_used * p.unit_value_at_use,
              was_used: p.was_used !== false
            })));
          }

          if (data.service_order_labor) {
            setLaborEntries(data.service_order_labor.map((l: any) => ({
              technician_name: l.technician_name,
              labor_date: l.labor_date || '',
              start_time: l.start_time || '',
              end_time: l.end_time || '',
              labor_type: l.labor_type || 'T',
            })));
          }
        }
      } catch (err: any) {
        console.error('Erro ao carregar dados:', err);
        setError('Não foi possível carregar as informações necessárias.');
      } finally {
        setLoading(false);
        setFetching(false);
      }
    };
    fetchData();

    const handleClickOutside = (event: MouseEvent) => {
      if (partContainerRef.current && !partContainerRef.current.contains(event.target as Node)) {
        setShowPartResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [id, isEdit]);

  const filteredParts = useMemo(() => {
    const q = partSearch.toLowerCase();
    const items = !partSearch
      ? allParts
      : allParts.filter(p =>
        p.description.toLowerCase().includes(q) ||
        p.internal_code.toLowerCase().includes(q) ||
        p.part_number?.toLowerCase().includes(q)
      );
    return items.slice(0, 10);
  }, [allParts, partSearch]);

  const handleSelectEquipment = (eq: Equipment) => {
    if (!formData.rental_invoice_id && eq.status === 'Locado') {
      alert(`O equipamento "${eq.asset_number} - ${eq.name}" está com status "Locado".\n\nOrdens de serviço para equipamentos locados só podem ser abertas diretamente a partir da respectiva locação (em Locações > Editar Locação > Abrir OS).`);
      return;
    }

    setFormData(prev => ({
      ...prev,
      equipment_id: eq.id,
      equipment_asset_number: eq.asset_number,
      equipment_name: eq.name,
      equipment_model: eq.model,
      equipment_serial_number: eq.serial_number
    }));
  };

  const handleAddPart = (part: Part) => {
    const existing = partsUsed.find(p => p.part_id === part.id);
    if (existing) {
      setPartsUsed(prev => prev.map(p =>
        p.part_id === part.id
          ? { ...p, quantity_used: p.quantity_used + 1, subtotal: (p.quantity_used + 1) * p.unit_value_at_use }
          : p
      ));
    } else {
      setPartsUsed(prev => [...prev, {
        part_id: part.id,
        description: part.description,
        internal_code: part.internal_code,
        quantity_used: 1,
        unit_value_at_use: part.unit_value,
        subtotal: part.unit_value,
        was_used: true
      }]);
    }
    setPartSearch('');
    setShowPartResults(false);
  };

  const handlePartCreated = (newPart: Part) => {
    setAllParts(prev => [newPart, ...prev.filter(p => p.id !== newPart.id)]);
    handleAddPart(newPart);
  };

  const handleRemovePart = (partId: string) => {
    setPartsUsed(prev => prev.filter(p => p.part_id !== partId));
  };

  const handleNfeImportSuccess = async (nfeRef: NfeInvoiceReference, newParts: ServiceOrderPart[]) => {
    // 1. Add linked NF-e (avoid duplicates)
    setFormData(prev => {
      const currentInvoices = prev.nfe_invoices || [];
      const exists = currentInvoices.some(n => n.access_key === nfeRef.access_key);
      const updatedInvoices = exists ? currentInvoices : [...currentInvoices, nfeRef];
      return {
        ...prev,
        nfe_invoices: updatedInvoices,
        nfe_access_keys: updatedInvoices.map(n => n.access_key),
      };
    });

    // 2. Refresh allParts list from backend
    try {
      const { data } = await api.get('/parts');
      setAllParts(data);
    } catch (e) {
      console.error('Erro ao recarregar materiais:', e);
    }

    // 3. Append selected parts to OS
    if (newParts && newParts.length > 0) {
      setPartsUsed(prev => {
        const updated = [...prev];
        for (const np of newParts) {
          const existingIdx = updated.findIndex(p => p.part_id === np.part_id);
          if (existingIdx >= 0) {
            const current = updated[existingIdx];
            const newQty = current.quantity_used + np.quantity_used;
            updated[existingIdx] = {
              ...current,
              quantity_used: newQty,
              subtotal: newQty * current.unit_value_at_use,
            };
          } else {
            updated.push({
              part_id: np.part_id,
              description: np.part_description || np.parts?.description || '',
              internal_code: np.internal_code || np.parts?.internal_code || '',
              quantity_used: np.quantity_used,
              unit_value_at_use: np.unit_value_at_use,
              subtotal: np.subtotal,
              was_used: true,
            });
          }
        }
        return updated;
      });
    }
  };

  const handleRemoveLinkedNfe = (accessKey: string) => {
    setFormData(prev => {
      const currentInvoices = prev.nfe_invoices || [];
      const updatedInvoices = currentInvoices.filter(n => n.access_key !== accessKey);
      return {
        ...prev,
        nfe_invoices: updatedInvoices,
        nfe_access_keys: updatedInvoices.map(n => n.access_key),
      };
    });
  };

  const handleUpdatePartQuantity = (partId: string, qty: number) => {
    if (qty < 1) return;
    setPartsUsed(prev => prev.map(p =>
      p.part_id === partId
        ? { ...p, quantity_used: qty, subtotal: qty * p.unit_value_at_use }
        : p
    ));
  };

  const totalPartsValue = useMemo(() => partsUsed.reduce((acc, p) => acc + p.subtotal, 0), [partsUsed]);

  const handleAddLabor = () => {
    setLaborEntries(prev => [...prev, {
      technician_name: '',
      labor_date: new Date().toISOString().split('T')[0],
      start_time: '',
      end_time: '',
      labor_type: 'T',
    }]);
  };

  const handleUpdateLabor = (index: number, field: string, value: string) => {
    setLaborEntries(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const handleRemoveLabor = (index: number) => {
    setLaborEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 10) {
      value = `${value.slice(0, 10)}-${value.slice(10)}`;
    }

    updateField('client_phone', value);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.equipment_id) {
      setError('Por favor, selecione um equipamento.');
      setActiveTab('geral');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        ...formData,
        nfe_invoices: formData.nfe_invoices || [],
        nfe_access_keys: (formData.nfe_invoices || []).map(n => n.access_key),
        parts: partsUsed,
        labor: laborEntries.filter(l => l.technician_name.trim() !== ''),
      };

      if (isEdit) {
        await api.put(`/service-orders/${id}`, payload);
      } else {
        await api.post('/service-orders', payload);
      }

      setSuccess(true);
      setTimeout(() => navigate('/manutencoes'), 1500);
    } catch (err: any) {
      console.error('Erro ao salvar OS:', err);
      setError(err.response?.data?.error || 'Erro ao salvar a ordem de serviço.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setGeneratingPdf(true);
      const blob = await pdf(
        <ServiceOrderDocument
          data={formData as ServiceOrder}
          parts={partsUsed}
          labor={laborEntries}
        />
      ).toBlob();
      const fileName = `OS-${formData.os_number || 'nova'}-${formData.order_type || 'Interna'}.pdf`;
      saveAs(blob, fileName);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setError('Erro ao gerar o PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleViewPdf = async () => {
    try {
      setViewingPdf(true);
      const blob = await pdf(
        <ServiceOrderDocument
          data={formData as ServiceOrder}
          parts={partsUsed}
          labor={laborEntries}
        />
      ).toBlob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Erro ao abrir PDF:', err);
      setError('Erro ao visualizar o PDF.');
    } finally {
      setViewingPdf(false);
    }
  };


  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-12 h-12 border-4 border-mustard-500/20 border-t-mustard-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-medium mt-4">Carregando dados da OS...</p>
      </div>
    );
  }

  const isExterna = formData.order_type === 'Externa';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8 pb-20"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/manutencoes')}
            className="p-2 hover:bg-white dark:hover:bg-slate-900 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {isEdit ? `OS #${formData.os_number}` : 'Nova Ordem de Serviço'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {isEdit ? 'Atualize os detalhes da manutenção executada.' : 'Registre uma nova atividade de manutenção.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isEdit && (
            <>
              <button
                type="button"
                onClick={handleViewPdf}
                disabled={viewingPdf}
                className="px-5 py-2.5 border border-mustard-500 text-mustard-600 dark:text-mustard-400 bg-white dark:bg-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {viewingPdf ? (
                  <div className="w-4 h-4 border-2 border-slate-300/30 border-t-slate-500 rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                )}
                Visualizar PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="px-5 py-2.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-800 flex items-center gap-2 disabled:opacity-60"
              >
                {generatingPdf ? (
                  <div className="w-4 h-4 border-2 border-slate-300/30 border-t-slate-500 rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]">download</span>
                )}
                Baixar PDF
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate('/manutencoes')}
            className="px-6 py-2.5 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-2.5 bg-mustard-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-mustard-600 active:scale-[0.98] transition-all shadow-lg shadow-mustard-500/20 flex items-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">save</span>
                {isEdit ? 'Salvar OS' : 'Emitir OS'}
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 font-medium">
          <span className="material-symbols-outlined text-red-500">error</span>
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 font-medium">
          <span className="material-symbols-outlined text-emerald-500">check_circle</span>
          Ordem de serviço salva com sucesso! Redirecionando...
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-px">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 px-3 text-xs font-bold uppercase tracking-widest transition-all relative whitespace-nowrap flex items-center gap-1.5 ${activeTab === tab.key ? 'text-mustard-600 dark:text-mustard-500' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.key && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-mustard-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {/* TAB 1: Informações Gerais */}
          {activeTab === 'geral' && (
            <motion.div key="geral" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Tipo & Equipamento" icon="construction">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo da Ordem *</label>
                    <div className="flex gap-3">
                      {(['Interna', 'Externa'] as ServiceOrderType[]).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => updateField('order_type', type)}
                          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border ${formData.order_type === type ? 'bg-mustard-500 text-white border-mustard-500 shadow-lg shadow-mustard-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-mustard-300 dark:hover:border-mustard-500/30'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <SearchableSelect
                    label="Equipamento"
                    placeholder="Selecione o equipamento"
                    items={equipments}
                    selectedId={formData.equipment_id || ''}
                    onSelect={(eqId) => {
                      const eq = equipments.find(e => e.id === eqId);
                      if (eq) handleSelectEquipment(eq);
                    }}
                    getDisplayValue={(eq) => `${eq.asset_number} - ${eq.name} ${eq.status === 'Locado' ? '🔒 (Locado - OS apenas via locação)' : ''}`}
                    getSearchValue={(eq) => `${eq.name} ${eq.asset_number} ${eq.status}`}
                    required
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Horímetro Anterior" type="number" placeholder="Ex: 1500" value={formData.hour_meter_before || ''} onChange={(e) => updateField('hour_meter_before', e.target.value ? Number(e.target.value) : null)} />
                    <InputField label="Horímetro Atual" type="number" placeholder="Ex: 1530" value={formData.hour_meter_after || ''} onChange={(e) => updateField('hour_meter_after', e.target.value ? Number(e.target.value) : null)} />
                  </div>
                </SectionCard>

                <SectionCard title="Controle da OS" icon="settings">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Data de Abertura" type="date" value={formData.execution_date || ''} onChange={(e) => updateField('execution_date', e.target.value)} />
                    <InputField label="Local" type="text" placeholder="Ex: Oficina, Campo..." value={formData.execution_location || ''} onChange={(e) => updateField('execution_location', e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Status da OS</label>
                    <select
                      value={formData.status}
                      onChange={(e) => updateField('status', e.target.value as ServiceOrderStatus)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value="Aberta">Aberta</option>
                      <option value="Em Andamento">Em Andamento</option>
                      <option value="Aguardando Peças">Aguardando Peças</option>
                      <option value="Concluída">Concluída</option>
                      <option value="Encerrada com pendências">Encerrada com pendências</option>
                      <option value="Cancelada">Cancelada</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Técnico Responsável</label>
                    <select
                      value={formData.executed_by || ''}
                      onChange={(e) => updateField('executed_by', e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value="">Selecione o técnico</option>
                      {technicians.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                  </div>
                </SectionCard>
              </div>

              {/* Dados do cliente (visíveis para ambos os tipos, mas mais relevante em Externa) */}
              <SectionCard title="Dados do Cliente / Obra" icon="business">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField label="Cliente" placeholder="Nome do cliente" value={formData.client_name || ''} onChange={(e) => updateField('client_name', e.target.value)} />
                  <InputField label="Endereço" placeholder="Endereço da obra" value={formData.client_address || ''} onChange={(e) => updateField('client_address', e.target.value)} />
                  <InputField label="Nome do Contato" placeholder="Contato no local" value={formData.client_contact_name || ''} onChange={(e) => updateField('client_contact_name', e.target.value)} />
                  <InputField label="Telefone" placeholder="(00) 00000-0000" value={formData.client_phone || ''} onChange={handlePhoneChange} />
                </div>
              </SectionCard>
            </motion.div>
          )}

          {/* TAB 2: Diagnóstico */}
          {activeTab === 'diagnostico' && (
            <motion.div key="diagnostico" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <SectionCard title="Diagnóstico e Serviços" icon="troubleshoot">
                <TextareaField label="Solicitação Cliente - Falha" rows={4} placeholder="Descreva o problema reportado pelo cliente ou solicitação..." value={formData.client_request || ''} onChange={(e) => updateField('client_request', e.target.value)} />
                <TextareaField label="Diagnóstico - Causa" rows={4} placeholder="Descreva a causa raiz identificada..." value={formData.diagnosis || ''} onChange={(e) => updateField('diagnosis', e.target.value)} />
                <TextareaField label="Serviços Executados - Ação" rows={6} placeholder="Descreva detalhadamente todos os serviços executados..." value={formData.services_executed || ''} onChange={(e) => updateField('services_executed', e.target.value)} />
              </SectionCard>
            </motion.div>
          )}

          {/* TAB 3: Peças */}
          {activeTab === 'pecas' && (
            <motion.div key="pecas" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              {/* Notas Fiscais Vinculadas (NF-e) */}
              <SectionCard title="Notas Fiscais de Entrada Vinculadas (NF-e)" icon="receipt_long">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      Importe NF-e (XML ou PDF) para alimentar o estoque e vincular à Ordem de Serviço.
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      Você pode vincular múltiplas notas e escolher exatamente quais itens aplicar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNfeModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-mustard-500 hover:bg-mustard-600 text-white rounded-2xl font-bold text-xs shadow-lg shadow-mustard-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap self-start sm:self-auto"
                  >
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    Importar NF-e
                  </button>
                </div>

                {/* Lista de NFs vinculadas */}
                {formData.nfe_invoices && formData.nfe_invoices.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {formData.nfe_invoices.map(nfe => (
                      <div
                        key={nfe.access_key}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3 group"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-mustard-100 dark:bg-mustard-500/20 text-mustard-800 dark:text-mustard-400 text-[10px] font-black uppercase font-mono">
                              NF-e Nº {nfe.invoice_number}
                            </span>
                            {nfe.series && (
                              <span className="text-[10px] text-slate-400 font-medium">Série {nfe.series}</span>
                            )}
                          </div>
                          <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={nfe.issuer_name}>
                            {nfe.issuer_name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            {nfe.issue_date && <span>{formatDate(nfe.issue_date)}</span>}
                            {nfe.total_invoice != null && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {nfe.total_invoice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </>
                            )}
                          </div>
                          <span className="font-mono text-[9px] text-slate-400 truncate block select-all" title={nfe.access_key}>
                            {nfe.access_key}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLinkedNfe(nfe.access_key)}
                          className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                          title="Desvincular NF-e da OS"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 px-5 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    Nenhuma nota fiscal vinculada a esta ordem de serviço.
                  </div>
                )}
              </SectionCard>

              {/* Peças e Materiais Utilizados */}
              <SectionCard title="Peças e Insumos Utilizados na OS" icon="inventory_2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Peças e materiais que serão baixados do estoque ao salvar esta OS.
                  </p>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Peças</p>
                    <p className="text-xl font-black text-mustard-600 dark:text-mustard-500">{totalPartsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 max-w-xl" ref={partContainerRef}>
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">add_shopping_cart</span>
                    <input
                      type="text"
                      placeholder="Busque por código, referência ou nome do material no estoque..."
                      value={partSearch}
                      onChange={(e) => { setPartSearch(e.target.value); setShowPartResults(true); }}
                      onFocus={() => setShowPartResults(true)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 text-slate-900 dark:text-white outline-none transition-all"
                    />
                    <AnimatePresence>
                      {showPartResults && filteredParts.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                          {filteredParts.map(p => (
                            <button key={p.id} type="button" onClick={() => handleAddPart(p)} className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between group border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors">
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{p.internal_code} - {p.description}</p>
                                <p className="text-xs text-slate-500 font-medium">
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold mr-1.5">{p.category || 'Peça'}</span>
                                  Estoque: {p.quantity} {p.unit || 'UN'} | {Number(p.unit_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                              </div>
                              <span className="material-symbols-outlined text-mustard-600 opacity-0 group-hover:opacity-100 transition-all">add_circle</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPartModalOpen(true)}
                    title="Cadastrar nova peça / material no estoque"
                    className="w-12 h-12 bg-mustard-500 hover:bg-mustard-600 active:scale-95 text-white rounded-2xl flex items-center justify-center transition-all shadow-md shadow-mustard-500/20 shrink-0"
                  >
                    <span className="material-symbols-outlined text-xl">add</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {partsUsed.length > 0 ? partsUsed.map(part => (
                    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={part.part_id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-mustard-200 dark:hover:border-mustard-500/30 transition-all">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{part.description}</p>
                        <p className="text-[10px] text-slate-400 font-mono">CÓD: {part.internal_code}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Utilizado:</label>
                        <button type="button" onClick={() => setPartsUsed(prev => prev.map(p => p.part_id === part.part_id ? { ...p, was_used: !p.was_used } : p))} className={`px-2 py-0.5 rounded text-xs font-bold ${part.was_used ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'}`}>
                          {part.was_used ? 'Sim' : 'Não'}
                        </button>
                      </div>
                      <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden h-10 shadow-sm">
                        <button type="button" onClick={() => handleUpdatePartQuantity(part.part_id, part.quantity_used - 1)} className="px-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-400"><span className="material-symbols-outlined text-[18px]">remove</span></button>
                        <input type="number" step="any" min="0" value={part.quantity_used} onChange={(e) => handleUpdatePartQuantity(part.part_id, parseFloat(e.target.value) || 0)} className="w-14 text-center text-sm font-black text-slate-700 dark:text-slate-300 bg-transparent outline-none" />
                        <button type="button" onClick={() => handleUpdatePartQuantity(part.part_id, part.quantity_used + 1)} className="px-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-400"><span className="material-symbols-outlined text-[18px]">add</span></button>
                      </div>
                      <div className="w-24 text-right">
                        <p className="text-sm font-black text-slate-900 dark:text-white">{part.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                      <button type="button" onClick={() => handleRemovePart(part.part_id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                    </motion.div>
                  )) : (
                    <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30">
                      <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-3xl mb-2">inventory_2</span>
                      <h4 className="font-bold text-slate-600 dark:text-slate-400">Nenhum material listado</h4>
                      <p className="text-xs text-slate-400 mt-1 font-medium">Busque peças acima ou importe uma NF-e para incluir.</p>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Modal de Importação de XML na OS */}
              <OsXmlImportModal
                isOpen={isNfeModalOpen}
                onClose={() => setIsNfeModalOpen(false)}
                onSuccess={handleNfeImportSuccess}
              />

              {/* Modal de Cadastro Rápido de Peça na OS */}
              <PartCreateModal
                isOpen={isPartModalOpen}
                onClose={() => setIsPartModalOpen(false)}
                onSuccess={handlePartCreated}
              />
            </motion.div>
          )}

          {/* TAB 4: Mão de Obra */}
          {activeTab === 'mao_de_obra' && (
            <motion.div key="mao_de_obra" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <SectionCard title="Mão de Obra" icon="engineering">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Registre as horas trabalhadas.</p>
                  <button type="button" onClick={handleAddLabor} className="px-4 py-2 bg-mustard-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-mustard-600 transition-all flex items-center gap-1.5 shadow-md shadow-mustard-500/20">
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Adicionar
                  </button>
                </div>

                {laborEntries.length > 0 ? (
                  <div className="space-y-3">
                    {laborEntries.map((entry, idx) => (
                      <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={idx} className="grid grid-cols-1 sm:grid-cols-6 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="sm:col-span-2">
                          <InputField label="Técnico" placeholder="Nome" value={entry.technician_name} onChange={(e) => handleUpdateLabor(idx, 'technician_name', e.target.value)} />
                        </div>
                        <InputField label="Data" type="date" value={entry.labor_date || ''} onChange={(e) => handleUpdateLabor(idx, 'labor_date', e.target.value)} />
                        <InputField label="Início" type="time" value={entry.start_time || ''} onChange={(e) => handleUpdateLabor(idx, 'start_time', e.target.value)} />
                        <InputField label="Final" type="time" value={entry.end_time || ''} onChange={(e) => handleUpdateLabor(idx, 'end_time', e.target.value)} />
                        <div className="flex items-end gap-2">
                          <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{isExterna ? 'V/T/I' : 'T/I'}</label>
                            <select value={entry.labor_type} onChange={(e) => handleUpdateLabor(idx, 'labor_type', e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none">
                              {isExterna && <option value="V">V - Viagem</option>}
                              <option value="T">T - Trabalho</option>
                              <option value="I">I - Intervalo</option>
                            </select>
                          </div>
                          <button type="button" onClick={() => handleRemoveLabor(idx)} className="p-2.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all mb-px"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30">
                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-3xl mb-2">engineering</span>
                    <h4 className="font-bold text-slate-600 dark:text-slate-400">Nenhuma entrada de mão de obra</h4>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Clique em "Adicionar" para registrar horas.</p>
                  </div>
                )}
              </SectionCard>
            </motion.div>
          )}

          {/* TAB 5: Observações e Checklist */}
          {activeTab === 'observacoes' && (
            <motion.div key="observacoes" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <SectionCard title="Observação Técnica" icon="engineering">
                <TextareaField label="Observação Técnica" rows={4} placeholder="Notas técnicas sobre a manutenção..." value={formData.tech_observation || ''} onChange={(e) => updateField('tech_observation', e.target.value)} />
                <BooleanToggle label="Observação Técnica OK?" value={formData.tech_observation_ok} onChange={(v) => updateField('tech_observation_ok', v)} />
                <BooleanToggle label="Equipamento ficou funcional?" value={formData.equipment_functional} onChange={(v) => updateField('equipment_functional', v)} />
                {!isExterna && (
                  <BooleanToggle label="Pendência de peças?" value={formData.parts_pending} onChange={(v) => updateField('parts_pending', v)} />
                )}
              </SectionCard>

              {isExterna && (
                <>
                  <SectionCard title="Observação do Cliente" icon="person">
                    <TextareaField label="Observação do Cliente" rows={3} placeholder="Observações registradas pelo cliente..." value={formData.client_observation || ''} onChange={(e) => updateField('client_observation', e.target.value)} />
                    <BooleanToggle label="Observação do Cliente OK?" value={formData.client_observation_ok} onChange={(v) => updateField('client_observation_ok', v)} />
                  </SectionCard>

                  <SectionCard title="Checklist do Cliente" icon="checklist">
                    <div className="space-y-2">
                      <BooleanToggle label="Equipamento ficou em condições?" value={formData.checklist_equipment_conditions} onChange={(v) => updateField('checklist_equipment_conditions', v)} />
                      <BooleanToggle label="Há condição segura de trabalho?" value={formData.checklist_safe_work} onChange={(v) => updateField('checklist_safe_work', v)} />
                      <BooleanToggle label="Técnico usava EPIs?" value={formData.checklist_epi} onChange={(v) => updateField('checklist_epi', v)} />
                      <BooleanToggle label="O ambiente é adequado para operação do equipamento?" value={formData.checklist_adequate_environment} onChange={(v) => updateField('checklist_adequate_environment', v)} />
                      <BooleanToggle label="Foi bem atendido?" value={formData.checklist_well_served} onChange={(v) => updateField('checklist_well_served', v)} />
                    </div>
                  </SectionCard>
                </>
              )}
            </motion.div>
          )}

          {/* TAB 6: Análise Crítica e Encerramento */}
          {activeTab === 'analise' && (
            <motion.div key="analise" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              {isExterna && (
                <>
                  <SectionCard title="Veículo" icon="directions_car">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <InputField label="Placa" placeholder="ABC-1234" value={formData.vehicle_plate || ''} onChange={(e) => updateField('vehicle_plate', e.target.value)} />
                      <InputField label="KM Inicial" type="number" value={formData.vehicle_km_start || ''} onChange={(e) => updateField('vehicle_km_start', e.target.value ? Number(e.target.value) : null)} />
                      <InputField label="KM Final" type="number" value={formData.vehicle_km_end || ''} onChange={(e) => updateField('vehicle_km_end', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                  </SectionCard>

                  <SectionCard title="Assinaturas" icon="draw">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Cliente</h4>
                        <InputField label="Nome" value={formData.signer_client_name || ''} onChange={(e) => updateField('signer_client_name', e.target.value)} />
                        <InputField label="RG" value={formData.signer_client_rg || ''} onChange={(e) => updateField('signer_client_rg', e.target.value)} />
                        <InputField label="Cargo / Função" value={formData.signer_client_role || ''} onChange={(e) => updateField('signer_client_role', e.target.value)} />
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Técnico</h4>
                        <InputField label="Nome" value={formData.signer_tech_name || ''} onChange={(e) => updateField('signer_tech_name', e.target.value)} />
                        <InputField label="Cargo / Função" value={formData.signer_tech_role || ''} onChange={(e) => updateField('signer_tech_role', e.target.value)} />
                      </div>
                    </div>
                  </SectionCard>
                </>
              )}

              {!isExterna && (
                <SectionCard title="Técnico Responsável" icon="badge">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Nome do Técnico" value={formData.signer_tech_name || ''} onChange={(e) => updateField('signer_tech_name', e.target.value)} />
                    <InputField label="Função" value={formData.signer_tech_role || ''} onChange={(e) => updateField('signer_tech_role', e.target.value)} />
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Análise Crítica (Gestor)" icon="assessment">
                <TextareaField label="Análise Crítica" rows={3} placeholder="Observações do gestor..." value={formData.critical_analysis || ''} onChange={(e) => updateField('critical_analysis', e.target.value)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label={isExterna ? 'Custo Altomaster' : 'Custo M (Manutenção)'} type="number" placeholder="0.00" value={formData.cost_company || ''} onChange={(e) => updateField('cost_company', e.target.value ? Number(e.target.value) : 0)} />
                  <InputField label={isExterna ? 'Custo CLIENTE' : 'Custo C (Compras)'} type="number" placeholder="0.00" value={formData.cost_client || ''} onChange={(e) => updateField('cost_client', e.target.value ? Number(e.target.value) : 0)} />
                </div>
                <BooleanToggle label="Há Pendência?" value={formData.has_pending} onChange={(v) => updateField('has_pending', v)} />
              </SectionCard>

              <SectionCard title="Relatório Técnico" icon="description">
                <TextareaField label="Descrição Detalhada" rows={8} placeholder="Relate aqui todos os procedimentos, problemas e soluções..." value={formData.description || ''} onChange={(e) => updateField('description', e.target.value)} />
                <TextareaField label="Observações Internas" rows={3} placeholder="Notas para controle interno..." value={formData.notes || ''} onChange={(e) => updateField('notes', e.target.value)} />
              </SectionCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default MaintenanceForm;
