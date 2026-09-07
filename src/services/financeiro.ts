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
  rental_invoice_id?: string;
  status?: string;
  origin?: string;
  type?: 'payable' | 'receivable';
  from?: string;
  to?: string;
  invoice_number?: string;
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

  atualizarLancamento: async (
    billId: string,
    payload: {
      status?: string;
      is_reconciled?: boolean;
      bank_slip_url?: string[] | string | null;
      bank_raw_snapshot?: Record<string, any>;
    }
  ): Promise<StatementItem> => {
    const { data } = await api.patch<StatementItem>(`/bills/${billId}`, payload);
    return data;
  },

  buscarFaturasLocacao: async (rentalInvoiceId: string): Promise<StatementItem[]> => {
    // 1. Busca os lançamentos em /bills passando rental_invoice_id
    const billsPromise = api.get<any>('/bills', {
      params: { rental_invoice_id: rentalInvoiceId, group_nfe: false, limit: 100 }
    }).catch((err) => {
      console.warn('[buscarFaturasLocacao] Erro ao buscar /bills:', err);
      return { data: [] };
    });

    // 2. Busca em paralelo as faturas oficiais registradas em rental_billing_invoices
    const faturasPromise = api.get<any[]>(`/rentals/${rentalInvoiceId}/faturas`).catch((err) => {
      console.warn('[buscarFaturasLocacao] Erro ao buscar /rentals/:id/faturas:', err);
      return { data: [] };
    });

    const [billsRes, faturasRes] = await Promise.all([billsPromise, faturasPromise]);

    const rawBills = billsRes.data;
    const items: StatementItem[] = Array.isArray(rawBills) ? rawBills : (rawBills?.data || []);
    const registeredFaturas: any[] = Array.isArray(faturasRes.data) ? faturasRes.data : [];

    // Mapeia as faturas registradas por bill_id para enriquecimento rápido
    const faturasByBillId = new Map<string, any>();
    registeredFaturas.forEach((f) => {
      if (f.bill_id) {
        faturasByBillId.set(f.bill_id, f);
      }
    });

    // 3. FILTRO ESTRITO: nunca exibir lançamentos que não pertençam a esta locação
    const filteredBills = items.filter((item) => {
      if (item.rental_invoice_id === rentalInvoiceId) return true;
      const rawRentalId = (item.raw as any)?.rental_invoice_id || (item.raw as any)?.invoice_id;
      if (rawRentalId === rentalInvoiceId) return true;
      if (faturasByBillId.has(item.id)) return true;
      return false;
    });

    // 4. Enriquece os lançamentos com o número oficial e PDF de rental_billing_invoices
    const enrichedBills: StatementItem[] = filteredBills.map((bill) => {
      const fatura = faturasByBillId.get(bill.id);
      const rawSnap = (bill.raw as any)?.bank_raw_snapshot || {};
      const officialNum = fatura?.numero || fatura?.invoice_number || bill.fatura_numero || rawSnap.fatura_numero || null;
      const officialPdf = fatura?.pdf_url || bill.invoice_url || rawSnap.fatura_pdf_url || null;

      return {
        ...bill,
        fatura_numero: officialNum,
        invoice_url: officialPdf,
        raw: {
          ...(bill.raw || {}),
          bank_raw_snapshot: {
            ...rawSnap,
            fatura_numero: officialNum,
            fatura_pdf_url: officialPdf,
          }
        }
      };
    });

    // 5. Se houver alguma fatura oficial em rental_billing_invoices sem bill associado, adiciona como item
    const presentBillIds = new Set(enrichedBills.map((b) => b.id));
    registeredFaturas.forEach((f) => {
      if (f.bill_id && presentBillIds.has(f.bill_id)) return;
      enrichedBills.push({
        source: 'bill',
        id: f.bill_id || f.id,
        type: 'receivable',
        status: 'Pendente',
        origin: 'MANUAL',
        gross_value: Number(f.total_amount) || 0,
        net_value: Number(f.total_amount) || 0,
        due_date: f.period_end || null,
        rental_invoice_id: rentalInvoiceId,
        description: f.invoice_type === 'EXTENSION' ? 'Prorrogação de Locação' : 'Fatura de Locação',
        invoice_url: f.pdf_url || null,
        fatura_numero: f.numero || f.invoice_number,
        raw: {
          bank_raw_snapshot: {
            is_extension: f.invoice_type === 'EXTENSION',
            fatura_numero: f.numero || f.invoice_number,
            fatura_pdf_url: f.pdf_url,
            period_start: f.period_start,
            period_end: f.period_end,
            total_value: Number(f.total_amount) || 0,
          }
        }
      } as StatementItem);
    });

    return enrichedBills;
  },

  gerarFaturaLocacaoRegistro: async (payload: {
    rental_invoice_id: string;
    bill_id?: string | null;
    tipo?: 'INICIAL' | 'PRORROGACAO';
    pdf_url?: string | null;
    period_start?: string | null;
    period_end?: string | null;
    valor_total?: number;
    dados_fatura?: Record<string, any> | null;
  }): Promise<{ id: string; numero: string; ano: number; sequencial: number; pdf_url: string; is_new: boolean }> => {
    const { data } = await api.post('/rentals/faturas/generate', payload);
    return data;
  },

  buscarFaturasLocacaoRegistradas: async (rentalInvoiceId: string): Promise<any[]> => {
    const { data } = await api.get(`/rentals/${rentalInvoiceId}/faturas`);
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
