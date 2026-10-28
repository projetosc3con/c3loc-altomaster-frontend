import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { notificationService, type SystemNotification } from '../services/notifications';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const formatRelativeTime = (isoDate: string): string => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Agora mesmo';
  if (diffMin < 60) return `Há ${diffMin} min`;
  if (diffHour < 24) return `Há ${diffHour}h`;
  if (diffDays === 1) {
    return `Ontem às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays < 7) {
    return `Há ${diffDays} dias`;
  }
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getNotificationMeta = (notification: SystemNotification) => {
  const tituloLower = (notification.titulo || '').toLowerCase();
  const origem = (notification.tabelaOrigem || '').toLowerCase();

  if (origem === 'rental_invoices') {
    if (tituloLower.includes('prorroga')) {
      return {
        icon: 'update',
        badgeLabel: 'Prorrogação',
        iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      };
    }
    return {
      icon: 'handshake',
      badgeLabel: 'Locação',
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      badgeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    };
  }

  if (origem === 'bills') {
    if (tituloLower.includes('pagar')) {
      return {
        icon: 'call_made',
        badgeLabel: 'Contas a Pagar',
        iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        badgeBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
      };
    }
    return {
      icon: 'call_received',
      badgeLabel: 'Contas a Receber',
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    };
  }

  return {
    icon: 'notifications',
    badgeLabel: 'Sistema',
    iconBg: 'bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 border-mustard-500/20',
    badgeBg: 'bg-mustard-500/10 text-mustard-700 dark:text-mustard-300',
  };
};

const resolveTargetRoute = (notification: SystemNotification): string | null => {
  const origem = (notification.tabelaOrigem || '').toLowerCase();
  const tituloLower = (notification.titulo || '').toLowerCase();
  const regId = notification.registroId?.trim() || null;

  if (origem === 'rental_invoices') {
    if (regId && UUID_REGEX.test(regId)) {
      return `/locacoes/editar/${regId}`;
    }
    return '/locacoes';
  }

  if (origem === 'bills') {
    const isPagar = tituloLower.includes('pagar');
    return isPagar ? '/financeiro/pagar' : '/financeiro/receber';
  }

  return null;
};

const getInitials = (name?: string | null) => {
  if (!name) return 'S';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const NotificationsOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await notificationService.listar({ limit: 80 });
      setNotifications(data);
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(true);
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications(notifications.length > 0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.lido).length,
    [notifications]
  );

  const displayedNotifications = useMemo(() => {
    if (filterTab === 'unread') {
      return notifications.filter((n) => !n.lido);
    }
    return notifications;
  }, [notifications, filterTab]);

  const handleToggleRead = async (
    e: React.MouseEvent,
    notification: SystemNotification
  ) => {
    e.stopPropagation();
    const nextReadState = !notification.lido;
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id ? { ...item, lido: nextReadState } : item
      )
    );
    try {
      await notificationService.marcarComoLida(notification.id, nextReadState);
    } catch (err) {
      console.error('Erro ao atualizar status da notificação:', err);
      fetchNotifications(true);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    try {
      await notificationService.excluir(id);
    } catch (err) {
      console.error('Erro ao excluir notificação:', err);
      fetchNotifications(true);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((item) => ({ ...item, lido: true })));
    try {
      await notificationService.marcarTodasComoLidas();
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err);
      fetchNotifications(true);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notification: SystemNotification) => {
    if (!notification.lido) {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, lido: true } : item
        )
      );
      notificationService.marcarComoLida(notification.id, true).catch(() => {});
    }

    const route = resolveTargetRoute(notification);
    if (route) {
      setIsOpen(false);
      navigate(route);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative"
        title="Notificações"
        aria-label="Abrir notificações"
      >
        <span className="material-symbols-outlined">
          {unreadCount > 0 ? 'notifications_active' : 'notifications'}
        </span>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-mustard-500 text-slate-900 text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-sm border-2 border-white dark:border-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="fixed sm:absolute right-3 sm:right-0 left-3 sm:left-auto mt-2 sm:w-[420px] max-h-[82vh] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-mustard-500/15 text-mustard-600 dark:text-mustard-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">notifications</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                      Central de Notificações
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {unreadCount > 0
                        ? `${unreadCount} ${unreadCount === 1 ? 'não lida' : 'não lidas'}`
                        : 'Tudo em dia por aqui'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fetchNotifications(false)}
                    disabled={loading}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                    title="Atualizar notificações"
                  >
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        loading ? 'animate-spin' : ''
                      }`}
                    >
                      refresh
                    </span>
                  </button>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      disabled={markingAll}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-mustard-600 dark:text-mustard-400 hover:bg-mustard-500/10 transition-colors"
                      title="Marcar todas como lidas"
                    >
                      <span className="material-symbols-outlined text-[15px]">done_all</span>
                      <span>Ler todas</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-900/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                    filterTab === 'all'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Todas</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {notifications.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('unread')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                    filterTab === 'unread'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Não lidas</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-mustard-500 text-slate-900 font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Body List */}
            <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/70 max-h-[420px]">
              {loading && notifications.length === 0 ? (
                <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                  <div className="w-8 h-8 border-2 border-mustard-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Carregando notificações...
                  </p>
                </div>
              ) : displayedNotifications.length === 0 ? (
                <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
                    <span className="material-symbols-outlined text-[26px]">
                      {filterTab === 'unread' ? 'mark_email_read' : 'notifications_off'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {filterTab === 'unread'
                      ? 'Nenhuma notificação não lida'
                      : 'Nenhuma notificação registrada'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[260px]">
                    {filterTab === 'unread'
                      ? 'Você já visualizou todos os alertas recentes do sistema.'
                      : 'Novas locações, prorrogações e lançamentos financeiros aparecerão aqui.'}
                  </p>
                </div>
              ) : (
                displayedNotifications.map((notification) => {
                  const meta = getNotificationMeta(notification);
                  const targetRoute = resolveTargetRoute(notification);
                  const actorName = notification.actor?.full_name || 'Sistema';

                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`group relative px-4 py-3.5 transition-colors flex items-start gap-3 ${
                        targetRoute ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        !notification.lido
                          ? 'bg-mustard-500/[0.07] dark:bg-mustard-500/[0.09] hover:bg-mustard-500/[0.12] dark:hover:bg-mustard-500/[0.14]'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      {/* Unread Left Bar */}
                      {!notification.lido && (
                        <span className="absolute left-0 top-3 bottom-3 w-1 bg-mustard-500 rounded-r-full" />
                      )}

                      {/* Category Icon */}
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${meta.iconBg}`}
                      >
                        <span className="material-symbols-outlined text-[19px]">
                          {meta.icon}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${meta.badgeBg}`}
                          >
                            {meta.badgeLabel}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                        </div>

                        <p
                          className={`text-xs leading-snug ${
                            !notification.lido
                              ? 'font-bold text-slate-900 dark:text-white'
                              : 'font-semibold text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {notification.titulo}
                        </p>

                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed break-words">
                          {notification.descricao}
                        </p>

                        {/* Footer: Actor + Quick Actions */}
                        <div className="flex items-center justify-between gap-2 mt-2.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {notification.actor?.photo_url ? (
                              <img
                                src={notification.actor.photo_url}
                                alt={actorName}
                                className="w-4 h-4 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-mustard-500 text-white text-[8px] font-bold flex items-center justify-center shrink-0">
                                {getInitials(actorName)}
                              </div>
                            )}
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              por <strong className="font-semibold text-slate-700 dark:text-slate-300">{actorName}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => handleToggleRead(e, notification)}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                              title={
                                notification.lido
                                  ? 'Marcar como não lida'
                                  : 'Marcar como lida'
                              }
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                {notification.lido ? 'mark_email_unread' : 'done'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDelete(e, notification.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                              title="Excluir notificação"
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                delete
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  Exibindo {displayedNotifications.length} de {notifications.length}{' '}
                  {notifications.length === 1 ? 'registro' : 'registros'}
                </span>
                <span className="text-[10px] text-slate-400">
                  Clique em um alerta para abrir
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationsOverlay;
