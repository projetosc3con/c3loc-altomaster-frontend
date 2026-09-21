import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TicketResponse {
  success: boolean;
  message: string;
  protocol?: string;
  ticket?: {
    id: string;
    protocol: string;
    application_id: string;
    application_name: string;
    requester_name: string;
    requester_contact: string;
    description: string;
    status: string;
    created_at: string;
  };
}

const TICKET_ENDPOINT = 'https://sstxhjglvkyodollfffe.supabase.co/functions/v1/public-ticket';
const APPLICATION_ID = 'daf0e046-3199-4152-9302-424521e74b3e';
const APPLICATION_NAME = 'C3Loc - Altomaster';

export const TicketModal: React.FC<TicketModalProps> = ({ isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<TicketResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setDescription('');
    setErrorMessage(null);
    setResult(null);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCopyProtocol = (protocol?: string) => {
    if (!protocol) return;
    navigator.clipboard.writeText(protocol);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMessage('Por favor, informe a descrição do problema ou solicitação.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const requesterName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
    const requesterContact = user?.email || profile?.email || '';

    try {
      const response = await fetch(TICKET_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requester_name: requesterName,
          requester_contact: requesterContact,
          application_id: APPLICATION_ID,
          application_name: APPLICATION_NAME,
          description: description.trim(),
        }),
      });

      const data: TicketResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Ocorreu um erro ao registrar a solicitação de atendimento.');
      }

      setResult(data);
    } catch (err: any) {
      console.error('Erro ao enviar ticket:', err);
      setErrorMessage(err.message || 'Falha na conexão. Tente novamente mais tarde.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-mustard-500/10 flex items-center justify-center text-mustard-600 dark:text-mustard-400 shrink-0">
                <span className="material-symbols-outlined text-2xl">
                  {result ? 'verified' : 'help'}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {result ? 'Chamado Registrado' : 'Suporte e Atendimento'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {result ? 'Sua solicitação foi enviada com sucesso' : 'Abra um ticket para relatar problemas ou dúvidas'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Fechar"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Body */}
          {result ? (
            <div className="p-6 space-y-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    {result.message}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Nossa equipe de suporte analisará a sua solicitação o mais rápido possível.
                  </p>
                </div>
              </div>

              {result.protocol && (
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Número do Protocolo
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-mustard-600 dark:text-mustard-400">
                      {result.protocol}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyProtocol(result.protocol)}
                      className="p-1.5 text-slate-400 hover:text-mustard-600 dark:hover:text-mustard-400 rounded-md hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors"
                      title="Copiar Protocolo"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {copied ? 'done' : 'content_copy'}
                      </span>
                    </button>
                  </div>
                  {copied && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Protocolo copiado!
                    </span>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full sm:w-auto px-6 py-2.5 bg-mustard-500 hover:bg-mustard-600 active:scale-95 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-mustard-500/20"
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-2.5 text-red-700 dark:text-red-400 text-xs">
                  <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                  <p className="font-medium">{errorMessage}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="ticket-description"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                >
                  Descrição do Problema / Solicitação
                </label>
                <textarea
                  id="ticket-description"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Descreva detalhadamente o que ocorreu, os passos para reproduzir ou o suporte necessário..."
                  className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-mustard-500 focus:ring-1 focus:ring-mustard-500 text-sm bg-slate-50 dark:bg-slate-800 dark:text-white transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60"
                  required
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Solicitante: </span>
                  {profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'}
                </div>
                <div className="font-mono text-slate-400 dark:text-slate-500 truncate max-w-[200px]" title={user?.email || ''}>
                  {user?.email || 'Sem e-mail'}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-mustard-500 hover:bg-mustard-600 active:scale-95 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-mustard-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      <span>Enviar Chamado</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
