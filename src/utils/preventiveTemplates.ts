export type PreventiveType = 'Elétrica' | 'Diesel';
export type MaintenanceCategory = 'OS' | 'PREVENTIVA';

export interface PreventiveChecklistItem {
  id: string;
  area: string;
  description: string;
  quantity: string;
  performed: 'SIM' | 'NAO' | '';
}

export interface PreventiveBatteryReading {
  label: string; // B1 .. B8
  voltage: string;
  voltage_drop: string;
}

export interface PreventiveChecklistData {
  items: PreventiveChecklistItem[];
  batteries: PreventiveBatteryReading[];
  battery_total_voltage: string;
  battery_total_drop: string;
  general_observations: string;
  cost_responsibility: 'ALTO_MASTER' | 'CLIENTE' | '';
}

export interface PreventiveAreaTemplate {
  area: string;
  items: string[];
}

const COMMON_AREAS_PAGE_1: PreventiveAreaTemplate[] = [
  {
    area: 'Conjunto do Cesto da Plataforma',
    items: [
      'Verificar estrutura do cesto',
      'Verificar desgaste ou vazamento no cilindro do JIB',
      'Verificar desgastes nos pinos e travas dos cilindros',
      'Verificar mangueiras hidráulicas e conexões',
      'Verificar chicote elétrico e botões de acionamento de funções',
      'Verificar coifas e proteções dos botões',
      'Verificar trava da porta de segurança',
      'Verificar adesivos de segurança e faixas refletivas',
      'Verificar Adesivos de Marketing Alto Master',
      'Verificar manual do operador, Laudo/ART, porta manual e extintor de incêndio',
      'Verificar pedal habilitador de função',
      'Verificar pontos de ancoragem do cinto de segurança',
      'Fazer teste da descida de emergência pelo cesto',
      'Fazer teste operacional pelo painel de cesto',
    ],
  },
  {
    area: 'Conjunto da Lança',
    items: [
      'Verificar desgastes ou vazamentos nas mangueiras',
      'Verificar desgaste ou vazamento nos cilindros',
      'Verificar desgastes nos pinos e travas dos cilindros',
      'Verificar esteira (Guia das mangueiras e chicote elétrico)',
      'Verificar corrosão nas estruturas',
      'Verificar sistemas de corrente de abertura/fechamento de lança',
      'Verificar gomos da esteira (Guia das mangueiras)',
      'Verificar chicote elétrico e conectores',
    ],
  },
  {
    area: 'Conjunto da Plataforma',
    items: [
      'Inspecionar peças da estrutura',
      'Inspecionar giro da mesa',
      'Inspecionar funcionamento do motor',
      'Inspecionar vazamento no bloco hidráulico',
      'Inspecionar vazamento em mangueiras/conexões',
      'Inspecionar motor principal/funcionamento',
      'Inspecionar trava do giro da mesa',
      'Inspecionar capôs',
      'Inspecionar travas dos capôs',
    ],
  },
];

const COMMON_AREAS_PAGE_2_TOP: PreventiveAreaTemplate[] = [
  {
    area: 'Conjunto do Chassis e Rodas',
    items: [
      'Verificar vazamento de torque hub',
      'Verificar nível do fluido dos cubos do torque HUB',
      'Verificar cilindros e pinos travantes da direção',
      'Verificar condições dos pneus',
      'Verificar aperto das porcas das rodas',
      'Verificar vazamentos de mangueiras',
      'Verificar corrosão nas estruturas da direção',
    ],
  },
  {
    area: 'Painel de Solo',
    items: [
      'Verificar/Testar função descida de emergência',
      'Verificar/Testar botões de acionamento',
      'Verificar/Testar indicador de horas (Horímetro)',
      'Verificar/Testar posição neutro, painel de solo e painel de cesto',
      'Verificar/Testar Operação dos Controles de Solo',
      'Verificar/Testar sirene e luz de sinalização',
      'Verificar condição da tampa do painel de solo',
      'Verificar travas do painel de solo',
      'Verificar adesivo de operação',
      'Verificar chave troca de função',
      'Verificar velocidade de funções',
    ],
  },
];

const GERAL_ELETRICA_ITEMS: string[] = [
  'Verificar se há registro de falhas na operação',
  'Verificar se há registro de falhas no equipamento',
  'Verificar se há adesivos de capacidade de peso instalados e visíveis',
  'Verificar todos os adesivos de segurança se encontram no equipamento',
  'Verificar adesivo de preventiva',
  'Verificar se buzina ou giroflex foram alterados pelos operadores',
  'Verificar vazamentos em geral',
  'Verificar nível de óleo hidráulico',
  'Verificar nível de água das baterias',
  'Fazer teste geral no equipamento fazendo avaliação de barulhos gerais',
];

const GERAL_DIESEL_ITEMS: string[] = [
  'Verificar se há registro de falhas na operação',
  'Verificar se há registro de falhas no equipamento',
  'Verificar se há adesivos de capacidade de peso instalados e visíveis',
  'Verificar todos os adesivos de segurança se encontram no equipamento',
  'Verificar adesivo de preventiva',
  'Verificar se buzina ou giroflex foram alterados pelos operadores',
  'Verificar vazamentos em geral',
  'Verificar nível de óleo hidráulico',
  'Verificar nível de óleo do motor',
  'Fazer substituição de produtos/peças solicitadas',
  'Fazer teste geral no equipamento fazendo avaliação de barulhos gerais',
];

export const PAGE_1_AREA_NAMES = [
  'Conjunto do Cesto da Plataforma',
  'Conjunto da Lança',
  'Conjunto da Plataforma',
];

export const PAGE_2_AREA_NAMES = [
  'Conjunto do Chassis e Rodas',
  'Painel de Solo',
  'Geral',
];

export function getPreventiveTemplateAreas(type: PreventiveType): PreventiveAreaTemplate[] {
  return [
    ...COMMON_AREAS_PAGE_1,
    ...COMMON_AREAS_PAGE_2_TOP,
    {
      area: 'Geral',
      items: type === 'Diesel' ? GERAL_DIESEL_ITEMS : GERAL_ELETRICA_ITEMS,
    },
  ];
}

export function createInitialBatteries(): PreventiveBatteryReading[] {
  return ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'].map((label) => ({
    label,
    voltage: '',
    voltage_drop: '',
  }));
}

export function createInitialPreventiveChecklist(type: PreventiveType): PreventiveChecklistData {
  const areas = getPreventiveTemplateAreas(type);
  const items: PreventiveChecklistItem[] = [];
  let idx = 1;
  for (const group of areas) {
    for (const desc of group.items) {
      items.push({
        id: `item_${idx++}`,
        area: group.area,
        description: desc,
        quantity: '1',
        performed: '',
      });
    }
  }

  return {
    items,
    batteries: type === 'Elétrica' ? createInitialBatteries() : [],
    battery_total_voltage: '',
    battery_total_drop: '',
    general_observations: '',
    cost_responsibility: '',
  };
}

export function normalizeEquipmentFuelType(val?: string | null): 'eletrica' | 'diesel' | '' {
  const norm = (val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (norm === 'eletrica' || norm === 'eletrico') return 'eletrica';
  if (norm === 'diesel') return 'diesel';
  return '';
}
