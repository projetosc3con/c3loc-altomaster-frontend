import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import type { Part } from '../../types';

export interface ReferencePartItem {
  part_id: string;
  default_quantity: number;
  notes?: string;
  part?: Part;
}

interface EquipmentPartsSectionProps {
  /** Se informado (modo edição), carrega e salva diretamente via API GET/PUT /equipments/:id/parts */
  equipmentId?: string;
  /** Em modo criação (sem equipmentId), controla estado no componente pai */
  value?: ReferencePartItem[];
  onChange?: (items: ReferencePartItem[]) => void;
  /** Apenas Administrador e Diretoria podem editar */
  canEdit: boolean;
  onCountChange?: (count: number) => void;
}

export const EquipmentPartsSection: React.FC<EquipmentPartsSectionProps> = ({
  equipmentId,
  value,
  onChange,
  canEdit,
  onCountChange,
}) => {
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [items, setItems] = useState<ReferencePartItem[]>(value || []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [selectedQty, setSelectedQty] = useState('1');
  const [selectedNotes, setSelectedNotes] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isControlled = !equipmentId;

  useEffect(() => {
    if (isControlled && value) {
      setItems(value);
    }
  }, [isControlled, value]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [partsRes, eqPartsRes] = await Promise.all([
          api.get<Part[]>('/parts'),
          equipmentId ? api.get(`/equipments/${equipmentId}/parts`).catch(() => ({ data: [] })) : Promise.resolve({ data: null }),
        ]);

        // Apenas materiais do tipo "Peça"
        const onlyPecas = (partsRes.data || []).filter((p) => (p.category || 'Peça') === 'Peça');
        setAllParts(onlyPecas);

        if (equipmentId && Array.isArray(eqPartsRes.data)) {
          const loaded: ReferencePartItem[] = eqPartsRes.data.map((row: any) => ({
            part_id: row.part_id,
            default_quantity: Number(row.default_quantity) || 1,
            notes: row.notes || '',
            part: row.part || onlyPecas.find((p) => p.id === row.part_id),
          }));
          setItems(loaded);
          onCountChange?.(loaded.length);
        }
      } catch (err) {
        console.error('Erro ao carregar lista de peças do equipamento:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [equipmentId]);

  const availableParts = useMemo(() => {
    const addedIds = new Set(items.map((i) => i.part_id));
    const q = search.trim().toLowerCase();
    return allParts.filter((p) => {
      if (addedIds.has(p.id)) return false;
      if (!q) return true;
      return (
        (p.description || '').toLowerCase().includes(q) ||
        (p.internal_code || '').toLowerCase().includes(q) ||
        (p.part_number || '').toLowerCase().includes(q)
      );
    });
  }, [allParts, items, search]);

  const updateList = (next: ReferencePartItem[]) => {
    setItems(next);
    onCountChange?.(next.length);
    if (isControlled && onChange) {
      onChange(next);
    }
  };

  const handleAddPart = () => {
    if (!selectedPartId) return;
    const partObj = allParts.find((p) => p.id === selectedPartId);
    if (!partObj) return;
    const qtyNum = Math.max(0.01, Number(selectedQty) || 1);
    const next: ReferencePartItem[] = [
      ...items,
      {
        part_id: partObj.id,
        default_quantity: qtyNum,
        notes: selectedNotes.trim(),
        part: partObj,
      },
    ];
    updateList(next);
    setSelectedPartId('');
    setSelectedQty('1');
    setSelectedNotes('');
    setFeedback(null);
  };

  const handleRemovePart = (partId: string) => {
    updateList(items.filter((i) => i.part_id !== partId));
    setFeedback(null);
  };

  const handleQtyChange = (partId: string, qtyStr: string) => {
    const num = Number(qtyStr);
    updateList(
      items.map((i) => (i.part_id === partId ? { ...i, default_quantity: !isNaN(num) && num > 0 ? num : 1 } : i))
    );
  };

  const handleSavePersisted = async () => {
    if (!equipmentId || !canEdit) return;
    try {
      setSaving(true);
      setFeedback(null);
      const payload = {
        parts: items.map((i) => ({
          part_id: i.part_id,
          default_quantity: i.default_quantity || 1,
          notes: i.notes || null,
        })),
      };
      const { data } = await api.put(`/equipments/${equipmentId}/parts`, payload);
      const refreshed: ReferencePartItem[] = (data || []).map((row: any) => ({
        part_id: row.part_id,
        default_quantity: Number(row.default_quantity) || 1,
        notes: row.notes || '',
        part: row.part || allParts.find((p) => p.id === row.part_id),
      }));
      setItems(refreshed);
      onCountChange?.(refreshed.length);
      setFeedback({ type: 'success', text: 'Lista de peças salva com sucesso (sem movimentação de estoque).' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Erro ao salvar lista de peças.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-500 text-xl">
              home_repair_service
            </span>
            Lista de Peças de Referência (Preventiva)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Define quais materiais do tipo <strong>Peça</strong> ficam disponíveis ao abrir uma Manutenção Preventiva deste equipamento.
            <strong> Não realiza baixa no estoque.</strong>
          </p>
        </div>

        {equipmentId && canEdit && (
          <button
            type="button"
            disabled={saving}
            onClick={handleSavePersisted}
            className="px-4 py-2 bg-mustard-500 hover:bg-mustard-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[17px]">save</span>
            )}
            <span>Salvar Lista de Peças</span>
          </button>
        )}
      </div>

      <div className="p-6 space-y-5">
        {feedback && (
          <div
            className={`px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {feedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{feedback.text}</span>
          </div>
        )}

        {!canEdit && (
          <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>Somente usuários com perfil <strong>Administrador</strong> ou <strong>Diretoria</strong> podem editar esta lista.</span>
          </div>
        )}

        {canEdit && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4 space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Filtrar Peças
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Código, PN ou descrição..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-mustard-500"
                />
              </div>

              <div className="md:col-span-5 space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Peça (Categoria: Peça)
                </label>
                <select
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-mustard-500"
                >
                  <option value="">Selecione uma peça ({availableParts.length} disponíveis)...</option>
                  {availableParts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.internal_code ? `[${p.internal_code}] ` : ''}
                      {p.description}
                      {p.part_number ? ` (PN: ${p.part_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1 space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Qtd. Ref.
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-mustard-500 text-center"
                />
              </div>

              <div className="md:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleAddPart}
                  disabled={!selectedPartId}
                  className="w-full py-2 px-3 bg-slate-900 dark:bg-mustard-500 hover:bg-slate-800 dark:hover:bg-mustard-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Adicionar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Carregando peças...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/20 space-y-1.5">
            <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">inventory_2</span>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Nenhuma peça de referência vinculada a este equipamento.
            </p>
            <p className="text-[11px] text-slate-400">
              Enquanto a lista estiver vazia, todas as peças do estoque ficarão disponíveis nas manutenções preventivas desta máquina.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Descrição da Peça</th>
                  <th className="px-4 py-3">Part Number</th>
                  <th className="px-4 py-3 text-center">Qtd. Referência</th>
                  <th className="px-4 py-3 text-center">Estoque Atual</th>
                  {canEdit && <th className="px-4 py-3 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => {
                  const p = item.part || allParts.find((x) => x.id === item.part_id);
                  return (
                    <tr key={item.part_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {p?.internal_code || '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {p?.description || 'Peça'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">{p?.part_number || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {canEdit ? (
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.default_quantity}
                            onChange={(e) => handleQtyChange(item.part_id, e.target.value)}
                            className="w-16 px-2 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                          />
                        ) : (
                          <span className="font-bold">{item.default_quantity}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-500">
                        {p?.quantity ?? '—'} {p?.unit || 'UN'}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemovePart(item.part_id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Remover peça da lista"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentPartsSection;
