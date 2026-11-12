import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { crmService, type CRMLeadSource } from '../../services/crm';
import { useAuth } from '../../contexts/AuthContext';

const maskCnpj = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
};

const formatCurrency = (value: string) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const number = (parseInt(digits, 10) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return number;
};

const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1')
    .slice(0, 15);
};

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ContactEntry {
  full_name: string;
  role_title: string;
  department: string;
  email: string;
  phone: string;
  is_primary: boolean;
}

const NewLeadModal: React.FC<NewLeadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'contacts'>('info');
  const [formError, setFormError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    company_name: '',
    cnpj: '',
    segment: '',
    estimated_potential: '',
    source: 'Indicação' as CRMLeadSource,
    owner_id: '',
    notes: ''
  });

  const [contacts, setContacts] = useState<ContactEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          const res = await api.get('/users');
          setUsers(res.data);
          
          // Lógica de pré-seleção do responsável
          if (profile?.access_level === 'Comercial') {
            setFormData(prev => ({ ...prev, owner_id: profile.id }));
          } else if (res.data.length > 0) {
            setFormData(prev => ({ ...prev, owner_id: res.data[0].id }));
          }
        } catch (err) {
          console.error('Erro ao buscar usuários:', err);
        }
      };
      fetchUsers();
    }
  }, [isOpen, profile]);

  const handleCnpjChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCnpj(e.target.value);
    setFormData(prev => ({ ...prev, cnpj: masked }));
    setFormError(null);

    const unmasked = masked.replace(/\D/g, '');
    if (unmasked.length === 14) {
      try {
        // Verificar duplicidade no backend primeiro
        const checkResult = await crmService.checkCnpj(unmasked);
        if (checkResult.exists) {
          setFormError(`Atenção: Já existe um ${checkResult.type === 'lead' ? 'Lead' : 'Cliente'} cadastrado com este CNPJ (${checkResult.name}).`);
          setFormData(prev => ({ ...prev, cnpj: '', company_name: '' }));
          return;
        }

        let company_name = '';
        let phone = '';
        let email = '';

        try {
          const { data } = await api.get(`/clients/lookup-cnpj/${unmasked}`);
          if (data && data.valid) {
            company_name = data.company_name || '';
            phone = data.phone || '';
            email = data.email || '';
          }
        } catch {
          // fallback direto se backend falhar
          try {
            const response = await fetch(`https://api.opencnpj.org/${unmasked}`);
            if (response.ok) {
              const data = await response.json();
              company_name = data.razao_scoial || data.razao_social || '';
              const tel = data.telefones?.[0];
              phone = tel ? `(${tel.ddd}) ${tel.numero}` : '';
              email = data.email || '';
            }
          } catch {
            // Silently fail
          }
        }

        setFormData(prev => ({
          ...prev,
          company_name: company_name || prev.company_name
        }));

        if (email || phone) {
          setContacts(prev => [
            ...prev,
            {
              full_name: company_name || 'Contato Principal',
              role_title: 'Administrativo',
              department: 'Geral',
              email: email,
              phone: phone,
              is_primary: prev.length === 0
            }
          ]);
          setActiveTab('contacts');
        }
      } catch (err) {
        // Silently fail
      }
    }
  };

  const handleAddContact = () => {
    setContacts(prev => [
      ...prev,
      {
        full_name: '',
        role_title: '',
        department: '',
        email: '',
        phone: '',
        is_primary: prev.length === 0 // Primeiro contato é primário por padrão
      }
    ]);
    setActiveTab('contacts');
    setFormError(null);
  };

  const handleRemoveContact = (index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index));
  };

  const handleContactChange = (index: number, field: keyof ContactEntry, value: any) => {
    setContacts(prev => prev.map((c, i) => {
      if (i !== index) {
        // Se estiver definindo um como primário, remove dos outros
        if (field === 'is_primary' && value === true) return { ...c, is_primary: false };
        return c;
      }
      return { ...c, [field]: value };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar se há ao menos um contato
    const validContacts = contacts.filter(c => c.full_name.trim() !== '');
    if (validContacts.length === 0) {
      setActiveTab('contacts');
      setFormError('É necessário adicionar ao menos um contato para cadastrar o lead.');
      return;
    }

    setLoading(true);
    try {
      const numericPotential = formData.estimated_potential 
        ? parseFloat(formData.estimated_potential.replace(/\./g, '').replace(',', '.')) 
        : 0;

      await crmService.createLead({
        ...formData,
        estimated_potential: numericPotential,
        contacts: validContacts
      });
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        company_name: '',
        cnpj: '',
        segment: '',
        estimated_potential: '',
        source: 'Indicação' as CRMLeadSource,
        owner_id: profile?.access_level === 'Comercial' ? profile.id : (users.length > 0 ? users[0].id : ''),
        notes: ''
      });
      setContacts([]);
      setActiveTab('info');
    } catch (err) {
      console.error('Erro ao criar lead:', err);
      setFormError('Erro ao criar lead. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-mustard-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-mustard-500/20">
                    <span className="material-symbols-outlined text-2xl">person_add</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Novo Lead</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Cadastre uma nova oportunidade e seus contatos.</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-400"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'info' ? 'bg-white dark:bg-slate-700 text-mustard-600 dark:text-mustard-400 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Informações Básicas
                </button>
                <button
                  onClick={() => setActiveTab('contacts')}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${activeTab === 'contacts' ? 'bg-white dark:bg-slate-700 text-mustard-600 dark:text-mustard-400 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Contatos
                  {contacts.length > 0 && (
                    <span className="bg-mustard-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{contacts.length}</span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <form id="new-lead-form" onSubmit={handleSubmit} className="p-8">
                {activeTab === 'info' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Nome da Empresa */}
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                        Nome da Empresa / Lead *
                      </label>
                      <input
                        required
                        type="text"
                        value={formData.company_name}
                        onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 transition-all dark:text-white"
                        placeholder="Ex: Indústrias Alfa S.A."
                      />
                    </div>

                    {/* CNPJ */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                        CNPJ
                      </label>
                      <input
                        type="text"
                        value={formData.cnpj}
                        onChange={handleCnpjChange}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 transition-all dark:text-white"
                        placeholder="00.000.000/0000-00"
                      />
                    </div>

                    {/* Segmento */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                        Segmento
                      </label>
                      <select
                        value={formData.segment}
                        onChange={e => setFormData({ ...formData, segment: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 transition-all dark:text-white appearance-none"
                      >
                        <option value="">Selecione...</option>
                        <option value="Construção Civil">Construção Civil</option>
                        <option value="Siderurgia">Siderurgia</option>
                        <option value="Mineração">Mineração</option>
                        <option value="Petroquímica">Petroquímica</option>
                        <option value="Logística">Logística</option>
                        <option value="Distribuição">Distribuição</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>

                    {/* Potencial Estimado */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                        Potencial Estimado (Anual)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                        <input
                          type="text"
                          value={formData.estimated_potential}
                          onChange={e => setFormData({ ...formData, estimated_potential: formatCurrency(e.target.value) })}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 transition-all dark:text-white"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    {/* Origem */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                        Origem do Lead
                      </label>
                      <select
                        value={formData.source}
                        onChange={e => setFormData({ ...formData, source: e.target.value as CRMLeadSource })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 transition-all dark:text-white appearance-none"
                      >
                        <option value="Indicação">Indicação</option>
                        <option value="Site">Site</option>
                        <option value="Evento">Evento</option>
                        <option value="Cold Call">Cold Call</option>
                        <option value="Rede Social">Rede Social</option>
                        <option value="Parceiro">Parceiro</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>

                    {/* Responsável (Owner) */}
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                        Responsável *
                      </label>
                      <select
                        required
                        disabled={profile?.access_level === 'Comercial'}
                        value={formData.owner_id}
                        onChange={e => setFormData({ ...formData, owner_id: e.target.value })}
                        className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 transition-all dark:text-white appearance-none ${profile?.access_level === 'Comercial' ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Observações */}
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                        Observações
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-mustard-500/20 focus:border-mustard-500 transition-all dark:text-white min-h-[100px]"
                        placeholder="Informações relevantes sobre a prospecção..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contatos Vinculados ({contacts.length})</h4>
                      <button
                        type="button"
                        onClick={handleAddContact}
                        className="flex items-center gap-2 px-4 py-2 bg-mustard-50 dark:bg-mustard-500/10 text-mustard-600 dark:text-mustard-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-mustard-100 transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Adicionar Contato
                      </button>
                    </div>

                    {contacts.length === 0 ? (
                      <div className="p-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300">
                          <span className="material-symbols-outlined text-4xl">contact_phone</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-400">Nenhum contato adicionado</p>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Adicione pessoas para facilitar o follow-up.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {contacts.map((contact, index) => (
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            key={index}
                            className={`p-6 rounded-3xl border transition-all relative ${contact.is_primary ? 'bg-mustard-50/30 border-mustard-200 dark:bg-mustard-500/5 dark:border-mustard-500/20' : 'bg-slate-50/50 border-slate-100 dark:bg-slate-800/30 dark:border-slate-800'}`}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo *</label>
                                <input
                                  required
                                  type="text"
                                  value={contact.full_name}
                                  onChange={e => handleContactChange(index, 'full_name', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                  placeholder="Nome do contato"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo</label>
                                <input
                                  type="text"
                                  value={contact.role_title}
                                  onChange={e => handleContactChange(index, 'role_title', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                  placeholder="Ex: Comprador"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Departamento</label>
                                <input
                                  type="text"
                                  value={contact.department}
                                  onChange={e => handleContactChange(index, 'department', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                  placeholder="Ex: Suprimentos"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                                <input
                                  type="email"
                                  value={contact.email}
                                  onChange={e => handleContactChange(index, 'email', e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                  placeholder="contato@empresa.com"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                                <input
                                  type="text"
                                  value={contact.phone}
                                  onChange={e => handleContactChange(index, 'phone', maskPhone(e.target.value))}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                                  placeholder="(00) 00000-0000"
                                />
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-4">
                              <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={contact.is_primary}
                                  onChange={e => handleContactChange(index, 'is_primary', e.target.checked)}
                                  className="hidden"
                                />
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${contact.is_primary ? 'bg-mustard-500 border-mustard-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                  {contact.is_primary && <span className="material-symbols-outlined text-white text-[16px]">check</span>}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${contact.is_primary ? 'text-mustard-600 dark:text-mustard-400' : 'text-slate-400 group-hover:text-slate-600'}`}>Contato Principal</span>
                              </label>

                              <button
                                type="button"
                                onClick={() => handleRemoveContact(index)}
                                className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest flex items-center gap-1 transition-colors"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                                Remover
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              {formError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest">{formError}</p>
                </div>
              )}
              {contacts.length === 0 && !formError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest">É obrigatório adicionar ao menos um contato.</p>
                </div>
              )}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-widest text-xs rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="new-lead-form"
                  disabled={loading}
                  className={`flex-[2] py-4 font-bold uppercase tracking-widest text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${contacts.length === 0 ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed shadow-none' : 'bg-mustard-500 hover:bg-mustard-600 text-white shadow-mustard-500/20'}`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">check</span>
                      Salvar Lead e Contatos
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NewLeadModal;
