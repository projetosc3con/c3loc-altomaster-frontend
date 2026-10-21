import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import type { Client } from '../types';
import { useAuth } from '../contexts/AuthContext';

const Clients: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [minScore, setMinScore] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [exportToast, setExportToast] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setExporting(true);
      setExportToast(null);

      const { data } = await api.get<{
        downloadUrl: string;
        fileName: string;
        expiresIn: number;
        totalRecords: number;
      }>('/exports/clients');

      // Trigger download via a temporary anchor element
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportToast(`✓ ${data.totalRecords} clientes exportados com sucesso!`);
      setTimeout(() => setExportToast(null), 5000);
    } catch (err: any) {
      console.error('[handleExport]', err);
      setExportToast('✗ Erro ao gerar exportação. Tente novamente.');
      setTimeout(() => setExportToast(null), 5000);
    } finally {
      setExporting(false);
    }
  };



  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/clients');
        setClients(data);
        setError(null);
      } catch (err: any) {
        console.error('Erro ao buscar clientes:', err);
        setError('Não foi possível carregar a base de clientes.');
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      // Filter by Status
      if (statusFilter === 'active' && !client.active) return false;
      if (statusFilter === 'inactive' && client.active) return false;

      // Filter by Score
      if (Number(client.average_score || 0) < minScore) return false;

      // Filter by Search
      if (search) {
        const q = search.toLowerCase();
        const match =
          client.company_name.toLowerCase().includes(q) ||
          client.cnpj.toLowerCase().includes(q) ||
          (client.contact_name || '').toLowerCase().includes(q) ||
          (client.email || '').toLowerCase().includes(q) ||
          (client.address_city || '').toLowerCase().includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [clients, statusFilter, minScore, search]);

  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredClients, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, minScore, itemsPerPage]);


  const stats = useMemo(() => {
    return {
      total: clients.length,
      active: clients.filter(c => c.active).length,
      inactive: clients.filter(c => !c.active).length
    };
  }, [clients]);

  const getScoreStyle = (score: number = 0) => {
    if (score < 3) return { badge: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-100 dark:border-red-500/20', icon: 'text-amber-400 fill-amber-400' };
    if (score < 4) return { badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-500/20', icon: 'text-amber-500 fill-amber-500' };
    return { badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20', icon: 'text-amber-400 fill-amber-400' };
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Export Toast Notification */}
      <AnimatePresence>
        {exportToast && (
          <motion.div
            key="export-toast"
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold ${exportToast.startsWith('✓')
              ? 'bg-emerald-900 text-white'
              : 'bg-red-600 text-white'
              }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {exportToast.startsWith('✓') ? 'check_circle' : 'error'}
            </span>
            {exportToast}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Base de Clientes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gerencie sua carteira de clientes e dados de contato.</p>
        </motion.div>

        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          {/* Export to XLSX button */}
          <button
            onClick={handleExport}
            disabled={exporting || clients.length === 0}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Exportar todos os clientes para XLSX"
          >
            {exporting ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">download</span>
                Exportar XLSX
              </>
            )}
          </button>

          {profile?.access_level !== 'Comercial' && (
            <button
              onClick={() => navigate('/clientes/novo')}
              className="flex items-center gap-2 bg-mustard-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-mustard-500/20 hover:bg-mustard-600 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Novo Cliente
            </button>
          )}
        </motion.div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total de Clientes', value: stats.total, icon: 'groups', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
          { label: 'Clientes Ativos', value: stats.active, icon: 'check_circle', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
          { label: 'Clientes Inativos', value: stats.inactive, icon: 'cancel', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                <span className="material-symbols-outlined text-2xl">{stat.icon}</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters & Search */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4"
      >
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 dark:text-slate-500">search</span>
          <input
            type="text"
            placeholder="Buscar por nome, CNPJ, contato ou cidade..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-mustard-500/20 transition-all outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-slate-700">
            {[
              { label: 'Todos', value: 'all' },
              { label: 'Ativos', value: 'active' },
              { label: 'Inativos', value: 'inactive' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === option.value
                  ? 'bg-white dark:bg-slate-700 text-mustard-500 shadow-sm'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 min-w-[200px] px-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Score Mínimo</span>
              <span className="text-xs font-black text-mustard-600 dark:text-mustard-400 bg-mustard-50 dark:bg-mustard-500/10 px-2 py-0.5 rounded-lg border border-mustard-100 dark:border-mustard-500/20">
                {minScore.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-mustard-500 transition-all"
              style={{
                background: `linear-gradient(to right, #bf8110 0%, #bf8110 ${(minScore / 5) * 100}%, var(--tw-color-slate-200, #e2e8f0) ${(minScore / 5) * 100}%, var(--tw-color-slate-200, #e2e8f0) 100%)`
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Clients List */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="w-12 h-12 border-4 border-mustard-500/20 border-t-mustard-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm font-medium mt-4">Carregando clientes...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-red-100"
          >
            <span className="material-symbols-outlined text-4xl mb-2 text-red-500">error</span>
            <p className="font-bold text-slate-800">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-red-100 hover:bg-red-200 rounded-xl text-sm font-bold transition-colors text-red-700"
            >
              Tentar novamente
            </button>
          </motion.div>
        ) : filteredClients.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-800 mb-4">groups</span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Nenhum cliente encontrado</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto text-center font-medium">Tente ajustar seus filtros ou cadastre um novo cliente.</p>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Empresa / Razão Social</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">CNPJ / CPF</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Inscrição Estadual</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cidade/UF</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Score</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {paginatedClients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white group-hover:text-mustard-500 transition-colors">{client.company_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{client.address_complement || 'Sem complemento'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">{client.cnpj}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">{client.state_subscription || 'ISENTO'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[18px]">location_on</span>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            {client.address_city ? `${client.address_city}/${client.address_state}` : 'Não informado'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const style = getScoreStyle(client.average_score);
                          return (
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg w-fit border ${style.badge}`}>
                              <span className={`material-symbols-outlined text-[16px] ${style.icon}`}>star</span>
                              <span className="text-sm font-black">{client.average_score?.toFixed(1) || '0.0'}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${client.active
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${client.active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                          {client.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/clientes/${client.id}`)}
                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-mustard-600 dark:hover:text-mustard-400 hover:bg-mustard-50 dark:hover:bg-mustard-500/10 rounded-lg transition-all"
                            title="Ver Detalhes / Editar"
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

            {/* Pagination Controls */}
            <div className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span>Itens por página:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-mustard-500/20 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                  >
                    {[10, 25, 50, 100].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                <span>
                  Mostrando {Math.min(filteredClients.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(filteredClients.length, currentPage * itemsPerPage)} de {filteredClients.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 text-slate-400 hover:text-mustard-600 dark:hover:text-mustard-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === pageNum
                          ? 'bg-mustard-500 text-white shadow-mustard-500/20'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 text-mustard-600 dark:text-mustard-400 hover:text-mustard-700 dark:hover:text-mustard-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Clients;
