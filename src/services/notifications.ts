import api from './api';

export interface NotificationActor {
  id: string;
  full_name: string;
  email: string;
  role_title?: string | null;
  photo_url?: string | null;
  access_level?: string;
}

export interface SystemNotification {
  id: string;
  titulo: string;
  descricao: string;
  tabelaOrigem: string;
  uid: string | null;
  timestamp: string;
  notificar: string;
  lido: boolean;
  registroId: string | null;
  actor?: NotificationActor | null;
}

export const notificationService = {
  async listar(params?: { unreadOnly?: boolean; limit?: number }): Promise<SystemNotification[]> {
    const response = await api.get<SystemNotification[]>('/notifications', {
      params: {
        ...(params?.unreadOnly ? { unreadOnly: 'true' } : {}),
        ...(params?.limit ? { limit: params.limit } : {}),
      },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  async marcarComoLida(id: string, lido = true): Promise<SystemNotification> {
    const response = await api.patch<SystemNotification>(`/notifications/${id}/read`, { lido });
    return response.data;
  },

  async marcarTodasComoLidas(): Promise<{ message: string; updatedCount: number }> {
    const response = await api.patch<{ message: string; updatedCount: number }>('/notifications/read-all');
    return response.data;
  },

  async excluir(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },
};

