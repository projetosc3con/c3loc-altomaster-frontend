import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoAltoMaster from '../../assets/altomaster-dark.png';
import type { ServiceOrder, ServiceOrderLabor } from '../../types';
import {
  PAGE_1_AREA_NAMES,
  PAGE_2_AREA_NAMES,
  createInitialPreventiveChecklist,
  type PreventiveChecklistData,
  type PreventiveChecklistItem,
  type PreventiveType,
} from '../../utils/preventiveTemplates';

export interface PreventivePartPdfItem {
  part_id: string;
  internal_code: string;
  description: string;
  quantity_used: number;
  was_used: boolean;
}

export interface PreventiveMaintenanceDocumentProps {
  data: ServiceOrder;
  parts: PreventivePartPdfItem[];
  labor: ServiceOrderLabor[];
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontFamily: 'Helvetica',
    fontSize: 6.8,
    color: '#000000',
    lineHeight: 1.18,
  },
  headerBox: {
    borderWidth: 1,
    borderColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    marginBottom: 4,
  },
  headerLogoCol: {
    width: '40%',
    paddingRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  headerLogo: {
    width: 195,
    height: 46,
    objectFit: 'contain',
  },
  headerInfoCol: {
    width: '60%',
    paddingLeft: 8,
    justifyContent: 'center',
  },
  companyName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#000000',
    marginBottom: 1.5,
  },
  companyLine: {
    fontSize: 6.4,
    color: '#222222',
    marginBottom: 1,
  },
  titleBar: {
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#D1D5DB',
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  titleBarText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.2,
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  table: {
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.7,
    borderBottomColor: '#000000',
    minHeight: 12.5,
    alignItems: 'stretch',
  },
  rowLast: {
    flexDirection: 'row',
    minHeight: 12.5,
    alignItems: 'stretch',
  },
  cell: {
    paddingHorizontal: 4,
    paddingVertical: 1.8,
    borderRightWidth: 0.7,
    borderRightColor: '#000000',
    justifyContent: 'center',
  },
  cellLast: {
    paddingHorizontal: 4,
    paddingVertical: 1.8,
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    color: '#000000',
  },
  value: {
    fontFamily: 'Helvetica',
    fontSize: 6.6,
    color: '#111111',
  },
  groupBar: {
    backgroundColor: '#D1D5DB',
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    borderBottomWidth: 0.8,
    borderBottomColor: '#000000',
  },
  groupBarText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.2,
    color: '#000000',
  },
  areaBar: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderBottomWidth: 0.7,
    borderBottomColor: '#000000',
  },
  areaBarText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    color: '#111111',
  },
  subHeaderCell: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRightWidth: 0.7,
    borderRightColor: '#000000',
    justifyContent: 'center',
  },
  subHeaderCellLast: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 2,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  subHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.4,
    color: '#000000',
  },
  centerText: {
    textAlign: 'center',
  },
  obsLine: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#9CA3AF',
    minHeight: 11,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    justifyContent: 'center',
  },
  obsLineLast: {
    minHeight: 11,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    justifyContent: 'center',
  },
});

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return clean;
};

const renderHeader = (preventiveType: PreventiveType) => (
  <>
    <View style={styles.headerBox}>
      <View style={styles.headerLogoCol}>
        <Image src={logoAltoMaster} style={styles.headerLogo} />
      </View>
      <View style={styles.headerInfoCol}>
        <Text style={styles.companyName}>ALTO MASTER LOCADORA DE EQUIPAMENTOS LTDA</Text>
        <Text style={styles.companyLine}>CNPJ: 48.477.385/0001-09   |   INSC. EST.: 13.968.337-2</Text>
        <Text style={styles.companyLine}>AV. IDEMAR RIEDI, 12032 - INDUSTRIAL - 2ª ETAPA - SORRISO/MT</Text>
        <Text style={styles.companyLine}>CEP: 78897-066   |   FONE: (66) 99649-8440   |   contato@altomaster.com.br</Text>
      </View>
    </View>
    <View style={styles.titleBar}>
      <Text style={styles.titleBarText}>
        PLANO DE MANUTENÇÃO PREVENTIVA PLATAFORMA ARTICULADA {preventiveType === 'Diesel' ? 'DIESEL' : 'ELÉTRICA'}
      </Text>
    </View>
  </>
);

const renderChecklistGroup = (areas: string[], allItems: PreventiveChecklistItem[]) => {
  const grouped = areas
    .map((area) => ({
      area,
      items: allItems.filter((i) => i.area === area),
    }))
    .filter((g) => g.items.length > 0);

  if (grouped.length === 0) return null;

  return (
    <View style={styles.table}>
      <View style={styles.groupBar}>
        <Text style={styles.groupBarText}>Grupo: Serviços a avaliar</Text>
      </View>
      <View style={styles.row}>
        <View style={[styles.subHeaderCell, { width: '74%' }]}>
          <Text style={styles.subHeaderText}>Descrição</Text>
        </View>
        <View style={[styles.subHeaderCell, { width: '11%' }]}>
          <Text style={[styles.subHeaderText, styles.centerText]}>Qtd.</Text>
        </View>
        <View style={[styles.subHeaderCellLast, { width: '15%' }]}>
          <Text style={[styles.subHeaderText, styles.centerText]}>Realizado?</Text>
        </View>
      </View>

      {grouped.map((g, gIdx) => {
        const isLastGroup = gIdx === grouped.length - 1;
        return (
          <View key={g.area}>
            <View style={styles.areaBar}>
              <Text style={styles.areaBarText}>Área: {g.area}</Text>
            </View>
            {g.items.map((item, iIdx) => {
              const isLastRow = isLastGroup && iIdx === g.items.length - 1;
              const performedLabel =
                item.performed === 'SIM' ? 'Sim' : item.performed === 'NAO' ? 'Não' : '';
              return (
                <View key={item.id || `${g.area}_${iIdx}`} style={isLastRow ? styles.rowLast : styles.row}>
                  <View style={[styles.cell, { width: '74%' }]}>
                    <Text style={styles.value}>{item.description}</Text>
                  </View>
                  <View style={[styles.cell, { width: '11%' }]}>
                    <Text style={[styles.value, styles.centerText]}>{item.quantity || ''}</Text>
                  </View>
                  <View style={[styles.cellLast, { width: '15%' }]}>
                    <Text style={[styles.label, styles.centerText]}>{performedLabel}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

const PreventiveMaintenanceDocument: React.FC<PreventiveMaintenanceDocumentProps> = ({
  data,
  parts = [],
  labor = [],
}) => {
  const preventiveType: PreventiveType =
    data.preventive_type === 'Diesel' ? 'Diesel' : 'Elétrica';
  const isEletrica = preventiveType === 'Elétrica';

  const fallbackChecklist = createInitialPreventiveChecklist(preventiveType);
  const checklist: PreventiveChecklistData = {
    ...fallbackChecklist,
    ...(data.preventive_checklist || {}),
    items:
      Array.isArray(data.preventive_checklist?.items) && data.preventive_checklist!.items.length > 0
        ? data.preventive_checklist!.items
        : fallbackChecklist.items,
    batteries:
      isEletrica &&
      Array.isArray(data.preventive_checklist?.batteries) &&
      data.preventive_checklist!.batteries.length > 0
        ? data.preventive_checklist!.batteries
        : fallbackChecklist.batteries,
  };

  const partsRowCount = Math.max(parts.length, 5);
  const partsRows = Array.from({ length: partsRowCount });

  const laborRowCount = Math.max(labor.length, 2);
  const laborRows = Array.from({ length: laborRowCount });

  const generalObsText = (checklist.general_observations || data.tech_observation || '').trim();
  const obsLines = generalObsText ? generalObsText.split('\n') : [];
  const obsRowCount = Math.max(obsLines.length, isEletrica ? 4 : 2);

  const costResp = checklist.cost_responsibility || (Number(data.cost_client) > 0 ? 'CLIENTE' : Number(data.cost_company) > 0 ? 'ALTO_MASTER' : '');

  return (
    <Document>
      {/* ======================= PÁGINA 1 ======================= */}
      <Page size="A4" style={styles.page}>
        {renderHeader(preventiveType)}

        {/* Dados Principais (idêntico ao cabeçalho dos anexos) */}
        <View style={styles.table}>
          <View style={styles.row}>
            <View style={[styles.cell, { width: '72%' }]}>
              <Text style={styles.label}>
                Nome do Cliente: <Text style={styles.value}>{data.client_name || ''}</Text>
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '28%' }]}>
              <Text style={styles.label}>
                Contrato: <Text style={styles.value}>{data.contract_number || ''}</Text>
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.cell, { width: '34%' }]}>
              <Text style={styles.label}>
                Patrimônio: <Text style={styles.value}>{data.equipment_asset_number || ''}</Text>
              </Text>
            </View>
            <View style={[styles.cell, { width: '33%' }]}>
              <Text style={styles.label}>
                Horímetro Anterior:{' '}
                <Text style={styles.value}>
                  {data.hour_meter_before !== null && data.hour_meter_before !== undefined
                    ? String(data.hour_meter_before)
                    : ''}
                </Text>
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '33%' }]}>
              <Text style={styles.label}>
                Horímetro Atual:{' '}
                <Text style={styles.value}>
                  {data.hour_meter_after !== null && data.hour_meter_after !== undefined
                    ? String(data.hour_meter_after)
                    : ''}
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.cell, { width: '50%' }]}>
              <Text style={styles.label}>
                Modelo: <Text style={styles.value}>{data.equipment_model || data.equipment_name || ''}</Text>
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '50%' }]}>
              <Text style={styles.label}>
                N° Ordem de manutenção:{' '}
                <Text style={styles.value}>
                  {data.os_number ? String(data.os_number).padStart(5, '0') : 'Nova'}
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.rowLast}>
            <View style={[styles.cell, { width: '50%' }]}>
              <Text style={styles.label}>
                Nro Série: <Text style={styles.value}>{data.equipment_serial_number || ''}</Text>
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '50%' }]}>
              <Text style={styles.label}>
                Data: <Text style={styles.value}>{formatDate(data.execution_date)}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Grupo: Produtos/Peças a substituir */}
        <View style={styles.table}>
          <View style={styles.groupBar}>
            <Text style={styles.groupBarText}>Grupo: Produtos/Peças a substituir</Text>
          </View>
          <View style={styles.row}>
            <View style={[styles.subHeaderCell, { width: '74%' }]}>
              <Text style={styles.subHeaderText}>Código / Descrição</Text>
            </View>
            <View style={[styles.subHeaderCell, { width: '11%' }]}>
              <Text style={[styles.subHeaderText, styles.centerText]}>Qtd.</Text>
            </View>
            <View style={[styles.subHeaderCellLast, { width: '15%' }]}>
              <Text style={[styles.subHeaderText, styles.centerText]}>Substituído?</Text>
            </View>
          </View>
          {partsRows.map((_, idx) => {
            const p = parts[idx];
            const isLast = idx === partsRows.length - 1;
            return (
              <View key={idx} style={isLast ? styles.rowLast : styles.row}>
                <View style={[styles.cell, { width: '74%' }]}>
                  <Text style={styles.value}>
                    {p ? `${p.internal_code ? `${p.internal_code} - ` : ''}${p.description}` : ''}
                  </Text>
                </View>
                <View style={[styles.cell, { width: '11%' }]}>
                  <Text style={[styles.value, styles.centerText]}>{p ? String(p.quantity_used) : ''}</Text>
                </View>
                <View style={[styles.cellLast, { width: '15%' }]}>
                  <Text style={[styles.label, styles.centerText]}>
                    {p ? (p.was_used ? 'Sim' : 'Não') : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Serviços a avaliar — Página 1 (Cesto, Lança, Plataforma) */}
        {renderChecklistGroup(PAGE_1_AREA_NAMES, checklist.items)}
      </Page>

      {/* ======================= PÁGINA 2 ======================= */}
      <Page size="A4" style={styles.page}>
        {renderHeader(preventiveType)}

        {/* Serviços a avaliar — Página 2 (Chassis e Rodas, Painel de Solo, Geral) */}
        {renderChecklistGroup(PAGE_2_AREA_NAMES, checklist.items)}

        {/* Tabela de Baterias (Exclusiva Elétrica) */}
        {isEletrica && (
          <View style={styles.table}>
            <View style={styles.row}>
              <View style={[styles.subHeaderCell, { width: '24%' }]}>
                <Text style={[styles.subHeaderText, styles.centerText]}>Bateria</Text>
              </View>
              <View style={[styles.subHeaderCell, { width: '38%' }]}>
                <Text style={[styles.subHeaderText, styles.centerText]}>Tensão (V)</Text>
              </View>
              <View style={[styles.subHeaderCellLast, { width: '38%' }]}>
                <Text style={[styles.subHeaderText, styles.centerText]}>Queda de tensão (V)</Text>
              </View>
            </View>
            {checklist.batteries.map((b, idx) => (
              <View key={b.label || idx} style={styles.row}>
                <View style={[styles.cell, { width: '24%' }]}>
                  <Text style={[styles.label, styles.centerText]}>{b.label}</Text>
                </View>
                <View style={[styles.cell, { width: '38%' }]}>
                  <Text style={[styles.value, styles.centerText]}>{b.voltage || ''}</Text>
                </View>
                <View style={[styles.cellLast, { width: '38%' }]}>
                  <Text style={[styles.value, styles.centerText]}>{b.voltage_drop || ''}</Text>
                </View>
              </View>
            ))}
            <View style={styles.rowLast}>
              <View style={[styles.cell, { width: '24%', backgroundColor: '#F3F4F6' }]}>
                <Text style={[styles.label, styles.centerText]}>Total</Text>
              </View>
              <View style={[styles.cell, { width: '38%', backgroundColor: '#F3F4F6' }]}>
                <Text style={[styles.label, styles.centerText]}>{checklist.battery_total_voltage || ''}</Text>
              </View>
              <View style={[styles.cellLast, { width: '38%', backgroundColor: '#F3F4F6' }]}>
                <Text style={[styles.label, styles.centerText]}>{checklist.battery_total_drop || ''}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Observações Gerais */}
        <View style={styles.table}>
          <View style={styles.areaBar}>
            <Text style={styles.areaBarText}>Observações gerais:</Text>
          </View>
          {Array.from({ length: obsRowCount }).map((_, idx) => (
            <View key={idx} style={idx === obsRowCount - 1 ? styles.obsLineLast : styles.obsLine}>
              <Text style={styles.value}>{obsLines[idx] || ''}</Text>
            </View>
          ))}
        </View>

        {/* Serviço ficou em condições? + Assinaturas */}
        <View style={styles.table}>
          <View style={styles.row}>
            <View style={[styles.cell, { width: '60%', backgroundColor: '#F3F4F6' }]}>
              <Text style={styles.label}>Serviço ficou em condições?</Text>
            </View>
            <View style={[styles.cell, { width: '20%' }]}>
              <Text style={[styles.label, styles.centerText]}>
                Sim {data.equipment_functional === true ? '[ X ]' : '[   ]'}
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '20%' }]}>
              <Text style={[styles.label, styles.centerText]}>
                Não {data.equipment_functional === false ? '[ X ]' : '[   ]'}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.cell, { width: '34%' }]}>
              <Text style={styles.label}>
                Data: <Text style={styles.value}>{formatDate(data.execution_date)}</Text>
              </Text>
            </View>
            <View style={[styles.cell, { width: '33%' }]}>
              <Text style={styles.label}>
                Técnico: <Text style={styles.value}>{data.signer_tech_name || data.executor?.full_name || ''}</Text>
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '33%' }]}>
              <Text style={styles.label}>Ass. Técnico:</Text>
            </View>
          </View>

          <View style={styles.rowLast}>
            <View style={[styles.cell, { width: '34%' }]}>
              <Text style={styles.label}>
                Cliente: <Text style={styles.value}>{data.signer_client_name || data.client_name || ''}</Text>
              </Text>
            </View>
            <View style={[styles.cell, { width: '33%' }]}>
              <Text style={styles.label}>
                RG: <Text style={styles.value}>{data.signer_client_rg || ''}</Text>
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '33%' }]}>
              <Text style={styles.label}>Ass. Cliente:</Text>
            </View>
          </View>
        </View>

        {/* Tabela Mão de Obra */}
        <View style={styles.table}>
          <View style={styles.groupBar}>
            <Text style={styles.groupBarText}>Mão de Obra</Text>
          </View>
          <View style={styles.row}>
            <View style={[styles.subHeaderCell, { width: '26%' }]}>
              <Text style={styles.subHeaderText}>Técnico</Text>
            </View>
            <View style={[styles.subHeaderCell, { width: '11%' }]}>
              <Text style={[styles.subHeaderText, styles.centerText]}>Data</Text>
            </View>
            <View style={[styles.subHeaderCell, { width: '9%' }]}>
              <Text style={[styles.subHeaderText, styles.centerText]}>Início</Text>
            </View>
            <View style={[styles.subHeaderCell, { width: '9%' }]}>
              <Text style={[styles.subHeaderText, styles.centerText]}>Final</Text>
            </View>
            <View style={[styles.subHeaderCell, { width: '9%' }]}>
              <Text style={[styles.subHeaderText, styles.centerText]}>V / T / I</Text>
            </View>
            <View style={[styles.subHeaderCell, { width: '14%' }]}>
              <Text style={[styles.subHeaderText, styles.centerText]}>Placa do veículo</Text>
            </View>
            <View style={[styles.subHeaderCell, { width: '11%' }]}>
              <Text style={[styles.subHeaderText, styles.centerText]}>Km Inicial</Text>
            </View>
            <View style={[styles.subHeaderCellLast, { width: '11%' }]}>
              <Text style={[styles.subHeaderText, styles.centerText]}>Km Final</Text>
            </View>
          </View>
          {laborRows.map((_, idx) => {
            const l: any = labor[idx];
            const isLast = idx === laborRows.length - 1;
            const plate = l?.vehicle_plate || (idx === 0 ? data.vehicle_plate : '') || '';
            const kmStart =
              l?.km_start !== null && l?.km_start !== undefined && l?.km_start !== ''
                ? String(l.km_start)
                : idx === 0 && data.vehicle_km_start !== null && data.vehicle_km_start !== undefined
                  ? String(data.vehicle_km_start)
                  : '';
            const kmEnd =
              l?.km_end !== null && l?.km_end !== undefined && l?.km_end !== ''
                ? String(l.km_end)
                : idx === 0 && data.vehicle_km_end !== null && data.vehicle_km_end !== undefined
                  ? String(data.vehicle_km_end)
                  : '';
            return (
              <View key={idx} style={isLast ? styles.rowLast : styles.row}>
                <View style={[styles.cell, { width: '26%' }]}>
                  <Text style={styles.value}>{l?.technician_name || ''}</Text>
                </View>
                <View style={[styles.cell, { width: '11%' }]}>
                  <Text style={[styles.value, styles.centerText]}>{l?.labor_date ? formatDate(l.labor_date) : ''}</Text>
                </View>
                <View style={[styles.cell, { width: '9%' }]}>
                  <Text style={[styles.value, styles.centerText]}>{l?.start_time || ''}</Text>
                </View>
                <View style={[styles.cell, { width: '9%' }]}>
                  <Text style={[styles.value, styles.centerText]}>{l?.end_time || ''}</Text>
                </View>
                <View style={[styles.cell, { width: '9%' }]}>
                  <Text style={[styles.value, styles.centerText]}>{l?.labor_type || ''}</Text>
                </View>
                <View style={[styles.cell, { width: '14%' }]}>
                  <Text style={[styles.value, styles.centerText]}>{plate}</Text>
                </View>
                <View style={[styles.cell, { width: '11%' }]}>
                  <Text style={[styles.value, styles.centerText]}>{kmStart}</Text>
                </View>
                <View style={[styles.cellLast, { width: '11%' }]}>
                  <Text style={[styles.value, styles.centerText]}>{kmEnd}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Análise Crítica (Gestor) */}
        <View style={styles.table}>
          <View style={styles.groupBar}>
            <Text style={[styles.groupBarText, styles.centerText]}>Análise Crítica (Gestor)</Text>
          </View>
          <View style={styles.row}>
            <View style={[styles.subHeaderCell, { width: '50%' }]}>
              <Text style={[styles.subHeaderText, styles.centerText]}>Custo</Text>
            </View>
            <View style={[styles.subHeaderCellLast, { width: '50%' }]}>
              <Text style={[styles.subHeaderText, styles.centerText]}>Pendência</Text>
            </View>
          </View>
          <View style={styles.rowLast}>
            <View style={[styles.cell, { width: '25%' }]}>
              <Text style={[styles.label, styles.centerText]}>
                ALTO MASTER {costResp === 'ALTO_MASTER' ? '[ X ]' : '[   ]'}
              </Text>
            </View>
            <View style={[styles.cell, { width: '25%' }]}>
              <Text style={[styles.label, styles.centerText]}>
                CLIENTE {costResp === 'CLIENTE' ? '[ X ]' : '[   ]'}
              </Text>
            </View>
            <View style={[styles.cell, { width: '25%' }]}>
              <Text style={[styles.label, styles.centerText]}>
                SIM {data.has_pending === true ? '[ X ]' : '[   ]'}
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '25%' }]}>
              <Text style={[styles.label, styles.centerText]}>
                NÃO {data.has_pending === false ? '[ X ]' : '[   ]'}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default PreventiveMaintenanceDocument;
