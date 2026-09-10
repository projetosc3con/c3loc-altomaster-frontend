import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logoAltoMaster from '../../assets/altomaster-dark.png';

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
    marginBottom: 14,
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

export const CHECKLIST_ITEMS_CONFIG = [
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

export interface ReturnPhotoItem {
  position: number;
  label: string;
  file_url?: string;
  previewUrl?: string;
}

export interface ReturnChecklistDocumentProps {
  invoiceNumber?: string;
  returnDate: string;
  clientName?: string;
  workSite?: string;
  equipmentName?: string;
  equipmentType?: string;
  assetNumber?: string;
  serialNumber?: string;
  hourMeter?: string | number;
  inspectorName?: string;
  notes?: string;
  photos: ReturnPhotoItem[];
}

export const ReturnChecklistDocument: React.FC<ReturnChecklistDocumentProps> = ({
  invoiceNumber,
  returnDate,
  clientName,
  workSite,
  equipmentName,
  equipmentType,
  assetNumber,
  serialNumber,
  hourMeter,
  inspectorName,
  notes,
  photos = [],
}) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Image style={styles.logo} src={logoAltoMaster} />
          <Text style={styles.title}>Checklist de Retorno do Equipamento</Text>

          {/* Tabela de Detalhes */}
          <View style={styles.detailsTable}>
            <View style={styles.tableRow}>
              <View style={[styles.tableCell, styles.tableCellBorderRight, { width: '50%' }]}>
                <Text style={styles.metaLabel}>Fatura / Locação</Text>
                <Text style={styles.metaValue}>{invoiceNumber ? `#${invoiceNumber}` : 'Não informado'}</Text>
              </View>
              <View style={[styles.tableCell, { width: '50%' }]}>
                <Text style={styles.metaLabel}>Data do Retorno</Text>
                <Text style={styles.metaValue}>{returnDate}</Text>
              </View>
            </View>

            <View style={styles.tableRow}>
              <View style={[styles.tableCell, styles.tableCellBorderRight, { width: '50%' }]}>
                <Text style={styles.metaLabel}>Cliente</Text>
                <Text style={styles.metaValue}>{clientName || 'Não informado'}</Text>
              </View>
              <View style={[styles.tableCell, { width: '50%' }]}>
                <Text style={styles.metaLabel}>Local / Obra</Text>
                <Text style={styles.metaValue}>{workSite || 'Não informado'}</Text>
              </View>
            </View>

            <View style={styles.tableRow}>
              <View style={[styles.tableCell, styles.tableCellBorderRight, { width: '50%' }]}>
                <Text style={styles.metaLabel}>Equipamento</Text>
                <Text style={styles.metaValue}>
                  {equipmentName || 'Não identificado'} {equipmentType ? `(${equipmentType})` : ''}
                </Text>
              </View>
              <View style={[styles.tableCell, { width: '50%' }]}>
                <Text style={styles.metaLabel}>Patrimônio / Série</Text>
                <Text style={styles.metaValue}>
                  Pat: {assetNumber || 'S/N'} | Série: {serialNumber || 'S/N'}
                </Text>
              </View>
            </View>

            <View style={[styles.tableRow, notes ? {} : { borderBottomWidth: 0 }]}>
              <View style={[styles.tableCell, styles.tableCellBorderRight, { width: '50%' }]}>
                <Text style={styles.metaLabel}>Vistoriador / Responsável</Text>
                <Text style={styles.metaValue}>{inspectorName || 'Altomaster Operações'}</Text>
              </View>
              <View style={[styles.tableCell, { width: '50%' }]}>
                <Text style={styles.metaLabel}>Horímetro de Retorno</Text>
                <Text style={styles.metaValue}>{hourMeter !== undefined && hourMeter !== '' ? `${hourMeter} h` : 'Não registrado'}</Text>
              </View>
            </View>

            {notes && (
              <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.tableCell, { width: '100%' }]}>
                  <Text style={styles.metaLabel}>Observações / Avarias na Devolução</Text>
                  <Text style={styles.metaValue}>{notes}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Photos Grid */}
        <View style={styles.grid}>
          {CHECKLIST_ITEMS_CONFIG.map((item) => {
            const photo = photos.find((p) => p.position === item.position);
            const imageSrc = photo?.file_url || photo?.previewUrl;

            return (
              <View key={item.position} style={styles.photoCard} wrap={false}>
                <View style={styles.photoContainer}>
                  {imageSrc ? (
                    <Image style={styles.photo} src={imageSrc} />
                  ) : (
                    <Text style={styles.photoPlaceholderText}>Nenhuma foto registrada para este item no retorno.</Text>
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
          <Text>RentDesk Logística & Manutenção — Checklist de Retorno e Conferência de Estado</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
