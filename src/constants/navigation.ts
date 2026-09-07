export interface NavSubItem {
  name: string;
  path: string;
  icon?: string;
  allowedRoles?: string[];
}

export interface NavItem {
  name: string;
  path: string;
  icon: string;
  allowedRoles?: string[];
  accordionRoles?: string[];
  children?: NavSubItem[];
}

export const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: 'dashboard',
    allowedRoles: ['Administrador', 'Diretoria', 'Gerente', 'Comercial', 'Manutenção', 'Recursos Humanos', 'Logística'],
  },
  {
    name: 'Locações',
    path: '/locacoes',
    icon: 'contract',
    allowedRoles: ['Administrador', 'Diretoria', 'Gerente'],
  },
  {
    name: 'CRM',
    path: '/crm',
    icon: 'monitoring',
    allowedRoles: ['Administrador', 'Diretoria', 'Gerente'],
    accordionRoles: ['Administrador', 'Diretoria', 'Gerente'],
    children: [
      { name: 'Negociações', path: '/crm/pipeline', icon: 'view_kanban' },
      { name: 'Leads', path: '/crm/leads', icon: 'person_search' },
      { name: 'Contatos', path: '/crm/contatos', icon: 'contacts' },
      { name: 'Tarefas', path: '/crm/tarefas', icon: 'task_alt' },
      { name: 'Configurações', path: '/crm/configuracoes', icon: 'tune' },
    ],
  },

  // Sub-rotas do CRM como itens principais apenas para o Comercial
  { name: 'Pipeline', path: '/crm/pipeline', icon: 'view_kanban', allowedRoles: ['Comercial'] },
  { name: 'Leads', path: '/crm/leads', icon: 'person_search', allowedRoles: ['Comercial'] },
  { name: 'Contatos', path: '/crm/contatos', icon: 'contacts', allowedRoles: ['Comercial'] },
  { name: 'Tarefas', path: '/crm/tarefas', icon: 'task_alt', allowedRoles: ['Comercial'] },

  {
    name: 'Clientes',
    path: '/clientes',
    icon: 'groups',
    allowedRoles: ['Administrador', 'Diretoria', 'Gerente', 'Comercial'],
  },
  {
    name: 'Logística',
    path: '/logistica',
    icon: 'local_shipping',
    allowedRoles: ['Administrador', 'Diretoria', 'Gerente', 'Logística'],
  },
  {
    name: 'Equipamentos',
    path: '/equipamentos',
    icon: 'precision_manufacturing',
    allowedRoles: ['Administrador', 'Diretoria', 'Gerente'],
  },
  {
    name: 'Materiais',
    path: '/materiais',
    icon: 'inventory_2',
    allowedRoles: ['Administrador', 'Diretoria', 'Gerente', 'Manutenção'],
  },
  {
    name: 'Manutenção',
    path: '/manutencoes',
    icon: 'build',
    allowedRoles: ['Administrador', 'Diretoria', 'Gerente', 'Manutenção'],
  },
  {
    name: 'Financeiro',
    path: '/financeiro',
    icon: 'attach_money',
    allowedRoles: ['Administrador', 'Diretoria', 'Gerente'],
    accordionRoles: ['Administrador', 'Diretoria', 'Gerente'],
    children: [
      { name: 'Contas a pagar', path: '/financeiro/pagar', icon: 'trending_down' },
      { name: 'Contas a receber', path: '/financeiro/receber', icon: 'trending_up' },
      { name: 'Conciliação bancária', path: '/financeiro/conciliacao', icon: 'sync_alt' },
      { name: 'Consultar Score', path: '/financeiro/score', icon: 'credit_score' },
    ],
  },
  {
    name: 'Recursos Humanos',
    path: '/rh',
    icon: 'badge',
    allowedRoles: ['Administrador', 'Diretoria', 'Gerente', 'Recursos Humanos'],
    accordionRoles: ['Administrador', 'Diretoria', 'Gerente'],
    children: [
      { name: 'Cargos e salários', path: '/rh/cargos', icon: 'account_tree' },
      { name: 'Documentação', path: '/rh/documentacao', icon: 'description' },
      { name: 'Integrações', path: '/rh/integracoes', icon: 'verified_user' },
      { name: 'Treinamentos', path: '/rh/treinamentos', icon: 'school' },
    ],
  },
  {
    name: 'Usuários',
    path: '/usuarios',
    icon: 'manage_accounts',
    allowedRoles: ['Administrador', 'Diretoria', 'Gerente'],
  },
];