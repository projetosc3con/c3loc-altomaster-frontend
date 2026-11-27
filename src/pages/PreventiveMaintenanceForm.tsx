import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import api from '../services/api';
import type { Equipment, Part, ServiceOrder, ServiceOrderStatus, UserProfile } from '../types';
import PreventiveMaintenanceDocument from '../components/maintenance/PreventiveMaintenanceDocument';
import {
  createInitialBatteries,
  createInitialPreventiveChecklist,
  normalizeEquipmentFuelType,
  type PreventiveChecklistData,
  type PreventiveType,
} from '../utils/preventiveTemplates';

interface PreventivePartRow {
  part_id: string;
  internal_code: string;
  description: string;
  quantity_used: number;
  unit_value_at_use: number;
  was_used: boolean;
  available_stock: number;
}

interface PreventiveLaborRow {
  technician_name: string;
  labor_date: string;
  start_time: string;
  end_time: string;
  labor_type: string;
  vehicle_plate: string;
  km_start: string;
  km_end: string;
}

const STATUS_OPTIONS: ServiceOrderStatus[] = [
  'Aberta',
  'Em Andamento',
  'Aguardando Peças',
  'Concluída',
  'Encerrada com pendências',
  'Cancelada',
];

const PreventiveMaintenanceForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [allStockParts, setAllStockParts] = useState<Part[]>([]);
  const [equipmentRefParts, setEquipmentRefParts] = useState<
    Array<{ part_id: string; default_quantity: number; part?: Part }>
  >([]);
  const [loadingRefParts, setLoadingRefParts] = useState(false);
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);

  // Passo 1: Tipo de Preventiva (Elétrica ou Diesel)
  const [preventiveType, setPreventiveType] = useState<PreventiveType | ''>('');
  const [osNumber, setOsNumber] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<ServiceOrderStatus>('Aberta');
  const [equipmentId, setEquipmentId] = useState('');
  const [rentalInvoiceId, setRentalInvoiceId] = useState<string | null>(null);

  // Cabeçalho do documento
  const [clientName, setClientName] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [assetNumber, setAssetNumber] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [equipmentModel, setEquipmentModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [hourMeterBefore, setHourMeterBefore] = useState('');
  const [hourMeterAfter, setHourMeterAfter] = useState('');
  const [executionDate, setExecutionDate] = useState(new Date().toISOString().split('T')[0]);
  const [executionLocation, setExecutionLocation] = useState('');
  const [executedBy, setExecutedBy] = useState('');

  // Checklist e baterias
  const [checklist, setChecklist] = useState<PreventiveChecklistData>(() =>
    createInitialPreventiveChecklist('Elétrica')
  );

  // Produtos/Peças a substituir
  const [partsRows, setPartsRows] = useState<PreventivePartRow[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [selectedPartQty, setSelectedPartQty] = useState('1');
  const [selectedPartReplaced, setSelectedPartReplaced] = useState(true);
  const [partSearch, setPartSearch] = useState('');

  // Encerramento, assinaturas e análise crítica
  const [equipmentFunctional, setEquipmentFunctional] = useState<boolean | undefined>(undefined);
  const [signerTechName, setSignerTechName] = useState('');
  const [signerClientName, setSignerClientName] = useState('');
  const [signerClientRg, setSignerClientRg] = useState('');
  const [hasPending, setHasPending] = useState<boolean | undefined>(undefined);
  const [criticalAnalysis, setCriticalAnalysis] = useState('');

  // Mão de obra
  const [laborRows, setLaborRows] = useState<PreventiveLaborRow[]>([
    {
      technician_name: '',
      labor_date: new Date().toISOString().split('T')[0],
      start_time: '',
      end_time: '',
      labor_type: 'T',
      vehicle_plate: '',
      km_start: '',
      km_end: '',
    },
  ]);

  const loadEquipmentRefParts = async (eqId: string) => {
    if (!eqId) {
      setEquipmentRefParts([]);
      return;
    }
    try {
      setLoadingRefParts(true);
      const { data } = await api.get(`/equipments/${eqId}/parts`);
      setEquipmentRefParts(Array.isArray(data) ? data : []);
    } catch {
      setEquipmentRefParts([]);
    } finally {
      setLoadingRefParts(false);
    }
  };

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        setLoading(true);
        const [eqRes, partsRes, usersRes] = await Promise.all([
          api.get<Equipment[]>('/equipments'),
          api.get<Part[]>('/parts'),
          api.get<UserProfile[]>('/users').catch(() => ({ data: [] })),
        ]);
        const allEq = eqRes.data || [];
        const onlyPecas = (partsRes.data || []).filter((p) => (p.category || 'Peça') === 'Peça');
        setEquipments(allEq);
        setAllStockParts(onlyPecas);
        setTechnicians(usersRes.data || []);

        if (id) {
          const { data: os } = await api.get<ServiceOrder>(`/service-orders/${id}`);
          const pType: PreventiveType = os.preventive_type === 'Diesel' ? 'Diesel' : 'Elétrica';
          setPreventiveType(pType);
          setOsNumber(os.os_number);
          setStatus(os.status || 'Aberta');
          setEquipmentId(os.equipment_id || '');
          setRentalInvoiceId(os.rental_invoice_id || null);
          setClientName(os.client_name || '');
          setContractNumber(os.contract_number || '');
          setAssetNumber(os.equipment_asset_number || '');
          setEquipmentName(os.equipment_name || '');
          setEquipmentModel(os.equipment_model || '');
          setSerialNumber(os.equipment_serial_number || '');
          setHourMeterBefore(os.hour_meter_before != null ? String(os.hour_meter_before) : '');
          setHourMeterAfter(os.hour_meter_after != null ? String(os.hour_meter_after) : '');
          setExecutionDate(os.execution_date ? os.execution_date.split('T')[0] : new Date().toISOString().split('T')[0]);
          setExecutionLocation(os.execution_location || '');
          setExecutedBy(os.executed_by || '');
          setEquipmentFunctional(os.equipment_functional ?? undefined);
          setSignerTechName(os.signer_tech_name || '');
          setSignerClientName(os.signer_client_name || '');
          setSignerClientRg(os.signer_client_rg || '');
          setHasPending(os.has_pending ?? undefined);
          setCriticalAnalysis(os.critical_analysis || '');

          const baseChecklist = createInitialPreventiveChecklist(pType);
          const loadedChecklist: PreventiveChecklistData = {
            ...baseChecklist,
            ...(os.preventive_checklist || {}),
            items:
              Array.isArray(os.preventive_checklist?.items) && os.preventive_checklist.items.length > 0
                ? os.preventive_checklist.items
                : baseChecklist.items,
            batteries:
              pType === 'Elétrica'
                ? Array.isArray(os.preventive_checklist?.batteries) && os.preventive_checklist.batteries.length > 0
                  ? os.preventive_checklist.batteries
                  : createInitialBatteries()
                : [],
          };
          setChecklist(loadedChecklist);

          const mappedParts: PreventivePartRow[] = (os.service_order_parts || []).map((sp: any) => {
            const stockItem = onlyPecas.find((p) => p.id === sp.part_id);
            return {
              part_id: sp.part_id,
              internal_code: sp.parts?.internal_code || stockItem?.internal_code || '',
              description: sp.parts?.description || stockItem?.description || 'Peça',
              quantity_used: Number(sp.quantity_used) || 1,
              unit_value_at_use: Number(sp.unit_value_at_use) || Number(sp.parts?.unit_value) || 0,
              was_used: sp.was_used !== false,
              available_stock: Number(sp.parts?.quantity ?? stockItem?.quantity ?? 0),
            };
          });
          setPartsRows(mappedParts);

          if (Array.isArray(os.service_order_labor) && os.service_order_labor.length > 0) {
            setLaborRows(
              os.service_order_labor.map((l: any) => ({
                technician_name: l.technician_name || '',
                labor_date: l.labor_date ? String(l.labor_date).split('T')[0] : '',
                start_time: l.start_time || '',
                end_time: l.end_time || '',
                labor_type: l.labor_type || 'T',
                vehicle_plate: l.vehicle_plate || os.vehicle_plate || '',
                km_start: l.km_start != null ? String(l.km_start) : os.vehicle_km_start != null ? String(os.vehicle_km_start) : '',
                km_end: l.km_end != null ? String(l.km_end) : os.vehicle_km_end != null ? String(os.vehicle_km_end) : '',
              }))
            );
          }

          if (os.equipment_id) {
            await loadEquipmentRefParts(os.equipment_id);
          }
        }
      } catch (err: any) {
        console.error('Erro ao carregar manutenção preventiva:', err);
        setError(err.response?.data?.error || 'Erro ao carregar dados da manutenção preventiva.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, [id]);

  // Equipamentos filtrados estritamente pelo tipo escolhido (Elétrica ou Diesel)
  const filteredEquipments = useMemo(() => {
    if (!preventiveType) return [];
    const target = normalizeEquipmentFuelType(preventiveType);
    return equipments.filter((eq) => normalizeEquipmentFuelType(eq.type) === target);
  }, [equipments, preventiveType]);

  // Peças permitidas: lista da máquina (se houver) OU todas as peças do estoque
  const hasMachinePartsList = equipmentRefParts.length > 0;
  const selectableParts = useMemo(() => {
    const baseList: Array<{ part: Part; defaultQty: number }> = hasMachinePartsList
      ? equipmentRefParts
          .map((rp) => {
            const p = rp.part || allStockParts.find((sp) => sp.id === rp.part_id);
            return p ? { part: p, defaultQty: Number(rp.default_quantity) || 1 } : null;
          })
          .filter((x): x is { part: Part; defaultQty: number } => Boolean(x))
      : allStockParts.map((p) => ({ part: p, defaultQty: 1 }));

    const q = partSearch.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter(
      ({ part }) =>
        (part.description || '').toLowerCase().includes(q) ||
        (part.internal_code || '').toLowerCase().includes(q) ||
        (part.part_number || '').toLowerCase().includes(q)
    );
  }, [hasMachinePartsList, equipmentRefParts, allStockParts, partSearch]);

  const handleSelectPreventiveType = (type: PreventiveType) => {
    if (preventiveType === type) return;
    setPreventiveType(type);
    if (!isEditing) {
      setEquipmentId('');
      setAssetNumber('');
      setEquipmentName('');
      setEquipmentModel('');
      setSerialNumber('');
      setHourMeterBefore('');
      setClientName('');
      setContractNumber('');
      setExecutionLocation('');
      setEquipmentRefParts([]);
      setPartsRows([]);
    }
    setChecklist(createInitialPreventiveChecklist(type));
  };

  const handleSelectEquipment = async (eqId: string) => {
    setEquipmentId(eqId);
    setSelectedPartId('');
    const eq = equipments.find((e) => e.id === eqId);
    if (!eq) {
      setEquipmentRefParts([]);
      return;
    }

    setAssetNumber(eq.asset_number || '');
    setEquipmentName(eq.name || '');
    setEquipmentModel(eq.model || '');
    setSerialNumber(eq.serial_number || '');
    setHourMeterBefore(eq.hour_meter != null ? String(eq.hour_meter) : '');
    if (eq.rental_client_name) setClientName(eq.rental_client_name);
    if (eq.rental_contract_number) setContractNumber(String(eq.rental_contract_number));
    if (eq.rental_work_site) setExecutionLocation(eq.rental_work_site);

    await loadEquipmentRefParts(eqId);
  };

  const handleAddPart = () => {
    if (!selectedPartId) return;
    const found = selectableParts.find((x) => x.part.id === selectedPartId);
    if (!found) return;

    const qty = Math.max(0.01, Number(selectedPartQty) || found.defaultQty || 1);
    const existingIdx = partsRows.findIndex((r) => r.part_id === found.part.id);
    if (existingIdx >= 0) {
      setPartsRows((prev) =>
        prev.map((row, i) => (i === existingIdx ? { ...row, quantity_used: row.quantity_used + qty } : row))
      );
    } else {
      setPartsRows((prev) => [
        ...prev,
        {
          part_id: found.part.id,
          internal_code: found.part.internal_code || '',
          description: found.part.description || '',
          quantity_used: qty,
          unit_value_at_use: Number(found.part.unit_value) || 0,
          was_used: selectedPartReplaced,
          available_stock: Number(found.part.quantity) || 0,
        },
      ]);
    }
    setSelectedPartId('');
    setSelectedPartQty('1');
  };

  const handleLoadAllMachineRefParts = () => {
    if (!hasMachinePartsList) return;
    const existingIds = new Set(partsRows.map((p) => p.part_id));
    const toAdd: PreventivePartRow[] = [];
    for (const item of selectableParts) {
      if (existingIds.has(item.part.id)) continue;
      toAdd.push({
        part_id: item.part.id,
        internal_code: item.part.internal_code || '',
        description: item.part.description || '',
        quantity_used: item.defaultQty || 1,
        unit_value_at_use: Number(item.part.unit_value) || 0,
        was_used: false,
        available_stock: Number(item.part.quantity) || 0,
      });
    }
    if (toAdd.length > 0) {
      setPartsRows((prev) => [...prev, ...toAdd]);
    }
  };

  const areasGrouped = useMemo(() => {
    const map = new Map<string, typeof checklist.items>();
    for (const item of checklist.items) {
      const list = map.get(item.area) || [];
      list.push(item);
      map.set(item.area, list);
    }
    return Array.from(map.entries());
  }, [checklist.items]);

  const updateChecklistItem = (itemId: string, patch: Partial<{ quantity: string; performed: 'SIM' | 'NAO' | '' }>) => {
    setChecklist((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    }));
  };

  const markAreaAllPerformed = (area: string, value: 'SIM' | 'NAO' | '') => {
    setChecklist((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.area === area ? { ...it, performed: value } : it)),
    }));
  };

  const updateBatteryRow = (index: number, field: 'voltage' | 'voltage_drop', val: string) => {
    setChecklist((prev) => {
      const nextBats = prev.batteries.map((b, i) => (i === index ? { ...b, [field]: val } : b));
      const totalV = nextBats.reduce((acc, b) => acc + (parseFloat(b.voltage.replace(',', '.')) || 0), 0);
      const totalD = nextBats.reduce((acc, b) => acc + (parseFloat(b.voltage_drop.replace(',', '.')) || 0), 0);
      const anyV = nextBats.some((b) => b.voltage.trim() !== '');
      const anyD = nextBats.some((b) => b.voltage_drop.trim() !== '');
      return {
        ...prev,
        batteries: nextBats,
        battery_total_voltage: anyV ? totalV.toFixed(2) : '',
        battery_total_drop: anyD ? totalD.toFixed(2) : '',
      };
    });
  };

  const buildPayload = () => {
    const validLabor = laborRows.filter(
      (l) => l.technician_name.trim() || l.start_time || l.end_time || l.vehicle_plate.trim()
    );
    const firstLabor = validLabor[0];

    return {
      maintenance_category: 'PREVENTIVA' as const,
      preventive_type: preventiveType || 'Elétrica',
      order_type: clientName ? ('Externa' as const) : ('Interna' as const),
      status,
      equipment_id: equipmentId || null,
      rental_invoice_id: rentalInvoiceId || null,
      equipment_asset_number: assetNumber || null,
      equipment_name: equipmentName || null,
      equipment_model: equipmentModel || null,
      equipment_serial_number: serialNumber || null,
      client_name: clientName || null,
      contract_number: contractNumber || null,
      hour_meter_before: hourMeterBefore !== '' ? Number(hourMeterBefore) : null,
      hour_meter_after: hourMeterAfter !== '' ? Number(hourMeterAfter) : null,
      execution_date: executionDate || null,
      execution_location: executionLocation || null,
      executed_by: executedBy || null,
      description: `Manutenção Preventiva ${preventiveType || ''} - ${assetNumber || equipmentName || 'Equipamento'}`.trim(),
      tech_observation: checklist.general_observations || null,
      equipment_functional: equipmentFunctional ?? null,
      signer_tech_name: signerTechName || null,
      signer_client_name: signerClientName || null,
      signer_client_rg: signerClientRg || null,
      has_pending: hasPending ?? false,
      critical_analysis: criticalAnalysis || null,
      cost_company: checklist.cost_responsibility === 'ALTO_MASTER' ? 1 : 0,
      cost_client: checklist.cost_responsibility === 'CLIENTE' ? 1 : 0,
      vehicle_plate: firstLabor?.vehicle_plate || null,
      vehicle_km_start: firstLabor?.km_start ? Number(firstLabor.km_start) : null,
      vehicle_km_end: firstLabor?.km_end ? Number(firstLabor.km_end) : null,
      preventive_checklist: checklist,
      parts: partsRows.map((p) => ({
        part_id: p.part_id,
        quantity_used: p.quantity_used,
        unit_value_at_use: p.unit_value_at_use,
        was_used: p.was_used,
      })),
      labor: validLabor.map((l) => ({
        technician_name: l.technician_name || signerTechName || 'Técnico',
        labor_date: l.labor_date || executionDate || null,
        start_time: l.start_time || null,
        end_time: l.end_time || null,
        labor_type: l.labor_type || 'T',
        vehicle_plate: l.vehicle_plate || null,
        km_start: l.km_start !== '' ? Number(l.km_start) : null,
        km_end: l.km_end !== '' ? Number(l.km_end) : null,
      })),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preventiveType) {
      setError('Selecione primeiro o tipo da Manutenção Preventiva (Elétrica ou Diesel).');
      return;
    }
    if (!equipmentId) {
      setError(`Selecione um equipamento do tipo ${preventiveType}.`);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload = buildPayload();
      if (isEditing && id) {
        await api.put(`/service-orders/${id}`, payload);
      } else {
        await api.post('/service-orders', payload);
      }
      navigate('/manutencoes');
    } catch (err: any) {
      console.error('Erro ao salvar manutenção preventiva:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao salvar manutenção preventiva.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = async (mode: 'view' | 'download') => {
    if (!preventiveType) {
      setError('Selecione o tipo (Elétrica ou Diesel) antes de gerar o documento.');
      return;
    }
    try {
      setGeneratingPdf(true);
      const payload = buildPayload();
      const docData: ServiceOrder = {
        ...(payload as any),
        id: id || 'preview',
        os_number: osNumber || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const blob = await pdf(
        <PreventiveMaintenanceDocument
          data={docData}
          parts={partsRows.map((p) => ({
            part_id: p.part_id,
            internal_code: p.internal_code,
            description: p.description,
            quantity_used: p.quantity_used,
            was_used: p.was_used,
          }))}
          labor={payload.labor as any}
        />
      ).toBlob();

      if (mode === 'view') {
        window.open(URL.createObjectURL(blob), '_blank');
      } else {
        saveAs(
          blob,
          `Preventiva-${osNumber || 'nova'}-${preventiveType}-${assetNumber || 'equipamento'}.pdf`
        );
      }
    } catch (err) {
      console.error('Erro ao gerar PDF da preventiva:', err);
      setError('Erro ao gerar o PDF da Manutenção Preventiva.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-mustard-500/20 border-t-mustard-500 rounded-full animate-spin" />
        <p className="mt-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
          Carregando manutenção preventiva...
        </p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/manutencoes')}
            className="p-2.5 hover:bg-white dark:hover:bg-slate-900 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                {isEditing ? `Manutenção Preventiva #${osNumber || ''}` : 'Nova Manutenção Preventiva'}
              </h1>
              {preventiveType && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                    preventiveType === 'Diesel'
                      ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                      : 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30'
                  }`}
                >
                  {preventiveType}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Plano de manutenção preventiva com checklist completo e geração de PDF padrão Alto Master.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!preventiveType || generatingPdf}
            onClick={() => handleExportPdf('view')}
            className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            <span>Visualizar PDF</span>
          </button>
          <button
            type="button"
            disabled={!preventiveType || generatingPdf}
            onClick={() => handleExportPdf('download')}
            className="px-4 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Baixar PDF</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 font-medium">
          <span className="material-symbols-outlined text-red-500">error</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PASSO 1: Tipo de Preventiva (Elétrica / Diesel) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-mustard-500 text-white text-xs font-black flex items-center justify-center">
                  1
                </span>
                Tipo de Equipamento da Preventiva *
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-8">
                Escolha primeiro se a manutenção preventiva é <strong>Elétrica</strong> ou <strong>Diesel</strong>. O checklist e os equipamentos disponíveis serão filtrados automaticamente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['Elétrica', 'Diesel'] as PreventiveType[]).map((type) => {
              const selected = preventiveType === type;
              const eqCount = equipments.filter(
                (eq) => normalizeEquipmentFuelType(eq.type) === normalizeEquipmentFuelType(type)
              ).length;
              return (
                <button
                  key={type}
                  type="button"
                  disabled={isEditing}
                  onClick={() => handleSelectPreventiveType(type)}
                  className={`p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 cursor-pointer disabled:cursor-not-allowed ${
                    selected
                      ? type === 'Elétrica'
                        ? 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-500/10 ring-2 ring-cyan-500/20'
                        : 'border-amber-500 bg-amber-50/70 dark:bg-amber-500/10 ring-2 ring-amber-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      type === 'Elétrica'
                        ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                        : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl">
                      {type === 'Elétrica' ? 'electric_bolt' : 'local_gas_station'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-black text-slate-900 dark:text-white">
                      Preventiva {type}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {type === 'Elétrica'
                        ? 'Inclui verificação de água das baterias e medição B1 a B8.'
                        : 'Inclui verificação de óleo do motor e substituição de peças.'}
                    </p>
                    <span className="inline-block mt-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {eqCount} equipamento(s) do tipo {type} cadastrado(s)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PASSO 2: Equipamento + Dados de Cabeçalho */}
        {preventiveType && (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-mustard-500 text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                Equipamento ({preventiveType}) e Dados da Preventiva
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Equipamento (somente {preventiveType}) *
                  </label>
                  <select
                    required
                    value={equipmentId}
                    onChange={(e) => handleSelectEquipment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
                  >
                    <option value="">
                      Selecione um equipamento {preventiveType} ({filteredEquipments.length})...
                    </option>
                    {filteredEquipments.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.asset_number} — {eq.name} {eq.model ? `(${eq.model})` : ''} [{eq.status}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ServiceOrderStatus)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Nome do Cliente
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nome do cliente / obra"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Contrato
                  </label>
                  <input
                    type="text"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="Ex: 080 ou 65/2026"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-mustard-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Patrimônio
                  </label>
                  <input
                    type="text"
                    value={assetNumber}
                    onChange={(e) => setAssetNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={equipmentModel}
                    onChange={(e) => setEquipmentModel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Nº Série
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Horímetro Anterior
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={hourMeterBefore}
                    onChange={(e) => setHourMeterBefore(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Horímetro Atual
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={hourMeterAfter}
                    onChange={(e) => setHourMeterAfter(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Data
                  </label>
                  <input
                    type="date"
                    value={executionDate}
                    onChange={(e) => setExecutionDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Local da Execução / Obra
                  </label>
                  <input
                    type="text"
                    value={executionLocation}
                    onChange={(e) => setExecutionLocation(e.target.value)}
                    placeholder="Ex: Pátio Alto Master ou local da obra"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Técnico Responsável
                  </label>
                  <select
                    value={executedBy}
                    onChange={(e) => {
                      const uId = e.target.value;
                      setExecutedBy(uId);
                      const tech = technicians.find((t) => t.id === uId);
                      if (tech && !signerTechName) setSignerTechName(tech.full_name);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  >
                    <option value="">Selecione um técnico...</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* PASSO 3: Grupo Produtos/Peças a substituir */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-mustard-500 text-white text-xs font-black flex items-center justify-center">
                      3
                    </span>
                    Produtos / Peças a Substituir
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-8">
                    {!equipmentId ? (
                      'Selecione um equipamento acima para carregar as peças permitidas.'
                    ) : loadingRefParts ? (
                      'Verificando lista de peças cadastrada para o equipamento...'
                    ) : hasMachinePartsList ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        Lista de referência ativa: exibindo apenas as {equipmentRefParts.length} peça(s) vinculadas a esta máquina.
                      </span>
                    ) : (
                      <span>
                        Este equipamento não possui lista de peças cadastrada — todas as {allStockParts.length} peças do estoque estão liberadas.
                      </span>
                    )}
                  </p>
                </div>

                {hasMachinePartsList && (
                  <button
                    type="button"
                    onClick={handleLoadAllMachineRefParts}
                    className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">playlist_add</span>
                    Carregar todas as peças da máquina
                  </button>
                )}
              </div>

              {equipmentId && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[11px] font-bold uppercase text-slate-500">Buscar Peça</label>
                    <input
                      type="text"
                      value={partSearch}
                      onChange={(e) => setPartSearch(e.target.value)}
                      placeholder="Código ou descrição..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[11px] font-bold uppercase text-slate-500">Peça</label>
                    <select
                      value={selectedPartId}
                      onChange={(e) => {
                        const pId = e.target.value;
                        setSelectedPartId(pId);
                        const match = selectableParts.find((x) => x.part.id === pId);
                        if (match) setSelectedPartQty(String(match.defaultQty || 1));
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    >
                      <option value="">Selecione ({selectableParts.length} disponíveis)...</option>
                      {selectableParts.map(({ part }) => (
                        <option key={part.id} value={part.id}>
                          {part.internal_code ? `[${part.internal_code}] ` : ''}
                          {part.description} (Est: {part.quantity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1 space-y-1">
                    <label className="text-[11px] font-bold uppercase text-slate-500">Qtd.</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={selectedPartQty}
                      onChange={(e) => setSelectedPartQty(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-center text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold uppercase text-slate-500">Substituído?</label>
                    <select
                      value={selectedPartReplaced ? 'SIM' : 'NAO'}
                      onChange={(e) => setSelectedPartReplaced(e.target.value === 'SIM')}
                      className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    >
                      <option value="SIM">Sim (baixa estoque)</option>
                      <option value="NAO">Não</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <button
                      type="button"
                      onClick={handleAddPart}
                      disabled={!selectedPartId}
                      className="w-full py-2 px-3 bg-mustard-500 hover:bg-mustard-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      Adicionar
                    </button>
                  </div>
                </div>
              )}

              {partsRows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Código / Descrição</th>
                        <th className="px-4 py-2.5 text-center w-24">Qtd.</th>
                        <th className="px-4 py-2.5 text-center w-36">Substituído?</th>
                        <th className="px-4 py-2.5 text-center w-24">Estoque</th>
                        <th className="px-4 py-2.5 text-right w-16">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {partsRows.map((row) => (
                        <tr key={row.part_id}>
                          <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                            {row.internal_code ? <span className="font-mono text-slate-500 mr-1.5">[{row.internal_code}]</span> : null}
                            {row.description}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <input
                              type="number"
                              min="1"
                              value={row.quantity_used}
                              onChange={(e) =>
                                setPartsRows((prev) =>
                                  prev.map((p) =>
                                    p.part_id === row.part_id ? { ...p, quantity_used: Math.max(1, Number(e.target.value) || 1) } : p
                                  )
                                )
                              }
                              className="w-16 px-2 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setPartsRows((prev) =>
                                  prev.map((p) => (p.part_id === row.part_id ? { ...p, was_used: !p.was_used } : p))
                                )
                              }
                              className={`px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${
                                row.was_used
                                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {row.was_used ? 'Sim' : 'Não'}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-center font-mono text-slate-500">{row.available_stock}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setPartsRows((prev) => prev.filter((p) => p.part_id !== row.part_id))}
                              className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* PASSO 4: Grupo Serviços a Avaliar (por Área) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-mustard-500 text-white text-xs font-black flex items-center justify-center">
                  4
                </span>
                Grupo: Serviços a Avaliar
              </h2>

              <div className="space-y-5">
                {areasGrouped.map(([areaName, areaItems]) => (
                  <div key={areaName} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        Área: {areaName}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => markAreaAllPerformed(areaName, 'SIM')}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 cursor-pointer"
                        >
                          Marcar todos Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => markAreaAllPerformed(areaName, '')}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {areaItems.map((item) => (
                        <div
                          key={item.id}
                          className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                        >
                          <span className="text-xs text-slate-800 dark:text-slate-200 flex-1">{item.description}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="text"
                              value={item.quantity}
                              onChange={(e) => updateChecklistItem(item.id, { quantity: e.target.value })}
                              placeholder="Qtd."
                              title="Quantidade"
                              className="w-14 px-2 py-1 text-center text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            />
                            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                              {(['SIM', 'NAO'] as const).map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() =>
                                    updateChecklistItem(item.id, { performed: item.performed === opt ? '' : opt })
                                  }
                                  className={`px-3 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                                    item.performed === opt
                                      ? opt === 'SIM'
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-red-500 text-white'
                                      : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  {opt === 'SIM' ? 'Sim' : 'Não'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PASSO 5 (Exclusivo Elétrica): Tabela de Baterias B1-B8 */}
            {preventiveType === 'Elétrica' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-500">battery_charging_full</span>
                  Medição das Baterias (B1 a B8)
                </h2>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 text-center w-24">Bateria</th>
                        <th className="px-4 py-2.5 text-center">Tensão (V)</th>
                        <th className="px-4 py-2.5 text-center">Queda de tensão (V)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {checklist.batteries.map((bat, idx) => (
                        <tr key={bat.label}>
                          <td className="px-4 py-2 text-center font-black font-mono text-slate-800 dark:text-slate-200">
                            {bat.label}
                          </td>
                          <td className="px-4 py-1.5">
                            <input
                              type="text"
                              value={bat.voltage}
                              onChange={(e) => updateBatteryRow(idx, 'voltage', e.target.value)}
                              placeholder="Ex: 6.35"
                              className="w-full px-3 py-1.5 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="px-4 py-1.5">
                            <input
                              type="text"
                              value={bat.voltage_drop}
                              onChange={(e) => updateBatteryRow(idx, 'voltage_drop', e.target.value)}
                              placeholder="Ex: 5.90"
                              className="w-full px-3 py-1.5 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            />
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 dark:bg-slate-800/60 font-bold">
                        <td className="px-4 py-2.5 text-center uppercase text-slate-800 dark:text-white">Total</td>
                        <td className="px-4 py-1.5">
                          <input
                            type="text"
                            value={checklist.battery_total_voltage}
                            onChange={(e) =>
                              setChecklist((prev) => ({ ...prev, battery_total_voltage: e.target.value }))
                            }
                            placeholder="Total (V)"
                            className="w-full px-3 py-1.5 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-1.5">
                          <input
                            type="text"
                            value={checklist.battery_total_drop}
                            onChange={(e) =>
                              setChecklist((prev) => ({ ...prev, battery_total_drop: e.target.value }))
                            }
                            placeholder="Total Queda (V)"
                            className="w-full px-3 py-1.5 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PASSO 6: Observações, Mão de Obra, Assinaturas e Análise Crítica */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-mustard-500 text-white text-xs font-black flex items-center justify-center">
                  5
                </span>
                Encerramento, Mão de Obra e Análise Crítica
              </h2>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Observações Gerais
                </label>
                <textarea
                  rows={3}
                  value={checklist.general_observations}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, general_observations: e.target.value }))}
                  placeholder="Observações técnicas, recomendações ou anomalias encontradas..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                />
              </div>

              {/* Serviço ficou em condições + Assinaturas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Serviço ficou em condições?
                  </label>
                  <div className="flex gap-2">
                    {[
                      { label: 'Sim', val: true },
                      { label: 'Não', val: false },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setEquipmentFunctional(equipmentFunctional === opt.val ? undefined : opt.val)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                          equipmentFunctional === opt.val
                            ? opt.val
                              ? 'bg-emerald-500 text-white border-emerald-500'
                              : 'bg-red-500 text-white border-red-500'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Técnico (Assinatura)
                  </label>
                  <input
                    type="text"
                    value={signerTechName}
                    onChange={(e) => setSignerTechName(e.target.value)}
                    placeholder="Nome do técnico"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Cliente (Assinatura)
                  </label>
                  <input
                    type="text"
                    value={signerClientName}
                    onChange={(e) => setSignerClientName(e.target.value)}
                    placeholder="Nome do representante"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    RG do Cliente
                  </label>
                  <input
                    type="text"
                    value={signerClientRg}
                    onChange={(e) => setSignerClientRg(e.target.value)}
                    placeholder="RG"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Tabela de Mão de Obra */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Mão de Obra e Deslocamento
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setLaborRows((prev) => [
                        ...prev,
                        {
                          technician_name: signerTechName || '',
                          labor_date: executionDate || '',
                          start_time: '',
                          end_time: '',
                          labor_type: 'T',
                          vehicle_plate: '',
                          km_start: '',
                          km_end: '',
                        },
                      ])
                    }
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    Adicionar Linha
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-2">Técnico</th>
                        <th className="px-2 py-2">Data</th>
                        <th className="px-2 py-2">Início</th>
                        <th className="px-2 py-2">Final</th>
                        <th className="px-2 py-2">V/T/I</th>
                        <th className="px-2 py-2">Placa</th>
                        <th className="px-2 py-2">Km Inicial</th>
                        <th className="px-2 py-2">Km Final</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {laborRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.technician_name}
                              onChange={(e) =>
                                setLaborRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, technician_name: e.target.value } : r))
                                )
                              }
                              placeholder="Técnico"
                              className="w-full min-w-[130px] px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="date"
                              value={row.labor_date}
                              onChange={(e) =>
                                setLaborRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, labor_date: e.target.value } : r))
                                )
                              }
                              className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="time"
                              value={row.start_time}
                              onChange={(e) =>
                                setLaborRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, start_time: e.target.value } : r))
                                )
                              }
                              className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="time"
                              value={row.end_time}
                              onChange={(e) =>
                                setLaborRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, end_time: e.target.value } : r))
                                )
                              }
                              className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <select
                              value={row.labor_type}
                              onChange={(e) =>
                                setLaborRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, labor_type: e.target.value } : r))
                                )
                              }
                              className="w-16 px-1.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            >
                              <option value="T">T</option>
                              <option value="V">V</option>
                              <option value="I">I</option>
                            </select>
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.vehicle_plate}
                              onChange={(e) =>
                                setLaborRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, vehicle_plate: e.target.value.toUpperCase() } : r))
                                )
                              }
                              placeholder="ABC-1D23"
                              className="w-24 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              value={row.km_start}
                              onChange={(e) =>
                                setLaborRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, km_start: e.target.value } : r))
                                )
                              }
                              placeholder="Km Ini"
                              className="w-20 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              value={row.km_end}
                              onChange={(e) =>
                                setLaborRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, km_end: e.target.value } : r))
                                )
                              }
                              placeholder="Km Fim"
                              className="w-20 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            {laborRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setLaborRows((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-red-500 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Análise Crítica (Gestor) */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Análise Crítica — Custo
                  </label>
                  <div className="flex gap-2">
                    {[
                      { label: 'Alto Master', val: 'ALTO_MASTER' as const },
                      { label: 'Cliente', val: 'CLIENTE' as const },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() =>
                          setChecklist((prev) => ({
                            ...prev,
                            cost_responsibility: prev.cost_responsibility === opt.val ? '' : opt.val,
                          }))
                        }
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                          checklist.cost_responsibility === opt.val
                            ? 'bg-mustard-500 text-white border-mustard-500'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Análise Crítica — Pendência
                  </label>
                  <div className="flex gap-2">
                    {[
                      { label: 'Sim', val: true },
                      { label: 'Não', val: false },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setHasPending(hasPending === opt.val ? undefined : opt.val)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                          hasPending === opt.val
                            ? opt.val
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Observação do Gestor
                  </label>
                  <input
                    type="text"
                    value={criticalAnalysis}
                    onChange={(e) => setCriticalAnalysis(e.target.value)}
                    placeholder="Comentário da análise crítica..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/manutencoes')}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-7 py-2.5 bg-mustard-500 hover:bg-mustard-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-mustard-500/20 flex items-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]">save</span>
                )}
                <span>{isEditing ? 'Salvar Preventiva' : 'Cadastrar Preventiva'}</span>
              </button>
            </div>
          </>
        )}
      </form>
    </motion.div>
  );
};

export default PreventiveMaintenanceForm;
