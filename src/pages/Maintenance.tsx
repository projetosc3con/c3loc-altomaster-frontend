import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import api from '../services/api';
import type { ServiceOrder, UserProfile } from '../types';
import ServiceOrderDocument from '../components/maintenance/ServiceOrderDocument';

const STATUS_OPTIONS = [
  { label: 'Aberta', value: 'Aberta', dotColor: 'bg-blue-500' },
  { label: 'Em andamento', value: 'Em Andamento', dotColor: 'bg-amber-500' },
  { label: 'Aguardando peças', value: 'Aguardando Peças', dotColor: 'bg-purple-500' },
  { label: 'Encerrada com pendências', value: 'Encerrada com pendências', dotColor: 'bg-orange-500' },
  { label: 'Concluída', value: 'Concluída', dotColor: 'bg-emerald-500' },
  { label: 'Cancelada', value: 'Cancelada', dotColor: 'bg-red-500' },
];

const STORAGE_KEY = 'c3loc_maintenance_filters';

interface MaintenanceFiltersStorage {
  typeFilter: '' | 'Interna' | 'Externa';
  selectedStatuses: string[];
  technicianFilter: string;
}

const getInitialStoredFilters = (): MaintenanceFiltersStorage => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        typeFilter: parsed.typeFilter || '',
        selectedStatuses: Array.isArray(parsed.selectedStatuses) ? parsed.selectedStatuses : [],
        technicianFilter: parsed.technicianFilter || '',
      };
    }
  } catch (e) {
    console.warn('Erro ao carregar filtros de manutenção do localStorage:', e);
  }
  return {
    typeFilter: '',
    selectedStatuses: [],
    technicianFilter: '',
  };
};

const getPartsTotalValue = (os: ServiceOrder): number => {
  const partsList = (os as any).service_order_parts || os.parts || [];
  if (!Array.isArray(partsList) || partsList.length === 0) return 0;
  return partsList.reduce((acc: number, p: any) => {
    if (p.was_used === false) return acc;
    const qty = Number(p.quantity_used) || 0;
    const unitVal = Number(p.unit_value_at_use) || Number(p.parts?.unit_value) || 0;
    const subtotal = Number(p.subtotal) > 0 ? Number(p.subtotal) : (qty * unitVal);
    return acc + subtotal;
  }, 0);
};

const getPartsCount = (os: ServiceOrder): number => {
  const partsList = (os as any).service_order_parts || os.parts || [];
  if (!Array.isArray(partsList) || partsList.length === 0) return 0;
  return partsList.filter((p: any) => p.was_used !== false).length;
};

const Maintenance: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [viewingPdfId, setViewingPdfId] = useState<string | null>(null);

  // Filtros Avançados com persistência em localStorage
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'' | 'Interna' | 'Externa'>(() => getInitialStoredFilters().typeFilter);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => getInitialStoredFilters().selectedStatuses);
  const [technicianFilter, setTechnicianFilter] = useState<string>(() => getInitialStoredFilters().technicianFilter);

  // Salvar preferências de filtros automaticamente no localStorage
  useEffect(() => {
    try {
      if (!typeFilter && selectedStatuses.length === 0 && !technicianFilter) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            typeFilter,
            selectedStatuses,
            technicianFilter,
          })
        );
      }
    } catch (e) {
      console.warn('Erro ao salvar filtros de manutenção no localStorage:', e);
    }
  }, [typeFilter, selectedStatuses, technicianFilter]);

  const handleDownloadPdf = async (os: ServiceOrder) => {
    try {
      setGeneratingPdfId(os.id);
      
      const partsUsed = (os as any).service_order_parts?.map((p: any) => ({
        part_id: p.part_id,
        description: p.parts?.description || p.part_description || '',
        internal_code: p.parts?.internal_code || p.internal_code || '',
        quantity_used: p.quantity_used,
        unit_value_at_use: p.unit_value_at_use,
        subtotal: p.quantity_used * p.unit_value_at_use,
        was_used: p.was_used !== false
      })) || [];

      const laborEntries = (os as any).service_order_labor?.map((l: any) => ({
        technician_name: l.technician_name,
        labor_date: l.labor_date || '',
        start_time: l.start_time || '',
        end_time: l.end_time || '',
        labor_type: l.labor_type || 'T',
      })) || [];

      const blob = await pdf(
        <ServiceOrderDocument
          data={os}
          parts={partsUsed}
          labor={laborEntries}
        />
      ).toBlob();
      
      const fileName = `OS-${os.os_number || 'nova'}-${os.order_type || 'Interna'}.pdf`;
      saveAs(blob, fileName);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar o PDF da Ordem de Serviço.');
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const handleViewPdf = async (os: ServiceOrder) => {
    try {
      setViewingPdfId(os.id);
      
      const partsUsed = (os as any).service_order_parts?.map((p: any) => ({
        part_id: p.part_id,
        description: p.parts?.description || p.part_description || '',
        internal_code: p.parts?.internal_code || p.internal_code || '',
        quantity_used: p.quantity_used,
        unit_value_at_use: p.unit_value_at_use,
        subtotal: p.quantity_used * p.unit_value_at_use,
        was_used: p.was_used !== false
      })) || [];

      const laborEntries = (os as any).service_order_labor?.map((l: any) => ({
        technician_name: l.technician_name,
        labor_date: l.labor_date || '',
        start_time: l.start_time || '',
        end_time: l.end_time || '',
        labor_type: l.labor_type || 'T',
      })) || [];

      const blob = await pdf(
        <ServiceOrderDocument
          data={os}
          parts={partsUsed}
          labor={laborEntries}
        />
      ).toBlob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Erro ao abrir PDF:', err);
      alert('Erro ao visualizar o PDF da Ordem de Serviço.');
    } finally {
      setViewingPdfId(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [ordersRes, usersRes] = await Promise.all([
          api.get('/service-orders'),
          api.get('/users').catch(() => ({ data: [] })),
        ]);
        setOrders(ordersRes.data || []);
        setTechnicians(usersRes.data || []);
        setError(null);
      } catch (err: any) {
        console.error('Erro ao buscar manutenções:', err);
        setError('Não foi possível carregar as ordens de serviço. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Lista dinâmica de técnicos
  const availableTechnicians = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role?: string }>();

    technicians.forEach(u => {
      map.set(u.id, { id: u.id, name: u.full_name, role: u.access_level });
    });

    orders.forEach(os => {
      if (os.executor && !map.has(os.executor.id)) {
        map.set(os.executor.id, { id: os.executor.id, name: os.executor.full_name });
      }
      if (os.signer_tech_name && !Array.from(map.values()).some(t => t.name.toLowerCase() === os.signer_tech_name!.toLowerCase())) {
        map.set(`name:${os.signer_tech_name}`, { id: `name:${os.signer_tech_name}`, name: os.signer_tech_name });
      }
      os.service_order_labor?.forEach((l: any) => {
        if (l.technician_name && !Array.from(map.values()).some(t => t.name.toLowerCase() === l.technician_name.toLowerCase())) {
          map.set(`name:${l.technician_name}`, { id: `name:${l.technician_name}`, name: l.technician_name });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [technicians, orders]);

  const selectedTechnicianLabel = useMemo(() => {
    if (!technicianFilter) return '';
    const found = availableTechnicians.find(t => t.id === technicianFilter);
    return found ? found.name : technicianFilter.replace('name:', '');
  }, [technicianFilter, availableTechnicians]);

  const toggleStatus = (statusValue: string) => {
    setSelectedStatuses(prev => {
      const exists = prev.some(s => s.toLowerCase() === statusValue.toLowerCase());
      if (exists) {
        return prev.filter(s => s.toLowerCase() !== statusValue.toLowerCase());
      } else {
        return [...prev, statusValue];
      }
    });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(os => {
      // 1. Busca textual
      if (search) {
        const q = search.toLowerCase();
        const techName = os.executor?.full_name || os.signer_tech_name || '';
        const match = (os.os_number?.toString() || '').includes(q)
          || (os.equipment_asset_number || '').toLowerCase().includes(q)
          || (os.equipment_name || '').toLowerCase().includes(q)
          || (os.description || '').toLowerCase().includes(q)
          || (os.status || '').toLowerCase().includes(q)
          || techName.toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Tipo de OS (Interna ou Externa)
      if (typeFilter) {
        const osType = os.order_type || 'Interna';
        if (osType.toLowerCase() !== typeFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Status da OS
      if (selectedStatuses.length > 0) {
        const osStatus = (os.status || '').toLowerCase();
        const matchesStatus = selectedStatuses.some(s => s.toLowerCase() === osStatus);
        if (!matchesStatus) return false;
      }

      // 4. Técnico Responsável
      if (technicianFilter) {
        const target = technicianFilter.startsWith('name:')
          ? technicianFilter.replace('name:', '').toLowerCase()
          : technicianFilter;

        const matchesId = os.executed_by === target || os.executor?.id === target;
        const matchesName = (os.executor?.full_name?.toLowerCase() === target.toLowerCase())
          || (os.signer_tech_name?.toLowerCase() === target.toLowerCase())
          || (os.service_order_labor?.some((l: any) => l.technician_name?.toLowerCase() === target.toLowerCase()));

        if (!matchesId && !matchesName) return false;
      }

      return true;
    });
  }, [orders, search, typeFilter, selectedStatuses, technicianFilter]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (typeFilter) count++;
    if (selectedStatuses.length > 0) count++;
    if (technicianFilter) count++;
    return count;
  }, [typeFilter, selectedStatuses, technicianFilter]);

  const clearAllFilters = () => {
    setSearch('');
    setTypeFilter('');
    setSelectedStatuses([]);
    setTechnicianFilter('');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Erro ao limpar filtros no localStorage:', e);
    }
  };

  const clearFilters = () => {
    setSearch('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aberta':
        return 'bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
      case 'Em Andamento':
      case 'Em andamento':
        return 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
      case 'Aguardando Peças':
      case 'Aguardando peças':
        return 'bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
      case 'Concluída':
        return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
      case 'Encerrada com pendências':
        return 'bg-orange-100 dark:bg-orange-500/10 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-500/20';
      case 'Cancelada':
        return 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 border-red-200 dark:border-red-500/20';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Manutenções</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Acompanhe e gerencie as ordens de serviço de equipamentos.</p>
        </motion.div>
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={() => navigate('/manutencoes/nova')}
            className="bg-mustard-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-mustard-600 active:scale-[0.98] transition-all shadow-lg shadow-mustard-500/20"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Nova OS</span>
          </button>
        </motion.div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-3"
        >
          <span className="material-symbols-outlined text-red-500">error</span>
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {/* Barra de Busca, Botão de Filtros e Contador */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3"
      >
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                placeholder="Buscar por OS, equipamento, técnico ou status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 transition-all text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
              {search && (
                <button onClick={clearFilters} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Botão para abrir o Offcanvas */}
            <button
              onClick={() => setShowFilters(true)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeFiltersCount > 0
                  ? 'bg-mustard-50 dark:bg-mustard-500/10 border-mustard-500 text-mustard-600 dark:text-mustard-400 ring-2 ring-mustard-500/20'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 bg-mustard-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 w-full md:w-auto transition-colors shrink-0">
            <div className="w-8 h-8 rounded-full bg-mustard-100 dark:bg-mustard-500/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-400 text-[18px]">build</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-0.5">Ordens Encontradas</span>
              <span className="text-sm font-black text-slate-700 dark:text-slate-300 leading-none">{filteredOrders.length}</span>
            </div>
          </div>
        </div>

        {/* Chips de Filtros Ativos */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-1">
              Filtros ativos:
            </span>

            {typeFilter && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-mustard-50 dark:bg-mustard-500/10 border border-mustard-200 dark:border-mustard-500/30 text-mustard-700 dark:text-mustard-400 rounded-full text-xs font-bold">
                <span>Tipo: <strong>{typeFilter}</strong></span>
                <button
                  onClick={() => setTypeFilter('')}
                  className="hover:text-red-500 rounded-full p-0.5 transition-colors cursor-pointer"
                  title="Remover filtro de tipo"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            )}

            {selectedStatuses.map(st => (
              <span
                key={st}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold"
              >
                <span>Status: <strong>{st}</strong></span>
                <button
                  onClick={() => toggleStatus(st)}
                  className="hover:text-red-500 rounded-full p-0.5 transition-colors cursor-pointer"
                  title={`Remover filtro ${st}`}
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            ))}

            {technicianFilter && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-mustard-50 dark:bg-mustard-500/10 border border-mustard-200 dark:border-mustard-500/30 text-mustard-700 dark:text-mustard-400 rounded-full text-xs font-bold">
                <span>Técnico: <strong>{selectedTechnicianLabel}</strong></span>
                <button
                  onClick={() => setTechnicianFilter('')}
                  className="hover:text-red-500 rounded-full p-0.5 transition-colors cursor-pointer"
                  title="Remover filtro de técnico"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            )}

            <button
              onClick={clearAllFilters}
              className="text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 font-bold underline transition-colors ml-2 cursor-pointer"
            >
              Limpar todos
            </button>
          </div>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-10 h-10 border-4 border-mustard-500/10 border-t-mustard-500 rounded-full animate-spin" />
            <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Carregando ordens de serviço...</p>
          </motion.div>
        ) : filteredOrders.length > 0 ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider transition-colors">
                  <tr>
                    <th className="px-6 py-4">OS</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Equipamento</th>
                    <th className="px-6 py-4">Data/Local</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Total em Peças</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredOrders.map((os) => (
                    <tr key={os.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900 dark:text-white">#{os.os_number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                          os.order_type === 'Externa'
                            ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200/50 dark:border-orange-500/20'
                            : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20'
                        }`}>
                          {os.order_type || 'Interna'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white" title={os.description ? `Problema relatado: ${os.description}` : undefined}>
                            {os.equipment_name || 'Desconhecido'}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                            <span>Frota: {os.equipment_asset_number || '-'}</span>
                            {(os.executor?.full_name || os.signer_tech_name || os.service_order_labor?.[0]?.technician_name) && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                                  <span className="material-symbols-outlined text-[13px] text-mustard-500">engineering</span>
                                  {os.executor?.full_name || os.signer_tech_name || os.service_order_labor?.[0]?.technician_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {os.execution_date ? new Date(os.execution_date).toLocaleDateString('pt-BR') : '-'}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-500">{os.execution_location || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-colors ${getStatusColor(os.status)}`}>
                          {os.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(() => {
                          const totalVal = getPartsTotalValue(os);
                          const count = getPartsCount(os);
                          return (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-slate-900 dark:text-white font-mono">
                                {totalVal > 0
                                  ? totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                  : 'R$ 0,00'}
                              </span>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                {count > 0 ? `${count} ${count === 1 ? 'item' : 'itens'}` : 'Sem peças'}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleViewPdf(os)}
                            disabled={viewingPdfId === os.id}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors disabled:opacity-60"
                            title="Visualizar PDF"
                          >
                            {viewingPdfId === os.id ? (
                              <div className="w-4 h-4 border-2 border-slate-300/30 border-t-slate-500 rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[20px]">visibility</span>
                            )}
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(os)}
                            disabled={generatingPdfId === os.id}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors disabled:opacity-60"
                            title="Baixar PDF"
                          >
                            {generatingPdfId === os.id ? (
                              <div className="w-4 h-4 border-2 border-slate-300/30 border-t-slate-500 rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[20px]">download</span>
                            )}
                          </button>
                          <button
                            onClick={() => navigate(`/manutencoes/editar/${os.id}`)}
                            className="p-1.5 text-slate-400 hover:text-mustard-600 dark:hover:text-mustard-400 hover:bg-mustard-50 dark:hover:bg-mustard-500/10 rounded transition-colors"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center transition-colors"
          >
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-600 text-3xl">build</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhuma ordem encontrada</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm font-medium">
              {search || activeFiltersCount > 0
                ? 'Sua busca com filtros não retornou resultados. Tente ajustar ou limpar os filtros.'
                : 'Não há manutenções cadastradas. Clique em "Nova OS" para criar.'}
            </p>
            {(search || activeFiltersCount > 0) && (
              <button
                onClick={clearAllFilters}
                className="mt-6 px-5 py-2.5 bg-mustard-500 hover:bg-mustard-600 text-white font-bold rounded-xl transition-colors shadow-sm text-xs uppercase tracking-wider cursor-pointer"
              >
                Limpar Filtros
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offcanvas Filtros Avançados */}
      <AnimatePresence>
        {showFilters && (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-mustard-500">tune</span>
                    Filtros de Manutenção
                  </h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Refine por tipo de OS, status e técnico
                  </p>
                </div>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Fechar filtros"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Tipo de OS */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-mustard-500">category</span>
                      Tipo de OS
                    </label>
                    {typeFilter && (
                      <button
                        type="button"
                        onClick={() => setTypeFilter('')}
                        className="text-[11px] font-bold text-mustard-600 dark:text-mustard-400 hover:underline cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Todos', value: '', icon: 'apps' },
                      { label: 'Interna', value: 'Interna', icon: 'home_repair_service' },
                      { label: 'Externa', value: 'Externa', icon: 'local_shipping' },
                    ].map((item) => {
                      const isSelected = typeFilter === item.value;
                      const count = orders.filter(o => !item.value || (o.order_type || 'Interna').toLowerCase() === item.value.toLowerCase()).length;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setTypeFilter(item.value as '' | 'Interna' | 'Externa')}
                          className={`px-3 py-3 rounded-2xl text-xs font-bold text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-mustard-500 text-white shadow-lg shadow-mustard-500/25 ring-2 ring-mustard-500'
                              : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                          <span>{item.label}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                            isSelected ? 'bg-white/25 text-white' : 'bg-slate-200/60 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Status da OS */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-mustard-500">traffic</span>
                      Status da OS
                    </label>
                    {selectedStatuses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses([])}
                        className="text-[11px] font-bold text-mustard-600 dark:text-mustard-400 hover:underline cursor-pointer"
                      >
                        Limpar seleção ({selectedStatuses.length})
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_OPTIONS.map((item) => {
                      const isSelected = selectedStatuses.some(s => s.toLowerCase() === item.value.toLowerCase());
                      const count = orders.filter(o => (o.status || '').toLowerCase() === item.value.toLowerCase()).length;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => toggleStatus(item.value)}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all flex items-center justify-between border cursor-pointer ${
                            isSelected
                              ? 'bg-mustard-500 text-white border-mustard-500 shadow-md shadow-mustard-500/20'
                              : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? 'bg-white' : item.dotColor}`} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full shrink-0 ml-1.5 ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Técnico Responsável */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-mustard-500">engineering</span>
                      Técnico Responsável
                    </label>
                    {technicianFilter && (
                      <button
                        type="button"
                        onClick={() => setTechnicianFilter('')}
                        className="text-[11px] font-bold text-mustard-600 dark:text-mustard-400 hover:underline cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      value={technicianFilter}
                      onChange={(e) => setTechnicianFilter(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 transition-all cursor-pointer appearance-none pr-10"
                    >
                      <option value="">Todos os Técnicos</option>
                      {availableTechnicians.map((t) => {
                        const count = orders.filter(os => {
                          const target = t.id.startsWith('name:') ? t.id.replace('name:', '').toLowerCase() : t.id;
                          return os.executed_by === target
                            || os.executor?.id === target
                            || (os.executor?.full_name?.toLowerCase() === target.toLowerCase())
                            || (os.signer_tech_name?.toLowerCase() === target.toLowerCase())
                            || (os.service_order_labor?.some((l: any) => l.technician_name?.toLowerCase() === target.toLowerCase()));
                        }).length;
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.role ? `(${t.role})` : ''} — {count} OS
                          </option>
                        );
                      })}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Resumo da Filtragem */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="material-symbols-outlined text-mustard-500 text-lg">info</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Resumo da Filtragem</span>
                  </div>
                  <p className="text-2xl font-black text-mustard-500">{filteredOrders.length}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    ordem(ns) de serviço encontrada(s) de um total de {orders.length}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Limpar Tudo
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="flex-[2] py-3 bg-mustard-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-mustard-600 active:scale-[0.98] transition-all shadow-lg shadow-mustard-500/20 cursor-pointer"
                >
                  Aplicar Filtros
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Maintenance;
