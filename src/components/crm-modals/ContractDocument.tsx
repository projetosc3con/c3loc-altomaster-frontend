import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoAltoMaster from '../../assets/cabecalho-contrato.jpeg';

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 28,
    paddingVertical: 20,
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: '#000',
    lineHeight: 1.35,
  },
  // Top Header Row on each page
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 52,
  },
  headerLogoLeft: {
    width: 175,
    height: 50,
    objectFit: 'contain',
  },
  headerLogoRight: {
    width: 75,
    height: 50,
    objectFit: 'contain',
  },
  // Title on Page 1
  contractTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  contractTitle: {
    fontSize: 12.5,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  // Date & Contract Number Bar
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoCellLeft: {
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#c5d9f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: '38%',
  },
  infoCellRight: {
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#c5d9f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: '42%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoTextBold: {
    color: '#000',
    fontSize: 9.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  // Bordered Sections
  partyBox: {
    borderWidth: 1,
    borderColor: '#000',
    padding: 6,
    marginBottom: 6,
  },
  partyBoxTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  partyRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  partyLabel: {
    width: 85,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  partyValue: {
    flex: 1,
    fontSize: 9,
  },
  partyValueBold: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
  },
  // Proposta e Valores
  proposalHeader: {
    fontSize: 10.5,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginVertical: 8,
  },
  proposalBox: {
    borderWidth: 1,
    borderColor: '#000',
    padding: 7,
    marginBottom: 8,
  },
  proposalLine: {
    fontSize: 9,
    lineHeight: 1.35,
    marginBottom: 3,
  },
  proposalLabel: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  // Location & Reception Box
  locationTable: {
    borderWidth: 1,
    borderColor: '#000',
    flexDirection: 'row',
    marginTop: 6,
  },
  locationLeftCol: {
    width: '32%',
    padding: 7,
    borderRightWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
  },
  locationRightCol: {
    width: '68%',
    padding: 7,
    justifyContent: 'center',
  },
  locationLabelText: {
    fontSize: 9,
    marginBottom: 4,
  },
  locationValueText: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  // Legal Clauses & Sections (Pages 2 & 3)
  clauseTitle: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 2.5,
  },
  clauseParagraph: {
    fontFamily: 'Helvetica',
    fontSize: 7.2,
    color: '#000',
    marginBottom: 3,
    textAlign: 'justify',
    lineHeight: 1.3,
  },
  clauseParagraphBold: {
    fontFamily: 'Helvetica',
    fontSize: 7.2,
    color: '#000',
    fontWeight: 'bold',
    marginBottom: 3,
    textAlign: 'justify',
    lineHeight: 1.3,
  },
  redNotice: {
    fontFamily: 'Helvetica',
    fontSize: 7.2,
    fontWeight: 'bold',
    color: '#b91c1c',
    marginVertical: 3,
    textAlign: 'justify',
    lineHeight: 1.3,
  },
  listContainer: {
    marginVertical: 2,
    paddingLeft: 4,
  },
  listItem: {
    fontFamily: 'Helvetica',
    fontSize: 7.2,
    color: '#000',
    marginBottom: 1,
    lineHeight: 1.3,
  },
  // Page 3 Notices & Signatures
  dieselBox: {
    borderWidth: 1,
    borderColor: '#000',
    padding: 6,
    marginVertical: 8,
  },
  dieselText: {
    fontFamily: 'Helvetica',
    fontSize: 7.2,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'justify',
    lineHeight: 1.3,
  },
  signatureBox: {
    borderWidth: 1,
    borderColor: '#000',
    flexDirection: 'row',
    minHeight: 80,
    padding: 8,
    marginTop: 6,
  },
  signatureColLeft: {
    width: '50%',
    paddingRight: 8,
    borderRightWidth: 1,
    borderColor: '#000',
    justifyContent: 'space-between',
  },
  signatureColRight: {
    width: '50%',
    paddingLeft: 8,
    justifyContent: 'space-between',
  },
  signaturePartyTitle: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  signatureLineText: {
    fontFamily: 'Helvetica',
    fontSize: 7.2,
    marginTop: 5,
  },
  locadorImgSign: {
    width: 90,
    height: 35,
    objectFit: 'contain',
    alignSelf: 'center',
    marginVertical: 2,
  },
  bold: {
    fontWeight: 'bold',
  },
});

interface ContractDocumentProps {
  data: any;
  generatedAt?: string;
}

const ContractDocument: React.FC<ContractDocumentProps> = ({ data, generatedAt }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const buildCostsText = () => {
    const items = [
      { value: data.costs?.rental, label: 'Valor da locação' },
      { value: data.costs?.insurance, label: 'SEGURO' },
      { value: data.costs?.freight, label: 'FRETE' },
      { value: data.costs?.rcd, label: 'RCD' },
      { value: data.costs?.third_party, label: 'TERCEIROS' },
      { value: data.costs?.training, label: 'TREINAMENTO' },
    ];

    const rentalPart = data.costs?.rental
      ? formatCurrency(Number(data.costs.rental))
      : (data.value ? formatCurrency(Number(data.value)) : 'R$ 0,00');

    const additions = items
      .slice(1)
      .filter(item => item.value !== undefined && item.value !== null && Number(item.value) > 0)
      .map(item => `${item.label} ${formatCurrency(Number(item.value))}`);

    if (additions.length > 0) {
      return `${rentalPart} + ${additions.join(' + ')}.`;
    }
    return `${rentalPart}.`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const clean = dateStr.split('T')[0];
      const [year, month, day] = clean.split('-');
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getDurationDaysText = () => {
    if (data.contract_duration_days) {
      return `${data.contract_duration_days} dias`;
    }
    if (data.period_start && data.period_end) {
      const start = new Date(data.period_start);
      const end = new Date(data.period_end);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (!isNaN(diffDays) && diffDays > 0) {
        return `${diffDays} dias`;
      }
    }
    return '15 dias';
  };

  const locadorName = data.locador?.company_name || 'ALTO MASTER LOCADORA DE EQUIPAMENTOS LTDA';
  const locadorAddress = data.locador?.address_full || 'Avenida Idemar Riedi, 12032, - Sorriso - MT';
  const locadorCnpj = data.locador?.cnpj || '48.477.385/0001-09';
  const locadorIe = data.locador?.state_registration || '13.968.337-2';
  const locadorBankInfo = `Banco do Brasil Ag.1917-8 Conta Corrente: 14.677-3 em nome de ALTO MASTER LOCADORA DE EQUIPAMENTOS LTDA, CNPJ 48.477.385/0001-09) PIX CNPJ`;

  const locatarioName = data.locatario?.company_name || 'N/A';
  const locatarioAddress = data.locatario?.address_full || 'N/A';
  const locatarioCnpj = data.locatario?.cnpj || 'N/A';
  const locatarioIe = data.locatario?.state_registration && data.locatario?.state_registration !== ''
    ? data.locatario.state_registration
    : '13.308.407-8';

  const equipmentsList = (data.equipments && data.equipments.length > 0)
    ? data.equipments
    : (data.equipment?.items && data.equipment.items.length > 0)
      ? data.equipment.items
      : null;

  const buildItemCostsText = (item: any) => {
    const items = [
      { label: 'Locação', value: item.cost_rental ?? item.rental },
      { label: 'Seguro', value: item.cost_insurance ?? item.insurance },
      { label: 'Frete', value: item.cost_freight ?? item.freight },
      { label: 'RCD', value: item.cost_rcd ?? item.rcd },
      { label: 'Terceiros', value: item.cost_third_party ?? item.third_party },
      { label: 'Treinamento', value: item.cost_training ?? item.training },
    ];

    const rentalVal = item.cost_rental ?? item.rental ?? item.total_value ?? item.total ?? 0;
    const rentalPart = formatCurrency(Number(rentalVal));

    const additions = items
      .slice(1)
      .filter(it => it.value !== undefined && it.value !== null && Number(it.value) > 0)
      .map(it => `${it.label} ${formatCurrency(Number(it.value))}`);

    if (additions.length > 0) {
      return `${rentalPart} + ${additions.join(' + ')}.`;
    }
    return `${rentalPart}.`;
  };

  const getItemDurationDaysText = (item: any) => {
    const start = item.billing_period_start || item.period_start || data.period_start;
    const end = item.billing_period_end || item.period_end || data.period_end;
    if (start && end) {
      const startDate = new Date(start.split('T')[0] + 'T00:00:00');
      const endDate = new Date(end.split('T')[0] + 'T00:00:00');
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (!isNaN(diffDays) && diffDays > 0) {
        return `${diffDays} dias`;
      }
    }
    return getDurationDaysText();
  };

  const equipmentDesc = data.equipment?.description || 'Plataforma Elevatória Articulada 20 metros';
  const equipmentType = data.equipment?.type ? data.equipment.type.toUpperCase() : 'PLATAFORMA ELEVATÓRIA';

  const contractDateFormatted = formatDate(generatedAt?.split('T')[0] || data.contract_date || new Date().toISOString().split('T')[0]);
  const contractNumberFormatted = data.contract_number ? String(data.contract_number).padStart(5, '0') : '00190';

  const totalInvestment = Number(data.costs?.total ?? data.value ?? 0);

  const getBillingConditionText = () => {
    const val = data.billing_interval_days;
    if (!val) return '28 dias';
    const s = String(val).trim().toLowerCase();
    if (s === '7' || s === '7dias' || s === '7 dias') return '7 dias';
    if (s === '15' || s === '15 dias' || s === '15dias') return '15 dias';
    if (s === '28' || s === '28 dias' || s === '28dias') return '28 dias';
    if (s === 'a vista' || s === 'à vista' || s === 'avista') return 'A vista';
    return String(val);
  };

  const renderHeader = () => (
    <View style={styles.headerRow}>
      <Image style={styles.headerLogoLeft} src={logoAltoMaster} />
      {data.equipment?.image_url ? (
        <Image style={styles.headerLogoRight} src={data.equipment.image_url} />
      ) : (
        <View style={styles.headerLogoRight} />
      )}
    </View>
  );

  return (
    <Document title={`Contrato de Locação - ${contractNumberFormatted}`}>
      {/* ===================== PAGE 1 ===================== */}
      <Page size="A4" style={styles.page}>
        {renderHeader()}

        <View style={styles.contractTitleContainer}>
          <Text style={styles.contractTitle}>CONTRATO DE LOCAÇÃO – {equipmentType}</Text>
        </View>

        {/* Data e Contrato Nº */}
        <View style={styles.infoRow}>
          <View style={styles.infoCellLeft}>
            <Text style={styles.infoTextBold}>DATA: {contractDateFormatted}</Text>
          </View>
          <View style={styles.infoCellRight}>
            <Text style={styles.infoTextBold}>CONTRATO Nº:</Text>
            <Text style={styles.infoTextBold}>{contractNumberFormatted}</Text>
          </View>
        </View>

        {/* Locador */}
        <View style={styles.partyBox}>
          <Text style={styles.partyBoxTitle}>LOCADOR</Text>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>NOME:</Text>
            <Text style={styles.partyValueBold}>{locadorName}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>ENDEREÇO:</Text>
            <Text style={styles.partyValue}>{locadorAddress}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>CNPJ:</Text>
            <Text style={styles.partyValue}>{locadorCnpj}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>I.E:</Text>
            <Text style={styles.partyValue}>{locadorIe}</Text>
          </View>
        </View>

        {/* Locatário */}
        <View style={styles.partyBox}>
          <Text style={styles.partyBoxTitle}>LOCATÁRIO</Text>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>NOME:</Text>
            <Text style={styles.partyValueBold}>{locatarioName}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>ENDEREÇO:</Text>
            <Text style={styles.partyValue}>{locatarioAddress}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>CNPJ OU CPF:</Text>
            <Text style={styles.partyValue}>{locatarioCnpj}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>I.E:</Text>
            <Text style={styles.partyValue}>{locatarioIe}</Text>
          </View>
        </View>

        {/* Proposta e Valores */}
        <Text style={styles.proposalHeader}>PROPOSTA E VALORES</Text>
        <View style={styles.proposalBox}>
          {equipmentsList && equipmentsList.length > 0 ? (
            equipmentsList.map((item: any, idx: number) => {
              const itemDesc = item.equipment_name || item.description || item.name || equipmentDesc;
              const itemWorkingHeight = item.equipment_size ? ` - ${item.equipment_size} mts` : '';
              const fullItemDesc = `${itemDesc}${itemWorkingHeight}`.trim();
              const itemStart = item.billing_period_start || item.period_start || data.period_start;
              const itemEnd = item.billing_period_end || item.period_end || data.period_end;

              return (
                <View key={idx} style={{ marginBottom: idx < equipmentsList.length - 1 ? 5 : 3 }}>
                  {equipmentsList.length > 1 && (
                    <Text style={[styles.proposalLabel, { fontSize: 8.5, marginBottom: 1, color: '#000' }]}>
                      EQUIPAMENTO {idx + 1}:
                    </Text>
                  )}
                  <Text style={styles.proposalLine}>
                    <Text style={styles.proposalLabel}>Informações do equipamento: </Text>
                    {fullItemDesc}
                  </Text>
                  <Text style={styles.proposalLine}>
                    <Text style={styles.proposalLabel}>Duração do Contrato: </Text>
                    {getItemDurationDaysText(item)}
                  </Text>
                  <Text style={styles.proposalLine}>
                    <Text style={styles.proposalLabel}>Período início: </Text>
                    {formatDate(itemStart)}
                  </Text>
                  <Text style={styles.proposalLine}>
                    <Text style={styles.proposalLabel}>Período final: </Text>
                    {itemEnd ? formatDate(itemEnd) : 'Indefinido'}
                  </Text>
                  <Text style={styles.proposalLine}>
                    <Text style={styles.proposalLabel}>Valor da locação: </Text>
                    {buildItemCostsText(item)}
                  </Text>
                </View>
              );
            })
          ) : (
            <>
              <Text style={styles.proposalLine}>
                <Text style={styles.proposalLabel}>Informações do equipamento: </Text>
                {equipmentDesc}
              </Text>
              <Text style={styles.proposalLine}>
                <Text style={styles.proposalLabel}>Duração do Contrato: </Text>
                {getDurationDaysText()}
              </Text>
              <Text style={styles.proposalLine}>
                <Text style={styles.proposalLabel}>Período início: </Text>
                {formatDate(data.period_start)}
              </Text>
              <Text style={styles.proposalLine}>
                <Text style={styles.proposalLabel}>Período final: </Text>
                {data.period_end ? formatDate(data.period_end) : 'Indefinido'}
              </Text>
              <Text style={styles.proposalLine}>
                <Text style={styles.proposalLabel}>Valor da locação: </Text>
                {buildCostsText()}
              </Text>
            </>
          )}

          <Text style={[styles.proposalLine, { marginTop: 8, marginBottom: 8 }]}>
            <Text style={styles.proposalLabel}>TOTAL DO INVESTIMENTO: </Text>
            <Text style={styles.bold}>{formatCurrency(totalInvestment)}</Text>
          </Text>
          <Text style={styles.proposalLine}>
            <Text style={styles.proposalLabel}>Dados bancários: </Text>
            Banco do Brasil Agencia: 1917-8 Conta Corrente: 14.677-3
          </Text>
          <Text style={styles.proposalLine}>
            <Text style={styles.proposalLabel}>Nome: </Text>
            ALTO MASTER LOCADORA DE EQUIPAMENTOS LTDA
          </Text>
          <Text style={styles.proposalLine}>
            <Text style={styles.proposalLabel}>Chave pix: </Text>
            CNPJ 48.477.385/0001-09
          </Text>
          <Text style={[styles.proposalLine, { marginTop: 8 }]}>
            <Text style={styles.proposalLabel}>CONDIÇÕES DE FATURAMENTO: </Text>
            <Text style={styles.bold}>{getBillingConditionText()}</Text>
          </Text>
        </View>

        {/* Local de Uso e Contato */}
        <View style={styles.locationTable}>
          <View style={styles.locationLeftCol}>
            <Text style={styles.locationLabelText}>Local de uso do equipamento:</Text>
            <Text style={styles.locationLabelText}>Contato de recebimento:</Text>
          </View>
          <View style={styles.locationRightCol}>
            <Text style={styles.locationValueText}>{data.work_site || locatarioAddress}</Text>
            <Text style={styles.locationValueText}>
              {data.site_contact_name} - {data.site_contact_phone}
            </Text>
          </View>
        </View>
      </Page>

      {/* ===================== PAGE 2 ===================== */}
      <Page size="A4" style={styles.page}>
        {renderHeader()}

        <Text style={styles.clauseTitle}>OBJETO DA PROPOSTA E VALORES</Text>
        <Text style={styles.clauseParagraph}>
          Ao assinar a presente Proposta, a LOCATÁRIA declara total ciência da seção <Text style={styles.bold}>“ OBJETO DA PROPOSTA E VALORES”</Text>
        </Text>
        <Text style={styles.clauseParagraph}>
          Descritivo do(s) <Text style={styles.bold}>Equipamento(s)</Text> que serão locados e sua(s) <Text style={styles.bold}>Quantidade(s)</Text>, confirmando que o(s) mesmo(s) cumprem a finalidade para o qual se destinam;
        </Text>
        <Text style={styles.clauseParagraph}>
          <Text style={styles.bold}>Período Contratado</Text>, <Text style={styles.bold}>Intervalo de Faturamento</Text>, Valores de Locação (unitários e total), Valores de Proteção (unitários e total), complementos devidamente discriminados, <Text style={styles.bold}>Total Contratado</Text>, Número de Parcelas e Valor Parcelas;
        </Text>
        <Text style={styles.clauseParagraph}>
          <Text style={styles.bold}>CONTRATO DE LOCAÇÃO DE BENS MÓVEIS E VALIDADE DA PROPOSTA.</Text> A locação será regida pelas cláusulas constantes nesta Proposta, como se aqui estivesse transcrito. A LOCATÁRIA declara que conhece, compreende e aceita o seu conteúdo sem ressalvas, incluindo, mas sem restringir, as regras da Lei Geral de Proteção de Dados, ficando ajustado que a aplicação, de todo os conteúdos mencionados, à presente locação representa premissa de negócio. O referido Contrato pode ser solicitado através de qualquer dos nossos canais de atendimento. Havendo divergência entre os documentos que compõem a presente contratação, prevalecerá o disposto na Proposta.
        </Text>
        <Text style={styles.clauseParagraph}>
          A presente Proposta se aperfeiçoa com o “De acordo” da LOCATÁRIA e sua imediata devolução assinada à LOCADORA até o prazo de validade contido no cabeçalho de cada página implicando na aceitação dos termos aqui estabelecidos. Ultrapassado o período de validade, esta Proposta não gerará mais efeitos, estando sujeita à disponibilidade dos equipamentos na data em que efetivamente houver o envio do seu “aceite” à LOCADORA. A presente Proposta também perderá seus efeitos, ainda que devidamente assinada, na hipótese de reprovação da análise de crédito da LOCATÁRIA pelo departamento financeiro da LOCADORA.
        </Text>

        <Text style={styles.clauseTitle}>PERÍODO CONTRATADO E RENOVAÇÃO</Text>
        <Text style={styles.clauseParagraph}>
          O período mínimo do contrato corresponde ao Período Contratado da seção <Text style={styles.bold}>“OBJETO DA PROPOSTA E VALORES ”</Text> e se inicia, automaticamente, na saída do(s) Bem(ns) Móvel(is) do depósito da LOCADORA.
        </Text>
        <Text style={styles.redNotice}>
          OBS- O CONTRATO E VIGENTE A ENTREGA NA DATA COMBINADA NÃO NOS RESPONSABILIZAMOS PELO TEMPO CLIMATICO CASO OCORRA CHUVA NO PERIODO DA LOCAÇÃO.
        </Text>
        <Text style={styles.clauseParagraph}>
          O término do Período contratado ocorrerá na data da efetiva devolução do(s) Equipamento(s) no depósito da LOCADORA, acompanhado da devida documentação fiscal a ser emitida e enviada pela LOCATÁRIA, exceto no caso de devolução do(s) Equipamento(s) antes do término do Período Contratado caso em que não haverá redução no valor da locação, que será aquele correspondente ao Período Contratado inteiro.
        </Text>
        <Text style={styles.clauseParagraphBold}>
          Caso o equipamento seja devolvido fora do periodo contratato a LOCATÀRIA pagará pelo valor cheio até o prazo final da locação, conforme alinhamento na PROPOSTA E VALORES.
        </Text>
        <Text style={styles.clauseParagraphBold}>
          Caso não haja qualquer manifestação em contrário de qualquer das partes, operar-se-á a renovação da locação, pelo mesmo Período Contratado e nas mesmas condições contidas nesta Proposta, observado o reajuste anual. Renovada a locação após o primeiro Período Contratado, qualquer das Partes poderá optar pela devolução antecipada do(s) Equipamento(s), seja total ou parcial, sem aplicação de qualquer penalidade específica, devendo a LOCATÁRIA arcar com o valor da locação, observado o reajuste anual, até sua efetiva devolução.
        </Text>

        <Text style={styles.clauseTitle}>FATURAMENTO E CONDIÇÕES DE PAGAMENTO</Text>
        <Text style={styles.clauseParagraph}>
          As faturas serão sempre enviadas no início de cada intervalo de faturamento, mesmo nos casos de renovação após o primeiro período Contratado. A primeira fatura será enviada no dia da saída do(s) Bem(ns) Móvel(is) do depósito da LOCADORA.
        </Text>
        <Text style={styles.clauseParagraph}>
          Cada Fatura corresponderá a 1 (um) intervalo de faturamento sendo devido na primeira fatura também os complementos de locação.
        </Text>
        <Text style={styles.clauseParagraph}>
          O vencimento das faturas ocorrerá conforme acordo aplicado nas <Text style={styles.bold}>CONDIÇÕES DE PAGAMENTO</Text>, a partir da data de sua emissão.
        </Text>
        <Text style={styles.clauseParagraph}>
          Para períodos contratados superiores a 30 (trinta) dias, no caso de devolução antecipada, os valores devidos pelo saldo remanescente serão cobrados em uma única fatura, a ser enviada após a devolução do(s) Equipamento(s).
        </Text>
        <Text style={styles.clauseParagraph}>
          O pagamento da locação será efetuado através de boleto bancário ({locadorBankInfo}). O boleto com atraso superior a 05 dias será enviado para protesto, independentemente de notificação, sendo que todas as despesas com a baixa do protesto ficarão a cargo do <Text style={styles.bold}>LOCATÁRIO(A)</Text>.
        </Text>
        <Text style={styles.clauseParagraph}>
          Após a devolução do(s) Equipamento(s), a LOCADORA avaliará se existe algum saldo (locação, danos, despesas, multas etc.) a ser cobrado da LOCATÁRIA, na forma do Contrato de Locação de Bens Móveis, vide Cláusula 2, e procederá com a cobrança em uma única fatura.
        </Text>
        <Text style={styles.clauseParagraph}>
          A LOCATÁRIA, autoriza a LOCADORA a emitir NOTA DE DÉBITO referente ao ressarcimento de prejuízos nos termos do procedimento, acompanhado do respectivo boleto bancário para cobrança e, na hipótese de não pagamento, como também de qualquer débito relativo à Proposta e Contrato, fica autorizado e ciente que os títulos serão encaminhados a protesto, além das medidas judiciais necessárias.
        </Text>
      </Page>

      {/* ===================== PAGE 3 ===================== */}
      <Page size="A4" style={styles.page}>
        {renderHeader()}

        <Text style={styles.clauseTitle}>ENTREGA DO(S) EQUIPAMENTO(S) À LOCATÁRIA</Text>
        <Text style={styles.clauseParagraph}>
          No momento da entrega do(s) equipamento(s) o preposto da LOCATÁRIA, assinará o “Termo de entrega”, documento que reflete as condições do(s) equipamento(s), caracterizando assim o aceite do(s) mesmo(s) e declarando que se encontra(m) em perfeita(s) condição(ões) de uso, conservação, funcionamento e segurança, com níveis de combustíveis, lubrificantes, água e demais componentes necessários à sua utilização, não podendo a LOCATÁRIA, posteriormente, reclamar a existência de quaisquer inconformidades.
        </Text>
        <Text style={styles.clauseParagraph}>
          A LOCATÁRIA obriga-se a credenciar um preposto apto a conferir o(s) Equipamento(s). No silêncio da LOCATÁRIA quanto ao credenciamento, será considerado seu preposto, para os fins da Proposta e Contrato, a pessoa que receber o(s) equipamento(s), sendo ele transportador ou não, e esse acompanhará as vistorias e firmará os documentos, os quais serão tidos como válidos entre as partes.
        </Text>

        <Text style={styles.clauseTitle}>DEVOLUÇÃO DO(S) EQUIPAMENTO(S) À LOCADORA E DANOS A RESSARCIR</Text>
        <Text style={styles.clauseParagraph}>
          No momento da devolução o preposto da LOCATÁRIA, assinará o “Termo de devolução”, documento que reflete as condições do(s) equipamento(s), onde será possível constatar a existência de danos, avarias, modificações, adaptações ou desgastes excessivos de peças e partes.
        </Text>
        <Text style={styles.clauseParagraphBold}>
          A LOCATÁRIA obriga-se a credenciar um preposto apto a conferir o(s) Equipamento(s) devolvido(s). No silêncio da LOCATÁRIA quanto ao credenciamento, será considerado seu preposto, para os fins da Proposta e Contrato, a pessoa que acompanhar presencialmente a devolução ou o transportador que recolher o(s) Equipamento(s) e esse acompanhará as vistorias e firmará os documentos, os quais serão tidos como válidos entre as partes. A falta de representante da LOCATÁRIA no momento da devolução não a exime das responsabilidades decorrentes de qualquer dano(s) eventualmente causado(s) ao(s) equipamento(s), que serão apurados.
        </Text>
        <Text style={styles.clauseParagraphBold}>
          Havendo danos de constatação imediata ou que sejam identificados somente após desmontagem ou análise mais detalhada dos equipamentos, a LOCATÁRIA será notificada de sua existência em até 5 (cinco) dias úteis. Após a notificação será emitido um relatório completo com as avarias e orçamento. A LOCATÁRIA terá 5 (cinco) dias úteis para se manifestar acerca do relatório enviado. Após esse prazo, não havendo manifestação da LOCATÁRIA, os reparos serão realizados e levados à cobrança mediante emissão de NOTA DE DÉBITO e seu respectivo boleto bancário. Todas as comunicações serão realizadas pelo e-mail fornecido pela LOCATÁRIA no ato da contratação.
        </Text>
        <Text style={styles.clauseParagraph}>
          Em caso de necessidade de reparos no(s) equipamento(s) constatado(s) na devolução, ou no caso de acidentes, a locação será contada na forma prevista nesta cláusula até o momento em que o(s) equipamento(s) esteja(m) reparado(s) e em condições de locação a novos clientes. Em caso de roubo ou furto dos equipamentos, a locação será contada até seu efetivo pagamento ou reposição independentemente da contratação da proteção.
        </Text>
        <Text style={styles.clauseParagraphBold}>
          Nos casos em que a devolução venha a ser realizada através da LOCADORA, é responsabilidade exclusiva da LOCATÁRIA manifestar formalmente a LOCADORA, através de nossos canais de atendimento, o interesse acerca do término da locação, informando a data na qual o(s) equipamento(s) deverá(ão) ser devolvido(s). A falta de manifestação dentro do Período Contratado acarretará a renovação automática da locação que só termina com a efetiva devolução do(s) equipamento(s) no deposito da LOCADORA que o(s) locou, após a devida análise da documentação fiscal a ser produzida e enviada pela LOCATARIA, sem prejuízo da apuração de responsabilidade acerca de danos ou avarias no(s) equipamento(s), na forma da Proposta e Contrato.
        </Text>
        <Text style={styles.redNotice}>
          A devolução do equipamento antes do período descrito neste contrato não dispensará o LOCATÁRIO(A) do pagamento total do bem locado, inclusive após iniciado o período de renovação automática.
        </Text>

        <Text style={styles.clauseTitle}>MANUTENÇÃO, TREINAMENTO E DESPESAS EXIGÍVEIS</Text>
        <Text style={styles.clauseParagraph}>
          Para fins de realização de Manutenção Preventiva, Treinamentos ou ainda Manutenção Corretiva causada por mau uso, dolo ou culpa da LOCATÁRIA , a LOCATÁRIA concorda que serão cobradas as seguintes despesas, envolvendo o deslocamento do técnico, incluindo, mas não se limitando a:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}><Text style={styles.bold}>(I)</Text> Combustível; (R$ 2,50 por Km);</Text>
          <Text style={styles.listItem}><Text style={styles.bold}>(II)</Text> Pedágio(s);</Text>
          <Text style={styles.listItem}><Text style={styles.bold}>(III)</Text> Passagem(ns) aérea(s) (se for o caso) de ida e volta;</Text>
          <Text style={styles.listItem}><Text style={styles.bold}>(IV)</Text> Hospedagem; (R$ 250,00 por dia);</Text>
          <Text style={styles.listItem}><Text style={styles.bold}>(V)</Text> Refeições; (R$ 100,00 por dia);</Text>
          <Text style={styles.listItem}><Text style={styles.bold}>(VI)</Text> O custo da hora trabalhada e de deslocamento (valor por hora), (R$ 250,00 por hora);</Text>
          <Text style={styles.listItem}><Text style={styles.bold}>(VII)</Text> O custo das peças e óleo nos casos de Manutenção Corretiva.</Text>
        </View>

        <Text style={styles.clauseParagraph}>
          <Text style={styles.bold}>Acesso do Técnico.</Text> Independentemente do tipo de manutenção (preventiva ou corretiva) a ser realizada é obrigação da LOCATÁRIA oferecer todos os meios necessários para que os técnicos da LOCADORA possam ir e retornar entre a recepção de pessoal é onde o(s) Equipamento(s) estiver(em) situado(s). Caberá a LOCATÁRIA providenciar integração, além todos os recursos necessários para que o técnico chegue o mais rápido possível ao local onde o Equipamento(s) estiverem situado(s), ainda que o Local seja gerenciado, por terceiro ou de difícil acesso, permitindo o efetivo atendimento e assumindo eventuais despesas que sobrevierem, mesmo que por culpa de terceiros. A demora entre a chegada do técnico e o efetivo acesso ao(s) Equipamento(s) poderá ensejar a cobrança de despesas extraordinárias.
        </Text>

        {/* Aviso Diesel */}
        <View style={styles.dieselBox}>
          <Text style={styles.dieselText}>
            OS EQUIPAMENTOS A DIESEL SERÃO ENVIADOS COM A QUANTIDADE PARA MINIMA, DEVENDO SER ABASTECIDO PELO USUARIO DO EQUIPAMENTO, DA MESMA FORMA TERÁ QUE SER DEVOLVIDO QUANDO ACIONADO A COLETA DO MESMO.
          </Text>
        </View>

        {/* Quadro de Assinaturas */}
        <View style={styles.signatureBox}>
          <View style={styles.signatureColLeft}>
            <Text style={styles.signaturePartyTitle}>LOCADOR: {locadorName}</Text>
          </View>
          <View style={styles.signatureColRight}>
            <Text style={styles.signaturePartyTitle}>LOCATÁRIA:</Text>
            <Text style={styles.signatureLineText}>Nome: _____________________________________</Text>
            <Text style={styles.signatureLineText}>Assinatura: ________________________________</Text>
            <Text style={styles.signatureLineText}>CPF: ______________________________________</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default ContractDocument;
