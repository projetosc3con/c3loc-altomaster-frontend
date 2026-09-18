import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import type { EquipmentHourMeterLog } from '../../types';

interface EquipmentHourMeterHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentId: string;
  assetNumber?: string;
  equipmentName?: string;
}

export const EquipmentHourMeterHistoryModal: React.FC<EquipmentHourMeterHistoryModalProps> = ({
  isOpen,
  onClose,
  equipmentId,
  assetNumber,
  equipmentName,
}) => {
  const [logs, setLogs] = useState<EquipmentHourMeterLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && equipmentId) {
      fetchLogs();
    }
  }, [isOpen, equipmentId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get(`/equipments/${equipmentId}/hour-meter-logs`);
      setLogs(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar histórico de horímetro:', err);
      setError('Não foi possível carregar o histórico de horímetro.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getSourceBadge = (source: string, refNumber?: string | null) => {
    switch (source) {
      case 'service_order':
        return {
          icon: 'construction',
          label: refNumber ? `Ordem de Serviço #${refNumber}` : 'Ordem de Serviço',
          badgeClass: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
        };
      case 'rental_dispatch':
        return {
          icon: 'local_shipping',
          label: refNumber ? `Saída Locação #${refNumber}` : 'Saída de Locação',
          badgeClass: 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
        };
      case 'rental_return':
        return {
          icon: 'keyboard_return',
          label: refNumber ? `Retorno Locação #${refNumber}` : 'Retorno de Locação',
          badgeClass: 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
        };
      case 'manual':
      default:
        return {
          icon: 'edit_note',
          label: 'Ajuste Manual',
          badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">history</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Histórico de Horímetro
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {assetNumber ? `Patrimônio: ${assetNumber}` : ''} {equipmentName ? `• ${equipmentName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
              <div className="w-8 h-8 border-3 border-mustard-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Carregando histórico de horímetro...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-2xl text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 dark:text-slate-500 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">speed</span>
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum registro de horímetro</p>
              <p className="text-xs max-w-sm">
                Alterações de horímetro realizadas em Ordens de Serviço, Triagens de Saída, Checklists de Retorno ou Ajustes Manuais ficarão registradas aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const badge = getSourceBadge(log.source_type, log.reference_number);
                const prev = log.previous_hour_meter != null ? Number(log.previous_hour_meter) : null;
                const curr = Number(log.hour_meter);
                const diff = prev !== null ? curr - prev : null;

                const dateFormatted = new Date(log.created_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.badgeClass}`}>
                        <span className="material-symbols-outlined text-[15px]">{badge.icon}</span>
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {dateFormatted}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                          {curr.toFixed(1)} h
                        </span>
                        {diff !== null && (
                          <span
                            className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg ${
                              diff > 0
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : diff < 0
                                ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {diff > 0 ? `+${diff.toFixed(1)} h` : `${diff.toFixed(1)} h`}
                          </span>
                        )}
                      </div>

                      {prev !== null && (
                        <span className="text-xs text-slate-400 font-mono">
                          anterior: {prev.toFixed(1)} h
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="truncate">
                        {log.notes || 'Atualização de horímetro'}
                      </span>
                      <span className="shrink-0 flex items-center gap-1 text-[11px] text-slate-400">
                        <span className="material-symbols-outlined text-[13px]">person</span>
                        {log.created_by_profile?.full_name || 'Sistema'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
