import React, { useState } from 'react';
import { financeiroService } from '../../../services/financeiro';
import { getApiErrorMessage } from '../../../utils/apiError';
import LancamentoManualModal from '../../../components/financeiro/LancamentoManualModal';
import VincularLancamentoModal from '../../../components/financeiro/VincularLancamentoModal';
import { formatDate } from '../../../utils/date';
import type { Bill, BankStatementMatchResult, ReconcileBankStatementResponse } from '../../../types';

const dcBadgeClass = (dc: 'D' | 'C') =>
  dc === 'C'
    ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
    : 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-500/20';

const formatDocument = (doc?: string | null): string => {
  if (!doc) return '';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
};

const ConciliacaoTab: React.FC = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReconcileBankStatementResponse | null>(null);

  const [linkTarget, setLinkTarget] = useState<BankStatementMatchResult | null>(null);
  const [createTarget, setCreateTarget] = useState<BankStatementMatchResult | null>(null);

  const totalItems = result?.lines.length ?? 0;

  const handleReconcile = async () => {
    setReconciling(true);
    setError(null);
    try {
      const data = await financeiroService.reconciliarExtratoBancario({
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setReconciling(false);
    }
  };

  // Localiza a linha por referência de objeto — como cada linha vem do
  // mesmo array em memória (nunca refetch), isso basta pra achar a linha
  // certa depois de vincular/cadastrar, sem precisar de um id próprio.
  const replaceLine = (target: BankStatementMatchResult, bill: Bill) => {
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lines: prev.lines.map((l) => (l === target ? {
          ...l,
          match_status: 'matched',
          matched_bill_id: bill.id,
          matched_bill: {
            source: 'bill',
            id: bill.id,
            type: bill.type,
            status: bill.status,
            origin: bill.origin,
            gross_value: bill.gross_value,
            net_value: bill.net_value,
            fee_amount: bill.fee_amount,
            due_date: bill.due_date,
            settled_date: bill.reconciled_at,
            client_id: bill.client_id,
            client_name: bill.client?.company_name ?? null,
            counterparty_name: bill.counterparty_name,
            invoice_number: bill.invoice?.invoice_number ?? null,
            description: bill.description,
            invoice_url: null,
            bank_slip_url: null,
            is_reconciled: true,
            raw: bill,
          },
        } : l)),
        matched_count: prev.matched_count + 1,
        unmatched_count: prev.unmatched_count - 1,
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 bg-mustard-100 dark:bg-mustard-500/10 rounded-2xl flex items-center justify-center text-mustard-500 shadow-sm">
            <span className="material-symbols-outlined text-3xl">account_balance</span>
          </div>
          <div className="flex-1 min-w-[200px]">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Conciliação Bancária</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Busca o extrato da conta no Banco do Brasil e confere com os lançamentos do sistema.
            </p>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Até</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            <button
              type="button"
              onClick={handleReconcile}
              disabled={reconciling}
              title="Reconciliar com o extrato bancário (padrão: últimos 30 dias)"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-mustard-600 dark:hover:text-mustard-400 hover:border-mustard-300 dark:hover:border-mustard-500 transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${reconciling ? 'animate-spin' : ''}`}>refresh</span>
            </button>

            {result && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {result.simulated && <span className="font-bold text-amber-500">[simulado] </span>}
                {result.matched_count} conciliado(s), {result.unmatched_count} pendente(s) — período {formatDate(result.period.from)} a {formatDate(result.period.to)}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl p-4 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="max-h-[620px] overflow-y-auto overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-700/50 shadow-sm text-left">
                <tr>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Data</th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tipo</th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Descrição</th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Valor</th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Conciliado</th>
                  <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {!result ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400 dark:text-slate-500 italic">
                      Clique no ícone de atualizar para buscar o extrato bancário do período.
                    </td>
                  </tr>
                ) : result.lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400 dark:text-slate-500 italic">
                      Nenhum lançamento encontrado no extrato para o período selecionado.
                    </td>
                  </tr>
                ) : (
                  result.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(line.bank_date)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${dcBadgeClass(line.dc_indicator)}`}>
                          {line.dc_indicator === 'C' ? 'Crédito' : 'Débito'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {line.match_status === 'matched'
                            ? (line.matched_bill?.counterparty_name || line.matched_bill?.client_name || line.counterparty_name || line.description || '—')
                            : (line.counterparty_name || line.description || '—')}
                        </div>
                        {line.counterparty_document && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tracking-tight">
                            {formatDocument(line.counterparty_document)}
                          </div>
                        )}
                        {line.description && line.counterparty_name && line.description !== line.counterparty_name && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            {line.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                        {line.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-6 py-3.5 text-center whitespace-nowrap">
                        {line.match_status === 'matched' ? (
                          line.matched_bill?.status === 'Divergente' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                              <span className="material-symbols-outlined text-[14px]">warning</span>
                              Divergente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              Conciliado
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {line.match_status === 'unmatched' && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setLinkTarget(line)}
                              title="Vincular a lançamento existente"
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-mustard-600 dark:hover:text-mustard-400 transition-all"
                            >
                              <span className="material-symbols-outlined text-[16px]">link</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCreateTarget(line)}
                              title="Cadastrar novo lançamento"
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-mustard-600 dark:hover:text-mustard-400 transition-all"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalItems > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Total de {totalItems} {totalItems === 1 ? 'lançamento' : 'lançamentos'} no período
              </span>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  {result?.matched_count ?? 0} conciliados
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  {result?.unmatched_count ?? 0} pendentes
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <VincularLancamentoModal
        isOpen={linkTarget !== null}
        line={linkTarget}
        onClose={() => setLinkTarget(null)}
        onLinked={(bill) => {
          if (linkTarget) replaceLine(linkTarget, bill);
          setLinkTarget(null);
        }}
      />

      <LancamentoManualModal
        isOpen={createTarget !== null}
        type={createTarget?.type || 'receivable'}
        initialValues={createTarget ? {
          gross_value: createTarget.value,
          due_date: createTarget.bank_date,
          description: createTarget.description ?? undefined,
          counterparty_name: createTarget.counterparty_name ?? undefined,
        } : undefined}
        presetSettlement={createTarget ? {
          settled_date: createTarget.bank_date,
          bank_transaction_date: createTarget.bank_date,
          bank_raw_snapshot: createTarget.raw,
        } : undefined}
        onClose={() => setCreateTarget(null)}
        onCreated={(bill) => {
          if (createTarget) replaceLine(createTarget, bill);
          setCreateTarget(null);
        }}
      />
    </div>
  );
};

export default ConciliacaoTab;
