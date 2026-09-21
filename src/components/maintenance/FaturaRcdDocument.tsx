import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoAltoMaster from '../../assets/cabecalho-contrato.jpeg';
import { formatDate } from '../../utils/date';
import type { ServiceOrderRcd, ServiceOrder } from '../../types';

export interface FaturaRcdDocumentProps {
  rcd: ServiceOrderRcd;
  os?: Partial<ServiceOrder>;
  invoiceNumber?: string;
  dueDate?: string;
  companySettings?: {
    company_name?: string;
    cnpj?: string;
    state_registration?: string;
    address_full?: string;
    phone?: string;
    bank_name?: string;
    bank_pix_key?: string;
  };
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#000',
    lineHeight: 1.2,
  },
  mainContainer: {
    borderWidth: 1,
    borderColor: '#000',
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
    minHeight: 65,
  },
  headerLogoCol: {
    width: '22%',
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#000',
  },
  headerLogo: {
    width: '100%',
    height: 48,
    objectFit: 'contain',
  },
  headerCompanyCol: {
    width: '58%',
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#000',
    textAlign: 'center',
  },
  companyTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  companyText: {
    fontSize: 7.5,
    color: '#000',
    textAlign: 'center',
    marginBottom: 1,
  },
  headerInvoiceCol: {
    width: '20%',
    backgroundColor: '#000',
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  invoiceBoxTitle: {
    color: '#fff',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  invoiceBoxSub: {
    color: '#fff',
    fontSize: 7,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  invoiceBoxNumber: {
    color: '#fff',
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
  },
  gridCell: {
    padding: 3,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  gridCellLast: {
    padding: 3,
    paddingHorizontal: 4,
  },
  cellLabel: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: '#000',
    textTransform: 'uppercase',
    marginBottom: 1.5,
  },
  cellValue: {
    fontSize: 7.5,
    color: '#000',
  },
  cellValueBold: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    padding: 3,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderColor: '#000',
    textTransform: 'uppercase',
  },
  tableHeaderCellLast: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    padding: 3,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
    minHeight: 18,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 7.5,
    padding: 3,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  tableCellLast: {
    fontSize: 7.5,
    padding: 3,
    paddingHorizontal: 4,
  },
  obsContainer: {
    padding: 5,
    borderBottomWidth: 1,
    borderColor: '#000',
    minHeight: 38,
  },
  obsTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  obsText: {
    fontSize: 7,
    color: '#000',
    lineHeight: 1.3,
  },
  footerRow: {
    flexDirection: 'row',
    minHeight: 48,
  },
  footerPaymentCol: {
    width: '75%',
    padding: 4,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#000',
  },
  footerPaymentTextBold: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 1.5,
  },
  footerPaymentText: {
    fontSize: 7,
    color: '#333',
    marginBottom: 1,
  },
  footerTotalCol: {
    width: '25%',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  totalLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
    textAlign: 'center',
  },
  totalValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
});

const formatCurrency = (val: number | undefined | null) => {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const FaturaRcdDocument: React.FC<FaturaRcdDocumentProps> = ({
  rcd,
  os,
  invoiceNumber,
  dueDate,
  companySettings,
}) => {
  const companyName = companySettings?.company_name || 'ALTO MASTER LOCADORA DE EQUIPAMENTOS LTDA';
  const companyCnpj = companySettings?.cnpj || '48.477.385/0001-09';
  const companyIe = companySettings?.state_registration || '13.968.337-2';
  const companyAddress = companySettings?.address_full || 'AV IDEMAR RIEDI, 12032 - INDUSTRIAL - 2A ETAPA - CEP: 78897-066 - SORRISO - MT';
  const companyPhone = companySettings?.phone || '(47) 99788-0131';

  const parts = rcd.parts || [];
  const services = rcd.services || [];
  const totalValue = rcd.total_value ?? 0;

  const formattedInvoiceNum = invoiceNumber || rcd.invoice_number || rcd.rcd_number || `ND-${String(os?.os_number || '1').padStart(6, '0')}`;
  const formattedIssueDate = rcd.issue_date ? formatDate(rcd.issue_date) : formatDate(new Date().toISOString());

  const clientName = rcd.client_name || os?.client_name || 'CLIENTE NÃO INFORMADO';
  const clientCnpj = rcd.client_cnpj || '-';
  const clientPhone = rcd.client_phone || os?.client_phone || '-';
  const clientAddress = rcd.client_address || os?.client_address || '-';
  const clientIe = rcd.client_ie || '-';

  const osRef = os?.os_number ? `OS #${os.os_number}` : '';
  const equipRef = rcd.equipment_name || os?.equipment_name || 'Equipamento';
  const assetRef = rcd.equipment_asset_number || os?.equipment_asset_number ? `(Patrimônio: ${rcd.equipment_asset_number || os?.equipment_asset_number})` : '';

  // Payment description in footer
  const isParcelado = rcd.payment_type === 'parcelado' && Array.isArray(rcd.installments_data) && rcd.installments_data.length > 1;
  const installments = rcd.installments_data || [];

  const firstDueDate = installments[0]?.due_date || dueDate || rcd.validity_date || rcd.issue_date;
  const formattedFirstDueDate = firstDueDate ? formatDate(firstDueDate) : formattedIssueDate;

  return (
    <Document title={`Fatura RCD - ${formattedInvoiceNum}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.mainContainer}>
          {/* 1. Cabeçalho */}
          <View style={styles.headerRow}>
            <View style={styles.headerLogoCol}>
              <Image src={logoAltoMaster} style={styles.headerLogo} />
            </View>
            <View style={styles.headerCompanyCol}>
              <Text style={styles.companyTitle}>{companyName}</Text>
              <Text style={styles.companyText}>{companyAddress}</Text>
              <Text style={styles.companyText}>FONE: {companyPhone}</Text>
              <Text style={styles.companyText}>CNPJ (MF): {companyCnpj}</Text>
              <Text style={styles.companyText}>INSC. ESTADUAL: {companyIe}</Text>
            </View>
            <View style={styles.headerInvoiceCol}>
              <Text style={styles.invoiceBoxTitle}>FATURA DE</Text>
              <Text style={styles.invoiceBoxSub}>RESSARCIMENTO</Text>
              <Text style={styles.invoiceBoxNumber}>{formattedInvoiceNum}</Text>
            </View>
          </View>

          {/* 2. Metadados - Linha 1 */}
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, { width: '45%' }]}>
              <Text style={styles.cellLabel}>PERÍODO / REFERÊNCIA</Text>
              <Text style={styles.cellValue}>{rcd.origin_description || 'Manutenção'} {osRef}</Text>
            </View>
            <View style={[styles.gridCell, { width: '35%' }]}>
              <Text style={styles.cellLabel}>NATUREZA DA OPERAÇÃO</Text>
              <Text style={styles.cellValue}>Ressarcimento de Danos e Despesas</Text>
            </View>
            <View style={[styles.gridCellLast, { width: '20%' }]}>
              <Text style={styles.cellLabel}>DATA DE EMISSÃO</Text>
              <Text style={styles.cellValue}>{formattedIssueDate}</Text>
            </View>
          </View>

          {/* 3. Metadados - Linha 2 (Tomador) */}
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, { width: '58%' }]}>
              <Text style={styles.cellLabel}>TOMADOR - RAZÃO SOCIAL</Text>
              <Text style={styles.cellValueBold}>{clientName}</Text>
            </View>
            <View style={[styles.gridCell, { width: '20%' }]}>
              <Text style={styles.cellLabel}>TELEFONE</Text>
              <Text style={styles.cellValue}>{clientPhone}</Text>
            </View>
            <View style={[styles.gridCellLast, { width: '22%' }]}>
              <Text style={styles.cellLabel}>C.N.P.J / CPF</Text>
              <Text style={styles.cellValue}>{clientCnpj}</Text>
            </View>
          </View>

          {/* 4. Metadados - Linha 3 (Endereço) */}
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, { width: '78%' }]}>
              <Text style={styles.cellLabel}>ENDEREÇO DO CLIENTE</Text>
              <Text style={styles.cellValue}>{clientAddress}</Text>
            </View>
            <View style={[styles.gridCellLast, { width: '22%' }]}>
              <Text style={styles.cellLabel}>INSC ESTADUAL / RG</Text>
              <Text style={styles.cellValue}>{clientIe}</Text>
            </View>
          </View>

          {/* 5. Tabela de Itens - Cabeçalho */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'center' }]}>Quantidade</Text>
            <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'center' }]}>Unidade</Text>
            <Text style={[styles.tableHeaderCell, { width: '54%' }]}>Discriminação</Text>
            <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>Valor Unitário</Text>
            <Text style={[styles.tableHeaderCellLast, { width: '12%', textAlign: 'right' }]}>Valor Total</Text>
          </View>

          {/* 6. Itens de Peças */}
          {parts.map((p, idx) => (
            <View key={`part-${idx}`} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '12%', textAlign: 'center' }]}>{p.quantity}</Text>
              <Text style={[styles.tableCell, { width: '10%', textAlign: 'center' }]}>UN</Text>
              <View style={[styles.tableCell, { width: '54%' }]}>
                <Text style={{ fontWeight: 'normal' }}>Reposição de Peça / Componente:</Text>
                <Text style={{ fontWeight: 'bold', marginTop: 1 }}>{p.description} {p.internal_code ? `(Cód: ${p.internal_code})` : ''}</Text>
                <Text style={{ fontSize: 6.5, color: '#333', marginTop: 1 }}>
                  Equipamento: {equipRef} {assetRef} {osRef ? `• ${osRef}` : ''}
                </Text>
              </View>
              <Text style={[styles.tableCell, { width: '12%', textAlign: 'right' }]}>{formatCurrency(p.unit_value)}</Text>
              <Text style={[styles.tableCellLast, { width: '12%', textAlign: 'right' }]}>{formatCurrency(p.subtotal)}</Text>
            </View>
          ))}

          {/* 7. Itens de Serviços */}
          {services.map((s, idx) => (
            <View key={`serv-${idx}`} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '12%', textAlign: 'center' }]}>
                {s.type === 'deslocamento' && s.km ? `${s.km}` : `${s.quantity}`}
              </Text>
              <Text style={[styles.tableCell, { width: '10%', textAlign: 'center' }]}>
                {s.type === 'deslocamento' ? 'KM' : 'SERV'}
              </Text>
              <View style={[styles.tableCell, { width: '54%' }]}>
                <Text style={{ fontWeight: 'normal' }}>Serviço Técnico Especializado:</Text>
                <Text style={{ fontWeight: 'bold', marginTop: 1 }}>{s.description}</Text>
                <Text style={{ fontSize: 6.5, color: '#333', marginTop: 1 }}>
                  Referência: {osRef || 'Manutenção'} • {equipRef} {assetRef}
                </Text>
              </View>
              <Text style={[styles.tableCell, { width: '12%', textAlign: 'right' }]}>{formatCurrency(s.unit_value)}</Text>
              <Text style={[styles.tableCellLast, { width: '12%', textAlign: 'right' }]}>{formatCurrency(s.subtotal)}</Text>
            </View>
          ))}

          {parts.length === 0 && services.length === 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCellLast, { width: '100%', textAlign: 'center', color: '#64748b' }]}>
                Nenhum item lançado no RCD.
              </Text>
            </View>
          )}

          {/* 8. Observações */}
          <View style={styles.obsContainer}>
            <Text style={styles.obsTitle}>Observações:</Text>
            <Text style={styles.obsText}>
              {rcd.notes || 'Ressarcimento de danos e despesas conforme termo de inspeção da Ordem de Serviço.'}
            </Text>
          </View>

          {/* 9. Rodapé Financeiro e Total */}
          <View style={styles.footerRow}>
            <View style={styles.footerPaymentCol}>
              {isParcelado ? (
                <>
                  <Text style={styles.footerPaymentTextBold}>
                    {rcd.payment_method || 'Boleto Bancário'} – Parcelado em {installments.length}x:
                  </Text>
                  <Text style={styles.footerPaymentText}>
                    {installments.map((inst, i) => `${i + 1}ª: ${formatDate(inst.due_date)} (R$ ${formatCurrency(inst.gross_value)})`).join(' • ')}
                  </Text>
                </>
              ) : (
                <Text style={styles.footerPaymentTextBold}>
                  {rcd.payment_method || 'Boleto Bancário'} – Vencimento: {formattedFirstDueDate}
                </Text>
              )}
              <Text style={styles.footerPaymentText}>
                {companySettings?.bank_name || 'BANCO DO BRASIL'}
                {companySettings?.bank_pix_key ? ` • PIX: ${companySettings.bank_pix_key}` : ''}
              </Text>
              <Text style={styles.footerPaymentTextBold}>{companyName}</Text>
              <Text style={styles.footerPaymentText}>CNPJ: {companyCnpj}</Text>
            </View>

            <View style={styles.footerTotalCol}>
              <Text style={styles.totalLabel}>VALOR TOTAL</Text>
              <Text style={styles.totalValue}>R$ {formatCurrency(totalValue)}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default FaturaRcdDocument;
