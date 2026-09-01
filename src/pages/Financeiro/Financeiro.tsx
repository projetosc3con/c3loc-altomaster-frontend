import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const Financeiro: React.FC = () => {
  const location = useLocation();

  const tabs = [
    { id: 'pagar', label: 'Contas a Pagar', icon: 'trending_down', path: '/financeiro/pagar' },
    { id: 'receber', label: 'Contas a Receber', icon: 'trending_up', path: '/financeiro/receber' },
    { id: 'conciliacao', label: 'Conciliação', icon: 'account_balance', path: '/financeiro/conciliacao' },
    { id: 'score', label: 'Consultar Score', icon: 'credit_score', path: '/financeiro/score' },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Financeiro</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Gestão de contas a pagar, receber, conciliação bancária e extratos.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-full overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) => `flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap ${isActive
              ? 'bg-mustard-500 text-white shadow-lg shadow-mustard-500/20'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
          >
            <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Financeiro;

