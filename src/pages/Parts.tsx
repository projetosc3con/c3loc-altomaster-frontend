import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import type { Part, MaterialCategory } from '../types';
import XmlImportModal from '../components/XmlImportModal';
import StockMovementsModal from '../components/StockMovementsModal';

const CATEGORIES: { key: string; label: string; prefix: string; icon: string }[] = [
  { key: 'Todos', label: 'Todos os Materiais', prefix: '', icon: 'inventory_2' },
  { key: 'Peça', label: 'Peças', prefix: 'P', icon: 'build' },
  { key: 'Consumo', label: 'Consumo', prefix: 'C', icon: 'science' },
  { key: 'EPI', label: 'EPIs', prefix: 'E', icon: 'health_and_safety' },
  { key: 'Outros', label: 'Outros', prefix: 'O', icon: 'category' },
];

const categoryBadgeClass = (category?: MaterialCategory | string) => {
  switch (category) {
    case 'Consumo':
      return 'bg-sky-100 dark:bg-sky-500/10 text-sky-800 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20';
    case 'EPI':
      return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20';
    case 'Outros':
      return 'bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20';
    case 'Peça':
    default:
      return 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20';
  }
};

const categoryIcon = (category?: MaterialCategory | string) => {
  switch (category) {
    case 'Consumo':
      return 'science';
    case 'EPI':
      return 'health_and_safety';
    case 'Outros':
      return 'category';
    case 'Peça':
    default:
      return 'build';
  }
};

const Parts: React.FC = () => {
  const navigate = useNavigate();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [search, setSearch] = useState('');
  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false);
  const [movementFilterPart, setMovementFilterPart] = useState<{ id?: string; name?: string; code?: string } | null>(null);

  const handleOpenMovements = (part?: Part) => {
    if (part) {
      setMovementFilterPart({
        id: part.id,
        name: part.description,
        code: part.internal_code,
      });
    } else {
      setMovementFilterPart(null);
    }
    setIsMovementsModalOpen(true);
  };

  const fetchParts = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/parts');
      setParts(data);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao buscar materiais:', err);
      setError('Não foi possível carregar o estoque de materiais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts();
  }, []);

  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = {
      Todos: parts.length,
      Peça: 0,
      Consumo: 0,
      EPI: 0,
      Outros: 0,
    };
    parts.forEach((p) => {
      const cat = p.category || 'Peça';
      if (counts[cat] !== undefined) {
        counts[cat] += 1;
      } else {
        counts['Outros'] = (counts['Outros'] || 0) + 1;
      }
    });
    return counts;
  }, [parts]);

  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      const cat = p.category || 'Peça';
      if (selectedCategory !== 'Todos' && cat !== selectedCategory) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const match =
          (p.description || '').toLowerCase().includes(q) ||
          (p.internal_code || '').toLowerCase().includes(q) ||
          (p.part_number || '').toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [parts, selectedCategory, search]);

  const totalQuantity = useMemo(() => {
    return filteredParts.reduce((acc, part) => acc + (Number(part.quantity) || 0), 0);
  }, [filteredParts]);

  const totalStockValue = useMemo(() => {
    return filteredParts.reduce((acc, part) => acc + (Number(part.total_value) || 0), 0);
  }, [filteredParts]);

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('Todos');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Estoque de Materiais
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Gerencie o estoque de peças de reposição, consumíveis, EPIs e insumos industriais.
          </p>
        </motion.div>
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-center gap-3"
        >
          <button
            onClick={() => handleOpenMovements()}
            className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm text-sm"
          >
            <span className="material-symbols-outlined text-[20px] text-indigo-500">history</span>
            <span>Movimentações</span>
          </button>

          <button
            onClick={() => setIsXmlModalOpen(true)}
            className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm text-sm"
          >
            <span className="material-symbols-outlined text-[20px] text-mustard-600">receipt_long</span>
            <span>Importar NF-e</span>
          </button>

          <button
            onClick={() => navigate('/materiais/novo')}
            className="bg-mustard-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-mustard-600 active:scale-[0.98] transition-all shadow-lg shadow-mustard-500/20 text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Novo Material</span>
          </button>
        </motion.div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.key;
          const count = countsByCategory[cat.key] || 0;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
              <span>{cat.label}</span>
              {cat.prefix && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-black ${
                    isActive
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {cat.prefix}
                </span>
              )}
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-mustard-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & KPIs Bar */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between"
      >
        <div className="flex items-center gap-4 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por descrição, código (ex: P0001, C0001), PN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 transition-all text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-mustard-100 dark:bg-mustard-500/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-400 text-[18px]">
                inventory
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-0.5">
                Qtd Total
              </span>
              <span className="text-sm font-black text-slate-700 dark:text-slate-300 leading-none">
                {totalQuantity}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">
                payments
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-0.5">
                Valor em Estoque
              </span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 leading-none">
                R$ {totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content Table */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4"
          >
            <div className="w-12 h-12 border-4 border-mustard-500/10 border-t-mustard-500 rounded-full animate-spin" />
            <p className="font-bold text-xs uppercase tracking-widest">Carregando estoque de materiais...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-6 rounded-2xl text-center font-medium flex flex-col items-center gap-2 border border-red-100 dark:border-red-500/20"
          >
            <span className="material-symbols-outlined text-4xl">error</span>
            {error}
          </motion.div>
        ) : filteredParts.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed"
          >
            <span className="material-symbols-outlined text-6xl mb-4 text-slate-300 dark:text-slate-800">
              inventory_2
            </span>
            <p className="font-bold text-lg text-slate-600 dark:text-slate-300">Nenhum material encontrado</p>
            <p className="text-sm mt-1 dark:text-slate-500 font-medium">
              Ajuste a categoria ou busque por outro termo.
            </p>
            {(search || selectedCategory !== 'Todos') && (
              <button
                onClick={clearFilters}
                className="mt-4 text-mustard-600 dark:text-mustard-400 font-bold hover:underline"
              >
                Limpar Filtros
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Código
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Categoria
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Descrição do Material
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Part Number / Ref.
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">
                        Qtd / Unidade
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">
                        Valor Un.
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">
                        Valor Total
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredParts.map((part) => {
                      const cat = part.category || 'Peça';
                      const unit = part.unit || 'UN';
                      return (
                        <tr
                          key={part.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-mono font-black text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                              {part.internal_code}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${categoryBadgeClass(
                                cat
                              )}`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {categoryIcon(cat)}
                              </span>
                              {cat}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white group-hover:text-mustard-600 dark:group-hover:text-mustard-400 transition-colors">
                            {part.description}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-mono">
                            {part.part_number || '-'}
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                                part.quantity > 0
                                  ? 'bg-mustard-50 dark:bg-mustard-500/10 text-mustard-700 dark:text-mustard-400'
                                  : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                              }`}
                            >
                              {part.quantity} {unit}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white text-right whitespace-nowrap">
                            {part.unit_value != null
                              ? `R$ ${Number(part.unit_value).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                })}`
                              : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white text-right whitespace-nowrap">
                            {part.total_value != null
                              ? `R$ ${Number(part.total_value).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                })}`
                              : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedPart(part)}
                                className="p-2 text-slate-400 hover:text-mustard-600 dark:hover:text-mustard-400 hover:bg-mustard-50 dark:hover:bg-mustard-500/10 rounded-lg transition-all"
                                title="Visualizar Detalhes"
                              >
                                <span className="material-symbols-outlined text-[19px]">visibility</span>
                              </button>
                              <button
                                onClick={() => navigate(`/materiais/editar/${part.id}`)}
                                className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                title="Editar Material"
                              >
                                <span className="material-symbols-outlined text-[19px]">edit</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Detalhes */}
      <AnimatePresence>
        {selectedPart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPart(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800"
            >
              <div className="p-8 overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-mono font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                        {selectedPart.internal_code}
                      </span>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${categoryBadgeClass(
                          selectedPart.category
                        )}`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {categoryIcon(selectedPart.category)}
                        </span>
                        {selectedPart.category || 'Peça'}
                      </span>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full ${
                          selectedPart.quantity > 0
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400'
                            : 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400'
                        }`}
                      >
                        {selectedPart.quantity > 0 ? 'Em Estoque' : 'Sem Estoque'}
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                      {selectedPart.description}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedPart(null)}
                    className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Part Number / Ref
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {selectedPart.part_number || '-'}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Quantidade em Estoque
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {selectedPart.quantity} {selectedPart.unit || 'UN'}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Valor Unitário
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {selectedPart.unit_value != null
                        ? `R$ ${Number(selectedPart.unit_value).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 col-span-2 md:col-span-3">
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Valor Total em Estoque
                    </span>
                    <span className="text-xl font-black text-mustard-600 dark:text-mustard-500">
                      {selectedPart.total_value != null
                        ? `R$ ${Number(selectedPart.total_value).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">notes</span>
                    Observações
                  </h4>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic border-l-4 border-slate-300 dark:border-slate-700">
                    {selectedPart.notes || 'Nenhuma observação cadastrada para este material.'}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <button
                  onClick={() => handleOpenMovements(selectedPart)}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/20 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">history</span>
                  Ver Movimentações Deste Item
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedPart(null)}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={() => {
                      const id = selectedPart.id;
                      setSelectedPart(null);
                      navigate(`/materiais/editar/${id}`);
                    }}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-mustard-500 hover:bg-mustard-600 active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-mustard-500/20"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Editar Material
                  </button>
                </div>
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
          fetchParts();
        }}
      />

      {/* Modal de Movimentações de Estoque */}
      <StockMovementsModal
        isOpen={isMovementsModalOpen}
        onClose={() => setIsMovementsModalOpen(false)}
        partId={movementFilterPart?.id}
        partName={movementFilterPart?.name}
        partCode={movementFilterPart?.code}
      />
    </motion.div>
  );
};

export default Parts;

