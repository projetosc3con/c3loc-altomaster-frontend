import api from './api';

export interface ShippingInvoice {
  id: string;
  rental_invoice_id?: string;
  deal_contract_id?: string;
  direction: 'SAIDA' | 'RETORNO';
  issuer_type: 'SISTEMA_NOTAAS' | 'CLIENTE_EXTERNO';
  nfe_number?: number;
  serie: number;
  access_key?: string;
  protocol?: string;
  notaas_invoice_id?: string;
  status: 'queued' | 'processing' | 'issued' | 'error' | 'cancelled';
  status_code?: number;
  status_message?: string;
  natureza_operacao: string;
  total_value: number;
  cfop: string;
  danfe_pdf_url?: string;
  xml_url?: string;
  created_at: string;
}

export interface EmitShippingResult {
  shippingInvoice: ShippingInvoice;
  danfePdfUrl: string;
  xmlUrl: string;
  pdfBase64?: string;
  accessKey: string;
  protocol: string;
  nfeNumber: number;
}

export const shippingNfeService = {
  /**
   * Emite NF-e de Remessa de Saída para o contrato triado
   */
  emitSaida: async (contractId: string): Promise<EmitShippingResult> => {
    const response = await api.post(`/fiscal/shipping/saida/${contractId}`);
    return response.data;
  },

  /**
   * Emite NF-e de Retorno (Entrada) pelo sistema (cliente ISENTO)
   */
  emitRetorno: async (rentalId: string): Promise<EmitShippingResult> => {
    const response = await api.post(`/fiscal/shipping/retorno/${rentalId}`);
    return response.data;
  },

  /**
   * Registra NF-e de Retorno emitida externamente pelo cliente com IE
   */
  registerExternalRetorno: async (
    rentalId: string,
    data: { access_key?: string; nfe_number?: number; danfe_pdf_url?: string }
  ): Promise<ShippingInvoice> => {
    const response = await api.post(`/fiscal/shipping/retorno-externo/${rentalId}`, data);
    return response.data;
  },

  /**
   * Busca todas as notas de remessa/retorno da locação ou contrato
   */
  getDocuments: async (rentalOrContractId: string): Promise<ShippingInvoice[]> => {
    const response = await api.get(`/fiscal/shipping/documents/${rentalOrContractId}`);
    return response.data;
  },
};

