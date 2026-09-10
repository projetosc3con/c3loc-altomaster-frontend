import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { supabase } from '../../lib/supabase';
import api from '../../services/api';
import { CHECKLIST_ITEMS_CONFIG, ReturnChecklistDocument, type ReturnPhotoItem } from './ReturnChecklistDocument';
import type { RentalInvoice, RentalInvoiceEquipment } from '../../types';

interface UniqueMachineItem extends RentalInvoiceEquipment {
  uniqueKey: string;
}

interface MachineInspectionState {
  hourMeter: string;
  notes: string;
  photos: Record<number, { file?: File; previewUrl: string; storageUrl?: string }>;
}

interface ReturnChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  rental: RentalInvoice | any;
  equipmentItems: (RentalInvoiceEquipment & { tempId?: string })[];
  inspectorName?: string;
  onSuccess: () => Promise<void>;
}

export const ReturnChecklistModal: React.FC<ReturnChecklistModalProps> = ({
  isOpen,
  onClose,
  rental,
  equipmentItems,
  inspectorName = 'Altomaster Operações',
  onSuccess,
}) => {
  // Deduplicação estrita de máquinas:
  // Se a locação tiver a mesma máquina repetida 2 ou mais vezes (prorrogações/faturas),
  // apenas 1 checklist deve ser preenchido para essa máquina física única.
  const uniqueMachines = useMemo<UniqueMachineItem[]>(() => {
    const map = new Map<string, UniqueMachineItem>();
    equipmentItems.forEach((item) => {
      const key = item.equipment_id || item.asset_number || (item as any).tempId || 'unknown';
      if (key && !map.has(key)) {
        map.set(key, {
          ...item,
          uniqueKey: key,
        });
      }
    });
    return Array.from(map.values());
  }, [equipmentItems]);

  const [activeTabKey, setActiveTabKey] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [inspectionData, setInspectionData] = useState<Record<string, MachineInspectionState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Inicializa a aba ativa quando a lista de máquinas mudar ou o modal abrir
  React.useEffect(() => {
    if (uniqueMachines.length > 0 && (!activeTabKey || !uniqueMachines.some(m => m.uniqueKey === activeTabKey))) {
      setActiveTabKey(uniqueMachines[0].uniqueKey);
    }
  }, [uniqueMachines, activeTabKey]);

  // Obter ou inicializar o estado da máquina ativa
  const currentMachine = uniqueMachines.find((m) => m.uniqueKey === activeTabKey) || uniqueMachines[0];
  const currentMachineState = currentMachine
    ? inspectionData[currentMachine.uniqueKey] || { hourMeter: '', notes: '', photos: {} }
    : { hourMeter: '', notes: '', photos: {} };

  const handleHourMeterChange = (val: string) => {
    if (!currentMachine) return;
    setInspectionData((prev) => ({
      ...prev,
      [currentMachine.uniqueKey]: {
        ...(prev[currentMachine.uniqueKey] || { hourMeter: '', notes: '', photos: {} }),
        hourMeter: val,
      },
    }));
  };

  const handleNotesChange = (val: string) => {
    if (!currentMachine) return;
    setInspectionData((prev) => ({
      ...prev,
      [currentMachine.uniqueKey]: {
        ...(prev[currentMachine.uniqueKey] || { hourMeter: '', notes: '', photos: {} }),
        notes: val,
      },
    }));
  };

  const handlePhotoSelect = (position: number, file: File) => {
    if (!currentMachine) return;
    const previewUrl = URL.createObjectURL(file);

    setInspectionData((prev) => {
      const current = prev[currentMachine.uniqueKey] || { hourMeter: '', notes: '', photos: {} };
      return {
        ...prev,
        [currentMachine.uniqueKey]: {
          ...current,
          photos: {
            ...current.photos,
            [position]: {
              file,
              previewUrl,
            },
          },
        },
      };
    });
  };

  const handlePhotoDelete = (position: number) => {
    if (!currentMachine) return;
    setInspectionData((prev) => {
      const current = prev[currentMachine.uniqueKey] || { hourMeter: '', notes: '', photos: {} };
      const updatedPhotos = { ...current.photos };
      delete updatedPhotos[position];
      return {
        ...prev,
        [currentMachine.uniqueKey]: {
          ...current,
          photos: updatedPhotos,
        },
      };
    });
  };

  // Helper para contar quantas fotos uma máquina já possui
  const getMachinePhotosCount = (machineKey: string) => {
    const photos = inspectionData[machineKey]?.photos || {};
    return Object.keys(photos).length;
  };

  // Pré-visualizar PDF da máquina atual
  const handlePreviewCurrentPdf = async () => {
    if (!currentMachine) return;
    try {
      const photosList: ReturnPhotoItem[] = CHECKLIST_ITEMS_CONFIG.map((item) => {
        const p = currentMachineState.photos[item.position];
        return {
          position: item.position,
          label: item.label,
          previewUrl: p?.previewUrl,
          file_url: p?.storageUrl,
        };
      });

      const blob = await pdf(
        <ReturnChecklistDocument
          invoiceNumber={rental?.invoice_number}
          returnDate={new Date().toLocaleDateString('pt-BR')}
          clientName={rental?.client_name}
          workSite={rental?.work_site}
          equipmentName={currentMachine.equipment_name}
          equipmentType={currentMachine.equipment_type}
          assetNumber={currentMachine.asset_number}
          serialNumber={currentMachine.serial_number}
          hourMeter={currentMachineState.hourMeter}
          inspectorName={inspectorName}
          notes={currentMachineState.notes}
          photos={photosList}
        />
      ).toBlob();

      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Erro ao gerar prévia do PDF:', err);
      alert('Erro ao gerar pré-visualização do PDF.');
    }
  };

  // Salvar e Finalizar Retorno de toda a Locação
  const handleFinishReturn = async () => {
    if (uniqueMachines.length === 0) return;

    // Verificar se todas as máquinas têm fotos
    const incompleteMachines = uniqueMachines.filter(
      (m) => getMachinePhotosCount(m.uniqueKey) < CHECKLIST_ITEMS_CONFIG.length
    );

    if (incompleteMachines.length > 0) {
      const confirmIncomplete = window.confirm(
        `Atenção: ${incompleteMachines.length} máquina(s) não possuem todas as 22 fotos preenchidas.\nDeseja concluir o retorno mesmo com o checklist parcial?`
      );
      if (!confirmIncomplete) return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const generatedPdfUrls: string[] = [];
      const todayStr = new Date().toISOString().split('T')[0];
      const todayFormatted = new Date().toLocaleDateString('pt-BR');

      // 1. Processar cada máquina física única
      for (let i = 0; i < uniqueMachines.length; i++) {
        const machine = uniqueMachines[i];
        const state = inspectionData[machine.uniqueKey] || { hourMeter: '', notes: '', photos: {} };

        setSubmitProgress(`Processando fotos da máquina ${i + 1}/${uniqueMachines.length}: ${machine.equipment_name || 'Equipamento'}...`);

        // Upload das fotos desta máquina para o bucket 'client-documents'
        const uploadedPhotosList: ReturnPhotoItem[] = [];

        for (const item of CHECKLIST_ITEMS_CONFIG) {
          const photoData = state.photos[item.position];
          let fileUrl = photoData?.storageUrl || '';

          if (photoData?.file) {
            const ext = photoData.file.name.split('.').pop() || 'jpg';
            const cleanAsset = (machine.asset_number || 'EQ').replace(/[^a-zA-Z0-9_-]/g, '_');
            const filePath = `return-checklists/${rental.id}/${cleanAsset}/pos_${item.position}_${Date.now()}.${ext}`;

            const { error: uploadErr } = await supabase.storage
              .from('client-documents')
              .upload(filePath, photoData.file, { upsert: true });

            if (uploadErr) {
              console.warn(`Erro ao fazer upload da foto ${item.position}:`, uploadErr);
              // Fallback para previewUrl se o upload falhar
              fileUrl = photoData.previewUrl;
            } else {
              const { data: urlData } = supabase.storage
                .from('client-documents')
                .getPublicUrl(filePath);
              fileUrl = urlData.publicUrl;
            }
          }

          uploadedPhotosList.push({
            position: item.position,
            label: item.label,
            file_url: fileUrl,
            previewUrl: photoData?.previewUrl,
          });
        }

        setSubmitProgress(`Gerando PDF do checklist da máquina ${i + 1}/${uniqueMachines.length}...`);

        // Gerar o documento PDF desta máquina
        const pdfBlob = await pdf(
          <ReturnChecklistDocument
            invoiceNumber={rental?.invoice_number}
            returnDate={todayFormatted}
            clientName={rental?.client_name}
            workSite={rental?.work_site}
            equipmentName={machine.equipment_name}
            equipmentType={machine.equipment_type}
            assetNumber={machine.asset_number}
            serialNumber={machine.serial_number}
            hourMeter={state.hourMeter}
            inspectorName={inspectorName}
            notes={state.notes}
            photos={uploadedPhotosList}
          />
        ).toBlob();

        // Fazer upload do PDF gerado no storage
        const cleanAsset = (machine.asset_number || `EQ${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const pdfFileName = `Checklist_Retorno_${cleanAsset}_${Date.now()}.pdf`;
        const pdfFilePath = `return-checklists/${rental.id}/${pdfFileName}`;

        const { error: pdfUploadErr } = await supabase.storage
          .from('client-documents')
          .upload(pdfFilePath, pdfBlob, { contentType: 'application/pdf', upsert: true });

        if (pdfUploadErr) {
          throw new Error(`Falha no upload do PDF do checklist: ${pdfUploadErr.message}`);
        }

        const { data: pdfUrlData } = supabase.storage
          .from('client-documents')
          .getPublicUrl(pdfFilePath);

        if (pdfUrlData?.publicUrl) {
          generatedPdfUrls.push(pdfUrlData.publicUrl);
        }
      }

      setSubmitProgress('Atualizando registro da locação e data de retorno...');

      // 2. Atualizar rental_invoices no backend
      // Unir URLs existentes com as novas geradas
      const existingUrls: string[] = Array.isArray(rental?.return_checklist_urls) ? rental.return_checklist_urls : [];
      const updatedChecklistUrls = Array.from(new Set([...existingUrls, ...generatedPdfUrls]));

      // Atualizar também o return_date de todos os equipamentos da locação
      const updatedEquipments = equipmentItems.map((item) => ({
        ...item,
        return_date: todayStr,
      }));

      const payload = {
        ...rental,
        return_date: todayStr,
        return_checklist_urls: updatedChecklistUrls,
        equipments: updatedEquipments,
      };

      await api.put(`/rentals/${rental.id}`, payload);

      setSubmitProgress('Retorno concluído com sucesso!');
      await onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao concluir checklist de retorno:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao concluir retorno da locação.');
    } finally {
      setSubmitting(false);
      setSubmitProgress('');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-2xl">checklist_rtl</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
                    Checklist de Retorno de Equipamentos
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    Devolução
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Fatura #{rental?.invoice_number || rental?.id?.slice(0, 8)} • Cliente: <strong className="text-slate-700 dark:text-slate-200">{rental?.client_name || 'N/A'}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Machine Tabs (Deduplicadas - exatamente 1 por máquina física) */}
          <div className="px-5 sm:px-6 pt-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Máquinas Presentes na Locação ({uniqueMachines.length} máquina{uniqueMachines.length > 1 ? 's' : ''})
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                * 1 checklist fotográfico por máquina física única
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
              {uniqueMachines.map((machine, idx) => {
                const isActive = machine.uniqueKey === currentMachine?.uniqueKey;
                const photosCount = getMachinePhotosCount(machine.uniqueKey);
                const isComplete = photosCount === CHECKLIST_ITEMS_CONFIG.length;

                return (
                  <button
                    key={machine.uniqueKey}
                    type="button"
                    onClick={() => setActiveTabKey(machine.uniqueKey)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                      isActive
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg shadow-slate-950/10'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {machine.equipment_type?.toLowerCase().includes('lança') ? 'precision_manufacturing' : 'construction'}
                    </span>
                    <div className="text-left">
                      <div className="font-bold">
                        {machine.equipment_name || `Máquina ${idx + 1}`}
                      </div>
                      <div className="text-[10px] opacity-75 font-mono">
                        Pat: {machine.asset_number || 'S/N'}
                      </div>
                    </div>
                    <span
                      className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isComplete
                          ? 'bg-emerald-500 text-white'
                          : isActive
                          ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {photosCount}/{CHECKLIST_ITEMS_CONFIG.length} {isComplete ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Machine Checklist Details & Photos Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl text-red-700 dark:text-red-400 text-xs flex items-center gap-3">
                <span className="material-symbols-outlined text-lg">error</span>
                <span>{error}</span>
              </div>
            )}

            {currentMachine && (
              <>
                {/* Info & General Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Equipamento Selecionado
                    </label>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">
                      {currentMachine.equipment_name || 'Equipamento'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Patrimônio: <strong className="font-mono text-slate-700 dark:text-slate-300">{currentMachine.asset_number || 'S/N'}</strong> • Série: <strong className="font-mono text-slate-700 dark:text-slate-300">{currentMachine.serial_number || 'S/N'}</strong>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-emerald-500">speed</span>
                      Horímetro de Retorno
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={currentMachineState.hourMeter}
                      onChange={(e) => handleHourMeterChange(e.target.value)}
                      placeholder="Ex: 245.5"
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-emerald-500 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-amber-500">report_problem</span>
                      Observações / Avarias de Devolução
                    </label>
                    <input
                      type="text"
                      value={currentMachineState.notes}
                      onChange={(e) => handleNotesChange(e.target.value)}
                      placeholder="Ex: Sem avarias, entregue limpo e carregado."
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-emerald-500 dark:text-white"
                    />
                  </div>
                </div>

                {/* Toolbar: Progress, View Mode & Preview PDF */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        Conferência das 22 Posições
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {getMachinePhotosCount(currentMachine.uniqueKey)} de {CHECKLIST_ITEMS_CONFIG.length} preenchidas
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handlePreviewCurrentPdf}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-bold transition-all flex items-center gap-1.5 bg-white dark:bg-slate-800 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm text-emerald-500">visibility</span>
                      Visualizar PDF desta Máquina
                    </button>
                  </div>

                  {/* Toggle Grid / List */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                        viewMode === 'grid'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                      title="Visualização em Grade"
                    >
                      <span className="material-symbols-outlined text-sm">grid_view</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                        viewMode === 'list'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                      title="Visualização em Lista"
                    >
                      <span className="material-symbols-outlined text-sm">view_list</span>
                    </button>
                  </div>
                </div>

                {/* Checklist Photos: Grid View */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {CHECKLIST_ITEMS_CONFIG.map((item) => {
                      const photo = currentMachineState.photos[item.position];

                      return (
                        <div
                          key={item.position}
                          className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Item {item.position}
                              </span>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                                {item.label}
                              </h4>
                            </div>
                            <div>
                              {photo ? (
                                <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-100/50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                  <span className="material-symbols-outlined text-[12px]">check</span>
                                  OK
                                </span>
                              ) : (
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                  Pendente
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Image preview or placeholder */}
                          <div className="relative aspect-video w-full bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200/60 dark:border-slate-700/40 mb-3 group">
                            {photo ? (
                              <>
                                <img
                                  src={photo.previewUrl}
                                  alt={item.label}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => handlePhotoDelete(item.position)}
                                  className="absolute top-2 right-2 w-7 h-7 bg-red-500/90 hover:bg-red-600 text-white rounded-lg flex items-center justify-center transition-colors shadow-lg"
                                  title="Remover foto"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-600">
                                <span className="material-symbols-outlined text-2xl">photo_camera</span>
                                <span className="text-[10px]">Sem foto</span>
                              </div>
                            )}
                          </div>

                          {/* Upload buttons */}
                          <div className="flex gap-1.5">
                            <label className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer transition-all flex items-center justify-center gap-1 shadow-sm">
                              <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                              Câmera
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handlePhotoSelect(item.position, file);
                                }}
                              />
                            </label>
                            <label className="py-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer transition-all flex items-center justify-center">
                              <span className="material-symbols-outlined text-[14px]">file_upload</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handlePhotoSelect(item.position, file);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Checklist Photos: List View */
                  <div className="space-y-2">
                    {CHECKLIST_ITEMS_CONFIG.map((item) => {
                      const photo = currentMachineState.photos[item.position];

                      return (
                        <div
                          key={item.position}
                          className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 font-bold text-xs flex items-center justify-center text-slate-700 dark:text-slate-200 font-mono">
                              {item.position}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-white">
                                {item.label}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {photo ? 'Foto anexada' : 'Aguardando registro fotográfico'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {photo && (
                              <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0">
                                <img
                                  src={photo.previewUrl}
                                  alt={item.label}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => handlePhotoDelete(item.position)}
                                  className="absolute inset-0 bg-red-600/80 text-white opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                                  title="Remover"
                                >
                                  <span className="material-symbols-outlined text-[14px]">delete</span>
                                </button>
                              </div>
                            )}

                            <label className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer transition-all flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                              Câmera
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handlePhotoSelect(item.position, file);
                                }}
                              />
                            </label>
                            <label className="py-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer transition-all flex items-center justify-center">
                              <span className="material-symbols-outlined text-[14px]">file_upload</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handlePhotoSelect(item.position, file);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-5 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-lg">calendar_today</span>
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Data do Retorno: <strong className="text-slate-900 dark:text-white">{new Date().toLocaleDateString('pt-BR')}</strong> (Hoje)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleFinishReturn}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{submitProgress || 'Salvando...'}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">task_alt</span>
                    <span>Concluir Retorno da Locação</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
