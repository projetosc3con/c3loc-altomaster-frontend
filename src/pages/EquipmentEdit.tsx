import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import api from '../services/api';
import { formatDate } from '../utils/date';
import type { Equipment } from '../types';

const EQUIPMENT_TYPES = [
  'Elétrica',
  'Diesel',
  'GLP',
];

const EquipmentEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawEquipment, setRawEquipment] = useState<Equipment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF de Especificações Técnicas
  const [specsPdfUrl, setSpecsPdfUrl] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        setFetching(true);
        const { data } = await api.get(`/equipments/${id}`);
        setRawEquipment(data);
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
        if (data.technical_specs_url) setSpecsPdfUrl(data.technical_specs_url);
      } catch (err: any) {
        console.error('Erro ao buscar equipamento:', err);
        setError('Equipamento não encontrado ou erro de conexão.');
      } finally {
        setFetching(false);
      }
    };

    if (id) fetchEquipment();
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

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor, selecione apenas arquivos em formato PDF.');
      return;
    }
    setError(null);
    setPdfFile(file);
    setPdfFileName(file.name);
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
    setPdfFileName(null);
    setSpecsPdfUrl(null);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleViewPdf = () => {
    if (pdfFile) {
      const blobUrl = URL.createObjectURL(pdfFile);
      window.open(blobUrl, '_blank');
    } else if (specsPdfUrl) {
      window.open(specsPdfUrl, '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let photo_url = photoPreview;
      let technical_specs_url = specsPdfUrl;

      // 1. Upload de nova foto se selecionada
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

      // 2. Upload de PDF de especificações na pasta 'details' com nome do patrimônio
      if (pdfFile) {
        const cleanAsset = (formData.asset_number || `eq_${id}`).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const pdfPath = `details/${cleanAsset}.pdf`;

        const { error: uploadPdfError } = await supabase.storage
          .from('equipments')
          .upload(pdfPath, pdfFile, {
            upsert: true,
            contentType: 'application/pdf',
          });

        if (uploadPdfError) throw uploadPdfError;

        const { data: { publicUrl: pdfPublicUrl } } = supabase.storage
          .from('equipments')
          .getPublicUrl(pdfPath);

        technical_specs_url = pdfPublicUrl;
      }

      const payload = {
        ...formData,
        height: formData.height ? parseFloat(formData.height) : null,
        manufacture_year: formData.manufacture_year ? parseInt(formData.manufacture_year, 10) : null,
        value: formData.value ? parseFloat(formData.value) : null,
        purchase_date: formData.purchase_date || null,
        photo_url,
        technical_specs_url,
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
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/equipamentos')}
          className="p-2 hover:bg-white dark:hover:bg-slate-900 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Editar Máquina</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Atualize as informações do patrimônio{' '}
            <span className="font-bold text-mustard-600 dark:text-mustard-500 font-mono">
              {formData.asset_number}
            </span>
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 font-medium">
          <span className="material-symbols-outlined text-red-500">error</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Coluna Esquerda: Foto, Especificações (PDF), Status & Auditoria */}
          <div className="lg:col-span-1 space-y-6">
            {/* Foto da Máquina */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-500 text-xl">photo_camera</span>
                Foto da Máquina
              </h3>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-full aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center cursor-pointer hover:border-mustard-500/30 hover:bg-mustard-50/30 dark:hover:bg-mustard-500/10 transition-all overflow-hidden group"
              >
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                      <span className="material-symbols-outlined text-3xl">edit</span>
                      <span className="text-xs font-bold uppercase mt-1">Trocar Foto</span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700">add_photo_alternate</span>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">Clique para adicionar</p>
                  </>
                )}
              </div>

              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoSelect} />

              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="w-full mt-3 py-2 text-xs font-bold text-red-500 hover:text-red-600 dark:hover:text-red-400 uppercase tracking-widest transition-colors"
                >
                  Remover Foto
                </button>
              )}
            </div>

            {/* Card: Especificações Técnicas da Plataforma (PDF) */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-xl">picture_as_pdf</span>
                  Especificações (PDF)
                </h3>
                {(specsPdfUrl || pdfFile) && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase">
                    Anexado
                  </span>
                )}
              </div>

              {specsPdfUrl || pdfFile ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl">description</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-slate-900 dark:text-white truncate" title={pdfFileName || `${formData.asset_number || 'equipamento'}.pdf`}>
                        {pdfFileName || `${formData.asset_number || 'equipamento'}.pdf`}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {pdfFile ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB • Novo arquivo` : 'Armazenado'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleViewPdf}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">visibility</span>
                      Visualizar
                    </button>
                    <button
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">sync</span>
                      Trocar
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemovePdf}
                    className="w-full py-1 text-[11px] font-bold text-red-500 hover:text-red-600 dark:hover:text-red-400 uppercase tracking-wider transition-colors text-center"
                  >
                    Remover PDF
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => pdfInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-mustard-500/40 rounded-xl p-5 text-center cursor-pointer hover:bg-mustard-50/20 dark:hover:bg-mustard-500/5 transition-all group"
                >
                  <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-mustard-500 flex items-center justify-center transition-colors mb-2">
                    <span className="material-symbols-outlined text-2xl">upload_file</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Anexar Ficha Técnica (PDF)</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Manual, diagrama de carga ou especificações (PDF até 25MB)</p>
                </div>
              )}

              <input
                type="file"
                ref={pdfInputRef}
                className="hidden"
                accept="application/pdf,.pdf"
                onChange={handlePdfSelect}
              />
            </div>

            {/* Status Operacional */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-500 text-xl">settings</span>
                Status Operacional
              </h3>
              <div className="space-y-1.5">
                <div className="relative">
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm appearance-none cursor-pointer font-bold"
                  >
                    <option value="Disponível">Disponível</option>
                    <option value="Locado">Locado</option>
                    <option value="Em Manutenção">Em Manutenção</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                </div>
              </div>
            </div>

            {/* Card de Locação Ativa (se locado) */}
            {rawEquipment && rawEquipment.status === 'Locado' && rawEquipment.rental_client_name && (
              <div className="bg-blue-50/70 dark:bg-blue-950/20 p-5 rounded-2xl border border-blue-200 dark:border-blue-800/50 shadow-sm space-y-3">
                <h3 className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-lg">local_shipping</span>
                  Locação Ativa
                </h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold text-blue-600/70 dark:text-blue-400 uppercase tracking-widest">Cliente</span>
                    <span className="font-bold text-blue-950 dark:text-blue-100">{rawEquipment.rental_client_name}</span>
                  </div>
                  {rawEquipment.rental_work_site && (
                    <div>
                      <span className="block text-[10px] font-bold text-blue-600/70 dark:text-blue-400 uppercase tracking-widest">Obra / Local</span>
                      <span className="text-blue-900 dark:text-blue-200 font-medium">{rawEquipment.rental_work_site}</span>
                    </div>
                  )}
                  {rawEquipment.rental_period_start && (
                    <div>
                      <span className="block text-[10px] font-bold text-blue-600/70 dark:text-blue-400 uppercase tracking-widest">Período</span>
                      <span className="text-blue-900 dark:text-blue-200 font-medium">
                        {new Date(rawEquipment.rental_period_start + 'T00:00:00').toLocaleDateString('pt-BR')} até{' '}
                        {rawEquipment.rental_period_end ? new Date(rawEquipment.rental_period_end + 'T00:00:00').toLocaleDateString('pt-BR') : 'Indeterminado'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Auditoria & Registro */}
            {rawEquipment && (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-500 text-xl">history</span>
                  Auditoria & Registro
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Data de Cadastro
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(rawEquipment.created_at)}
                      {rawEquipment.created_at ? ` às ${new Date(rawEquipment.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </span>
                  </div>

                  {rawEquipment.updated_at && (
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Última Atualização
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatDate(rawEquipment.updated_at)}
                        {` às ${new Date(rawEquipment.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Chave / UID do Criador
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 select-all block break-all" title={rawEquipment.created_by || ''}>
                      {rawEquipment.created_by || 'Sistema / Importação'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Coluna Direita: Formulário de Edição */}
          <div className="lg:col-span-2 space-y-6">

            {/* 1. Identificação & Dados Gerais */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-500 text-xl">precision_manufacturing</span>
                  Identificação & Dados Gerais
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Nº Patrimônio *</label>
                    <input
                      type="text"
                      name="asset_number"
                      value={formData.asset_number}
                      onChange={handleChange}
                      required
                      placeholder="Ex: PAT-001"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Nome do Equipamento *</label>
                    <input
                      required
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Ex: Plataforma Tesoura 26ft"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                    <div className="relative">
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm appearance-none cursor-pointer"
                      >
                        <option value="">Selecione o tipo</option>
                        {EQUIPMENT_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Modelo</label>
                    <input
                      type="text"
                      name="model"
                      value={formData.model}
                      onChange={handleChange}
                      placeholder="Ex: JLG 2630ES"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Unidade</label>
                    <input
                      type="text"
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      placeholder="un"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Especificações Técnicas */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-500 text-xl">engineering</span>
                  Especificações Técnicas
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Nº de Série / Chassi</label>
                    <input
                      type="text"
                      name="serial_number"
                      value={formData.serial_number}
                      onChange={handleChange}
                      placeholder="S/N do fabricante"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Altura de Trabalho (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="height"
                      value={formData.height}
                      onChange={handleChange}
                      placeholder="Ex: 10.06"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Ano de Fabricação</label>
                    <input
                      type="number"
                      name="manufacture_year"
                      value={formData.manufacture_year}
                      onChange={handleChange}
                      placeholder="Ex: 2022"
                      min="1990"
                      max={new Date().getFullYear() + 1}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Financeiro & Aquisição */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-500 text-xl">payments</span>
                  Financeiro & Aquisição
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Valor Patrimonial (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="value"
                      value={formData.value}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Data de Aquisição / Compra</label>
                    <input
                      type="date"
                      name="purchase_date"
                      value={formData.purchase_date}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Dados Fiscais & NF-e de Entrada / Aquisição */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-500 text-xl">receipt_long</span>
                  Dados Fiscais & NF-e de Aquisição
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Nº Nota Fiscal (NF-e)</label>
                    <input
                      type="text"
                      name="invoice_number"
                      value={formData.invoice_number}
                      onChange={handleChange}
                      placeholder="Ex: 12345"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Código do Produto (Fornecedor)</label>
                    <input
                      type="text"
                      name="product_code"
                      value={formData.product_code}
                      onChange={handleChange}
                      placeholder="Ex: PROD-998"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Chave de Acesso da NF-e (44 dígitos)</label>
                  <input
                    type="text"
                    name="nfe_access_key"
                    value={formData.nfe_access_key}
                    onChange={handleChange}
                    maxLength={44}
                    placeholder="35230100000000000000550010000000011000000001"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-xs font-mono select-all tracking-wider"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Razão Social / Nome do Fornecedor</label>
                    <input
                      type="text"
                      name="supplier_name"
                      value={formData.supplier_name}
                      onChange={handleChange}
                      placeholder="Ex: JLG Industries Brasil Ltda"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">CNPJ do Fornecedor</label>
                    <input
                      type="text"
                      name="supplier_cnpj"
                      value={formData.supplier_cnpj}
                      onChange={handleChange}
                      placeholder="00.000.000/0000-00"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">NCM</label>
                    <input
                      type="text"
                      name="ncm"
                      value={formData.ncm}
                      onChange={handleChange}
                      placeholder="Ex: 84289090"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">CST / CSOSN</label>
                    <input
                      type="text"
                      name="cst"
                      value={formData.cst}
                      onChange={handleChange}
                      placeholder="Ex: 0102"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">CFOP</label>
                    <input
                      type="text"
                      name="cfop"
                      value={formData.cfop}
                      onChange={handleChange}
                      placeholder="Ex: 5102"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Observações Gerais */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-500 text-xl">notes</span>
                  Observações e Informações Adicionais
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Notas e Condições</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Informações adicionais sobre o equipamento, condição de conservação, acessórios inclusos..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm resize-none"
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/equipamentos')}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-xs uppercase tracking-widest"
                >
                  Descartar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-mustard-500 text-white rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-mustard-600 transition-all shadow-lg shadow-mustard-500/20 flex items-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">save</span>
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      </form>
    </motion.div>
  );
};

export default EquipmentEdit;
