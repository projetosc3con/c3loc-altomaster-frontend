import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import api from '../../services/api';
import type { EquipmentDocument } from '../../types';

interface EquipmentDocumentsTabProps {
  equipmentId: string;
  assetNumber: string;
}

export const EquipmentDocumentsTab: React.FC<EquipmentDocumentsTabProps> = ({
  equipmentId,
  assetNumber,
}) => {
  const [documents, setDocuments] = useState<EquipmentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Formulário de Novo Documento
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal / Edição de Nome
  const [editingDoc, setEditingDoc] = useState<EquipmentDocument | null>(null);
  const [editName, setEditName] = useState('');
  const [updating, setUpdating] = useState(false);

  // Modal / Exclusão
  const [deletingDoc, setDeletingDoc] = useState<EquipmentDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get(`/equipments/${equipmentId}/documents`);
      setDocuments(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar documentos:', err);
      setError('Não foi possível carregar a lista de documentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (equipmentId) {
      fetchDocuments();
    }
  }, [equipmentId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    if (!docName.trim()) {
      // Preenche o nome padrão sem a extensão
      const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, '');
      setDocName(nameWithoutExt);
    }
    setUploadError(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Por favor, selecione um arquivo para upload.');
      return;
    }
    if (!docName.trim()) {
      setUploadError('Por favor, informe um nome para o documento.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      // Pasta com o nome do patrimônio no bucket 'equipments'
      const cleanAsset = (assetNumber || `eq_${equipmentId}`).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${cleanAsset}/${Date.now()}_${cleanFileName}`;

      // Upload no Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('equipments')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || 'application/octet-stream',
        });

      if (storageError) throw storageError;

      // URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('equipments')
        .getPublicUrl(filePath);

      // Salvar registro na tabela equipment_documents
      await api.post(`/equipments/${equipmentId}/documents`, {
        document_name: docName.trim(),
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
      });

      // Fechar modal e resetar
      setIsUploadModalOpen(false);
      setDocName('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Atualizar listagem
      await fetchDocuments();
    } catch (err: any) {
      console.error('Erro ao fazer upload do documento:', err);
      setUploadError(err.response?.data?.error || err.message || 'Erro ao realizar upload do documento.');
    } finally {
      setUploading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc || !editName.trim()) return;

    try {
      setUpdating(true);
      await api.put(`/equipments/documents/${editingDoc.id}`, {
        document_name: editName.trim(),
      });
      setEditingDoc(null);
      await fetchDocuments();
    } catch (err: any) {
      console.error('Erro ao renomear documento:', err);
      alert('Erro ao renomear documento: ' + (err.response?.data?.error || err.message));
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDoc) return;

    try {
      setDeleting(true);
      await api.delete(`/equipments/documents/${deletingDoc.id}`);
      setDeletingDoc(null);
      await fetchDocuments();
    } catch (err: any) {
      console.error('Erro ao excluir documento:', err);
      alert('Erro ao excluir documento: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeleting(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName?: string | null, fileUrl?: string) => {
    const ext = (fileName || fileUrl || '').split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return { icon: 'picture_as_pdf', color: 'text-red-500 bg-red-50 dark:bg-red-950/40' };
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
        return { icon: 'image', color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40' };
      case 'doc':
      case 'docx':
        return { icon: 'description', color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/40' };
      case 'xls':
      case 'xlsx':
      case 'csv':
        return { icon: 'table_chart', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' };
      default:
        return { icon: 'attach_file', color: 'text-slate-500 bg-slate-100 dark:bg-slate-800' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Aba */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-mustard-500 text-2xl">folder_open</span>
            Documentação da Máquina
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Anexe manuais, laudos ART, termos, notas fiscais e certificados. Os arquivos são salvos na pasta{' '}
            <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-mustard-600 dark:text-mustard-400">
              {assetNumber || 'equipamento'}
            </code>
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setDocName('');
            setFile(null);
            setUploadError(null);
            setIsUploadModalOpen(true);
          }}
          className="px-4 py-2.5 bg-mustard-500 hover:bg-mustard-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-md shadow-mustard-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-base">upload_file</span>
          Adicionar Documento
        </button>
      </div>

      {/* Mensagem de Erro Geral */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-2xl text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Lista de Documentos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 border-4 border-mustard-500/20 border-t-mustard-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-xs font-medium mt-3">Carregando documentos...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-4">
            <span className="material-symbols-outlined text-3xl">description</span>
          </div>
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Nenhum documento anexado</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
            Adicione laudos técnicos, ART, manuais ou certificados de calibração para manter o histórico da máquina organizado.
          </p>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="mt-6 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Anexar Primeiro Documento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map(doc => {
            const { icon, color } = getFileIcon(doc.file_name, doc.file_url);
            return (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-mustard-500/40 transition-all flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate" title={doc.document_name}>
                      {doc.document_name}
                    </h4>

                    {doc.file_name && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5" title={doc.file_name}>
                        {doc.file_name} • {formatFileSize(doc.file_size)}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                        {new Date(doc.created_at).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(doc.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {doc.created_by_profile && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">person</span>
                          {doc.created_by_profile.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDoc(doc);
                      setEditName(doc.document_name);
                    }}
                    title="Renomear documento"
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingDoc(doc)}
                    title="Excluir documento"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>

                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-mustard-500 hover:text-white dark:hover:bg-mustard-500 dark:hover:text-white text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    Visualizar
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Adicionar Documento */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-mustard-500">upload_file</span>
                Anexar Novo Documento
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Nome do Documento *
                </label>
                <input
                  type="text"
                  required
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  placeholder="Ex: Manual de Operação, Laudo ART, Certificado"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Arquivo *
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                    file
                      ? 'border-mustard-500 bg-mustard-50/20 dark:bg-mustard-950/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-mustard-500 bg-slate-50 dark:bg-slate-800/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-3 text-slate-800 dark:text-slate-200">
                      <span className="material-symbols-outlined text-mustard-500 text-3xl">task</span>
                      <div className="text-left">
                        <p className="text-sm font-bold truncate max-w-xs">{file.name}</p>
                        <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="material-symbols-outlined text-slate-400 text-4xl mb-1">cloud_upload</span>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Clique para selecionar um arquivo
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        PDF, Imagens, Planilhas ou Documentos até 25MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2.5 bg-mustard-500 hover:bg-mustard-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-mustard-500/20"
                >
                  {uploading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {uploading ? 'Enviando...' : 'Salvar Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Renomear Documento */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Renomear Documento</h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Novo Nome *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-mustard-500/10 focus:border-mustard-500 transition-all outline-none text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 bg-mustard-500 hover:bg-mustard-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                >
                  {updating ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Excluir Documento */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">delete</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Excluir Documento?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Deseja realmente remover <strong>"{deletingDoc.document_name}"</strong>? Esta ação não poderá ser desfeita.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDoc(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest shadow-md shadow-red-600/20 cursor-pointer transition-all flex items-center gap-1.5"
              >
                {deleting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
