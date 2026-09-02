import api from './api';
import type { 
  CRMPipeline, 
  CRMPipelineStage, 
  CRMLead, 
  CRMTaskType,
  CRMLeadSource,
  CRMLeadStatus,
  CRMDeal
} from '../types';

export type { CRMPipeline, CRMPipelineStage, CRMLead, CRMTaskType, CRMLeadSource, CRMLeadStatus, CRMDeal };

// CRM Service Methods
export const crmService = {
  // Pipelines
  getPipelines: async (): Promise<(CRMPipeline & { stages: number; activeDeals: number; stageList: CRMPipelineStage[] })[]> => {
    const response = await api.get('/crm/pipelines');
    return response.data;
  },

  createPipeline: async (data: { name: string; description: string; stages: any[] }) => {
    const response = await api.post('/crm/pipelines', data);
    return response.data;
  },

  updatePipeline: async (id: string, data: { name: string; description: string; active: boolean; stages: any[] }) => {
    const response = await api.put(`/crm/pipelines/${id}`, data);
    return response.data;
  },

  deletePipeline: async (id: string) => {
    await api.delete(`/crm/pipelines/${id}`);
  },

  // Leads
  getLeads: async (): Promise<(CRMLead & { owner_name?: string })[]> => {
    const response = await api.get('/crm/leads');
    return response.data;
  },

  createLead: async (data: Partial<CRMLead> & { contacts?: any[] }) => {
    const response = await api.post('/crm/leads', data);
    return response.data;
  },

  updateLead: async (id: string, data: Partial<CRMLead> & { contacts?: any[] }) => {
    const response = await api.put(`/crm/leads/${id}`, data);
    return response.data;
  },

  getLeadContacts: async (id: string) => {
    const response = await api.get(`/crm/leads/${id}/contacts`);
    return response.data;
  },

  convertLead: async (id: string, data?: { score?: number; average_score?: number }) => {
    const response = await api.post(`/crm/leads/${id}/convert`, data);
    return response.data;
  },

  deleteLead: async (id: string) => {
    await api.delete(`/crm/leads/${id}`);
  },

  checkCnpj: async (cnpj: string) => {
    const response = await api.get(`/crm/leads/check-cnpj/${cnpj}`);
    return response.data;
  },

  getAllContacts: async () => {
    const response = await api.get('/crm/contacts');
    return response.data;
  },

  createContact: async (data: any) => {
    const response = await api.post('/crm/contacts', data);
    return response.data;
  },

  updateContact: async (id: string, data: any) => {
    const response = await api.put(`/crm/contacts/${id}`, data);
    return response.data;
  },

  deleteContact: async (id: string) => {
    await api.delete(`/crm/contacts/${id}`);
  },

  // Task Types
  getTaskTypes: async (): Promise<CRMTaskType[]> => {
    const response = await api.get('/crm/task-types');
    return response.data;
  },

  // Deals
  getDeals: async (): Promise<any[]> => {
    const response = await api.get('/crm/deals');
    return response.data;
  },

  createDeal: async (data: Partial<CRMDeal>) => {
    const response = await api.post('/crm/deals', data);
    return response.data;
  },

  updateDeal: async (id: string, data: Partial<CRMDeal>) => {
    const response = await api.put(`/crm/deals/${id}`, data);
    return response.data;
  },

  deleteDeal: async (id: string) => {
    await api.delete(`/crm/deals/${id}`);
  },

  getDealActivities: async (): Promise<any[]> => {
    const response = await api.get('/crm/deals/activities');
    return response.data;
  },

  getTasks: async (): Promise<any[]> => {
    const response = await api.get('/crm/tasks');
    return response.data;
  },

  createTask: async (taskData: any): Promise<any> => {
    const response = await api.post('/crm/tasks', taskData);
    return response.data;
  },

  updateTask: async (id: string, taskData: any): Promise<any> => {
    const response = await api.patch(`/crm/tasks/${id}`, taskData);
    return response.data;
  },

  deleteTask: async (id: string) => {
    await api.delete(`/crm/tasks/${id}`);
  },

  // Contracts
  getContractForm: async (dealId: string) => {
    const response = await api.get(`/crm/deals/${dealId}/contract-form`);
    return response.data;
  },

  saveContractForm: async (dealId: string, data: any) => {
    const response = await api.put(`/crm/deals/${dealId}/contract-form`, data);
    return response.data;
  },

  generateContractRecord: async (dealId: string, payload?: any) => {
    const response = await api.post(`/crm/deals/${dealId}/contract/generate`, payload || {});
    return response.data;
  },

  getContracts: async (dealId: string) => {
    const response = await api.get(`/crm/deals/${dealId}/contracts`);
    return response.data;
  },

  uploadSignedContract: async (dealId: string, contractId: string, file: File) => {
    // We upload to storage first
    const { supabase } = await import('../lib/supabase');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('crm-contracts')
      .upload(`${dealId}/${contractId}/signed.pdf`, file, { upsert: true });

    if (uploadError) throw uploadError;

    // Then call backend
    const response = await api.post(`/crm/deals/${dealId}/contract/upload`, {
      contract_id: contractId,
      file_url: uploadData.path
    });
    return response.data;
  },

  deleteContract: async (dealId: string, contractId: string) => {
    const response = await api.delete(`/crm/deals/${dealId}/contract/${contractId}`);
    return response.data;
  },

  sendContractEmail: async (dealId: string, contractId: string, pdfBase64: string) => {
    const response = await api.post(`/crm/deals/${dealId}/contract/${contractId}/send-email`, {
      pdf_base64: pdfBase64,
    });
    return response.data;
  }
};
