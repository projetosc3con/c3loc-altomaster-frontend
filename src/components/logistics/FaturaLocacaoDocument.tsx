import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoAltoMaster from '../../assets/cabecalho-contrato.jpeg';
import { formatDate } from '../../utils/date';

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#000',
    lineHeight: 1.2,
  },
  // Container com borda externa
  mainContainer: {
    borderWidth: 1,
    borderColor: '#000',
    flexDirection: 'column',
  },
  // Cabeçalho superior
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
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Seção de Grade de Metadados
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
    fontSize: 6.5,
    color: '#000',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  cellValue: {
    fontSize: 7.5,
    color: '#000',
    fontWeight: 'normal',
  },
  cellValueBold: {
    fontSize: 7.5,
    color: '#000',
    fontWeight: 'bold',
  },
  // Tabela de Itens
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
    backgroundColor: '#fff',
    minHeight: 16,
    alignItems: 'center',
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#000',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  tableHeaderCellLast: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#000',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
    minHeight: 35,
  },
  tableCell: {
    fontSize: 7.5,
    padding: 4,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  tableCellLast: {
    fontSize: 7.5,
    padding: 4,
  },
  // Observações
  obsContainer: {
    padding: 6,
    minHeight: 280,
    borderBottomWidth: 1,
    borderColor: '#000',
  },
  obsTitle: {
    fontSize: 7,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  obsText: {
    fontSize: 7.5,
    lineHeight: 1.3,
  },
  // Rodapé Financeiro
  footerRow: {
    flexDirection: 'row',
    minHeight: 55,
  },
  footerPaymentCol: {
    width: '75%',
    padding: 6,
    borderRightWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
  },
  footerPaymentTextBold: {
    fontSize: 7.5,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  footerPaymentText: {
    fontSize: 7,
    color: '#000',
    marginBottom: 1,
  },
  footerTotalCol: {
    width: '25%',
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  totalLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});

interface FaturaLocacaoDocumentProps {
  contract: any;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  paymentMethod?: string;
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

const formatCurrency = (val: number) => {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const FaturaLocacaoDocument: React.FC<FaturaLocacaoDocumentProps> = ({
  contract,
  invoiceNumber,
  issueDate,
  dueDate,
  paymentMethod,
  companySettings,
}) => {
  const form = contract.contract_form || ({} as any);
  const deal = contract.deal || ({} as any);
  const client = deal.client || deal.clients || contract.client || ({} as any);
  const snapshot = contract.snapshot || ({} as any);

  // Informações da Locadora (Alto Master / Configurações)
  const companyName = companySettings?.company_name || 'ALTO MASTER LOCADORA DE EQUIPAMENTOS LTDA';
  const companyCnpj = companySettings?.cnpj || '48.477.385/0001-09';
  const companyIe = companySettings?.state_registration || '13.968.337-2';
  const companyAddress = companySettings?.address_full || 'AV IDEMAR RIEDI, 12032 - INDUSTRIAL - 2A ETAPA - CEP: 78897-066 - SORRISO - MT';
  const companyPhone = companySettings?.phone || '(66) 99649-8440';

  // Informações do Tomador (Cliente)
  const clientName = form.locatario_company_name || client.company_name || 'CLIENTE NÃO INFORMADO';
  const clientCnpj = form.locatario_cnpj || client.cnpj || '-';
  const clientPhone = form.locatario_phone || form.site_contact_phone || client.phone || '-';
  const clientIe =
    form.locatario_state_registration ||
    form.locatario_state_subscription ||
    form.state_subscription ||
    form.state_registration ||
    client.state_subscription ||
    client.state_registration ||
    client.ie ||
    client.inscricao_estadual ||
    deal.clients?.state_subscription ||
    deal.clients?.state_registration ||
    deal.client?.state_subscription ||
    deal.client?.state_registration ||
    snapshot.locatario?.state_registration ||
    snapshot.locatario?.state_subscription ||
    snapshot.client?.state_subscription ||
    snapshot.client?.state_registration ||
    (contract as any).state_subscription ||
    (contract as any).state_registration ||
    '-';

  // Formatação do Endereço do Cliente
  // Composto por: Rua, Número, Complemento, Cidade - Estado, CEP
  const formatClientAddress = () => {
    const c = client || {};
    const f = form || {};
    const s = snapshot?.client || snapshot || {};

    const street = c.address_street || f.address_street || f.locatario_street || s.address_street || '';
    const number = c.address_number || f.address_number || f.locatario_number || s.address_number || '';
    const complement = c.address_complement || f.address_complement || f.locatario_complement || s.address_complement || '';
    const city = c.address_city || f.address_city || f.locatario_city || s.address_city || '';
    const state = c.address_state || c.address_sate || f.address_state || f.locatario_state || s.address_state || '';
    const zip = c.address_zip || f.address_zip || f.locatario_zip || s.address_zip || '';

    const parts: string[] = [];

    // Logradouro e Número
    if (street && number) {
      parts.push(`${street}, Nº ${number}`);
    } else if (street) {
      parts.push(street);
    } else if (number) {
      parts.push(`Nº ${number}`);
    }

    // Complemento
    if (complement) {
      parts.push(complement);
    }

    // Cidade e Estado (ex: Sorriso - MT)
    if (city && state) {
      parts.push(`${city} - ${state}`);
    } else if (city) {
      parts.push(city);
    } else if (state) {
      parts.push(state);
    }

    // CEP
    if (zip) {
      parts.push(zip.toUpperCase().includes('CEP') ? zip : `CEP: ${zip}`);
    }

    if (parts.length > 0) {
      return parts.join(', ');
    }

    return form.locatario_address || form.locatario_address_full || client.address_full || '-';
  };

  const clientAddress = formatClientAddress();
  const workSite = form.work_site || snapshot.work_site || clientAddress;

  // Datas
  const periodStart = form.period_start || snapshot.period_start || '';
  const periodEnd = form.period_end || snapshot.period_end || '';
  const periodString = periodStart && periodEnd
    ? `${formatDate(periodStart)} a ${formatDate(periodEnd)}`
    : periodStart
      ? `A partir de ${formatDate(periodStart)}`
      : 'Conforme Contrato';

  const formattedIssueDate = issueDate ? formatDate(issueDate) : formatDate(new Date().toISOString());
  const finalDueDate = dueDate || form.period_end || periodEnd;
  const formattedDueDate = finalDueDate ? formatDate(finalDueDate) : formattedIssueDate;

  // Número da Fatura
  const formattedInvoiceNum = invoiceNumber || (contract.contract_number ? `ND-${String(contract.contract_number).padStart(6, '0')}` : 'ND-000001');

  // Valores e Itens
  const rentalCost = Number(form.cost_rental ?? snapshot.costs?.rental ?? deal.value ?? 0);
  const totalCost = Number(form.cost_total ?? snapshot.costs?.total ?? deal.value ?? 0);

  const equipmentsList = (contract.equipments && contract.equipments.length > 0)
    ? contract.equipments
    : (form.equipments && form.equipments.length > 0)
      ? form.equipments
      : (snapshot.equipments && snapshot.equipments.length > 0)
        ? snapshot.equipments
        : (snapshot.equipment?.items && snapshot.equipment.items.length > 0)
          ? snapshot.equipment.items
          : null;

  const equipmentDesc = form.equipment_description || snapshot.equipment?.description || 'EQUIPAMENTO DE LOCAÇÃO';

  return (
    <Document title={`Fatura de Locação - ${formattedInvoiceNum}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.mainContainer}>
          {/* 1. Header Row */}
          <View style={styles.headerRow}>
            {/* Logo */}
            <View style={styles.headerLogoCol}>
              <Image src={logoAltoMaster} style={styles.headerLogo} />
            </View>

            {/* Dados da Empresa */}
            <View style={styles.headerCompanyCol}>
              <Text style={styles.companyTitle}>{companyName}</Text>
              <Text style={styles.companyText}>{companyAddress}</Text>
              <Text style={styles.companyText}>FONE: {companyPhone}</Text>
              <Text style={styles.companyText}>CNPJ (MF): {companyCnpj}</Text>
              <Text style={styles.companyText}>INSC. ESTADUAL: {companyIe}</Text>
            </View>

            {/* Bloco Fatura de Locação */}
            <View style={styles.headerInvoiceCol}>
              <Text style={styles.invoiceBoxTitle}>FATURA DE</Text>
              <Text style={styles.invoiceBoxSub}>LOCAÇÃO</Text>
              <Text style={styles.invoiceBoxNumber}>{formattedInvoiceNum}</Text>
            </View>
          </View>

          {/* 2. Metadados - Linha 1 */}
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, { width: '48%' }]}>
              <Text style={styles.cellLabel}>PERÍODO DE REFERÊNCIA</Text>
              <Text style={styles.cellValue}>{periodString}</Text>
            </View>
            <View style={[styles.gridCell, { width: '32%' }]}>
              <Text style={styles.cellLabel}>NATUREZA DA OPERAÇÃO</Text>
              <Text style={styles.cellValue}>Fatura de Locação de bens móveis</Text>
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

          {/* 5. Metadados - Linha 4 (Entrega) */}
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, { width: '78%' }]}>
              <Text style={styles.cellLabel}>ENDEREÇO DE ENTREGA</Text>
              <Text style={styles.cellValue}>{workSite}</Text>
            </View>
            <View style={[styles.gridCellLast, { width: '22%' }]}>
              <Text style={styles.cellLabel}>INSC MUNICIPAL</Text>
              <Text style={styles.cellValue}>-</Text>
            </View>
          </View>

          {/* 6. Tabela de Itens - Cabeçalho */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'center' }]}>Quantidade</Text>
            <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'center' }]}>Unidade</Text>
            <Text style={[styles.tableHeaderCell, { width: '54%' }]}>Discriminação</Text>
            <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>Valor Unitário</Text>
            <Text style={[styles.tableHeaderCellLast, { width: '12%', textAlign: 'right' }]}>Valor Total</Text>
          </View>

          {/* 7. Tabela de Itens */}
          {equipmentsList && equipmentsList.length > 0 ? (
            equipmentsList.map((eq: any, idx: number) => {
              const eqDesc = eq.equipment_name || eq.description || equipmentDesc;
              const eqHeight = eq.equipment_size ? ` - ${eq.equipment_size}` : '';
              const eqAsset = eq.asset_number ? ` (Patrimônio: ${eq.asset_number})` : '';
              const eqVal = Number(eq.total_value ?? eq.cost_rental ?? 0);
              const start = eq.billing_period_start || eq.period_start || form.period_start || snapshot.period_start;
              const end = eq.billing_period_end || eq.period_end || form.period_end || snapshot.period_end;
              const itemPeriod = start && end
                ? `${formatDate(start)} a ${formatDate(end)}`
                : start
                  ? `A partir de ${formatDate(start)}`
                  : periodString;

              return (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { width: '12%', textAlign: 'center' }]}>1</Text>
                  <Text style={[styles.tableCell, { width: '10%', textAlign: 'center' }]}>UN</Text>
                  <View style={[styles.tableCell, { width: '54%' }]}>
                    <Text style={{ fontWeight: 'normal' }}>Locação de Equipamento:</Text>
                    <Text style={{ fontWeight: 'bold', marginTop: 1.5 }}>{eqDesc}{eqHeight}{eqAsset}</Text>
                    <Text style={{ fontSize: 6.5, color: '#333', marginTop: 1.5 }}>
                      Período de referência: <Text style={{ fontWeight: 'bold' }}>{itemPeriod}</Text>
                    </Text>
                    {contract.contract_number && (
                      <Text style={{ fontSize: 6.5, color: '#555', marginTop: 1 }}>Contrato Nº {contract.contract_number}</Text>
                    )}
                  </View>
                  <Text style={[styles.tableCell, { width: '12%', textAlign: 'right' }]}>{formatCurrency(eqVal)}</Text>
                  <Text style={[styles.tableCellLast, { width: '12%', textAlign: 'right' }]}>{formatCurrency(eqVal)}</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '12%', textAlign: 'center' }]}>1</Text>
              <Text style={[styles.tableCell, { width: '10%', textAlign: 'center' }]}>UN</Text>
              <View style={[styles.tableCell, { width: '54%' }]}>
                <Text style={{ fontWeight: 'normal' }}>Locação do equipamento abaixo conforme contrato:</Text>
                <Text style={{ fontWeight: 'bold', marginTop: 1.5 }}>{equipmentDesc}</Text>
                <Text style={{ fontSize: 6.5, color: '#333', marginTop: 1.5 }}>
                  Período de locação: <Text style={{ fontWeight: 'bold' }}>{periodString}</Text>
                </Text>
                {contract.contract_number && (
                  <Text style={{ fontSize: 6.5, color: '#555', marginTop: 1 }}>Contrato Nº {contract.contract_number}</Text>
                )}
              </View>
              <Text style={[styles.tableCell, { width: '12%', textAlign: 'right' }]}>{formatCurrency(rentalCost || totalCost)}</Text>
              <Text style={[styles.tableCellLast, { width: '12%', textAlign: 'right' }]}>{formatCurrency(rentalCost || totalCost)}</Text>
            </View>
          )}

          {/* 8. Observações */}
          <View style={styles.obsContainer}>
            <Text style={styles.obsTitle}>Observações:</Text>
            <Text style={styles.obsText}>
              {form.notes || form.observations || contract.notes || contract.observations || snapshot.observations || snapshot.notes || deal.notes || 'PROPOSTA ASSINADA'}
            </Text>
          </View>

          {/* 9. Rodapé Financeiro e Total */}
          <View style={styles.footerRow}>
            <View style={styles.footerPaymentCol}>
              <Text style={styles.footerPaymentTextBold}>
                {paymentMethod || 'Boleto'} – Vencimento: {formattedDueDate}
              </Text>
              <Text style={styles.footerPaymentText}>
                {companySettings?.bank_name || 'BANCO DO BRASIL'}
                {companySettings?.bank_pix_key ? ` • PIX: ${companySettings.bank_pix_key}` : ''}
              </Text>
              <Text style={styles.footerPaymentTextBold}>{companyName}</Text>
              <Text style={styles.footerPaymentText}>CNPJ: {companyCnpj}</Text>
            </View>

            <View style={styles.footerTotalCol}>
              <Text style={styles.totalLabel}>VALOR TOTAL</Text>
              <Text style={styles.totalValue}>R$ {formatCurrency(totalCost)}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default FaturaLocacaoDocument;
