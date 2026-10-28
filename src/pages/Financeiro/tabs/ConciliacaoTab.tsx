import React, { useState, useEffect, useCallback } from 'react';
import { financeiroService } from '../../../services/financeiro';
import { getApiErrorMessage } from '../../../utils/apiError';
import LancamentoManualModal from '../../../components/financeiro/LancamentoManualModal';
import VincularLancamentoModal from '../../../components/financeiro/VincularLancamentoModal';
import { formatDate } from '../../../utils/date';
import type {
  Bill,
  BankStatementLine,
  BankStatementMatchResult,
  BankStatementSnapshot,
  ReconcileBankStatementResponse,
} from '../../../types';

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

const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (val?: number | null) =>
  (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ConciliacaoTab: React.FC = () => {
  const [activeView, setActiveView] = useState<'reconcile' | 'snapshots'>('reconcile');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<{
    message: string;
    snapshot: BankStatementSnapshot;
  } | null>(null);
  const [result, setResult] = useState<ReconcileBankStatementResponse | null>(null);

  const [snapshots, setSnapshots] = useState<BankStatementSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<BankStatementSnapshot | null>(null);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<string | null>(null);

  const [linkTarget, setLinkTarget] = useState<BankStatementMatchResult | null>(null);
  const [createTarget, setCreateTarget] = useState<BankStatementMatchResult | null>(null);

  const fetchSnapshots = useCallback(async () => {
    setLoadingSnapshots(true);
    try {
      const data = await financeiroService.listarExtratosBancariosSnapshots();
      setSnapshots(data);
    } catch (err) {
      console.error('Erro ao buscar snapshots de extrato:', err);
    } finally {
      setLoadingSnapshots(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const totalItems = result?.lines.length ?? 0;

  const handleReconcile = async () => {
    setReconciling(true);
    setError(null);
    setSuccessBanner(null);
    try {
      const data = await financeiroService.reconciliarExtratoBancario({
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setResult(data);
      setActiveView('reconcile');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setReconciling(false);
    }
  };

  const handleSaveSnapshot = async () => {
    setSavingSnapshot(true);
    setError(null);
    setSuccessBanner(null);
    try {
      const saved = await financeiroService.salvarExtratoBancarioSnapshot({
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setSnapshots((prev) => [saved, ...prev]);
      setSuccessBanner({
        message: `Extrato do período ${formatDate(saved.period_from)} a ${formatDate(saved.period_to)} armazenado no banco com sucesso (${saved.total_lines} lançamentos).`,
        snapshot: saved,
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleDeleteSnapshot = async (snapshot: BankStatementSnapshot) => {
    if (!window.confirm(`Deseja realmente excluir o extrato armazenado do período ${formatDate(snapshot.period_from)} a ${formatDate(snapshot.period_to)}?`)) {
      return;
    }
    setDeletingSnapshotId(snapshot.id);
    try {
      await financeiroService.excluirExtratoBancarioSnapshot(snapshot.id);
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshot.id));
      if (selectedSnapshot?.id === snapshot.id) {
        setSelectedSnapshot(null);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setDeletingSnapshotId(null);
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

  const selectedSnapshotLines: BankStatementLine[] = Array.isArray(selectedSnapshot?.lines)
    ? selectedSnapshot.lines
    : [];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-[200px]">
            <div className="w-14 h-14 bg-mustard-100 dark:bg-mustard-500/10 rounded-2xl flex items-center justify-center text-mustard-500 shadow-sm">
              <span className="material-symbols-outlined text-3xl">account_balance</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                Conciliação Bancária & Extratos
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Concilie o extrato do Banco do Brasil com os lançamentos ou armazene o extrato no banco para consulta e Power BI.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setActiveView('reconcile');
                setSelectedSnapshot(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'reconcile'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">sync_alt</span>
              <span>Conciliação</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveView('snapshots');
                fetchSnapshots();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'snapshots'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">inventory_2</span>
              <span>Extratos Armazenados</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-mustard-500/20 text-mustard-700 dark:text-mustard-400">
                {snapshots.length}
              </span>
            </button>
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
              disabled={reconciling || savingSnapshot}
              title="Reconciliar com o extrato bancário (padrão: últimos 30 dias)"
              className="px-4 py-2.5 rounded-xl flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-bold transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${reconciling ? 'animate-spin' : ''}`}>refresh</span>
              <span>{reconciling ? 'Conciliando...' : 'Buscar Extrato & Conciliar'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSnapshot}
              disabled={savingSnapshot || reconciling}
              title="Busca o extrato do período no BB e armazena no banco sem conciliar"
              className="px-4 py-2.5 rounded-xl flex items-center gap-2 bg-mustard-500 hover:bg-mustard-400 text-slate-900 text-xs font-bold transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${savingSnapshot ? 'animate-spin' : ''}`}>
                {savingSnapshot ? 'progress_activity' : 'cloud_upload'}
              </span>
              <span>{savingSnapshot ? 'Armazenando...' : 'Armazenar Extrato no Banco'}</span>
            </button>

            {activeView === 'reconcile' && result && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {result.simulated && <span className="font-bold text-amber-500">[simulado] </span>}
                {result.matched_count} conciliado(s), {result.unmatched_count} pendente(s) — período {formatDate(result.period.from)} a {formatDate(result.period.to)}
              </p>
            )}
          </div>

          {successBanner && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl p-4 text-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-medium">
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">check_circle</span>
                <span>{successBanner.message}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSnapshot(successBanner.snapshot);
                    setActiveView('snapshots');
                    setSuccessBanner(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">visibility</span>
                  <span>Visualizar Extrato Salvo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSuccessBanner(null)}
                  className="p-1 text-emerald-700 dark:text-emerald-400 hover:opacity-75"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl p-4 text-sm font-medium">
              {error}
            </div>
          )}

          {activeView === 'reconcile' ? (
            <>
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
                          Clique em "Buscar Extrato & Conciliar" para conciliar o período ou em "Armazenar Extrato no Banco" para salvar o snapshot.
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
            </>
          ) : (
            /* VISUALIZAÇÃO DE EXTRATOS ARMAZENADOS */
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/95 dark:bg-slate-800/95 border-b border-slate-100 dark:border-slate-700/50 text-left">
                    <tr>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Período</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Armazenado em</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Responsável</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Lançamentos</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Total Créditos</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Total Débitos</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loadingSnapshots && snapshots.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400 italic">
                          Carregando extratos armazenados...
                        </td>
                      </tr>
                    ) : snapshots.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400 italic">
                          Nenhum extrato armazenado encontrado. Selecione o período e clique em "Armazenar Extrato no Banco".
                        </td>
                      </tr>
                    ) : (
                      snapshots.map((snap) => {
                        const isSelected = selectedSnapshot?.id === snap.id;
                        return (
                          <tr
                            key={snap.id}
                            onClick={() => setSelectedSnapshot(isSelected ? null : snap)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-mustard-500/10'
                                : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                              {formatDate(snap.period_from)} a {formatDate(snap.period_to)}
                              {snap.simulated && (
                                <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600">
                                  SIMULADO
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {formatDateTime(snap.created_at)}
                            </td>
                            <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {snap.created_by_user?.full_name || 'Sistema'}
                            </td>
                            <td className="px-6 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                              {snap.total_lines}
                            </td>
                            <td className="px-6 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              +{formatCurrency(snap.total_credits)}
                            </td>
                            <td className="px-6 py-3.5 text-right font-mono font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                              -{formatCurrency(snap.total_debits)}
                            </td>
                            <td className="px-6 py-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedSnapshot(isSelected ? null : snap)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-mustard-500 hover:text-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[15px]">
                                    {isSelected ? 'visibility_off' : 'visibility'}
                                  </span>
                                  <span>{isSelected ? 'Ocultar' : 'Consultar'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSnapshot(snap)}
                                  disabled={deletingSnapshotId === snap.id}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                  title="Excluir extrato armazenado"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {selectedSnapshot && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50/40 dark:bg-slate-800/20">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        Lançamentos do Extrato Armazenado ({formatDate(selectedSnapshot.period_from)} a {formatDate(selectedSnapshot.period_to)})
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Salvo em {formatDateTime(selectedSnapshot.created_at)} • {selectedSnapshot.total_lines} lançamentos
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSnapshot(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>

                  <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-left">
                        <tr>
                          <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tipo</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Descrição / Contraparte</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">ID / Documento</th>
                          <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {selectedSnapshotLines.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400 italic">
                              Nenhum lançamento registrado neste snapshot.
                            </td>
                          </tr>
                        ) : (
                          selectedSnapshotLines.map((line, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="px-6 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                {formatDate(line.bank_date)}
                              </td>
                              <td className="px-6 py-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${dcBadgeClass(line.dc_indicator)}`}>
                                  {line.dc_indicator === 'C' ? 'Crédito' : 'Débito'}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                  {line.counterparty_name || line.description || '—'}
                                </div>
                                {line.counterparty_document && (
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    {formatDocument(line.counterparty_document)}
                                  </div>
                                )}
                                {line.description && line.counterparty_name && line.description !== line.counterparty_name && (
                                  <div className="text-[11px] text-slate-400">
                                    {line.description}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-3 text-xs font-mono text-slate-500">
                                {line.unique_transaction_id || line.document_number || '—'}
                              </td>
                              <td className="px-6 py-3 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                {formatCurrency(line.value)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
