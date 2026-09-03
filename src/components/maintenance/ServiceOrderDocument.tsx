import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoAltoMaster from '../../assets/altomaster-dark.png';
import type { ServiceOrder, ServiceOrderLabor } from '../../types';

export interface OSPartItem {
  part_id: string;
  description: string;
  internal_code: string;
  quantity_used: number;
  unit_value_at_use: number;
  subtotal: number;
  was_used: boolean;
}

export interface ServiceOrderDocumentProps {
  data: ServiceOrder;
  parts: OSPartItem[];
  labor: ServiceOrderLabor[];
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#000000',
    lineHeight: 1.2,
  },

  // ===== CABEÇALHO DA EMPRESA =====
  headerBox: {
    borderWidth: 1,
    borderColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    marginBottom: 4,
  },
  headerLogoCol: {
    width: '46%',
    paddingRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  headerLogo: {
    width: 220,
    height: 54,
    objectFit: 'contain',
  },
  headerInfoCol: {
    width: '54%',
    paddingLeft: 10,
    justifyContent: 'center',
  },
  companyName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#000000',
    marginBottom: 2,
  },
  companyLine: {
    fontSize: 6.8,
    color: '#222222',
    marginBottom: 1.5,
  },

  // ===== TÍTULO DA ORDEM DE SERVIÇO =====
  titleBar: {
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#CCCCCC',
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  titleBarText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#000000',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ===== TABELAS E GRIDS GERAIS =====
  table: {
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 14,
    alignItems: 'center',
  },
  tableRowLast: {
    flexDirection: 'row',
    minHeight: 14,
    alignItems: 'center',
  },

  // Células
  cell: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    justifyContent: 'center',
  },
  cellLast: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  cellLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    color: '#000000',
  },
  cellValue: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#111111',
  },

  // Seções de Texto (Falha, Causa, Ação)
  sectionHeader: {
    backgroundColor: '#CCCCCC',
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  sectionHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: '#000000',
    textTransform: 'uppercase',
  },
  sectionContentBox: {
    padding: 5,
    minHeight: 32,
    justifyContent: 'flex-start',
  },
  sectionContentText: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#111111',
    lineHeight: 1.25,
  },

  // Tabela Peças e Mão de Obra Lado a Lado
  colHeaderGroup: {
    backgroundColor: '#CCCCCC',
    paddingVertical: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  colHeaderGroupLast: {
    backgroundColor: '#CCCCCC',
    paddingVertical: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderCell: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  subHeaderCellLast: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    color: '#000000',
    textAlign: 'center',
  },
  dataCell: {
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    justifyContent: 'center',
  },
  dataCellLast: {
    paddingHorizontal: 3,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  dataText: {
    fontFamily: 'Helvetica',
    fontSize: 6.5,
    color: '#111111',
  },
  dataTextCenter: {
    fontFamily: 'Helvetica',
    fontSize: 6.5,
    color: '#111111',
    textAlign: 'center',
  },

  // Checklists
  checkHeader: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 2,
    paddingHorizontal: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    color: '#000000',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  checkHeaderCenter: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 2,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    color: '#000000',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  checkHeaderCenterLast: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 2,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    color: '#000000',
    textAlign: 'center',
  },
  checkText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    textAlign: 'center',
    color: '#000000',
  },

  // Assinaturas e Rodapé
  signatureSection: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 4,
  },
  signatureCol: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  signatureColLast: {
    flex: 1,
    padding: 6,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000000',
    marginTop: 18,
    paddingTop: 2,
    alignItems: 'center',
  },
  signatureLineText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    textAlign: 'center',
  },
  signatureDetail: {
    fontSize: 6.5,
    color: '#333333',
    textAlign: 'center',
    marginTop: 1,
  },
});

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
};

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return `R$ ${Number(value).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
};

const ServiceOrderDocument: React.FC<ServiceOrderDocumentProps> = ({ data, parts = [], labor = [] }) => {
  const isExterna = data.order_type === 'Externa';

  // Garantir pelo menos 5 linhas na tabela de peças / mão de obra para manter layout idêntico ao modelo
  const tableRowsCount = Math.max(parts.length, labor.length, 5);
  const rowsArray = Array.from({ length: tableRowsCount });

  // Auxiliar para preenchimento de Sim/Não com 'X'
  const markCheck = (value?: boolean, isSimTarget: boolean = true) => {
    if (value === undefined || value === null) return '';
    if (isSimTarget && value === true) return 'X';
    if (!isSimTarget && value === false) return 'X';
    return '';
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* 1. CABEÇALHO ALTOMASTER */}
        <View style={styles.headerBox}>
          <View style={styles.headerLogoCol}>
            <Image src={logoAltoMaster} style={styles.headerLogo} />
          </View>
          <View style={styles.headerInfoCol}>
            <Text style={styles.companyName}>ALTO MASTER LOCADORA DE EQUIPAMENTOS LTDA</Text>
            <Text style={styles.companyLine}>CNPJ: 48.477.385/0001-09   |   INSC. EST.: 13.968.337-2</Text>
            <Text style={styles.companyLine}>AV. IDEMAR RIEDI, 12032 - INDUSTRIAL - 2ª ETAPA - SORRISO/MT</Text>
            <Text style={styles.companyLine}>CEP: 78897-066   |   FONE: (66) 99649-8440</Text>
            <Text style={styles.companyLine}>E-MAIL: contato@altomaster.com.br</Text>
          </View>
        </View>

        {/* 2. TÍTULO DA ORDEM DE MANUTENÇÃO */}
        <View style={styles.titleBar}>
          <Text style={styles.titleBarText}>
            ORDEM DE MANUTENÇÃO - {isExterna ? 'EXTERNA' : 'INTERNA'}
          </Text>
        </View>

        {/* 3. TABELA DE IDENTIFICAÇÃO DO EQUIPAMENTO E CLIENTE */}
        <View style={styles.table}>
          {/* Linha 1 */}
          <View style={styles.tableRow}>
            <View style={[styles.cell, { width: '33%' }]}>
              <Text style={styles.cellLabel}>
                N° Ordem de Manutenção: <Text style={styles.cellValue}>{data.os_number ? String(data.os_number).padStart(5, '0') : 'Nova'}</Text>
              </Text>
            </View>
            <View style={[styles.cell, { width: '47%' }]}>
              <Text style={styles.cellLabel}>
                Local: <Text style={styles.cellValue}>{data.execution_location || '-'}</Text>
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '20%' }]}>
              <Text style={styles.cellLabel}>
                Patrimônio: <Text style={styles.cellValue}>{data.equipment_asset_number || '-'}</Text>
              </Text>
            </View>
          </View>

          {/* Linha 2 */}
          <View style={styles.tableRow}>
            <View style={[styles.cell, { width: '33%' }]}>
              <Text style={styles.cellLabel}>
                Modelo: <Text style={styles.cellValue}>{data.equipment_model || data.equipment_name || '-'}</Text>
              </Text>
            </View>
            <View style={[styles.cell, { width: '33%' }]}>
              <Text style={styles.cellLabel}>
                Nº Série: <Text style={styles.cellValue}>{data.equipment_serial_number || '-'}</Text>
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '34%' }]}>
              <Text style={styles.cellLabel}>
                Horímetro Anterior: <Text style={styles.cellValue}>{data.hour_meter_before !== null && data.hour_meter_before !== undefined ? data.hour_meter_before : '-'}</Text>
              </Text>
            </View>
          </View>

          {/* Linha 3 */}
          <View style={styles.tableRow}>
            <View style={[styles.cell, { width: '66%' }]}>
              <Text style={styles.cellLabel}>
                Cliente: <Text style={styles.cellValue}>{data.client_name || '-'}</Text>
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '34%' }]}>
              <Text style={styles.cellLabel}>
                Horímetro Atual: <Text style={styles.cellValue}>{data.hour_meter_after !== null && data.hour_meter_after !== undefined ? data.hour_meter_after : '-'}</Text>
              </Text>
            </View>
          </View>

          {/* Linha 4 */}
          <View style={styles.tableRow}>
            <View style={[styles.cellLast, { width: '100%' }]}>
              <Text style={styles.cellLabel}>
                Endereço: <Text style={styles.cellValue}>{data.client_address || '-'}</Text>
              </Text>
            </View>
          </View>

          {/* Linha 5 */}
          <View style={styles.tableRowLast}>
            <View style={[styles.cell, { width: '33%' }]}>
              <Text style={styles.cellLabel}>
                Nome Contato: <Text style={styles.cellValue}>{data.client_contact_name || '-'}</Text>
              </Text>
            </View>
            <View style={[styles.cell, { width: '33%' }]}>
              <Text style={styles.cellLabel}>
                Telefone: <Text style={styles.cellValue}>{data.client_phone || '-'}</Text>
              </Text>
            </View>
            <View style={[styles.cellLast, { width: '34%' }]}>
              <Text style={styles.cellLabel}>
                Data Abertura: <Text style={styles.cellValue}>{formatDate(data.execution_date) || '-'}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* 4. DIAGNÓSTICO E FALHA */}
        <View style={styles.table}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>Solicitação Cliente - Falha</Text>
          </View>
          <View style={styles.sectionContentBox}>
            <Text style={styles.sectionContentText}>{data.client_request || '-'}</Text>
          </View>

          <View style={[styles.sectionHeader, { borderTopWidth: 1, borderTopColor: '#000000' }]}>
            <Text style={styles.sectionHeaderText}>Diagnóstico - Causa</Text>
          </View>
          <View style={styles.sectionContentBox}>
            <Text style={styles.sectionContentText}>{data.diagnosis || '-'}</Text>
          </View>

          <View style={[styles.sectionHeader, { borderTopWidth: 1, borderTopColor: '#000000' }]}>
            <Text style={styles.sectionHeaderText}>Serviços Executados - Ação</Text>
          </View>
          <View style={[styles.sectionContentBox, { minHeight: 38 }]}>
            <Text style={styles.sectionContentText}>{data.services_executed || '-'}</Text>
          </View>
        </View>

        {/* 5. TABELA DE PEÇAS E MÃO DE OBRA (LADO A LADO) */}
        <View style={styles.table}>
          {/* Cabeçalho Superior Grupos */}
          <View style={[styles.tableRow, { minHeight: 16 }]}>
            <View style={[styles.colHeaderGroup, { width: '45%' }]}>
              <Text style={styles.sectionHeaderText}>Peças</Text>
            </View>
            <View style={[styles.colHeaderGroupLast, { width: '55%' }]}>
              <Text style={styles.sectionHeaderText}>Mão de Obra</Text>
            </View>
          </View>

          {/* Subcabeçalhos de Colunas */}
          <View style={[styles.tableRow, { minHeight: 15 }]}>
            {/* Peças Columns */}
            {isExterna ? (
              <>
                <View style={[styles.subHeaderCell, { width: '27%' }]}>
                  <Text style={styles.subHeaderText}>Código / Descrição</Text>
                </View>
                <View style={[styles.subHeaderCell, { width: '8%' }]}>
                  <Text style={styles.subHeaderText}>Qtd.</Text>
                </View>
                <View style={[styles.subHeaderCell, { width: '10%' }]}>
                  <Text style={styles.subHeaderText}>Utilizado</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.subHeaderCell, { width: '12%' }]}>
                  <Text style={styles.subHeaderText}>PN</Text>
                </View>
                <View style={[styles.subHeaderCell, { width: '20%' }]}>
                  <Text style={styles.subHeaderText}>Descrição</Text>
                </View>
                <View style={[styles.subHeaderCell, { width: '6%' }]}>
                  <Text style={styles.subHeaderText}>Qtd.</Text>
                </View>
                <View style={[styles.subHeaderCell, { width: '7%' }]}>
                  <Text style={styles.subHeaderText}>Utilizado</Text>
                </View>
              </>
            )}

            {/* Mão de Obra Columns */}
            <View style={[styles.subHeaderCell, { width: isExterna ? '21%' : '23%' }]}>
              <Text style={styles.subHeaderText}>Técnico</Text>
            </View>
            <View style={[styles.subHeaderCell, { width: '11%' }]}>
              <Text style={styles.subHeaderText}>Data</Text>
            </View>
            <View style={[styles.subHeaderCell, { width: '7.5%' }]}>
              <Text style={styles.subHeaderText}>Início</Text>
            </View>
            <View style={[styles.subHeaderCell, { width: '7.5%' }]}>
              <Text style={styles.subHeaderText}>Final</Text>
            </View>
            <View style={[styles.subHeaderCellLast, { width: isExterna ? '8%' : '6%' }]}>
              <Text style={styles.subHeaderText}>{isExterna ? 'V / T / I' : 'T / I'}</Text>
            </View>
          </View>

          {/* Linhas de Dados */}
          {rowsArray.map((_, idx) => {
            const p = parts[idx];
            const l = labor[idx];
            const isLast = idx === rowsArray.length - 1;

            return (
              <View key={idx} style={isLast ? styles.tableRowLast : styles.tableRow}>
                {/* Dados de Peças */}
                {isExterna ? (
                  <>
                    <View style={[styles.dataCell, { width: '27%' }]}>
                      <Text style={styles.dataText}>
                        {p ? `${p.internal_code ? p.internal_code + ' - ' : ''}${p.description}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.dataCell, { width: '8%' }]}>
                      <Text style={styles.dataTextCenter}>{p ? p.quantity_used : ''}</Text>
                    </View>
                    <View style={[styles.dataCell, { width: '10%' }]}>
                      <Text style={styles.dataTextCenter}>{p ? (p.was_used ? 'Sim' : 'Não') : ''}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={[styles.dataCell, { width: '12%' }]}>
                      <Text style={styles.dataText}>{p?.internal_code || ''}</Text>
                    </View>
                    <View style={[styles.dataCell, { width: '20%' }]}>
                      <Text style={styles.dataText}>{p?.description || ''}</Text>
                    </View>
                    <View style={[styles.dataCell, { width: '6%' }]}>
                      <Text style={styles.dataTextCenter}>{p ? p.quantity_used : ''}</Text>
                    </View>
                    <View style={[styles.dataCell, { width: '7%' }]}>
                      <Text style={styles.dataTextCenter}>{p ? (p.was_used ? 'Sim' : 'Não') : ''}</Text>
                    </View>
                  </>
                )}

                {/* Dados de Mão de Obra */}
                <View style={[styles.dataCell, { width: isExterna ? '21%' : '23%' }]}>
                  <Text style={styles.dataText}>{l?.technician_name || ''}</Text>
                </View>
                <View style={[styles.dataCell, { width: '11%' }]}>
                  <Text style={styles.dataTextCenter}>{l?.labor_date ? formatDate(l.labor_date) : ''}</Text>
                </View>
                <View style={[styles.dataCell, { width: '7.5%' }]}>
                  <Text style={styles.dataTextCenter}>{l?.start_time || ''}</Text>
                </View>
                <View style={[styles.dataCell, { width: '7.5%' }]}>
                  <Text style={styles.dataTextCenter}>{l?.end_time || ''}</Text>
                </View>
                <View style={[styles.dataCellLast, { width: isExterna ? '8%' : '6%' }]}>
                  <Text style={styles.dataTextCenter}>{l?.labor_type || ''}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* 6. OBSERVAÇÕES E CHECKLISTS */}
        {isExterna ? (
          /* CHECKLIST EXTERNA: Lado a Lado (Observação Cliente / Observação Técnica) */
          <View style={styles.table}>
            {/* Header Checklist */}
            <View style={styles.tableRow}>
              <View style={[styles.checkHeader, { width: '38%' }]}>
                <Text>Observação Cliente</Text>
              </View>
              <View style={[styles.checkHeaderCenter, { width: '6%' }]}>
                <Text>Sim</Text>
              </View>
              <View style={[styles.checkHeaderCenter, { width: '6%' }]}>
                <Text>Não</Text>
              </View>
              <View style={[styles.checkHeader, { width: '38%' }]}>
                <Text>Observação Técnica</Text>
              </View>
              <View style={[styles.checkHeaderCenter, { width: '6%' }]}>
                <Text>Sim</Text>
              </View>
              <View style={[styles.checkHeaderCenterLast, { width: '6%' }]}>
                <Text>Não</Text>
              </View>
            </View>

            {/* Linha 1 */}
            <View style={styles.tableRow}>
              <View style={[styles.cell, { width: '38%' }]}>
                <Text style={styles.cellLabel}>Equipamento ficou em condições?</Text>
              </View>
              <View style={[styles.cell, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.checklist_equipment_conditions, true)}</Text>
              </View>
              <View style={[styles.cell, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.checklist_equipment_conditions, false)}</Text>
              </View>
              <View style={[styles.cell, { width: '38%' }]}>
                <Text style={styles.cellLabel}>Há Condição Segura de Trabalho?</Text>
              </View>
              <View style={[styles.cell, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.checklist_safe_work, true)}</Text>
              </View>
              <View style={[styles.cellLast, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.checklist_safe_work, false)}</Text>
              </View>
            </View>

            {/* Linha 2 */}
            <View style={styles.tableRow}>
              <View style={[styles.cell, { width: '38%' }]}>
                <Text style={styles.cellLabel}>Técnico usava EPI's?</Text>
              </View>
              <View style={[styles.cell, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.checklist_epi, true)}</Text>
              </View>
              <View style={[styles.cell, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.checklist_epi, false)}</Text>
              </View>
              <View style={[styles.cell, { width: '38%' }]}>
                <Text style={styles.cellLabel}>O ambiente é adequado para operação do equipamento?</Text>
              </View>
              <View style={[styles.cell, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.checklist_adequate_environment, true)}</Text>
              </View>
              <View style={[styles.cellLast, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.checklist_adequate_environment, false)}</Text>
              </View>
            </View>

            {/* Linha 3 */}
            <View style={styles.tableRow}>
              <View style={[styles.cell, { width: '38%' }]}>
                <Text style={styles.cellLabel}>Foi bem atendido?</Text>
              </View>
              <View style={[styles.cell, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.checklist_well_served, true)}</Text>
              </View>
              <View style={[styles.cell, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.checklist_well_served, false)}</Text>
              </View>
              <View style={[styles.cell, { width: '38%' }]}>
                <Text style={styles.cellLabel}>Equipamento ficou funcional?</Text>
              </View>
              <View style={[styles.cell, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.equipment_functional, true)}</Text>
              </View>
              <View style={[styles.cellLast, { width: '6%' }]}>
                <Text style={styles.checkText}>{markCheck(data.equipment_functional, false)}</Text>
              </View>
            </View>

            {/* Observações Textuais Lado a Lado */}
            <View style={styles.tableRowLast}>
              <View style={[styles.cell, { width: '50%', padding: 0 }]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>Observação do Cliente</Text>
                </View>
                <View style={[styles.sectionContentBox, { minHeight: 28 }]}>
                  <Text style={styles.sectionContentText}>{data.client_observation || '-'}</Text>
                </View>
              </View>

              <View style={[styles.cellLast, { width: '50%', padding: 0 }]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>Observação Técnica</Text>
                </View>
                <View style={[styles.sectionContentBox, { minHeight: 28 }]}>
                  <Text style={styles.sectionContentText}>{data.tech_observation || '-'}</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          /* CHECKLIST INTERNA: Observação Técnica */
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={[styles.checkHeader, { width: '70%' }]}>
                <Text>Observação Técnica</Text>
              </View>
              <View style={[styles.checkHeaderCenter, { width: '15%' }]}>
                <Text>Sim</Text>
              </View>
              <View style={[styles.checkHeaderCenterLast, { width: '15%' }]}>
                <Text>Não</Text>
              </View>
            </View>

            <View style={styles.tableRow}>
              <View style={[styles.cell, { width: '70%' }]}>
                <Text style={styles.cellLabel}>Equipamento ficou funcional?</Text>
              </View>
              <View style={[styles.cell, { width: '15%' }]}>
                <Text style={styles.checkText}>{markCheck(data.equipment_functional, true)}</Text>
              </View>
              <View style={[styles.cellLast, { width: '15%' }]}>
                <Text style={styles.checkText}>{markCheck(data.equipment_functional, false)}</Text>
              </View>
            </View>

            <View style={styles.tableRow}>
              <View style={[styles.cell, { width: '70%' }]}>
                <Text style={styles.cellLabel}>Pendência de peças?</Text>
              </View>
              <View style={[styles.cell, { width: '15%' }]}>
                <Text style={styles.checkText}>{markCheck(data.parts_pending, true)}</Text>
              </View>
              <View style={[styles.cellLast, { width: '15%' }]}>
                <Text style={styles.checkText}>{markCheck(data.parts_pending, false)}</Text>
              </View>
            </View>

            <View style={styles.tableRowLast}>
              <View style={[styles.cellLast, { width: '100%', padding: 0 }]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>Detalhamento Técnico / Observações</Text>
                </View>
                <View style={[styles.sectionContentBox, { minHeight: 28 }]}>
                  <Text style={styles.sectionContentText}>{data.tech_observation || '-'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 7. DESLOCAMENTO (VEÍCULO - EXCLUSIVO EXTERNA) */}
        {isExterna && (
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={[styles.checkHeaderCenter, { width: '34%' }]}>
                <Text>Placa</Text>
              </View>
              <View style={[styles.checkHeaderCenter, { width: '33%' }]}>
                <Text>KM Inicial</Text>
              </View>
              <View style={[styles.checkHeaderCenterLast, { width: '33%' }]}>
                <Text>KM Final</Text>
              </View>
            </View>
            <View style={styles.tableRowLast}>
              <View style={[styles.cell, { width: '34%' }]}>
                <Text style={styles.dataTextCenter}>{data.vehicle_plate || '-'}</Text>
              </View>
              <View style={[styles.cell, { width: '33%' }]}>
                <Text style={styles.dataTextCenter}>{data.vehicle_km_start !== null && data.vehicle_km_start !== undefined ? data.vehicle_km_start : '-'}</Text>
              </View>
              <View style={[styles.cellLast, { width: '33%' }]}>
                <Text style={styles.dataTextCenter}>{data.vehicle_km_end !== null && data.vehicle_km_end !== undefined ? data.vehicle_km_end : '-'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 8. ASSINATURAS E ANÁLISE CRÍTICA */}
        <View style={styles.table}>
          <View style={styles.tableRowLast}>
            {/* Lado Assinatura(s) */}
            <View style={[styles.cell, { width: isExterna ? '65%' : '60%', padding: 6 }]}>
              {isExterna ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {/* Assinatura Cliente */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.8 }}>
                      Nome Cliente: <Text style={{ fontFamily: 'Helvetica' }}>{data.signer_client_name || '-'}</Text>
                    </Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.8, marginTop: 2 }}>
                      RG: <Text style={{ fontFamily: 'Helvetica' }}>{data.signer_client_rg || '-'}</Text>
                    </Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.8, marginTop: 2 }}>
                      Cargo/Função: <Text style={{ fontFamily: 'Helvetica' }}>{data.signer_client_role || '-'}</Text>
                    </Text>
                    <View style={styles.signatureLine}>
                      <Text style={styles.signatureLineText}>Assinatura do Cliente</Text>
                    </View>
                  </View>

                  {/* Assinatura Técnico */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.8 }}>
                      Técnico: <Text style={{ fontFamily: 'Helvetica' }}>{data.signer_tech_name || data.executed_by || '-'}</Text>
                    </Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.8, marginTop: 2 }}>
                      Cargo/Função: <Text style={{ fontFamily: 'Helvetica' }}>{data.signer_tech_role || 'Técnico de Manutenção'}</Text>
                    </Text>
                    <View style={styles.signatureLine}>
                      <Text style={styles.signatureLineText}>Assinatura do Técnico</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={{ paddingVertical: 2 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7 }}>
                    Técnico: <Text style={{ fontFamily: 'Helvetica' }}>{data.signer_tech_name || data.executed_by || '______________________________________'}</Text>
                  </Text>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, marginTop: 3 }}>
                    Função: <Text style={{ fontFamily: 'Helvetica' }}>{data.signer_tech_role || 'Técnico de Manutenção'}</Text>
                  </Text>
                  <View style={[styles.signatureLine, { marginTop: 14, width: '75%' }]}>
                    <Text style={styles.signatureLineText}>Assinatura do Técnico Responsável</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Lado Análise Crítica */}
            <View style={[styles.cellLast, { width: isExterna ? '35%' : '40%', padding: 0 }]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>
                  Análise Crítica {isExterna ? '(Gestor)' : ''}
                </Text>
              </View>

              <View style={{ padding: 4, minHeight: 25 }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica' }}>
                  {data.critical_analysis || 'Sem análise crítica informada.'}
                </Text>
              </View>

              {/* Tabela de Custos e Pendência */}
              <View style={{ borderTopWidth: 1, borderTopColor: '#000000' }}>
                <View style={[styles.tableRow, { minHeight: 13, backgroundColor: '#E5E7EB' }]}>
                  <View style={[styles.cell, { width: '55%' }]}>
                    <Text style={[styles.subHeaderText, { textAlign: 'left' }]}>Custo</Text>
                  </View>
                  <View style={[styles.cellLast, { width: '45%' }]}>
                    <Text style={[styles.subHeaderText, { textAlign: 'left' }]}>Pendência</Text>
                  </View>
                </View>

                <View style={[styles.tableRowLast, { minHeight: 18 }]}>
                  <View style={[styles.cell, { width: '55%', paddingVertical: 2 }]}>
                    <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold' }}>
                      {isExterna ? 'CLM (Empresa): ' : 'M (Manutenção): '}
                      <Text style={{ fontFamily: 'Helvetica' }}>{formatCurrency(data.cost_company)}</Text>
                    </Text>
                    <Text style={{ fontSize: 6.2, fontFamily: 'Helvetica-Bold', marginTop: 1 }}>
                      {isExterna ? 'CLIENTE: ' : 'C (Compras): '}
                      <Text style={{ fontFamily: 'Helvetica' }}>{formatCurrency(data.cost_client)}</Text>
                    </Text>
                  </View>
                  <View style={[styles.cellLast, { width: '45%', paddingVertical: 2 }]}>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold' }}>
                      [ {data.has_pending ? 'X' : ' '} ] {isExterna ? 'SIM' : 'S'}
                    </Text>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', marginTop: 1 }}>
                      [ {data.has_pending === false ? 'X' : ' '} ] {isExterna ? 'NÃO' : 'N'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 9. RELATÓRIO TÉCNICO COMPLEMENTAR (OPCIONAL) */}
        {data.description && (
          <View style={styles.table}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Relatório Técnico Detalhado / Observações Gerais</Text>
            </View>
            <View style={styles.sectionContentBox}>
              <Text style={styles.sectionContentText}>{data.description}</Text>
            </View>
          </View>
        )}

      </Page>
    </Document>
  );
};

export default ServiceOrderDocument;
