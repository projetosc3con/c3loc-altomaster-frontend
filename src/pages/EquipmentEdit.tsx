import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { EquipmentGeneralTab } from '../components/equipments/EquipmentGeneralTab';
import { EquipmentDocumentsTab } from '../components/equipments/EquipmentDocumentsTab';
import { EquipmentRentalsTab } from '../components/equipments/EquipmentRentalsTab';
import { EquipmentMaintenanceTab } from '../components/equipments/EquipmentMaintenanceTab';

type TabType = 'geral' | 'documentos' | 'locacoes' | 'manutencoes';

const EquipmentEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canEditHourMeter = profile?.access_level === 'Administrador' || profile?.access_level === 'Diretoria';

  const [activeTab, setActiveTab] = useState<TabType>('geral');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [counts, setCounts] = useState({
    documents: 0,
    rentals: 0,
    serviceOrders: 0,
  });

  const [formData, setFormData] = useState({
    // Identificação
    asset_number: '',
    name: '',
    type: '',
    model: '',
    unit: 'un',
    status: 'Disponível',

    // Especificações Técnicas
    serial_number: '',
    height: '',
    manufacture_year: '',
    hour_meter: '',

    // Financeiro & Aquisição
    value: '',
    purchase_date: '',
    notes: '',

    // Dados Fiscais / NF-e
    invoice_number: '',
    nfe_access_key: '',
    supplier_name: '',
    supplier_cnpj: '',
    product_code: '',
    ncm: '',
    cst: '',
    cfop: '',
  });

  const fetchEquipment = async () => {
    try {
      setFetching(true);
      const { data } = await api.get(`/equipments/${id}`);
      setFormData({
        asset_number: data.asset_number || '',
        name: data.name || '',
        type: data.type || '',
        model: data.model || '',
        unit: data.unit || 'un',
        status: data.status || 'Disponível',

        serial_number: data.serial_number || '',
        height: data.height != null ? String(data.height) : '',
        manufacture_year: data.manufacture_year != null ? String(data.manufacture_year) : '',
        hour_meter: data.hour_meter != null ? String(data.hour_meter) : '',

        value: data.value != null ? String(data.value) : '',
        purchase_date: data.purchase_date || '',
        notes: data.notes || '',

        invoice_number: data.invoice_number || '',
        nfe_access_key: data.nfe_access_key || '',
        supplier_name: data.supplier_name || '',
        supplier_cnpj: data.supplier_cnpj || '',
        product_code: data.product_code || '',
        ncm: data.ncm || '',
        cst: data.cst || '',
        cfop: data.cfop || '',
      });
      if (data.photo_url) setPhotoPreview(data.photo_url);
    } catch (err: any) {
      console.error('Erro ao buscar equipamento:', err);
      setError('Equipamento não encontrado ou erro de conexão.');
    } finally {
      setFetching(false);
    }
  };

  const fetchCounts = async () => {
    if (!id) return;
    try {
      const [docsRes, rentalsRes, osRes] = await Promise.allSettled([
        api.get(`/equipments/${id}/documents`),
        api.get(`/equipments/${id}/rentals`),
        api.get(`/equipments/${id}/service-orders`),
      ]);

      setCounts({
        documents: docsRes.status === 'fulfilled' ? docsRes.value.data?.length || 0 : 0,
        rentals: rentalsRes.status === 'fulfilled' ? rentalsRes.value.data?.length || 0 : 0,
        serviceOrders: osRes.status === 'fulfilled' ? osRes.value.data?.length || 0 : 0,
      });
    } catch (e) {
      // Silencioso para não bloquear carregamento principal
    }
  };

  useEffect(() => {
    if (id) {
      fetchEquipment();
      fetchCounts();
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let photo_url = photoPreview;

      // Upload de nova foto se selecionada
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('equipments')
          .upload(filePath, photoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('equipments')
          .getPublicUrl(filePath);

        photo_url = publicUrl;
      }

      const payload = {
        ...formData,
        height: formData.height ? parseFloat(formData.height) : null,
        manufacture_year: formData.manufacture_year ? parseInt(formData.manufacture_year, 10) : null,
        hour_meter: formData.hour_meter ? parseFloat(formData.hour_meter) : 0,
        value: formData.value ? parseFloat(formData.value) : null,
        purchase_date: formData.purchase_date || null,
        photo_url,
      };

      await api.put(`/equipments/${id}`, payload);
      navigate('/equipamentos');
    } catch (err: any) {
      console.error('Erro ao atualizar equipamento:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao atualizar equipamento.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Disponível':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30';
      case 'Locado':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-900/30';
      case 'Em Manutenção':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-900/30';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-mustard-500/10 border-t-mustard-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 dark:text-slate-500 text-sm font-medium mt-4">Buscando dados da máquina...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-6 pb-20"
    >
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/equipamentos')}
            className="p-2.5 hover:bg-white dark:hover:bg-slate-900 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 cursor-pointer"
            title="Voltar para a lista"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                {formData.name || 'Editar Máquina'}
              </h1>
              {formData.asset_number && (
                <span className="px-2.5 py-1 bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 font-mono font-bold text-xs rounded-xl border border-mustard-500/20">
                  {formData.asset_number}
                </span>
              )}
              {formData.status && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeStyle(formData.status)}`}>
                  {formData.status}
                </span>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-xs font-medium">
              Gerencie características, documentações anexas e histórico de locações e manutenções.
            </p>
          </div>
        </div>
      </div>

      {/* Alerta de Erro Geral */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-2xl text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('geral')}
          className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'geral'
              ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg">tune</span>
          Características Gerais
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documentos')}
          className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'documentos'
              ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg">folder_open</span>
          Documentação
          {counts.documents > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold">
              {counts.documents}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('locacoes')}
          className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'locacoes'
              ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg">receipt_long</span>
          Histórico de Locações
          {counts.rentals > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold">
              {counts.rentals}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manutencoes')}
          className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'manutencoes'
              ? 'border-mustard-500 text-mustard-600 dark:text-mustard-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg">engineering</span>
          Histórico de Manutenções
          {counts.serviceOrders > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold">
              {counts.serviceOrders}
            </span>
          )}
        </button>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'geral' && (
            <EquipmentGeneralTab
              formData={formData}
              handleChange={handleChange}
              photoPreview={photoPreview}
              handlePhotoSelect={handlePhotoSelect}
              handleRemovePhoto={handleRemovePhoto}
              fileInputRef={fileInputRef}
              equipmentId={id}
              canEditHourMeter={canEditHourMeter}
              loading={loading}
              onSubmit={handleSubmit}
              onCancel={() => navigate('/equipamentos')}
            />
          )}

          {activeTab === 'documentos' && (
            <EquipmentDocumentsTab
              equipmentId={id!}
              assetNumber={formData.asset_number}
            />
          )}

          {activeTab === 'locacoes' && (
            <EquipmentRentalsTab
              equipmentId={id!}
            />
          )}

          {activeTab === 'manutencoes' && (
            <EquipmentMaintenanceTab
              equipmentId={id!}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default EquipmentEdit;
