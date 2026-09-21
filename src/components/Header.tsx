import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { TicketModal } from './TicketModal';

import logoLight from '../../config_files/logo-completo.png';
import logoDark from '../../config_files/logo-completo-dark.png';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);

  // Helper to get initials
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex justify-between items-center w-full px-6 h-16 sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors duration-300 shrink-0"
    >
      <div className="flex items-center gap-4 flex-1">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative w-full max-w-md hidden md:block"
        >
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
            search
          </span>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-mustard-500 focus:ring-1 focus:ring-mustard-500 text-sm bg-slate-50 dark:bg-slate-800 dark:text-white transition-all"
            placeholder="Buscar equipamentos, clientes, ordens..."
          />
        </motion.div>

        {/* Mobile menu and logo */}
        <div className="flex items-center gap-2 md:hidden">
          <img 
            src={theme === 'dark' ? logoDark : logoLight} 
            alt="C3LOC Logo" 
            className="h-8 w-auto object-contain transition-opacity duration-300" 
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleTheme}
          className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
        >
          <span className="material-symbols-outlined">
            {theme === 'light' ? 'dark_mode' : 'light_mode'}
          </span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative"
        >
          <span className="material-symbols-outlined">notifications</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsTicketModalOpen(true)}
          className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative"
          title="Ajuda e Suporte"
        >
          <span className="material-symbols-outlined">help</span>
        </motion.button>

        <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block"></div>

        <div className="relative" ref={menuRef}>
          <div
            className="flex items-center gap-3 pl-1 cursor-pointer group"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <div className="text-right hidden lg:block">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-none group-hover:text-mustard-500 transition-colors">
                {profile?.full_name || user?.email?.split('@')[0] || 'Usuário'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-tight mt-0.5">
                {profile?.access_level || 'Administrador'}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-9 h-9 rounded-full bg-mustard-500 flex items-center justify-center text-white text-xs font-bold border-2 border-transparent group-hover:border-mustard-500/20 shadow-sm overflow-hidden transition-all"
            >
              {profile?.photo_url ? (
                <img
                  src={profile.photo_url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm tracking-tighter">
                  {getInitials(profile?.full_name || user?.email?.split('@')[0] || 'U')}
                </span>
              )}
            </motion.div>
          </div>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Conta</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={user?.email}>
                    {user?.email}
                  </p>
                </div>

                <div className="p-2">
                  <Link
                    to="/perfil"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-mustard-500 transition-colors text-sm font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="material-symbols-outlined text-[20px]">person</span>
                    Meu Perfil
                  </Link>
                  <Link
                    to="/ponto"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-mustard-500 transition-colors text-sm font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                    Registrar Ponto
                  </Link>
                </div>

                <div className="h-[1px] bg-slate-100 dark:bg-slate-700 mx-2"></div>

                <div className="p-2">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-bold uppercase tracking-wider"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    Sair
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
      />
    </motion.header>
  );
};

export default Header;
