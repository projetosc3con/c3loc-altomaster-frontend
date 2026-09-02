import api from './api';
import type {
  ScoreConsultaResponse,
  Client,
  AsaasChargeResult,
  Payment,
  Bill,
  BillType,
  CreateBillPayload,
  StatementItem,
  InvoiceNfse,
  NfseEmitResult,
  BankStatementLine,
  ReconcileBankStatementResponse,
  PaginatedBillStatement,
} from '../types';

export interface ExtratoFilters {
  client_id?: string;
  status?: string;
  from?: string;
  to?: string;
}

export interface ExtratoBancarioFilters {
  client_id?: string;
  status?: string;
  origin?: string;
  type?: 'payable' | 'receivable';
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  group_nfe?: boolean;
}

export interface AsaasScoreInfo {
  available: boolean;
  balance: number;
  totalReceivables?: number;
  feePerQuery: number;
  feeNaturalPerson: number;
  feeLegalPerson: number;
  message?: string;
  bankPixKey?: string | null;
  companyCnpj?: string | null;
  companyName?: string | null;
  asaasPortalUrl?: string | null;
}

export const financeiroService = {
  getAsaasScoreInfo: async (): Promise<AsaasScoreInfo> => {
    const { data } = await api.get<AsaasScoreInfo>('/consultar-score/info');
    return data;
  },

  consultarScore: async (documento: string): Promise<ScoreConsultaResponse> => {
    const { data } = await api.post<ScoreConsultaResponse>(
      '/consultar-score',
      { documento },
      { validateStatus: () => true }
    );
    return data;
  },

  sincronizarClienteAsaas: async (clientId: string): Promise<Client> => {
    const { data } = await api.post<Client>(`/clients/${clientId}/asaas-sync`);
    return data;
  },

  verificarClienteAsaas: async (clientId: string): Promise<Record<string, unknown>> => {
    const { data } = await api.get<Record<string, unknown>>(`/clients/${clientId}/asaas-verify`);
    return data;
  },

  gerarCobranca: async (invoiceId: string): Promise<AsaasChargeResult> => {
    const { data } = await api.post<AsaasChargeResult>(`/payments/invoices/${invoiceId}/charge`);
    return data;
  },

  buscarPagamentosFatura: async (invoiceId: string): Promise<Payment[]> => {
    const { data } = await api.get<Payment[]>(`/payments/invoices/${invoiceId}`);
    return data;
  },

  listarExtrato: async (filters: ExtratoFilters = {}): Promise<Payment[]> => {
    const { data } = await api.get<Payment[]>('/payments', { params: filters });
    return data;
  },

  // Extrato bancário: `payments` ainda em aberto + `bills` já conciliado
  // (automático ou manual), mesclados e paginados pelo backend (máx. 20/página).
  listarExtratoBancario: async (filters: ExtratoBancarioFilters = {}): Promise<PaginatedBillStatement> => {
    const { data } = await api.get<PaginatedBillStatement>('/bills', { params: filters });
    return data;
  },

  criarLancamentoManual: async (payload: CreateBillPayload): Promise<Bill> => {
    const { data } = await api.post<Bill>('/bills', payload);
    return data;
  },

  atualizarLancamento: async (billId: string, payload: { status?: string; is_reconciled?: boolean }): Promise<StatementItem> => {
    const { data } = await api.patch<StatementItem>(`/bills/${billId}`, payload);
    return data;
  },

  excluirLancamento: async (billId: string): Promise<void> => {
    await api.delete(`/bills/${billId}`);
  },

  // Dispara a busca do extrato bancário no BB pro período informado (default
  // últimos 30 dias no backend) e concilia automaticamente contra os `bills`
  // ainda não conciliados. A lista de linhas retornada não é persistida em
  // nenhum lugar novo — só os `bills` batidos são atualizados no banco.
  reconciliarExtratoBancario: async (period: { from?: string; to?: string } = {}): Promise<ReconcileBankStatementResponse> => {
    const { data } = await api.post<ReconcileBankStatementResponse>('/bills/reconcile', null, { params: period });
    return data;
  },

  // Vincula manualmente uma linha do extrato que não bateu automaticamente a
  // um bill existente, atualizando esse bill pra refletir o extrato.
  vincularLancamentoExtrato: async (billId: string, line: BankStatementLine): Promise<Bill> => {
    const { data } = await api.post<Bill>(`/bills/${billId}/link-statement-line`, line);
    return data;
  },

  // Lista bills de um tipo ainda não conciliados com o extrato bancário —
  // usado como candidatos no picker de "vincular a lançamento existente".
  listarLancamentosNaoConciliados: async (type: BillType): Promise<StatementItem[]> => {
    const { data } = await api.get<StatementItem[]>('/bills', { params: { type, unreconciled: 'true' } });
    return data;
  },

  emitirNfse: async (invoiceId: string): Promise<NfseEmitResult> => {
    const { data } = await api.post<NfseEmitResult>(`/fiscal/invoices/${invoiceId}/nfse`);
    return data;
  },

  buscarNfseFatura: async (invoiceId: string): Promise<InvoiceNfse> => {
    const { data } = await api.get<InvoiceNfse>(`/fiscal/invoices/${invoiceId}/nfse`);
    return data;
  },
};
