import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { navItems } from '../constants/navigation';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import logoLight from '../assets/altomaster-dark.png';
import logoDark from '../assets/altomaster-white.png';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Sidebar: React.FC = () => {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const location = useLocation();

  const filteredNavItems = navItems.filter(item =>
    !item.allowedRoles || (profile && item.allowedRoles.includes(profile.access_level))
  );

  // Accordion state management: auto-open if current route matches any child
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (item.children) {
        const matches =
          item.children.some((c) => window.location.pathname.startsWith(c.path)) ||
          window.location.pathname === item.path ||
          window.location.pathname.startsWith(item.path + '/');
        if (matches) {
          initial[item.name] = true;
        }
      }
    });
    return initial;
  });

  // Keep accordion open when navigating into its subroutes
  useEffect(() => {
    filteredNavItems.forEach((item) => {
      if (item.children) {
        const matches =
          item.children.some((c) => location.pathname.startsWith(c.path)) ||
          location.pathname === item.path ||
          location.pathname.startsWith(item.path + '/');
        if (matches) {
          setOpenAccordions((prev) => (prev[item.name] ? prev : { ...prev, [item.name]: true }));
        }
      }
    });
  }, [location.pathname, filteredNavItems]);

  const toggleAccordion = (name: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

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

      <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar">
        {filteredNavItems.map((item, index) => {
          const isAccordion = Boolean(
            item.children &&
            item.children.length > 0 &&
            (!item.accordionRoles || (profile && item.accordionRoles.includes(profile.access_level)))
          );

          if (isAccordion && item.children) {
            const isAnyChildActive = Boolean(
              item.children.some((child) => location.pathname.startsWith(child.path)) ||
              location.pathname === item.path ||
              location.pathname.startsWith(item.path + '/')
            );
            const isOpen = Boolean(openAccordions[item.name]);

            return (
              <motion.div
                key={item.name}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="space-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(item.name)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 rounded-md transition-all duration-200 group text-left",
                    isAnyChildActive
                      ? "text-mustard-600 dark:text-mustard-400 bg-mustard-500/10 dark:bg-mustard-500/10 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-mustard-500 dark:hover:text-mustard-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "material-symbols-outlined text-[20px] transition-colors shrink-0",
                        isAnyChildActive ? "text-mustard-500" : ""
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="font-medium text-sm truncate">{item.name}</span>
                  </div>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "material-symbols-outlined text-[18px] transition-colors shrink-0",
                      isAnyChildActive ? "text-mustard-500" : "text-slate-400 group-hover:text-mustard-500"
                    )}
                  >
                    expand_more
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1 ml-4 pl-3 border-l-2 border-slate-200/80 dark:border-slate-800 space-y-0.5 py-0.5">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            className={({ isActive }) =>
                              cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-150 group",
                                isActive
                                  ? "bg-mustard-500 text-white font-bold shadow-sm"
                                  : "text-slate-600 dark:text-slate-400 hover:text-mustard-600 dark:hover:text-mustard-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                              )
                            }
                          >
                            <span className="material-symbols-outlined text-[17px] shrink-0 opacity-75 group-hover:opacity-100 transition-opacity">
                              {child.icon || 'arrow_right'}
                            </span>
                            <span className="truncate">{child.name}</span>
                          </NavLink>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          }

          return (
            <motion.div
              key={item.path}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.03 }}
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
          );
        })}
      </div>
    </motion.nav>
  );
};

export default Sidebar;
