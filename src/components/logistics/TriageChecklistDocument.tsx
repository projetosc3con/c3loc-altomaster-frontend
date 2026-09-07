import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoAltoMaster from '../../assets/altomaster-dark.png';
import type { LogisticsContract, TriagePhoto } from '../../services/logistics';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#333',
    lineHeight: 1.4,
  },
  headerContainer: {
    marginBottom: 16,
  },
  logo: {
    width: 170,
    height: 55,
    objectFit: 'contain',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  detailsTable: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableCell: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tableCellBorderRight: {
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  metaLabel: {
    fontWeight: 'bold',
    color: '#64748b',
    fontSize: 7.5,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  metaValue: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoCard: {
    width: '48%',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 6,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  photoContainer: {
    width: '100%',
    height: 150,
    backgroundColor: '#cbd5e1',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoPlaceholderText: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
    padding: 10,
  },
  photoLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#94a3b8',
  },
});

interface EquipmentChecklistData {
  equipmentLabel: string;
  assetNumber?: string;
  serialNumber?: string;
  model?: string;
  period?: string;
  photos: TriagePhoto[];
}

interface TriageChecklistDocumentProps {
  contract: LogisticsContract;
  photos?: TriagePhoto[];
  equipmentLabel?: string;
  assetNumber?: string;
  serialNumber?: string;
  clientName?: string;
  workSite?: string;
  equipmentsWithPhotos?: EquipmentChecklistData[];
}

export const TriageChecklistDocument: React.FC<TriageChecklistDocumentProps> = ({
  contract,
  photos = [],
  equipmentLabel,
  assetNumber,
  serialNumber,
  clientName,
  workSite,
  equipmentsWithPhotos,
}) => {
  const currentDate = new Date().toLocaleDateString('pt-BR');

  // 22 checklist items
  const checklistItems = [
    { position: 1, label: 'Dianteira' },
    { position: 2, label: 'Traseira' },
    { position: 3, label: 'Lateral direita' },
    { position: 4, label: 'Lateral esquerda' },
    { position: 5, label: 'Tanque hidráulico' },
    { position: 6, label: 'Bloco hidráulico' },
    { position: 7, label: 'Baterias' },
    { position: 8, label: 'Roda lateral direita dianteira' },
    { position: 9, label: 'Roda lateral direita traseira' },
    { position: 10, label: 'Roda lateral esquerda dianteira' },
    { position: 11, label: 'Roda lateral esquerda traseira' },
    { position: 12, label: 'Deck dianteira' },
    { position: 13, label: 'Deck traseira' },
    { position: 14, label: 'Barra deck direita' },
    { position: 15, label: 'Barra deck esquerda' },
    { position: 16, label: 'Porta manual' },
    { position: 17, label: 'Joystick' },
    { position: 18, label: 'Painel de solo' },
    { position: 19, label: 'Horimetro' },
    { position: 20, label: 'Patrimonio' },
    { position: 21, label: 'Plugue tomada' },
    { position: 22, label: 'Placa de identificação' },
  ];

  // Se foram passados múltiplos equipamentos com fotos, renderiza cada um em sua respectiva seção
  const sections: EquipmentChecklistData[] = equipmentsWithPhotos && equipmentsWithPhotos.length > 0
    ? equipmentsWithPhotos
    : [{
        equipmentLabel: equipmentLabel || 'Não identificado',
        assetNumber: assetNumber,
        serialNumber: serialNumber,
        photos: photos
      }];

  return (
    <Document>
      {sections.map((section, sIdx) => {
        // Obter inspetores deste equipamento
        const inspectors = Array.from(
          new Set(
            section.photos
              .map((p) => p.uploaded_by_user?.full_name)
              .filter((name): name is string => !!name)
          )
        );

        return (
          <Page key={sIdx} size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.headerContainer}>
              <Image style={styles.logo} src={logoAltoMaster} />
              <Text style={styles.title}>Checklist de Confirmação Fotográfica</Text>

              {/* Tabela de Detalhes */}
              <View style={styles.detailsTable}>
                <View style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.tableCellBorderRight, { width: '50%' }]}>
                    <Text style={styles.metaLabel}>Contrato</Text>
                    <Text style={styles.metaValue}>#{contract.contract_number}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: '50%' }]}>
                    <Text style={styles.metaLabel}>Data Triagem</Text>
                    <Text style={styles.metaValue}>{currentDate}</Text>
                  </View>
                </View>

                <View style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.tableCellBorderRight, { width: '50%' }]}>
                    <Text style={styles.metaLabel}>Equipamento</Text>
                    <Text style={styles.metaValue}>{section.equipmentLabel}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: '50%' }]}>
                    <Text style={styles.metaLabel}>Cliente</Text>
                    <Text style={styles.metaValue}>{clientName || 'Não informado'}</Text>
                  </View>
                </View>

                <View style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.tableCellBorderRight, { width: '50%' }]}>
                    <Text style={styles.metaLabel}>Patrimônio</Text>
                    <Text style={styles.metaValue}>
                      {section.assetNumber || assetNumber || (section.equipmentLabel?.match(/#([A-Za-z0-9-]+)/)?.[1]) || 'Não informado'}
                    </Text>
                  </View>
                  <View style={[styles.tableCell, { width: '50%' }]}>
                    <Text style={styles.metaLabel}>Nº de Série</Text>
                    <Text style={styles.metaValue}>
                      {section.serialNumber || serialNumber || 'Não informado'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.tableRow, (workSite || section.period) ? {} : { borderBottomWidth: 0 }]}>
                  <View style={[styles.tableCell, styles.tableCellBorderRight, { width: '50%' }]}>
                    <Text style={styles.metaLabel}>Responsável(is)</Text>
                    <Text style={styles.metaValue}>
                      {inspectors.length > 0 ? inspectors.join(', ') : 'Não informado'}
                    </Text>
                  </View>
                  <View style={[styles.tableCell, { width: '50%' }]}>
                    <Text style={styles.metaLabel}>Local / Obra</Text>
                    <Text style={styles.metaValue}>{workSite || 'Não informado'}</Text>
                  </View>
                </View>

                {section.period && (
                  <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                    <View style={[styles.tableCell, { width: '100%' }]}>
                      <Text style={styles.metaLabel}>Período de Locação</Text>
                      <Text style={styles.metaValue}>{section.period}</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Photos Grid */}
            <View style={styles.grid}>
              {checklistItems.map((item) => {
                const photo = section.photos.find((p) => p.position === item.position);
                return (
                  <View key={item.position} style={styles.photoCard} wrap={false}>
                    <View style={styles.photoContainer}>
                      {photo?.file_url ? (
                        <Image style={styles.photo} src={photo.file_url} />
                      ) : (
                        <Text style={styles.photoPlaceholderText}>Nenhuma foto registrada para este item.</Text>
                      )}
                    </View>
                    <Text style={styles.photoLabel}>
                      {item.position}. {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Footer */}
            <View style={styles.footer} fixed>
              <Text>RentDesk Logística — Checklist de Conferência de Estado do Equipamento</Text>
              <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
            </View>
          </Page>
        );
      })}
    </Document>
  );
};
