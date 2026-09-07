import React from 'react';
import { NavLink } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { motion } from 'framer-motion';
import { navItems } from '../constants/navigation';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import logoLight from '../assets/altomaster-dark.png';
import logoDark from '../assets/altomaster-white.png';

const Sidebar: React.FC = () => {
  const { theme } = useTheme();
  const { profile } = useAuth();

  const filteredNavItems = navItems.filter(item =>
    !item.allowedRoles || (profile && item.allowedRoles.includes(profile.access_level))
  );

  return (
    <motion.nav
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="hidden lg:flex flex-col p-4 w-64 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 shrink-0 transition-colors duration-300"
    >
      <div className="mb-8 flex items-center justify-center flex-col mt-4">
        <div className="w-full mb-2">
          <img
            src={theme === 'dark' ? logoDark : logoLight}
            alt="C3LOC Logo"
            className="w-full h-auto object-contain transition-opacity duration-300"
          />
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {filteredNavItems.map((item, index) => (
          <motion.div
            key={item.path}
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-200",
                  isActive
                    ? "bg-mustard-500 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-mustard-500 dark:hover:text-mustard-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                )
              }
            >
              <span className="material-symbols-outlined text-[20px]">
                {item.icon}
              </span>
              <span className="font-medium text-sm">{item.name}</span>
            </NavLink>
          </motion.div>
        ))}
      </div>
    </motion.nav>
  );
};

export default Sidebar;
