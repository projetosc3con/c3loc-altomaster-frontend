import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface StagingStep {
  title: string;
  desc?: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

interface StagingNfeModalProps {
  isOpen: boolean;
  title?: string;
  steps: StagingStep[];
  error?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
}

export const StagingNfeModal: React.FC<StagingNfeModalProps> = ({
  isOpen,
  title = 'Emitindo Nota Fiscal de Remessa (SEFAZ)',
  steps,
  error,
  onRetry,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-6 text-center"
        >
          {/* Header Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            {error ? (
              <span className="material-symbols-outlined text-3xl text-rose-500">error</span>
            ) : steps.every((s) => s.status === 'done') ? (
              <span className="material-symbols-outlined text-3xl text-emerald-500">check_circle</span>
            ) : (
              <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
            )}
          </div>

          {/* Title & Subtitle */}
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {error
                ? 'Ocorreu uma inconsistência na emissão'
                : 'Aguarde a validação e autorização em tempo real na SEFAZ-MT'}
            </p>
          </div>

          {/* Steps Timeline */}
          <div className="space-y-3 text-left">
            {steps.map((st, i) => (
              <div
                key={i}
                className={`p-3 rounded-2xl border transition-all flex items-center gap-3.5 ${
                  st.status === 'active'
                    ? 'border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400'
                    : st.status === 'done'
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                    : st.status === 'error'
                    ? 'border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-400'
                }`}
              >
                <div className="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0">
                  {st.status === 'done' ? (
                    <span className="material-symbols-outlined text-[18px]">done</span>
                  ) : st.status === 'active' ? (
                    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  ) : st.status === 'error' ? (
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  ) : (
                    <span className="text-[11px] font-mono">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-tight">{st.title}</p>
                  {st.desc && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{st.desc}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium text-left">
              {error}
            </div>
          )}

          {/* Footer Action buttons */}
          {error && (
            <div className="flex gap-2">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider"
                >
                  Fechar
                </button>
              )}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-amber-500/20"
                >
                  Tentar Novamente
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

