import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import XmlImportModal from '../components/XmlImportModal';
import type { Equipment, RentalInvoice } from '../types';

const EQUIPMENT_TYPES = [
  'Elétrica',
  'Diesel',
  'GLP'
];

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('inventory_view_mode');
    return saved === 'list' || saved === 'grid' ? saved : 'grid';
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('inventory_view_mode', viewMode);
  }, [viewMode]);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [historyEquipment, setHistoryEquipment] = useState<Equipment | null>(null);
  const [equipmentRentals, setEquipmentRentals] = useState<RentalInvoice[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [valueMin, setValueMin] = useState(0);
  const [valueMax, setValueMax] = useState(0);
  const [assetSortOrder, setAssetSortOrder] = useState<'asc' | 'desc' | null>(null);

  const activeAdvancedCount = [search, typeFilter, yearMin, yearMax].filter(Boolean).length + (valueMin > 0 || valueMax > 0 ? 1 : 0);

  const maxEquipmentValue = useMemo(() => {
    if (equipments.length === 0) return 1000000;
    return Math.ceil(Math.max(...equipments.map(e => e.value || 0)) / 10000) * 10000 || 1000000;
  }, [equipments]);

  const filteredEquipments = useMemo(() => {
    const list = equipments.filter(eq => {
      if (statusFilter && eq.status !== statusFilter) return false;
      if (typeFilter && eq.type !== typeFilter) return false;
      if (yearMin && (eq.manufacture_year ?? 0) < parseInt(yearMin)) return false;
      if (yearMax && (eq.manufacture_year ?? 9999) > parseInt(yearMax)) return false;
      if (valueMin > 0 && (eq.value ?? 0) < valueMin) return false;
      if (valueMax > 0 && (eq.value ?? 0) > valueMax) return false;
      if (search) {
        const q = search.toLowerCase();
        const match = eq.name.toLowerCase().includes(q)
          || eq.asset_number.toLowerCase().includes(q)
          || (eq.model || '').toLowerCase().includes(q)
          || (eq.serial_number || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    if (assetSortOrder) {
      list.sort((a, b) => {
        const cmp = (a.asset_number || '').localeCompare(b.asset_number || '', undefined, { numeric: true, sensitivity: 'base' });
        return assetSortOrder === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [equipments, statusFilter, typeFilter, yearMin, yearMax, search, valueMin, valueMax, assetSortOrder]);

  const clearAllFilters = () => {
    setStatusFilter(null);
    setSearch('');
    setTypeFilter('');
    setYearMin('');
    setYearMax('');
    setValueMin(0);
    setValueMax(0);
    setAssetSortOrder(null);
  };

  const handleOpenHistory = async (eq: Equipment) => {
    setHistoryEquipment(eq);
    setLoadingHistory(true);
    setHistoryError(null);
    setEquipmentRentals([]);
    try {
      const { data } = await api.get(`/equipments/${eq.id}/rentals`);
      const sorted = (data || []).sort((a: RentalInvoice, b: RentalInvoice) => {
        if (!a.return_date && !b.return_date) {
          return new Date(b.billing_period_start || b.created_at || 0).getTime() - new Date(a.billing_period_start || a.created_at || 0).getTime();
        }
        if (!a.return_date) return -1;
        if (!b.return_date) return 1;
        return new Date(b.return_date).getTime() - new Date(a.return_date).getTime();
      });
      setEquipmentRentals(sorted);
    } catch (err: any) {
      console.error('Erro ao buscar histórico de locações:', err);
      setHistoryError('Não foi possível carregar o histórico de locações.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const historyStats = useMemo(() => {
    if (!equipmentRentals || equipmentRentals.length === 0) {
      return { avgDays: 0, avgValue: 0, totalRentals: 0, totalRevenue: 0 };
    }

    // 1. Média de dias locada
    const durations = equipmentRentals
      .map(r => {
        if (!r.billing_period_start) return null;
        const startDate = new Date(r.billing_period_start.includes('T') ? r.billing_period_start : `${r.billing_period_start}T00:00:00`);
        const endDateStr = r.return_date || r.billing_period_end;
        if (!endDateStr) return null;
        const endDate = new Date(endDateStr.includes('T') ? endDateStr : `${endDateStr}T00:00:00`);
        const diffTime = endDate.getTime() - startDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 ? Math.max(1, diffDays) : null;
      })
      .filter((d): d is number => d !== null);

    const avgDays = durations.length > 0
      ? Math.round(durations.reduce((acc, d) => acc + d, 0) / durations.length)
      : 0;

    // 2. Média das faturas de locação
    const nonCancelled = equipmentRentals.filter(r => r.billing_status !== 'Cancelada');
    const totalRevenue = nonCancelled.reduce((acc, r) => acc + Number(r.total_value || 0), 0);
    const avgValue = nonCancelled.length > 0 ? totalRevenue / nonCancelled.length : 0;

    return {
      avgDays,
      avgValue,
      totalRentals: equipmentRentals.length,
      totalRevenue,
    };
  }, [equipmentRentals]);

  useEffect(() => {
    const fetchEquipments = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/equipments');
        setEquipments(data);
        setError(null);
      } catch (err: any) {
        console.error('Erro ao buscar equipamentos:', err);
        setError('Não foi possível carregar o estoque.');
      } finally {
        setLoading(false);
      }
    };

    fetchEquipments();
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Disponível': return 'bg-emerald-600 text-white border-emerald-500';
      case 'Locado': return 'bg-slate-800 text-white border-slate-700';
      case 'Em Manutenção': return 'bg-amber-500 text-white border-amber-400';
      default: return 'bg-slate-400 text-white border-slate-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Disponível': return 'check_circle';
      case 'Locado': return 'schedule';
      case 'Em Manutenção': return 'build';
      default: return 'help';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Estoque de Máquinas</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gerencie a frota de equipamentos, status e disponibilidade.</p>
        </motion.div>
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          <div className="flex bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-800 text-mustard-500 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 dark:bg-slate-800 text-mustard-500 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              <span className="material-symbols-outlined text-[20px]">view_list</span>
            </button>
          </div>

          <button
            onClick={() => setIsXmlModalOpen(true)}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-bold text-xs uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-[20px] text-mustard-600">receipt_long</span>
            Importar NF-e
          </button>

          <button
            onClick={() => navigate('/equipamentos/novo')}
            className="flex items-center gap-2 bg-mustard-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-mustard-500/20 hover:bg-mustard-600 transition-all font-bold text-xs uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Novo Equipamento
          </button>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
      >
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-2">Filtros:</span>
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${!statusFilter ? 'bg-mustard-500 text-white shadow-md shadow-mustard-500/20' : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
        >
          Todos
        </button>
        {(['Disponível', 'Locado', 'Em Manutenção', 'Inativo'] as const).map(s => {
          const styles: Record<string, { active: string; inactive: string; icon: string }> = {
            'Disponível': {
              active: 'bg-emerald-600 text-white shadow-md',
              inactive: 'border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20',
              icon: 'check_circle'
            },
            'Locado': {
              active: 'bg-slate-800 dark:bg-slate-700 text-white shadow-md',
              inactive: 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700',
              icon: 'schedule'
            },
            'Em Manutenção': {
              active: 'bg-amber-500 text-white shadow-md',
              inactive: 'border border-amber-100 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20',
              icon: 'build'
            },
            'Inativo': {
              active: 'bg-red-500 text-white shadow-md',
              inactive: 'border border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20',
              icon: 'block'
            },
          };
          const st = styles[s];
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${statusFilter === s ? st.active : st.inactive}`}>
              <span className="material-symbols-outlined text-[16px]">{st.icon}</span>
              {s}
            </button>
          );
        })}
        <button
          onClick={() => setShowFilters(true)}
          className="relative flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ml-auto"
        >
          <span className="material-symbols-outlined text-[18px]">filter_list</span>
          Mais Filtros
          {activeAdvancedCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-mustard-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{activeAdvancedCount}</span>
          )}
        </button>
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
            <div className="w-10 h-10 border-4 border-mustard-500/10 border-t-mustard-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm font-medium mt-4">Carregando estoque...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 border border-red-100 text-red-800 p-8 rounded-2xl text-center"
          >
            <span className="material-symbols-outlined text-4xl mb-2 text-red-500">error</span>
            <p className="font-bold">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-red-100 hover:bg-red-200 rounded-xl text-sm font-bold transition-colors"
            >
              Tentar Novamente
            </button>
          </motion.div>
        ) : equipments.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 p-20 rounded-3xl text-center transition-colors"
          >
            <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-800 mb-4">inventory_2</span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Nenhum equipamento cadastrado</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto font-medium">Comece adicionando uma nova máquina ao seu estoque operacional.</p>
            <button
              onClick={() => navigate('/equipamentos/novo')}
              className="mt-6 px-8 py-3 bg-mustard-500 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-mustard-600 transition-all shadow-lg shadow-mustard-500/20"
            >
              Cadastrar Primeiro Equipamento
            </button>
          </motion.div>
        ) : filteredEquipments.length === 0 && equipments.length > 0 ? (
          <motion.div key="no-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 p-16 rounded-3xl text-center transition-colors">
            <span className="material-symbols-outlined text-5xl text-slate-200 dark:text-slate-800 mb-3">search_off</span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum resultado encontrado</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">Tente alterar os filtros aplicados.</p>
            <button onClick={clearAllFilters} className="mt-4 px-6 py-2 bg-mustard-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-mustard-600 transition-all">Limpar Filtros</button>
          </motion.div>
        ) : (
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredEquipments.map((equipment, index) => (
                  <motion.div
                    key={equipment.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300"
                  >
                    <div className="h-48 relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                      {equipment.photo_url ? (
                        <img
                          src={equipment.photo_url}
                          alt={equipment.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <span className="material-symbols-outlined text-5xl">image</span>
                        </div>
                      )}
                      <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-wider shadow-lg border ${getStatusStyle(equipment.status)}`}>
                        <span className="material-symbols-outlined text-[16px]">
                          {getStatusIcon(equipment.status)}
                        </span>
                        {equipment.status}
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight group-hover:text-mustard-500 transition-colors line-clamp-1">{equipment.name}</h3>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{equipment.model || 'Modelo não informado'}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-3 mb-6 mt-auto border-t border-slate-50 dark:border-slate-800 pt-4">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Patrimônio</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">{equipment.asset_number}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nº de Série</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono truncate block" title={equipment.serial_number || '-'}>
                            {equipment.serial_number || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Altura</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{equipment.height ? `${equipment.height}m` : '-'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ano</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{equipment.manufacture_year || '-'}</span>
                        </div>
                      </div>

                      {equipment.status === 'Locado' && equipment.rental_period_start && (
                        <div className="flex items-center gap-1.5 mb-4 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="material-symbols-outlined text-[14px] text-mustard-500">date_range</span>
                          {new Date(equipment.rental_period_start + 'T00:00:00').toLocaleDateString('pt-BR')}
                          {' — '}
                          {equipment.rental_period_end ? new Date(equipment.rental_period_end + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/equipamentos/editar/${equipment.id}`)}
                          title="Editar Equipamento"
                          className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-mustard-600 dark:hover:text-mustard-400 hover:border-mustard-300 dark:hover:border-mustard-500/30 rounded-xl transition-all flex items-center justify-center shrink-0"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(equipment)}
                          title="Histórico de Locações"
                          className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-mustard-600 dark:hover:text-mustard-400 hover:border-mustard-300 dark:hover:border-mustard-500/30 rounded-xl transition-all flex items-center justify-center shrink-0"
                        >
                          <span className="material-symbols-outlined text-[18px]">quick_reference_all</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedEquipment(equipment)}
                          className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-center"
                        >
                          Detalhes
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Equipamento</th>
                        <th
                          onClick={() => setAssetSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-mustard-500 transition-colors group/sort"
                          title="Clique para ordenar por patrimônio"
                        >
                          <div className="flex items-center gap-1">
                            <span>Patrimônio</span>
                            <span className={`material-symbols-outlined text-[16px] transition-all ${assetSortOrder ? 'text-mustard-500 opacity-100' : 'opacity-0 group-hover/sort:opacity-40'}`}>
                              {assetSortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                            </span>
                          </div>
                        </th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nº de Série</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Modelo</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Altura</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredEquipments.map((equipment) => (
                        <tr key={equipment.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                                {equipment.photo_url ? (
                                  <img src={equipment.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700">
                                    <span className="material-symbols-outlined text-xl">image</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-mustard-500 transition-colors">{equipment.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[11px] font-mono">{equipment.asset_number}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[11px] font-mono">
                              {equipment.serial_number || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{equipment.model || '-'}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                            {equipment.height ? `${equipment.height}m` : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider border ${getStatusStyle(equipment.status)}`}>
                                <span className="material-symbols-outlined text-[14px]">
                                  {getStatusIcon(equipment.status)}
                                </span>
                                {equipment.status}
                              </div>
                            </div>
                            {equipment.status === 'Locado' && equipment.rental_client_name && (
                              <div className="mt-2 flex flex-col gap-0.5">
                                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[13px] text-mustard-500">business</span>
                                  {equipment.rental_client_name}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">date_range</span>
                                  {equipment.rental_period_start ? new Date(equipment.rental_period_start + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                  {' — '}
                                  {equipment.rental_period_end ? new Date(equipment.rental_period_end + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/equipamentos/editar/${equipment.id}`)}
                                className="p-2 text-slate-400 hover:text-mustard-600 hover:bg-mustard-50 dark:hover:bg-mustard-500/10 rounded-lg transition-all"
                                title="Editar Equipamento"
                              >
                                <span className="material-symbols-outlined text-[20px]">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenHistory(equipment)}
                                className="p-2 text-slate-400 hover:text-mustard-600 hover:bg-mustard-50 dark:hover:bg-mustard-500/10 rounded-lg transition-all"
                                title="Histórico de Locações"
                              >
                                <span className="material-symbols-outlined text-[20px]">quick_reference_all</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedEquipment(equipment)}
                                className="p-2 text-slate-400 hover:text-mustard-600 hover:bg-mustard-50 dark:hover:bg-mustard-500/10 rounded-lg transition-all"
                                title="Ver Detalhes"
                              >
                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Detalhes */}
      <AnimatePresence>
        {selectedEquipment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEquipment(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            >
              {/* Lado Esquerdo: Imagem */}
              <div className="w-full md:w-1/2 h-64 md:h-auto relative bg-slate-100 dark:bg-slate-800">
                {selectedEquipment.photo_url ? (
                  <img
                    src={selectedEquipment.photo_url}
                    alt={selectedEquipment.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                    <span className="material-symbols-outlined text-7xl">image</span>
                    <p className="text-xs font-bold uppercase tracking-widest mt-2">Sem foto cadastrada</p>
                  </div>
                )}

                {/* Status Badge flutuante na imagem */}
                <div className={`absolute top-6 left-6 flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest shadow-2xl border ${getStatusStyle(selectedEquipment.status)}`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {getStatusIcon(selectedEquipment.status)}
                  </span>
                  {selectedEquipment.status}
                </div>

                <button
                  onClick={() => setSelectedEquipment(null)}
                  className="absolute top-6 right-6 md:hidden w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Lado Direito: Informações */}
              <div className="w-full md:w-1/2 flex flex-col p-8 md:p-10 overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedEquipment.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg mt-1">{selectedEquipment.model || 'Modelo não informado'}</p>
                  </div>
                  <button
                    onClick={() => setSelectedEquipment(null)}
                    className="hidden md:flex w-10 h-10 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full items-center justify-center text-slate-400 transition-colors"
                  >
                    <span className="material-symbols-outlined text-2xl">close</span>
                  </button>
                </div>

                {/* Grid de Especificações - Bento Style */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tipo</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedEquipment.type || '-'}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Unidade</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedEquipment.unit || '-'}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Patrimônio</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedEquipment.asset_number}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Nº de Série</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedEquipment.serial_number || '-'}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Altura Trabalho</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedEquipment.height ? `${selectedEquipment.height}m` : '-'}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Fabricação</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedEquipment.manufacture_year || '-'}</span>
                  </div>
                </div>

                {/* Informações de Locação */}
                {selectedEquipment.status === 'Locado' && selectedEquipment.rental_client_name && (
                  <div className="mb-8 p-5 rounded-2xl bg-mustard-50 dark:bg-mustard-900/20 border border-mustard-200 dark:border-mustard-800/30">
                    <h4 className="text-[11px] font-bold text-mustard-600 dark:text-mustard-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">assignment</span>
                      Locação Ativa
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <span className="block text-[10px] font-bold text-mustard-500/70 dark:text-mustard-500/50 uppercase tracking-widest mb-0.5">Cliente</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedEquipment.rental_client_name}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-mustard-500/70 dark:text-mustard-500/50 uppercase tracking-widest mb-0.5">Início</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {selectedEquipment.rental_period_start ? new Date(selectedEquipment.rental_period_start + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-mustard-500/70 dark:text-mustard-500/50 uppercase tracking-widest mb-0.5">Término</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {selectedEquipment.rental_period_end ? new Date(selectedEquipment.rental_period_end + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </span>
                      </div>
                      {selectedEquipment.rental_work_site && (
                        <div className="col-span-2">
                          <span className="block text-[10px] font-bold text-mustard-500/70 dark:text-mustard-500/50 uppercase tracking-widest mb-0.5">Local da Obra</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedEquipment.rental_work_site}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dados Fiscais / NF-e de Aquisição */}
                {selectedEquipment.invoice_number && (
                  <div className="mb-8 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                    <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-mustard-500">receipt_long</span>
                      Dados Fiscais de Aquisição (NF-e)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nº da NF-e</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedEquipment.invoice_number}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fornecedor</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block" title={selectedEquipment.supplier_name}>
                          {selectedEquipment.supplier_name || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">NCM / CST / CFOP</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {selectedEquipment.ncm || '-'}{selectedEquipment.cst ? ` | CST ${selectedEquipment.cst}` : ''}{selectedEquipment.cfop ? ` | CFOP ${selectedEquipment.cfop}` : ''}
                        </span>
                      </div>
                      {selectedEquipment.nfe_access_key && (
                        <div className="col-span-2 sm:col-span-3">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chave de Acesso</span>
                          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all select-all">
                            {selectedEquipment.nfe_access_key}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notas/Observações */}
                <div className="mb-8">
                  <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">notes</span>
                    Observações Internas
                  </h4>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic border-l-4 border-mustard-500">
                    {selectedEquipment.notes || 'Nenhuma observação adicional cadastrada para este equipamento.'}
                  </div>
                </div>

                {/* Ações Inferiores */}
                <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                  <button
                    onClick={() => navigate(`/equipamentos/editar/${selectedEquipment.id}`)}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Editar Máquina
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Histórico de Locações */}
      <AnimatePresence>
        {historyEquipment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryEquipment(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">quick_reference_all</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Histórico de Locações</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {historyEquipment.asset_number} — {historyEquipment.name} {historyEquipment.model ? `(${historyEquipment.model})` : ''} {historyEquipment.serial_number ? ` • Série: ${historyEquipment.serial_number}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryEquipment(null)}
                  className="w-9 h-9 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {loadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 gap-3">
                    <div className="w-8 h-8 border-2 border-mustard-500/20 border-t-mustard-500 rounded-full animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest">Carregando histórico de locações...</p>
                  </div>
                ) : historyError ? (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 p-4 rounded-xl text-xs font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    {historyError}
                  </div>
                ) : equipmentRentals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 mb-4">
                      <span className="material-symbols-outlined text-3xl">history_toggle_off</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      Nenhuma locação associada a esse equipamento
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                      Este equipamento ainda não possui registros de contratos ou faturas de locação vinculados.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Seção Superior: KPIs de Médias */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-2xl">date_range</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Média de Dias</span>
                          <span className="text-base font-black text-slate-900 dark:text-white">
                            {historyStats.avgDays > 0 ? `${historyStats.avgDays} dias` : '-'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-2xl">payments</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Média por Fatura</span>
                          <span className="text-base font-black text-slate-900 dark:text-white">
                            {historyStats.avgValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-2xl">quick_reference_all</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total de Locações</span>
                          <span className="text-base font-black text-slate-900 dark:text-white">
                            {historyStats.totalRentals} {historyStats.totalRentals === 1 ? 'locação' : 'locações'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-2 font-medium border-t border-slate-100 dark:border-slate-800">
                      <span>{equipmentRentals.length} fatura(s) encontrada(s)</span>
                      <span className="text-[11px] text-slate-400">Ordenado por data de retorno</span>
                    </div>

                    {equipmentRentals.map((rental) => (
                      <div
                        key={rental.id}
                        className="bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 hover:border-mustard-500/40 transition-all space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/50 dark:border-slate-700/50 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">{rental.client_name}</span>
                              {rental.invoice_number && (
                                <span className="px-2 py-0.5 bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-mono">
                                  #{rental.invoice_number}
                                </span>
                              )}
                            </div>
                            {rental.work_site && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                <span className="material-symbols-outlined text-[14px] text-mustard-500">location_on</span>
                                {rental.work_site}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              rental.billing_status === 'Faturado'
                                ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400'
                                : rental.billing_status === 'Cancelada'
                                ? 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400'
                                : 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400'
                            }`}>
                              {rental.billing_status}
                            </span>
                            <span className="font-bold text-sm text-mustard-600 dark:text-mustard-400">
                              {Number(rental.total_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período de Locação</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                              {rental.billing_period_start ? new Date(rental.billing_period_start + (rental.billing_period_start.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR') : '-'}
                              {' — '}
                              {rental.billing_period_end ? new Date(rental.billing_period_end + (rental.billing_period_end.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR') : '-'}
                            </span>
                          </div>

                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data de Retorno</span>
                            {rental.return_date ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">event_available</span>
                                {new Date(rental.return_date + (rental.return_date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR')}
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">schedule</span>
                                Em andamento
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vencimento</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                              {rental.due_date ? new Date(rental.due_date + (rental.due_date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR') : '-'}
                            </span>
                          </div>
                        </div>

                        {rental.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            {rental.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
                <button
                  type="button"
                  onClick={() => setHistoryEquipment(null)}
                  className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
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
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Filtros Avançados</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Refine a busca no estoque</p>
                </div>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Busca */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Busca por Nome, Patrimônio ou Modelo</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Digite para buscar..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 dark:hover:text-slate-400">
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tipo de Equipamento */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tipo de Equipamento</label>
                  <div className="grid grid-cols-3 gap-2">
                    {EQUIPMENT_TYPES.map(t => (
                      <button
                        key={t}
                        onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold text-center transition-all ${typeFilter === t ? 'bg-mustard-500 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ano de Fabricação */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Ano de Fabricação</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={yearMin}
                      onChange={(e) => setYearMin(e.target.value)}
                      placeholder="De"
                      className="min-w-0 w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                    <span className="text-slate-300 dark:text-slate-600 font-bold shrink-0">—</span>
                    <input
                      type="number"
                      value={yearMax}
                      onChange={(e) => setYearMax(e.target.value)}
                      placeholder="Até"
                      className="min-w-0 w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                  </div>
                </div>

                {/* Faixa de Valor */}
                <div className="space-y-4">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Faixa de Valor (R$)</label>
                  <div className="px-1">
                    <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
                      <div
                        className="absolute h-full bg-mustard-500 rounded-full shadow-sm"
                        style={{
                          left: `${(valueMin / maxEquipmentValue) * 100}%`,
                          right: `${100 - (valueMax > 0 ? valueMax : maxEquipmentValue) / maxEquipmentValue * 100}%`,
                        }}
                      />
                    </div>
                    <div className="relative mt-[-6px]">
                      <input
                        type="range"
                        min={0}
                        max={maxEquipmentValue}
                        step={1000}
                        value={valueMin}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (valueMax > 0 && v > valueMax) return;
                          setValueMin(v);
                        }}
                        className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-mustard-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-mustard-500 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                      />
                      <input
                        type="range"
                        min={0}
                        max={maxEquipmentValue}
                        step={1000}
                        value={valueMax > 0 ? valueMax : maxEquipmentValue}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (v < valueMin) return;
                          setValueMax(v >= maxEquipmentValue ? 0 : v);
                        }}
                        className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-mustard-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-mustard-500 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50 transition-colors">
                      R$ {valueMin.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-[10px] text-slate-300 dark:text-slate-600 uppercase tracking-widest font-bold">até</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50 transition-colors">
                      {valueMax > 0 ? `R$ ${valueMax.toLocaleString('pt-BR')}` : 'Máx'}
                    </span>
                  </div>
                </div>

                {/* Resumo */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-mustard-500 text-lg">info</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Resultados</span>
                  </div>
                  <p className="text-2xl font-black text-mustard-500">{filteredEquipments.length}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">equipamento(s) correspondente(s)</p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  onClick={clearAllFilters}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Limpar Tudo
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="flex-[2] py-3 bg-mustard-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-mustard-600 transition-all"
                >
                  Aplicar Filtros
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal de Importação de NF-e XML */}
      <XmlImportModal
        isOpen={isXmlModalOpen}
        onClose={() => setIsXmlModalOpen(false)}
        onSuccess={() => {
          // Re-fetch equipments
          api.get('/equipments').then(res => setEquipments(res.data)).catch(console.error);
        }}
      />
    </motion.div>
  );
};

export default Inventory;
