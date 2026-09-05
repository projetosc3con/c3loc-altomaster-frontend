import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { financeiroService } from '../services/financeiro';
import { crmService } from '../services/crm';
import type {
  BillingStatus,
  ReconciliationStatus,
  Client,
  Equipment,
  AsaasChargeResult,
  RentalInvoiceEquipment
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import ContractFormModal from '../components/crm-modals/ContractFormModal';
import { pdf } from '@react-pdf/renderer';
import ContractDocument from '../components/crm-modals/ContractDocument';
import { saveAs } from 'file-saver';
import { formatDate } from '../utils/date';
import RentalExtensionModal from '../components/RentalExtensionModal';

type NfseRecord = any;
type DealContract = any;
type DealContractForm = any;

const BILLING_STATUSES: BillingStatus[] = ['Pendente', 'Faturado', 'Emitida', 'Cancelada'];
const RECONCILIATION_STATUSES: ReconciliationStatus[] = ['Pendente', 'Atrasado', 'Recebido', 'Divergente', 'No prazo'];

function isPaidStatus(status: string): boolean {
  return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'PAGO', 'RECEBIDO'].includes(status?.toUpperCase());
}

function getApiErrorMessage(err: any): string {
  if (err?.response?.data?.errors?.length) {
    return err.response.data.errors.map((e: any) => e.description).join('; ');
  }
  return err?.response?.data?.error || err?.message || 'Erro inesperado';
}

function nfseBadgeClass(status: string) {
  switch (status) {
    case 'AUTORIZADA':
      return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'PROCESSANDO':
      return 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400';
    case 'CANCELADA':
      return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
    case 'ERROR':
    case 'ERRO':
      return 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400';
    default:
      return 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400';
  }
}

function nfseStatusIcon(status: string) {
  switch (status) {
    case 'AUTORIZADA':
      return 'check_circle';
    case 'PROCESSANDO':
      return 'sync';
    case 'CANCELADA':
      return 'cancel';
    case 'ERROR':
    case 'ERRO':
      return 'error';
    default:
      return 'schedule';
  }
}

interface SearchableSelectProps<T> {
  label: string;
  placeholder: string;
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  getDisplayValue: (item: T) => string;
  getSearchValue: (item: T) => string;
  required?: boolean;
}

function SearchableSelect<T extends { id: string }>({
  label,
  placeholder,
  items,
  selectedId,
  onSelect,
  getDisplayValue,
  getSearchValue,
  required
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const lowerSearch = searchTerm.toLowerCase();
    return items.filter(item =>
      getSearchValue(item).toLowerCase().includes(lowerSearch)
    );
  }, [items, searchTerm, getSearchValue]);

  const selectedItem = useMemo(() =>
    items.find(i => i.id === selectedId),
    [items, selectedId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">{label} {required && '*'}</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${isOpen
            ? 'border-mustard-500 ring-2 ring-mustard-500/10 dark:bg-slate-900'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
      >
        <span className={`text-sm truncate ${selectedItem ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
          {selectedItem ? getDisplayValue(selectedItem) : placeholder}
        </span>
        <span className={`material-symbols-outlined text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''} text-[20px]`}>expand_more</span>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">search</span>
                <input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-mustard-500 transition-all dark:text-white"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelect(item.id);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`px-4 py-2.5 text-xs cursor-pointer hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors flex flex-col gap-0.5 ${selectedId === item.id
                        ? 'bg-mustard-50/50 dark:bg-mustard-500/20 border-l-4 border-mustard-500'
                        : 'border-l-4 border-transparent'
                      }`}
                  >
                    <span className="font-bold text-slate-900 dark:text-white">{getDisplayValue(item)}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{getSearchValue(item)}</span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 italic">Nenhum resultado encontrado.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FormEquipmentItem extends RentalInvoiceEquipment {
  tempId: string;
}

const createDefaultEquipmentItem = (): FormEquipmentItem => ({
  tempId: Math.random().toString(36).substring(2, 9),
  equipment_id: '',
  equipment_name: '',
  equipment_type: '',
  equipment_size: '',
  asset_number: '',
  serial_number: '',
  billing_period_start: new Date().toISOString().split('T')[0],
  billing_period_end: '',
  return_date: '',
  cost_rental: 0,
  cost_insurance: 0,
  cost_freight: 0,
  cost_rcd: 0,
  cost_third_party: 0,
  cost_training: 0,
  total_value: 0,
  notes: ''
});

const RentalEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<'equipments' | 'billing' | 'contract' | 'service_orders'>('equipments');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [allEquipments, setAllEquipments] = useState<Equipment[]>([]);

  // Ordens de Serviço da Locação
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [creatingOsEquipmentId, setCreatingOsEquipmentId] = useState<string | null>(null);
  const [selectEquipModalOpen, setSelectEquipModalOpen] = useState(false);

  // Multi-equipments list
  const [equipmentItems, setEquipmentItems] = useState<FormEquipmentItem[]>([]);

  // General fields
  const [generalData, setGeneralData] = useState({
    invoice_number: '',
    client_id: '',
    work_site: '',
    billing_status: 'Pendente' as BillingStatus,
    billing_method: 'MANUAL' as const,
    due_date: '',
    payment_method: '',
    reconciliation_status: 'Pendente' as ReconciliationStatus,
    notes: '',
  });

  // Asaas & NFS-e state
  const [hasCharge, setHasCharge] = useState(false);
  const [charging, setCharging] = useState(false);
  const [chargeResult, setChargeResult] = useState<AsaasChargeResult | null>(null);
  const [chargeMessage, setChargeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [chargeConfirmOpen, setChargeConfirmOpen] = useState(false);
  const [invoicePaid, setInvoicePaid] = useState(false);

  const [nfse, setNfse] = useState<NfseRecord | null>(null);
  const [emittingNfse, setEmittingNfse] = useState(false);
  const [nfseLoading, setNfseLoading] = useState(false);
  const [nfseMessage, setNfseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Contract integration state
  const [deal, setDeal] = useState<any | null>(null);
  const [contractForm, setContractForm] = useState<DealContractForm | null>(null);
  const [contracts, setContracts] = useState<DealContract[]>([]);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [showContractDeleteConfirm, setShowContractDeleteConfirm] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<any | null>(null);

  // Rental & Extension state
  const [rental, setRental] = useState<any | null>(null);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [extensionSuccessMsg, setExtensionSuccessMsg] = useState<string | null>(null);
  const [showRetornoNotice, setShowRetornoNotice] = useState(false);

  // Rental Deletion state (Exclusivo Administrador e Diretoria)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRental, setDeletingRental] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const userRole = profile?.access_level || (user as any)?.role;
  const canDeleteRental = userRole === 'Administrador' || userRole === 'Diretoria';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [clientsRes, equipmentsRes, rentalRes] = await Promise.all([
          api.get('/clients'),
          api.get('/equipments'),
          api.get(`/rentals/${id}`)
        ]);

        const rental = rentalRes.data;
        setRental(rental);
        setClients(clientsRes.data.filter((c: Client) => c.active || c.id === rental.client_id));
        setAllEquipments(equipmentsRes.data);

        setGeneralData({
          invoice_number: rental.invoice_number || '',
          client_id: rental.client_id || '',
          work_site: rental.work_site || '',
          billing_status: rental.billing_status || 'Pendente',
          billing_method: rental.billing_method || 'MANUAL',
          due_date: rental.due_date ? rental.due_date.split('T')[0] : '',
          payment_method: rental.payment_method || '',
          reconciliation_status: rental.reconciliation_status || 'Pendente',
          notes: rental.notes || '',
        });

        setServiceOrders(rental.service_orders || []);

        // Initialize equipments array
        if (Array.isArray(rental.equipments) && rental.equipments.length > 0) {
          setEquipmentItems(
            rental.equipments.map((eq: RentalInvoiceEquipment) => {
              const match = equipmentsRes.data?.find((e: Equipment) => e.id === eq.equipment_id);
              return {
                ...eq,
                serial_number: eq.serial_number || match?.serial_number || '',
                tempId: eq.id || Math.random().toString(36).substring(2, 9),
                billing_period_start: eq.billing_period_start ? eq.billing_period_start.split('T')[0] : '',
                billing_period_end: eq.billing_period_end ? eq.billing_period_end.split('T')[0] : '',
                return_date: eq.return_date ? eq.return_date.split('T')[0] : '',
                cost_rental: Number(eq.cost_rental) || 0,
                cost_insurance: Number(eq.cost_insurance) || 0,
                cost_freight: Number(eq.cost_freight) || 0,
                cost_rcd: Number(eq.cost_rcd) || 0,
                cost_third_party: Number(eq.cost_third_party) || 0,
                cost_training: Number(eq.cost_training) || 0,
                total_value: Number(eq.total_value) || 0
              };
            })
          );
        } else if (rental.equipment_id) {
          const match = equipmentsRes.data?.find((e: Equipment) => e.id === rental.equipment_id);
          setEquipmentItems([
            {
              tempId: Math.random().toString(36).substring(2, 9),
              equipment_id: rental.equipment_id,
              equipment_name: rental.equipment_name || '',
              equipment_type: rental.equipment_type || '',
              equipment_size: rental.equipment_size || '',
              asset_number: rental.asset_number || '',
              serial_number: rental.serial_number || match?.serial_number || '',
              billing_period_start: rental.billing_period_start ? rental.billing_period_start.split('T')[0] : '',
              billing_period_end: rental.billing_period_end ? rental.billing_period_end.split('T')[0] : '',
              return_date: rental.return_date ? rental.return_date.split('T')[0] : '',
              cost_rental: Number(rental.cost_rental) || 0,
              cost_insurance: Number(rental.cost_insurance) || 0,
              cost_freight: Number(rental.cost_freight) || 0,
              cost_rcd: Number(rental.cost_rcd) || 0,
              cost_third_party: Number(rental.cost_third_party) || 0,
              cost_training: Number(rental.cost_training) || 0,
              total_value: Number(rental.total_value) || 0,
              notes: rental.notes
            }
          ]);
        } else {
          setEquipmentItems([createDefaultEquipmentItem()]);
        }

        if (id) {
          loadRentalDeal(id);
        }
      } catch (err: any) {
        console.error('Erro ao buscar dados:', err);
        setError('Erro ao carregar os dados da locação.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const totals = useMemo(() => {
    let cost_rental = 0;
    let cost_insurance = 0;
    let cost_freight = 0;
    let cost_rcd = 0;
    let cost_third_party = 0;
    let cost_training = 0;

    equipmentItems.forEach(item => {
      cost_rental += Number(item.cost_rental) || 0;
      cost_insurance += Number(item.cost_insurance) || 0;
      cost_freight += Number(item.cost_freight) || 0;
      cost_rcd += Number(item.cost_rcd) || 0;
      cost_third_party += Number(item.cost_third_party) || 0;
      cost_training += Number(item.cost_training) || 0;
    });

    const total_value = cost_rental + cost_insurance + cost_freight + cost_rcd + cost_third_party + cost_training;

    return {
      cost_rental,
      cost_insurance,
      cost_freight,
      cost_rcd,
      cost_third_party,
      cost_training,
      total_value
    };
  }, [equipmentItems]);

  const canExtend = useMemo(() => {
    // Visível apenas para faturas sem return_date
    if (rental?.return_date) return false;
    if (equipmentItems.some(item => Boolean(item.return_date))) return false;
    return true;
  }, [rental, equipmentItems]);

  const reloadRentalData = async () => {
    if (!id) return;
    try {
      const rentalRes = await api.get(`/rentals/${id}`);
      const updated = rentalRes.data;
      setRental(updated);

      setGeneralData({
        invoice_number: updated.invoice_number || '',
        client_id: updated.client_id || '',
        work_site: updated.work_site || '',
        billing_status: updated.billing_status || 'Pendente',
        billing_method: updated.billing_method || 'MANUAL',
        due_date: updated.due_date ? updated.due_date.split('T')[0] : '',
        payment_method: updated.payment_method || '',
        reconciliation_status: updated.reconciliation_status || 'Pendente',
        notes: updated.notes || '',
      });

      setServiceOrders(updated.service_orders || []);

      if (Array.isArray(updated.equipments) && updated.equipments.length > 0) {
        setEquipmentItems(
          updated.equipments.map((eq: RentalInvoiceEquipment) => {
            const match = allEquipments.find((e: Equipment) => e.id === eq.equipment_id);
            return {
              ...eq,
              serial_number: eq.serial_number || match?.serial_number || '',
              tempId: eq.id || Math.random().toString(36).substring(2, 9),
              billing_period_start: eq.billing_period_start ? eq.billing_period_start.split('T')[0] : '',
              billing_period_end: eq.billing_period_end ? eq.billing_period_end.split('T')[0] : '',
              return_date: eq.return_date ? eq.return_date.split('T')[0] : '',
              cost_rental: Number(eq.cost_rental) || 0,
              cost_insurance: Number(eq.cost_insurance) || 0,
              cost_freight: Number(eq.cost_freight) || 0,
              cost_rcd: Number(eq.cost_rcd) || 0,
              cost_third_party: Number(eq.cost_third_party) || 0,
              cost_training: Number(eq.cost_training) || 0,
              total_value: Number(eq.total_value) || 0
            };
          })
        );
      } else if (updated.equipment_id) {
        const match = allEquipments.find((e: Equipment) => e.id === updated.equipment_id);
        setEquipmentItems([
          {
            tempId: Math.random().toString(36).substring(2, 9),
            equipment_id: updated.equipment_id,
            equipment_name: updated.equipment_name || '',
            equipment_type: updated.equipment_type || '',
            equipment_size: updated.equipment_size || '',
            asset_number: updated.asset_number || '',
            serial_number: updated.serial_number || match?.serial_number || '',
            billing_period_start: updated.billing_period_start ? updated.billing_period_start.split('T')[0] : '',
            billing_period_end: updated.billing_period_end ? updated.billing_period_end.split('T')[0] : '',
            return_date: updated.return_date ? updated.return_date.split('T')[0] : '',
            cost_rental: Number(updated.cost_rental) || 0,
            cost_insurance: Number(updated.cost_insurance) || 0,
            cost_freight: Number(updated.cost_freight) || 0,
            cost_rcd: Number(updated.cost_rcd) || 0,
            cost_third_party: Number(updated.cost_third_party) || 0,
            cost_training: Number(updated.cost_training) || 0,
            total_value: Number(updated.total_value) || 0,
            notes: updated.notes
          }
        ]);
      }

      await loadRentalDeal(id);
    } catch (err: any) {
      console.error('Erro ao recarregar dados da locação:', err);
    }
  };

  const loadContractData = async (targetDealId?: string) => {
    const currentDealId = targetDealId || deal?.id;
    try {
      setContractLoading(true);
      if (currentDealId) {
        const form = await crmService.getContractForm(currentDealId);
        setContractForm(form);
      }
      if (id) {
        const { data: allContracts } = await api.get(`/rentals/${id}/contracts`);
        setContracts(allContracts || []);
      } else if (currentDealId) {
        const generated = await crmService.getContracts(currentDealId);
        setContracts(generated || []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do contrato:', err);
    } finally {
      setContractLoading(false);
    }
  };

  const loadRentalDeal = async (rentalId: string) => {
    try {
      setContractLoading(true);
      const res = await api.get(`/rentals/${rentalId}/contract-deal`);
      if (res.data?.deal) {
        setDeal(res.data.deal);
        const form = await crmService.getContractForm(res.data.deal.id);
        setContractForm(form);
      }
      // Carregar todos os contratos cadastrados para esta locação
      const contractsRes = await api.get(`/rentals/${rentalId}/contracts`);
      setContracts(contractsRes.data || res.data?.contracts || []);
    } catch (err) {
      console.error('Erro ao obter/criar deal de contrato para locação:', err);
    } finally {
      setContractLoading(false);
    }
  };

  const openContractModal = async () => {
    if (deal?.id) {
      try {
        setContractLoading(true);
        const form = await crmService.getContractForm(deal.id);
        if (form) {
          setContractForm(form);
        }
      } catch (e) {
        console.error('Erro ao buscar formulário antes de abrir modal:', e);
      } finally {
        setContractLoading(false);
      }
    }
    setIsContractModalOpen(true);
  };

  const handleDeleteContract = (contract?: any) => {
    setContractToDelete(contract || (contracts.length > 0 ? contracts[0] : null));
    setShowContractDeleteConfirm(true);
    setContractError(null);
  };

  const executeDeleteContract = async () => {
    const target = contractToDelete || contracts[0];
    if (!deal || !target) return;
    try {
      setContractLoading(true);
      setContractError(null);
      setShowContractDeleteConfirm(false);
      await crmService.deleteContract(deal.id, target.id);
      await loadContractData(deal.id);
    } catch (err: any) {
      console.error(err);
      setContractError(err.response?.data?.error || 'Erro ao excluir contrato');
    } finally {
      setContractLoading(false);
      setContractToDelete(null);
    }
  };

  const handleGeneratePdf = async () => {
    if (!deal) return;
    try {
      setContractLoading(true);
      await crmService.generateContractRecord(deal.id, { rental_invoice_id: id, equipments: contractForm?.equipments || equipmentItems });
      await loadContractData(deal.id);
      alert('Contrato gerado com sucesso!');
    } catch (e: any) {
      setContractError(e?.message || 'Não foi possível gerar o contrato. Tente novamente.');
    } finally {
      setContractLoading(false);
    }
  };

  const handleViewContractPdf = async (contract: any) => {
    try {
      const blob = await pdf(<ContractDocument data={contract.snapshot} generatedAt={contract.generated_at} />).toBlob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Erro ao abrir PDF', err);
      alert('Erro ao abrir PDF.');
    }
  };

  const handleDownloadContractPdf = async (contract: any) => {
    try {
      const blob = await pdf(<ContractDocument data={contract.snapshot} generatedAt={contract.generated_at} />).toBlob();
      saveAs(blob, `CONTRATO DE LOCAÇÃO - ${contract.contract_number} - ${contract.snapshot?.locatario?.company_name || 'Contrato'}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF', err);
      alert('Erro ao gerar arquivo PDF.');
    }
  };

  const handleUploadSigned = (targetContract?: any) => {
    const contract = targetContract || (contracts.length > 0 ? contracts[0] : null);
    if (!contract || !deal) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file && deal && contract) {
        try {
          setContractLoading(true);
          await crmService.uploadSignedContract(deal.id, contract.id, file);
          await loadContractData(deal.id);
          alert(`Contrato Nº ${contract.contract_number} assinado anexado com sucesso!`);
        } catch (err) {
          alert('Erro ao enviar contrato');
        } finally {
          setContractLoading(false);
        }
      }
    };
    input.click();
  };

  useEffect(() => {
    if (!id || generalData.billing_method === 'MANUAL') return;
    financeiroService.buscarPagamentosFatura(id)
      .then((payments: any[]) => {
        setInvoicePaid(payments.some((p: any) => isPaidStatus(p.status)));
        setHasCharge(payments.length > 0);
      })
      .catch((err: any) => console.error('Erro ao buscar pagamentos da fatura:', err));
  }, [id, generalData.billing_method]);

  useEffect(() => {
    if (!id || generalData.billing_method === 'MANUAL') return;
    financeiroService.buscarNfseFatura(id)
      .then(setNfse)
      .catch((err: any) => {
        if (err?.response?.status !== 404) console.error('Erro ao buscar NFS-e da fatura:', err);
      });
  }, [id, generalData.billing_method]);

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGeneralData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddEquipment = () => {
    setEquipmentItems(prev => [...prev, createDefaultEquipmentItem()]);
  };

  const handleRemoveEquipment = (index: number) => {
    if (equipmentItems.length <= 1) {
      alert('A locação deve conter obrigatoriamente pelo menos um equipamento.');
      return;
    }
    setEquipmentItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleEquipmentChange = (index: number, field: string, value: any) => {
    setEquipmentItems(prev => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };

      const r = Number(current.cost_rental) || 0;
      const i = Number(current.cost_insurance) || 0;
      const f = Number(current.cost_freight) || 0;
      const rcd = Number(current.cost_rcd) || 0;
      const tp = Number(current.cost_third_party) || 0;
      const tr = Number(current.cost_training) || 0;
      current.total_value = r + i + f + rcd + tp + tr;

      updated[index] = current;
      return updated;
    });
  };

  const handleEquipmentSelect = (index: number, equipmentId: string) => {
    const selected = allEquipments.find(e => e.id === equipmentId);
    if (!selected) return;

    setEquipmentItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        equipment_id: selected.id,
        equipment_name: selected.name,
        equipment_type: selected.type,
        equipment_size: selected.height ? `${selected.height}m` : '',
        asset_number: selected.asset_number,
        serial_number: selected.serial_number || ''
      };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!generalData.client_id) {
      setError('Por favor, selecione um cliente.');
      setActiveTab('billing');
      return;
    }

    if (equipmentItems.length === 0) {
      setError('A locação deve conter pelo menos um equipamento.');
      setActiveTab('equipments');
      return;
    }

    for (let i = 0; i < equipmentItems.length; i++) {
      const item = equipmentItems[i];
      if (!item.equipment_id) {
        setError(`Por favor, selecione o equipamento no item #${i + 1}.`);
        setActiveTab('equipments');
        return;
      }
      if (!item.billing_period_start || !item.billing_period_end) {
        setError(`Por favor, defina o período de início e fim para o equipamento #${i + 1} (${item.equipment_name || 'Sem nome'}).`);
        setActiveTab('equipments');
        return;
      }
    }

    setSaving(true);

    try {
      const selectedClient = clients.find(c => c.id === generalData.client_id);
      if (!selectedClient) throw new Error('Selecione um cliente válido.');

      const payload = {
        ...generalData,
        client_name: selectedClient.company_name,
        cnpj: selectedClient.cnpj,
        equipments: equipmentItems.map(item => ({
          equipment_id: item.equipment_id,
          equipment_name: item.equipment_name,
          equipment_type: item.equipment_type,
          equipment_size: item.equipment_size,
          asset_number: item.asset_number,
          billing_period_start: item.billing_period_start,
          billing_period_end: item.billing_period_end,
          return_date: item.return_date || null,
          cost_rental: Number(item.cost_rental) || 0,
          cost_insurance: Number(item.cost_insurance) || 0,
          cost_freight: Number(item.cost_freight) || 0,
          cost_rcd: Number(item.cost_rcd) || 0,
          cost_third_party: Number(item.cost_third_party) || 0,
          cost_training: Number(item.cost_training) || 0,
          total_value: item.total_value,
          notes: item.notes || null
        }))
      };

      await api.put(`/rentals/${id}`, payload);
      navigate('/locacoes');
    } catch (err: any) {
      console.error('Erro ao salvar locação:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao salvar locação.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRental = async () => {
    if (!id) return;
    try {
      setDeletingRental(true);
      setDeleteError(null);
      await api.delete(`/rentals/${id}`);
      navigate('/locacoes', {
        state: { message: 'Locação e contas a receber associadas foram excluídas com sucesso.' }
      });
    } catch (err: any) {
      console.error('Erro ao excluir locação:', err);
      setDeleteError(err.response?.data?.error || err.message || 'Erro ao excluir locação.');
      setDeletingRental(false);
    }
  };

  const handleCreateServiceOrder = async (equipmentId?: string) => {
    if (!id) return;
    const validEquips = equipmentItems.filter(item => Boolean(item.equipment_id));
    const targetEquipId = equipmentId || (validEquips.length === 1 ? validEquips[0].equipment_id : null);

    if (!targetEquipId) {
      if (validEquips.length === 0) {
        alert('Selecione ao menos um equipamento válido nesta locação antes de abrir uma Ordem de Serviço.');
        return;
      }
      setSelectEquipModalOpen(true);
      return;
    }

    setCreatingOsEquipmentId(targetEquipId);
    setError(null);
    try {
      const { data: createdOs } = await api.post(`/rentals/${id}/service-orders`, {
        equipment_id: targetEquipId,
      });

      navigate(`/manutencoes/editar/${createdOs.id}`);
    } catch (err: any) {
      console.error('Erro ao gerar Ordem de Serviço da locação:', err);
      setError(getApiErrorMessage(err));
    } finally {
      setCreatingOsEquipmentId(null);
      setSelectEquipModalOpen(false);
    }
  };

  const handleGerarCobranca = async () => {
    if (!id) return;
    setCharging(true);
    setChargeMessage(null);
    try {
      const result = await financeiroService.gerarCobranca(id);
      setChargeResult(result);
      setHasCharge(true);
      window.open(result.charge.invoiceUrl, '_blank');
      setChargeMessage({ type: 'success', text: 'Cobrança gerada com sucesso!' });
    } catch (err) {
      setChargeMessage({ type: 'error', text: getApiErrorMessage(err) });
    } finally {
      setCharging(false);
      setChargeConfirmOpen(false);
    }
  };

  const handleEmitirNfse = async () => {
    if (!id) return;
    setEmittingNfse(true);
    setNfseMessage(null);
    try {
      const result = await financeiroService.emitirNfse(id);
      setNfse(result.nfse);
      setNfseMessage({ type: 'success', text: 'NFS-e emitida com sucesso!' });
    } catch (err) {
      setNfseMessage({ type: 'error', text: getApiErrorMessage(err) });
    } finally {
      setEmittingNfse(false);
    }
  };

  const handleAtualizarStatusNfse = async () => {
    if (!id) return;
    setNfseLoading(true);
    try {
      const updated = await financeiroService.buscarNfseFatura(id);
      setNfse(updated);
    } catch (err) {
      setNfseMessage({ type: 'error', text: getApiErrorMessage(err) });
    } finally {
      setNfseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 dark:text-slate-500 gap-4">
        <div className="w-12 h-12 border-4 border-mustard-500/10 border-t-mustard-500 rounded-full animate-spin" />
        <p className="font-bold text-xs uppercase tracking-widest">Carregando dados...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/locacoes')} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Editar Locação</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Atualize os equipamentos, faturamento e contrato Nº {generalData.invoice_number || id}.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500">error</span>
          {error}
        </div>
      )}

      {extensionSuccessMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-emerald-500">check_circle</span>
            <span>{extensionSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setExtensionSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 text-xs font-bold uppercase tracking-wider"
          >
            Dispensar
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8">
        <button
          type="button"
          onClick={() => setActiveTab('equipments')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'equipments'
              ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
        >
          <span className="material-symbols-outlined text-lg">precision_manufacturing</span>
          Equipamentos da Locação
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-mustard-100 dark:bg-mustard-500/20 text-mustard-700 dark:text-mustard-300 font-mono">
            {equipmentItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'billing'
              ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
        >
          <span className="material-symbols-outlined text-lg">business</span>
          Faturamento & Cobrança
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('contract')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'contract'
              ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
        >
          <span className="material-symbols-outlined text-lg">description</span>
          Contrato de Locação
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('service_orders')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'service_orders'
              ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
        >
          <span className="material-symbols-outlined text-lg">construction</span>
          Ordens de Serviço
          {serviceOrders.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mustard-100 dark:bg-mustard-500/20 text-mustard-700 dark:text-mustard-400 font-mono">
              {serviceOrders.length}
            </span>
          )}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tab Contents */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'equipments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Equipamentos Atrelados</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Edite os itens, datas individuais e devoluções parciais.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddEquipment}
                  className="px-4 py-2 bg-mustard-500 hover:bg-mustard-600 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Adicionar Equipamento
                </button>
              </div>

              {equipmentItems.map((item, index) => {
                const currentEquipId = item.equipment_id;
                const selectedInOtherTabs = equipmentItems
                  .filter((_, i) => i !== index)
                  .map(e => e.equipment_id);

                const selectableEquips = allEquipments.filter(e =>
                  e.status === 'Disponível' ||
                  e.id === currentEquipId ||
                  !selectedInOtherTabs.includes(e.id)
                );

                return (
                  <motion.div
                    key={item.tempId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-6 h-6 rounded-full bg-mustard-500 text-white text-xs font-bold flex items-center justify-center font-mono">
                          {index + 1}
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {item.equipment_name ? `${item.equipment_name} (${item.asset_number || 'S/N'})` : 'Novo Equipamento'}
                        </span>
                        {item.serial_number && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Série:</span>
                            <span>{item.serial_number}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {item.equipment_id && (
                          <button
                            type="button"
                            onClick={() => handleCreateServiceOrder(item.equipment_id)}
                            disabled={creatingOsEquipmentId === item.equipment_id}
                            className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                            title="Abrir Ordem de Serviço Externa para este equipamento"
                          >
                            {creatingOsEquipmentId === item.equipment_id ? (
                              <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[16px]">construction</span>
                            )}
                            <span>Abrir OS</span>
                          </button>
                        )}
                        <span className="text-xs font-bold text-mustard-600 dark:text-mustard-400 font-mono">
                          Subtotal: {(Number(item.total_value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        {equipmentItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEquipment(index)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remover equipamento"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      <SearchableSelect
                        label="Equipamento"
                        placeholder="Pesquise por nome, patrimônio, número de série ou modelo..."
                        items={selectableEquips}
                        selectedId={item.equipment_id}
                        onSelect={(id) => handleEquipmentSelect(index, id)}
                        getDisplayValue={(eq) => `${eq.asset_number} - ${eq.name}${eq.serial_number ? ` (Série: ${eq.serial_number})` : ''} (${eq.status})`}
                        getSearchValue={(eq) => `${eq.name} ${eq.asset_number} ${eq.serial_number || ''} ${eq.type}`}
                        required
                      />

                      {/* Informações detalhadas do equipamento selecionado */}
                      {item.equipment_id && (
                        <div className="flex flex-wrap items-center gap-4 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs">
                          {item.asset_number && (
                            <div>
                              <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Patrimônio</span>
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{item.asset_number}</span>
                            </div>
                          )}
                          <div className="pl-4 border-l border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Nº de Série</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{item.serial_number || '-'}</span>
                          </div>
                          {item.equipment_type && (
                            <div className="pl-4 border-l border-slate-200 dark:border-slate-700">
                              <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Tipo</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{item.equipment_type}</span>
                            </div>
                          )}
                          {item.equipment_size && (
                            <div className="pl-4 border-l border-slate-200 dark:border-slate-700">
                              <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Altura</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{item.equipment_size}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dates */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Início da Locação *</label>
                          <input
                            required
                            type="date"
                            value={item.billing_period_start}
                            onChange={(e) => handleEquipmentChange(index, 'billing_period_start', e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-mustard-500/10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Fim da Locação *</label>
                          <input
                            required
                            type="date"
                            value={item.billing_period_end}
                            onChange={(e) => handleEquipmentChange(index, 'billing_period_end', e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-mustard-500/10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Data de Devolução</label>
                          <input
                            type="date"
                            value={item.return_date || ''}
                            onChange={(e) => handleEquipmentChange(index, 'return_date', e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-mustard-500/10"
                          />
                        </div>
                      </div>

                      {/* Cost Composition for this equipment */}
                      <div>
                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Custos deste Equipamento (R$)</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {[
                            { name: 'cost_rental', label: 'Locação' },
                            { name: 'cost_insurance', label: 'Seguro' },
                            { name: 'cost_freight', label: 'Frete' },
                            { name: 'cost_rcd', label: 'RCD' },
                            { name: 'cost_third_party', label: 'Terceiros' },
                            { name: 'cost_training', label: 'Treinamento' },
                          ].map(cost => (
                            <div key={cost.name} className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{cost.label}</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={(item as any)[cost.name] || ''}
                                  onChange={(e) => handleEquipmentChange(index, cost.name, parseFloat(e.target.value) || 0)}
                                  placeholder="0,00"
                                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-mustard-500/10 outline-none"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              {/* Section: Client & Work Site */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-500 text-xl">person_pin_circle</span>
                  Cliente e Obra
                </h3>

                <SearchableSelect
                  label="Cliente"
                  placeholder="Selecione o cliente"
                  items={clients}
                  selectedId={generalData.client_id}
                  onSelect={(id) => setGeneralData(prev => ({ ...prev, client_id: id }))}
                  getDisplayValue={(c) => c.company_name}
                  getSearchValue={(c) => `${c.company_name} ${c.cnpj}`}
                  required
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">
                    Obra / Local de Uso
                  </label>
                  <input
                    type="text"
                    name="work_site"
                    value={generalData.work_site}
                    onChange={handleGeneralChange}
                    placeholder="Ex: Condomínio Solar das Águas"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-mustard-500/10 outline-none text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    Status Faturamento
                    {generalData.billing_method !== 'MANUAL' && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black normal-case tracking-normal ${invoicePaid
                          ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        }`}>
                        <span className="material-symbols-outlined text-[12px]">{invoicePaid ? 'check_circle' : 'schedule'}</span>
                        {invoicePaid ? 'Pago' : 'Aguardando pagamento'}
                      </span>
                    )}
                  </label>
                  <select
                    name="billing_status"
                    value={generalData.billing_status}
                    onChange={handleGeneralChange}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-mustard-500/10 cursor-pointer dark:text-white"
                  >
                    {BILLING_STATUSES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section: Notes */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-500 text-xl">description</span>
                  Observações do Contrato
                </h3>
                <textarea
                  name="notes"
                  value={generalData.notes}
                  onChange={handleGeneralChange}
                  rows={4}
                  placeholder="Detalhes sobre a negociação, descontos ou condições especiais..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-mustard-500/10 resize-none outline-none dark:text-white"
                />
              </div>
            </div>
          )}

          {activeTab === 'contract' && (
            <div className="space-y-6">
              {contractLoading && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-pulse">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                  </div>
                </div>
              )}

              {!contractLoading && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 rounded-t-2xl flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-mustard-500 text-xl">description</span>
                      Contrato de Locação
                    </h3>
                  </div>
                  <div className="p-6 relative">
                    {showContractDeleteConfirm ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                          <span className="material-symbols-outlined">warning</span>
                          <p className="text-sm font-bold">
                            Deseja realmente excluir o Contrato Nº {contractToDelete?.contract_number || 'selecionado'}?
                          </p>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Esta ação é irreversível e removerá o arquivo e o registro do contrato gerado.
                        </p>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowContractDeleteConfirm(false);
                              setContractToDelete(null);
                            }}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={executeDeleteContract}
                            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors"
                          >
                            Sim, Excluir
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {contractError && (
                          <div className="mb-4 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs flex items-center justify-between">
                            <span>{contractError}</span>
                            <button type="button" onClick={() => setContractError(null)}>
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        )}
                        {!contractForm?.id && contracts.length === 0 ? (
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                              Nenhum formulário de contrato criado. Preencha os dados para gerar o PDF.
                            </p>
                            <button
                              type="button"
                              onClick={openContractModal}
                              className="px-4 py-2 bg-mustard-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-mustard-500/20 hover:bg-mustard-600 transition-colors"
                            >
                              Preencher Dados do Contrato
                            </button>
                          </div>
                        ) : contractForm?.id && contractForm.form_status === 'Rascunho' && contracts.length === 0 ? (
                          <div>
                            <div className="flex items-center gap-2 mb-4">
                              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">Rascunho Salvo</p>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                              Você possui um rascunho de contrato salvo. Finalize o preenchimento para gerar o PDF.
                            </p>
                            <button
                              type="button"
                              onClick={openContractModal}
                              className="px-4 py-2 border border-mustard-500 text-mustard-600 dark:text-mustard-400 rounded-xl text-sm font-bold hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors"
                            >
                              Continuar Edição
                            </button>
                          </div>
                        ) : contractForm?.form_status === 'Pronto para Gerar' && contracts.length === 0 ? (
                          <div>
                            <div className="flex items-center gap-2 mb-4">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">Pronto para Gerar PDF</p>
                            </div>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={openContractModal}
                                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              >
                                Editar Formulário
                              </button>
                              <button
                                type="button"
                                onClick={handleGeneratePdf}
                                className="px-4 py-2 bg-mustard-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-mustard-500/20 hover:bg-mustard-600 transition-colors"
                              >
                                Gerar PDF
                              </button>
                            </div>
                          </div>
                        ) : contracts.length > 0 ? (
                          <div className="space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                              <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>Contratos Gerados para a Locação</span>
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-mustard-100 dark:bg-mustard-500/20 text-mustard-700 dark:text-mustard-400 font-mono">
                                    {contracts.length}
                                  </span>
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Todos os contratos e propostas de locação cadastrados para esta fatura.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={openContractModal}
                                className="px-3.5 py-1.5 bg-mustard-500 hover:bg-mustard-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit_document</span>
                                <span>Editar / Gerar Novo</span>
                              </button>
                            </div>

                            <div className="space-y-3">
                              {contracts.map((contract, cIdx) => (
                                <div
                                  key={contract.id || cIdx}
                                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3 hover:border-mustard-300 dark:hover:border-mustard-500/30 transition-all shadow-sm"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <span
                                        className={`w-3 h-3 rounded-full ${contract.status === 'Assinado' ? 'bg-emerald-500' : 'bg-blue-500'
                                          }`}
                                      />
                                      <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                          <span>Contrato Nº {contract.contract_number}</span>
                                          {contract.version && (
                                            <span className="text-[10px] text-slate-400 font-normal font-mono">
                                              (v{contract.version})
                                            </span>
                                          )}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                          Gerado em {new Date(contract.generated_at).toLocaleDateString('pt-BR')} às {new Date(contract.generated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${contract.status === 'Assinado'
                                            ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                            : 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20'
                                          }`}
                                      >
                                        {contract.status}
                                      </span>
                                      {(deal?.owner_id === user?.id || ['Administrador', 'Diretoria', 'Gerente'].includes(profile?.access_level || '')) && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteContract(contract)}
                                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                          title="Excluir este contrato"
                                        >
                                          <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                    <button
                                      type="button"
                                      onClick={() => handleViewContractPdf(contract)}
                                      className="px-3.5 py-1.5 border border-mustard-500 text-mustard-600 dark:text-mustard-400 rounded-xl text-xs font-bold hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors flex items-center gap-1.5"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                                      Visualizar PDF
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDownloadContractPdf(contract)}
                                      className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">download</span>
                                      Baixar PDF
                                    </button>

                                    {contract.status !== 'Assinado' && (
                                      <button
                                        type="button"
                                        onClick={() => handleUploadSigned(contract)}
                                        className="px-3.5 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                                      >
                                        <span className="material-symbols-outlined text-[16px]">upload_file</span>
                                        Anexar Assinado
                                      </button>
                                    )}

                                    {contract.status === 'Assinado' && contract.signed_file_url && (
                                      <a
                                        href={contract.signed_file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                                      >
                                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                        Ver Assinado
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'service_orders' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-mustard-500">construction</span>
                    Ordens de Serviço da Locação
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Histórico de manutenções preventivas e corretivas vinculadas aos equipamentos desta locação.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCreateServiceOrder()}
                  disabled={creatingOsEquipmentId !== null}
                  className="px-4 py-2.5 bg-mustard-500 hover:bg-mustard-600 active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm disabled:opacity-60"
                >
                  {creatingOsEquipmentId ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  )}
                  <span>Nova Ordem de Serviço</span>
                </button>
              </div>

              {serviceOrders.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-3xl">construction</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    Nenhuma Ordem de Serviço vinculada
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">
                    Você pode abrir uma Ordem de Serviço externa diretamente pelo botão acima ou clicando em &quot;Abrir OS&quot; no card do equipamento desejado na aba &quot;Equipamentos da Locação&quot;.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleCreateServiceOrder()}
                      className="px-5 py-2.5 bg-mustard-500 hover:bg-mustard-600 active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all inline-flex items-center gap-2 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Abrir Primeira OS
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-3.5 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Nº OS</th>
                          <th className="px-6 py-3.5 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Equipamento</th>
                          <th className="px-6 py-3.5 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Tipo</th>
                          <th className="px-6 py-3.5 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Data Execução</th>
                          <th className="px-6 py-3.5 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Status</th>
                          <th className="px-6 py-3.5 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px] text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {serviceOrders.map((os) => (
                          <tr key={os.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                              #{os.os_number}
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                {os.equipment_asset_number ? `${os.equipment_asset_number} - ` : ''}{os.equipment_name || 'Equipamento'}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {os.equipment_model && (
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                    Modelo: {os.equipment_model}
                                  </span>
                                )}
                                {os.equipment_serial_number && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    • Série: {os.equipment_serial_number}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                                {os.order_type || 'Externa'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">
                              {os.execution_date ? formatDate(os.execution_date) : '-'}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                {os.status || 'Aberta'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => navigate(`/manutencoes/editar/${os.id}`)}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-mustard-50 dark:hover:bg-mustard-500/10 text-slate-700 dark:text-slate-300 hover:text-mustard-600 dark:hover:text-mustard-400 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700"
                                title="Editar / Ver Ordem de Serviço"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                <span>Ver / Editar</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Invoicing Summary & Actions */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-6 space-y-5 sticky top-6">

            {/* Header com total consolidado e itens */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-mustard-500">payments</span>
                Faturamento da Locação
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">precision_manufacturing</span>
                <span>{equipmentItems.length} {equipmentItems.length === 1 ? 'item' : 'itens'}</span>
              </span>
            </div>

            {/* Valor Total Consolidado */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                Valor Total Consolidado
              </span>
              <p className="text-3xl sm:text-4xl text-mustard-500 font-black tracking-tight mt-1 font-mono">
                {totals.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            {/* Breakdown summary */}
            <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800/80">
              <div className="flex justify-between items-center">
                <span>Locação total:</span>
                <span className="font-semibold text-slate-900 dark:text-white font-mono">{totals.cost_rental.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Seguro total:</span>
                <span className="font-semibold text-slate-900 dark:text-white font-mono">{totals.cost_insurance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Frete total:</span>
                <span className="font-semibold text-slate-900 dark:text-white font-mono">{totals.cost_freight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>RCD total:</span>
                <span className="font-semibold text-slate-900 dark:text-white font-mono">{totals.cost_rcd.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Terceiros total:</span>
                <span className="font-semibold text-slate-900 dark:text-white font-mono">{totals.cost_third_party.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Treinamento total:</span>
                <span className="font-semibold text-slate-900 dark:text-white font-mono">{totals.cost_training.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            {/* Campos de Dados da Fatura */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              {/* Linha 1: Nº Fatura / Contrato e Vencimento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate" title="Nº Fatura / Contrato">
                    Nº Fatura
                  </label>
                  <input
                    type="text"
                    name="invoice_number"
                    value={generalData.invoice_number}
                    onChange={handleGeneralChange}
                    placeholder="Nº da Fatura"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-mustard-500/20 font-mono transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate" title="Data de Vencimento">
                    Vencimento *
                  </label>
                  <input
                    required
                    type="date"
                    name="due_date"
                    value={generalData.due_date}
                    onChange={handleGeneralChange}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-mustard-500/20 transition-colors"
                  />
                </div>
              </div>

              {/* Linha 2: Forma de Pagamento e Status Conciliação */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate" title="Forma de Pagamento">
                    Forma Pagto
                  </label>
                  <select
                    name="payment_method"
                    value={generalData.payment_method}
                    onChange={handleGeneralChange}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-mustard-500/20 cursor-pointer dark:text-white transition-colors"
                  >
                    <option value="">Selecione</option>
                    <option value="BOLETO">BOLETO</option>
                    <option value="PIX">PIX</option>
                    <option value="DEPÓSITO BANCÁRIO">DEPÓSITO</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate" title="Status Conciliação">
                    Conciliação
                  </label>
                  <select
                    name="reconciliation_status"
                    value={generalData.reconciliation_status}
                    onChange={handleGeneralChange}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-mustard-500/20 cursor-pointer dark:text-white transition-colors"
                  >
                    {RECONCILIATION_STATUSES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Ações e Botões com Ícones */}
            <div className="pt-2 space-y-2.5 border-t border-slate-100 dark:border-slate-800">
              {/* Salvar Alterações */}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-mustard-500 hover:bg-mustard-600 active:scale-[0.98] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-mustard-500/20 disabled:opacity-70"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>

              {/* Botões para locações sem data de retorno */}
              {canExtend && (
                <div className="space-y-2 pt-0.5">
                  {/* Lançar Prorrogação */}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setIsExtensionModalOpen(true);
                    }}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20"
                  >
                    <span className="material-symbols-outlined text-[18px]">more_time</span>
                    <span>Lançar Prorrogação</span>
                  </button>

                  {/* Retorno */}
                  <button
                    type="button"
                    onClick={() => setShowRetornoNotice(prev => !prev)}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
                  >
                    <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">checklist</span>
                    <span>Retorno</span>
                  </button>

                  {/* Banner de Feedback da Triagem de Retorno */}
                  {showRetornoNotice && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2"
                    >
                      <span className="material-symbols-outlined text-base flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5">info</span>
                      <div className="flex-1">
                        <p className="font-bold text-[11px]">Triagem de Retorno</p>
                        <p className="text-[11px] text-blue-600 dark:text-blue-400/90 mt-0.5">
                          A triagem e conferência de retorno dos equipamentos desta locação estará disponível nesta ação.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRetornoNotice(false)}
                        className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Excluir Locação (Exclusivo Administrador e Diretoria) */}
              {canDeleteRental && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setShowDeleteModal(true);
                    }}
                    className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm hover:border-red-300 dark:hover:border-red-500/50"
                    title="Excluir esta locação e contas a receber associadas"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    <span>Excluir Locação</span>
                  </button>
                </div>
              )}
            </div>

            {generalData.billing_method !== 'MANUAL' && (
              <>
                {chargeMessage && (
                  <div className={`px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 ${chargeMessage.type === 'success' ? 'bg-emerald-900/20 text-emerald-100' : 'bg-red-900/30 text-red-100'
                    }`}>
                    <span className="material-symbols-outlined text-base">{chargeMessage.type === 'success' ? 'check_circle' : 'error'}</span>
                    {chargeMessage.text}
                  </div>
                )}

                {invoicePaid ? (
                  <span className="w-full py-3 bg-emerald-900/20 text-emerald-100 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    Pagamento Confirmado
                  </span>
                ) : chargeResult ? (
                  <a
                    href={chargeResult.charge.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                    Ver Boleto
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setChargeConfirmOpen(true)}
                    disabled={charging}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70"
                  >
                    {charging ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">payments</span>
                        {generalData.billing_status === 'Faturado' ? 'Gerar Segunda Via do Boleto' : 'Gerar Cobrança'}
                      </>
                    )}
                  </button>
                )}

                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">request_quote</span>
                    Nota Fiscal
                  </h4>

                  {nfseMessage && (
                    <div className={`px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 ${nfseMessage.type === 'success' ? 'bg-emerald-900/20 text-emerald-100' : 'bg-red-900/30 text-red-100'
                      }`}>
                      <span className="material-symbols-outlined text-base">{nfseMessage.type === 'success' ? 'check_circle' : 'error'}</span>
                      {nfseMessage.text}
                    </div>
                  )}

                  {nfse ? (
                    <>
                      <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${nfseBadgeClass(nfse.status)}`}>
                        <span className="material-symbols-outlined text-[14px]">{nfseStatusIcon(nfse.status)}</span>
                        {nfse.status}
                      </div>

                      {(nfse.status === 'ERROR' || nfse.status === 'ERRO') && nfse.return_message && (
                        <p className="text-xs text-red-400">{nfse.return_message}</p>
                      )}

                      {(nfse.status === 'ERROR' || nfse.status === 'ERRO') && (
                        <button
                          type="button"
                          onClick={handleEmitirNfse}
                          disabled={!hasCharge || emittingNfse}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {emittingNfse ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[16px]">refresh</span>
                              Tentar Emitir Novamente
                            </>
                          )}
                        </button>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {nfse.nfse_link && (
                          <a
                            href={nfse.nfse_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[16px]">description</span>
                            Ver Nota
                          </a>
                        )}
                        {nfse.xml_url && (
                          <a
                            href={nfse.xml_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[16px]">code</span>
                            XML
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleAtualizarStatusNfse}
                        disabled={nfseLoading}
                        className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                        {nfseLoading ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">refresh</span>
                            Atualizar Status
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleEmitirNfse}
                        disabled={!hasCharge || emittingNfse}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                      >
                        {emittingNfse ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">request_quote</span>
                            Emitir NFS-e
                          </>
                        )}
                      </button>
                      {!hasCharge && (
                        <p className="text-[11px] text-slate-400 text-center">Gere a cobrança antes de emitir a nota fiscal.</p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            <button type="button" onClick={() => navigate('/locacoes')} className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 uppercase tracking-widest transition-colors text-center">
              Cancelar e Voltar
            </button>
          </div>
        </div>
      </form>

      {/* Modal de Confirmação — Gerar Cobrança */}
      <AnimatePresence>
        {chargeConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !charging && setChargeConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-center"
            >
              <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
                <span className="material-symbols-outlined text-3xl">warning</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Atenção</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
                Esta ação irá gerar uma nova cobrança (boleto) para esta fatura. Se já existir uma cobrança em aberto, isso pode gerar duplicidade. Deseja continuar?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={charging}
                  onClick={() => setChargeConfirmOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={charging}
                  onClick={handleGerarCobranca}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {charging ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Confirmar'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Formulário de Contrato */}
      {deal && (
        <ContractFormModal
          isOpen={isContractModalOpen}
          onClose={() => setIsContractModalOpen(false)}
          onSuccess={() => {
            if (deal?.id) loadContractData(deal.id);
          }}
          dealId={deal.id}
          deal={{
            ...deal,
            rental_invoice_id: id || deal.rental_invoice_id
          }}
          initialData={{
            ...contractForm,
            equipments: (equipmentItems && equipmentItems.length > 0)
              ? equipmentItems
              : contractForm?.equipments
          }}
        />
      )}

      {/* Modal de Seleção de Equipamento para abertura de OS */}
      <AnimatePresence>
        {selectEquipModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !creatingOsEquipmentId && setSelectEquipModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-mustard-50 dark:bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 flex items-center justify-center">
                    <span className="material-symbols-outlined">construction</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Selecione o Equipamento</h3>
                    <p className="text-xs text-slate-400">Para qual equipamento desta locação deseja abrir a Ordem de Serviço?</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={creatingOsEquipmentId !== null}
                  onClick={() => setSelectEquipModalOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {equipmentItems
                  .filter((item) => Boolean(item.equipment_id))
                  .map((item, idx) => (
                    <button
                      key={item.equipment_id || idx}
                      type="button"
                      disabled={creatingOsEquipmentId === item.equipment_id}
                      onClick={() => handleCreateServiceOrder(item.equipment_id)}
                      className="w-full text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-mustard-500 hover:bg-mustard-50/50 dark:hover:bg-mustard-500/10 transition-all flex items-center justify-between group disabled:opacity-60"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-sm block group-hover:text-mustard-600 dark:group-hover:text-mustard-400">
                          {item.asset_number ? `${item.asset_number} - ` : ''}{item.equipment_name || 'Equipamento'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {item.equipment_type || ''} {item.equipment_size ? `(${item.equipment_size})` : ''} {item.serial_number ? ` • Série: ${item.serial_number}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {creatingOsEquipmentId === item.equipment_id ? (
                          <div className="w-4 h-4 border-2 border-mustard-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-slate-400 group-hover:text-mustard-600 dark:group-hover:text-mustard-400 group-hover:translate-x-1 transition-all">
                            arrow_forward
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Prorrogação de Locação */}
      {id && (
        <RentalExtensionModal
          isOpen={isExtensionModalOpen}
          onClose={() => setIsExtensionModalOpen(false)}
          rentalId={id}
          invoiceNumber={generalData.invoice_number}
          equipments={equipmentItems}
          onSuccess={(result) => {
            setExtensionSuccessMsg(result?.message || 'Locação prorrogada com sucesso!');
            reloadRentalData();
          }}
        />
      )}

      {/* Modal de Confirmação de Exclusão da Locação (Administrador e Diretoria) */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deletingRental && setShowDeleteModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-red-200 dark:border-red-900/40 overflow-hidden z-10 p-6 space-y-5"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-2xl">delete_forever</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Excluir Locação</span>
                    {generalData.invoice_number && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                        #{generalData.invoice_number}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ação restrita a Administradores e Diretoria
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base flex-shrink-0">error</span>
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Tem certeza que deseja excluir esta locação? Esta ação é <strong className="text-red-600 dark:text-red-400">irreversível</strong> e executará as seguintes ações:
                </p>
                <ul className="space-y-1.5 pl-4 list-disc marker:text-red-500">
                  <li>Exclusão permanente da fatura de locação.</li>
                  <li><strong>Exclusão de todos os lançamentos financeiros</strong> atrelados a esta locação.</li>
                  <li>Liberação automática das máquinas vinculadas para o status <strong>Disponível</strong> no estoque.</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={deletingRental}
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deletingRental}
                  onClick={handleDeleteRental}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {deletingRental ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>Sim, Excluir Locação</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RentalEdit;
