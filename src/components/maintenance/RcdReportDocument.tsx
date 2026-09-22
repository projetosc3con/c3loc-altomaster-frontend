import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoAltoMaster from '../../assets/cabecalho-contrato.jpeg';
import { formatDate } from '../../utils/date';
import type { ServiceOrderRcd } from '../../types';

export interface RcdReportDocumentProps {
  rcd: ServiceOrderRcd;
  companySettings?: {
    company_name?: string;
    cnpj?: string;
    state_registration?: string;
    address_full?: string;
    phone?: string;
  };
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#000000',
    lineHeight: 1.25,
  },
  container: {
    borderWidth: 1,
    borderColor: '#000000',
    flexDirection: 'column',
  },
  // 1. Cabeçalho
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    padding: 6,
    minHeight: 65,
  },
  headerLogoCol: {
    width: '45%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#000000',
    paddingRight: 6,
  },
  headerLogo: {
    width: '95%',
    height: 52,
    objectFit: 'contain',
  },
  headerInfoCol: {
    width: '55%',
    paddingLeft: 8,
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  companyLine: {
    fontSize: 7.5,
    marginBottom: 1.5,
  },

  // 2. Faixa do Número e Datas
  titleBarRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
  },
  titleColLeft: {
    width: '54%',
    padding: 5,
    paddingLeft: 8,
    borderRightWidth: 1,
    borderColor: '#000000',
  },
  titleText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  titleColMid: {
    width: '23%',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#000000',
  },
  titleColRight: {
    width: '23%',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 8,
  },

  // 3. Seções em Geral
  sectionBox: {
    padding: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: '#000000',
  },
  sectionLine: {
    flexDirection: 'row',
    marginBottom: 3,
    fontSize: 8,
  },
  labelBold: {
    fontFamily: 'Helvetica-Bold',
    marginRight: 4,
  },
  textNormal: {
    fontSize: 8,
  },

  // 4. Tabelas
  tableTitleRow: {
    borderBottomWidth: 1,
    borderColor: '#000000',
    padding: 4,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  tableTitleText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    textAlign: 'center',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    paddingVertical: 3,
    paddingHorizontal: 4,
    backgroundColor: '#ffffff',
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#e2e8f0',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tableCell: {
    fontSize: 7.5,
  },
  tableSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderColor: '#000000',
    borderBottomWidth: 1,
    padding: 4,
    paddingRight: 10,
  },
  tableSubtotalText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },

  // 5. Total do Orçamento Banner
  totalBanner: {
    padding: 6,
    borderBottomWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  totalBannerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    textAlign: 'center',
  },

  // 6. Observações
  obsBox: {
    padding: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: '#000000',
    minHeight: 38,
  },
  obsTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    marginBottom: 2,
  },
  obsText: {
    fontSize: 7.5,
    lineHeight: 1.3,
  },

  // 7. Aprovação e Assinaturas
  approvalBox: {
    padding: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: '#000000',
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  approvalItem: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    marginRight: 16,
  },
  signaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  signCol: {
    width: '42%',
    alignItems: 'center',
  },
  signLine: {
    width: '100%',
    borderTopWidth: 1,
    borderColor: '#000000',
    marginBottom: 4,
  },
  signLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica',
  },

  // 8. Rodapé de Fabricantes
  footerLogosRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 6,
    paddingRight: 12,
    gap: 14,
  },
  brandText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
});

const formatCurrency = (val: number | undefined | null) => {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const RcdReportDocument: React.FC<RcdReportDocumentProps> = ({ rcd, companySettings }) => {
  const companyName = companySettings?.company_name || 'ALTO MASTER LOCADORA DE EQUIPAMENTOS LTDA';
  const companyCnpj = companySettings?.cnpj || '48.477.385/0001-09';
  const companyIe = companySettings?.state_registration || '13.968.337-2';
  const companyAddress = companySettings?.address_full || 'Av. Idemar Riedi, 12032, Industrial – 2A Etapa, Sorriso/MT - CEP: 78897-066';
  const companyPhone = companySettings?.phone || '(47) 99788-0131';

  const parts = rcd.parts || [];
  const services = rcd.services || [];

  const totalParts = rcd.total_parts ?? parts.reduce((acc, p) => acc + (Number(p.subtotal) || 0), 0);
  const totalServices = rcd.total_services ?? services.reduce((acc, s) => acc + (Number(s.subtotal) || 0), 0);
  const totalValue = rcd.total_value ?? (totalParts + totalServices);

  const formattedIssue = rcd.issue_date ? formatDate(rcd.issue_date) : formatDate(new Date().toISOString());
  const formattedValidity = rcd.validity_date ? formatDate(rcd.validity_date) : '15 DIAS';

  const rcdNumberDisplay = rcd.rcd_number || 'RESSARCIMENTO DE DANOS';

  return (
    <Document title={`${rcdNumberDisplay} - ${rcd.client_name || 'Cliente'}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.container}>
          {/* 1. Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLogoCol}>
              <Image src={logoAltoMaster} style={styles.headerLogo} />
            </View>
            <View style={styles.headerInfoCol}>
              <Text style={styles.companyName}>{companyName}</Text>
              <Text style={styles.companyLine}>CNPJ: {companyCnpj}</Text>
              <Text style={styles.companyLine}>Inscrição estadual: {companyIe}</Text>
              <Text style={styles.companyLine}>Endereço: {companyAddress}</Text>
              <Text style={styles.companyLine}>Telefone: {companyPhone}</Text>
            </View>
          </View>

          {/* 2. Barra de Título / Número e Datas */}
          <View style={styles.titleBarRow}>
            <View style={styles.titleColLeft}>
              <Text style={styles.titleText}>{rcdNumberDisplay}</Text>
            </View>
            <View style={styles.titleColMid}>
              <Text style={styles.metaLabel}>EMISSÃO</Text>
              <Text style={styles.metaValue}>{formattedIssue}</Text>
            </View>
            <View style={styles.titleColRight}>
              <Text style={styles.metaLabel}>VALIDADE DO ORÇAMENTO</Text>
              <Text style={styles.metaValue}>{formattedValidity}</Text>
            </View>
          </View>

          {/* 3. Dados do Cliente */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionLine}>
              <Text style={styles.labelBold}>Cliente:</Text>
              <Text style={styles.textNormal}>{rcd.client_name || '-'}</Text>
            </View>
            <View style={styles.sectionLine}>
              <Text style={styles.labelBold}>Endereço:</Text>
              <Text style={styles.textNormal}>{rcd.client_address || '-'}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
              <View style={{ flexDirection: 'row', width: '55%' }}>
                <Text style={styles.labelBold}>CNPJ:</Text>
                <Text style={styles.textNormal}>{rcd.client_cnpj || '-'}</Text>
              </View>
              <View style={{ flexDirection: 'row', width: '45%' }}>
                <Text style={styles.labelBold}>Inscr. Est.:</Text>
                <Text style={styles.textNormal}>{rcd.client_ie || '-'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', width: '55%' }}>
                <Text style={styles.labelBold}>Contato:</Text>
                <Text style={styles.textNormal}>{rcd.client_contact || '-'}</Text>
              </View>
              <View style={{ flexDirection: 'row', width: '45%' }}>
                <Text style={styles.labelBold}>Fone:</Text>
                <Text style={styles.textNormal}>{rcd.client_phone || '-'}</Text>
              </View>
            </View>
          </View>

          {/* 4. Origem & Equipamento */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionLine}>
              <Text style={styles.labelBold}>Origem:</Text>
              <Text style={styles.textNormal}>{rcd.origin_description || 'Contrato de locação'}</Text>
            </View>
            <View style={styles.sectionLine}>
              <Text style={styles.labelBold}>Equipamento:</Text>
              <Text style={styles.textNormal}>
                {rcd.equipment_name || 'Equipamento'} {rcd.equipment_model ? `– ${rcd.equipment_model}` : ''}
              </Text>
            </View>
            <View style={styles.sectionLine}>
              <Text style={styles.labelBold}>PATRIMÔNIO:</Text>
              <Text style={styles.textNormal}>{rcd.equipment_asset_number || '-'}</Text>
            </View>
          </View>

          {/* 5. Descrição / Problema */}
          <View style={styles.sectionBox}>
            <Text style={[styles.labelBold, { marginBottom: 2 }]}>Descrição:</Text>
            <View style={styles.sectionLine}>
              <Text style={styles.labelBold}>Problema:</Text>
              <Text style={[styles.textNormal, { flex: 1, textTransform: 'uppercase' }]}>
                {rcd.problem_description || 'Inspeção técnica realizada no equipamento.'}
              </Text>
            </View>
          </View>

          {/* 6. Tabela de Peças */}
          <View style={styles.tableTitleRow}>
            <Text style={styles.tableTitleText}>Relação de peças a serem utilizadas</Text>
          </View>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: '8%', textAlign: 'center' }]}>Qt.</Text>
            <Text style={[styles.tableHeaderCell, { width: '8%', textAlign: 'center' }]}>Un.</Text>
            <Text style={[styles.tableHeaderCell, { width: '16%' }]}>Código</Text>
            <Text style={[styles.tableHeaderCell, { width: '42%' }]}>Material</Text>
            <Text style={[styles.tableHeaderCell, { width: '13%', textAlign: 'right' }]}>Valor unitario</Text>
            <Text style={[styles.tableHeaderCell, { width: '13%', textAlign: 'right' }]}>Valor Total</Text>
          </View>

          {parts.length > 0 ? (
            parts.map((p, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>
                  {String(p.quantity || 1).padStart(2, '0')}
                </Text>
                <Text style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>UN</Text>
                <Text style={[styles.tableCell, { width: '16%' }]}>{p.internal_code || '-'}</Text>
                <Text style={[styles.tableCell, { width: '42%', textTransform: 'uppercase' }]}>{p.description}</Text>
                <Text style={[styles.tableCell, { width: '13%', textAlign: 'right' }]}>
                  R$ {formatCurrency(p.unit_value)}
                </Text>
                <Text style={[styles.tableCell, { width: '13%', textAlign: 'right' }]}>
                  R$ {formatCurrency(p.subtotal)}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '100%', textAlign: 'center', color: '#64748b' }]}>
                Nenhuma peça cobrada neste relatório.
              </Text>
            </View>
          )}

          <View style={styles.tableSubtotalRow}>
            <Text style={styles.tableSubtotalText}>Total das Peças : R$ {formatCurrency(totalParts)}</Text>
          </View>

          {/* 7. Tabela de Serviços */}
          <View style={styles.tableTitleRow}>
            <Text style={styles.tableTitleText}>Relação de serviços a serem executados</Text>
          </View>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'center' }]}>Qt.</Text>
            <Text style={[styles.tableHeaderCell, { width: '64%' }]}>Descrição</Text>
            <Text style={[styles.tableHeaderCell, { width: '13%', textAlign: 'right' }]}>Valor unitario</Text>
            <Text style={[styles.tableHeaderCell, { width: '13%', textAlign: 'right' }]}>Valor Total</Text>
          </View>

          {services.length > 0 ? (
            services.map((s, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: '10%', textAlign: 'center' }]}>
                  {s.type === 'deslocamento' && s.km ? `${s.km} KM` : String(s.quantity || 1).padStart(2, '0')}
                </Text>
                <Text style={[styles.tableCell, { width: '64%', textTransform: 'uppercase' }]}>
                  {s.description}
                </Text>
                <Text style={[styles.tableCell, { width: '13%', textAlign: 'right' }]}>
                  R$ {formatCurrency(s.unit_value)}
                </Text>
                <Text style={[styles.tableCell, { width: '13%', textAlign: 'right' }]}>
                  R$ {formatCurrency(s.subtotal)}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '100%', textAlign: 'center', color: '#64748b' }]}>
                Nenhum serviço cobrado neste relatório.
              </Text>
            </View>
          )}

          <View style={styles.tableSubtotalRow}>
            <Text style={styles.tableSubtotalText}>Total dos Serviços : R$ {formatCurrency(totalServices)}</Text>
          </View>

          {/* 8. Total do Orçamento Banner */}
          <View style={styles.totalBanner}>
            <Text style={styles.totalBannerText}>
              TOTAL DO ORÇAMENTO: R$ {formatCurrency(totalValue)} – {rcd.payment_terms || '15 DIAS PARA PAGAMENTO'}
            </Text>
          </View>

          {/* 9. Observações */}
          <View style={styles.obsBox}>
            <Text style={styles.obsTitle}>Observações:</Text>
            <Text style={styles.obsText}>
              {rcd.notes || 'PELA FORTE PARCERIA QUE TEMOS SERÁ COBRADO APENAS AS PEÇAS PARA REPOSIÇÃO.'}
            </Text>
          </View>

          {/* 10. Aprovação e Assinaturas */}
          <View style={styles.approvalBox}>
            <View style={styles.approvalRow}>
              <Text style={styles.approvalItem}>APROVADO</Text>
              <Text style={styles.approvalItem}>(  ) SIM</Text>
              <Text style={styles.approvalItem}>(  ) NÃO</Text>
              <Text style={[styles.approvalItem, { marginLeft: 16 }]}>DATA: ______/______/___________</Text>
            </View>

            <View style={styles.signaturesRow}>
              <View style={styles.signCol}>
                <View style={styles.signLine} />
                <Text style={styles.signLabel}>Técnico Responsável</Text>
              </View>
              <View style={styles.signCol}>
                <View style={styles.signLine} />
                <Text style={styles.signLabel}>Assinatura do Cliente</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default RcdReportDocument;
