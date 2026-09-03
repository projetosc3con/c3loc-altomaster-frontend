import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoC3Loc from '../../assets/logo-completo.png';
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
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 15,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginRight: 20,
  },
  logo: {
    width: 110,
    height: 45,
    objectFit: 'contain',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaItem: {
    width: '50%',
    marginBottom: 4,
  },
  metaLabel: {
    fontWeight: 'bold',
    color: '#666',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 9,
    color: '#1a1a1a',
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
  model?: string;
  period?: string;
  photos: TriagePhoto[];
}

interface TriageChecklistDocumentProps {
  contract: LogisticsContract;
  photos?: TriagePhoto[];
  equipmentLabel?: string;
  clientName?: string;
  workSite?: string;
  equipmentsWithPhotos?: EquipmentChecklistData[];
}

export const TriageChecklistDocument: React.FC<TriageChecklistDocumentProps> = ({
  contract,
  photos = [],
  equipmentLabel,
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
              <View style={styles.headerInfo}>
                <Text style={styles.title}>Checklist de Confirmação Fotográfica</Text>
                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Contrato</Text>
                    <Text style={styles.metaValue}>#{contract.contract_number}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Data Triagem</Text>
                    <Text style={styles.metaValue}>{currentDate}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Equipamento</Text>
                    <Text style={styles.metaValue}>{section.equipmentLabel}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Cliente</Text>
                    <Text style={styles.metaValue}>{clientName || 'Não informado'}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Responsável(is)</Text>
                    <Text style={styles.metaValue}>{inspectors.length > 0 ? inspectors.join(', ') : 'Não informado'}</Text>
                  </View>
                  {workSite && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Local / Obra</Text>
                      <Text style={styles.metaValue}>{workSite}</Text>
                    </View>
                  )}
                  {section.period && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Período</Text>
                      <Text style={styles.metaValue}>{section.period}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Image style={styles.logo} src={logoC3Loc} />
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
