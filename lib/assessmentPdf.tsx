import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';
import { getRubricItems } from './simulatorRubrics';

// Register Noto Sans Hebrew for RTL/Hebrew support
Font.register({
  family: 'NotoHebrew',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/notosanshebrew/v38/or3NQ7v33eiDljA1IufXTtVf7V6RvEEdhQlk0LlGxCyaeNKYZC0miQ.ttf', fontWeight: 400 },
  ],
});

const SCORE_COLORS: Record<number, string> = {
  1: '#dc2626', 2: '#f97316', 3: '#d97706', 4: '#84cc16', 5: '#16a34a',
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoHebrew',
    backgroundColor: '#f8fafc',
    padding: 0,
    fontSize: 10,
    direction: 'rtl',
  },
  header: {
    backgroundColor: '#1e40af',
    padding: '20 32',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 2,
    textAlign: 'right',
  },
  headerSub: {
    color: '#bfdbfe',
    fontSize: 10,
    textAlign: 'right',
  },
  body: {
    padding: '20 32',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 16,
  },
  metaCard: {
    flex: 1,
    backgroundColor: '#fff',
    border: '1 solid #e5e7eb',
    borderRadius: 6,
    padding: '8 12',
  },
  metaLabel: {
    color: '#6b7280',
    fontSize: 8,
    marginBottom: 2,
    textAlign: 'right',
  },
  metaValue: {
    color: '#111827',
    fontWeight: 700,
    fontSize: 10,
    textAlign: 'right',
  },
  scoreBand: {
    borderRadius: 8,
    padding: '10 16',
    marginBottom: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scoreBandTotal: {
    fontSize: 24,
    fontWeight: 700,
    color: '#111827',
  },
  scoreBandMax: {
    fontSize: 14,
    color: '#6b7280',
  },
  scoreBandLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
  tableHeader: {
    flexDirection: 'row-reverse',
    backgroundColor: '#eff6ff',
    borderBottom: '1 solid #dbeafe',
    padding: '6 12',
  },
  tableHeaderCell: {
    color: '#1e40af',
    fontWeight: 700,
    fontSize: 9,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row-reverse',
    borderBottom: '1 solid #f0f0f0',
    padding: '7 12',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#f7f9ff',
  },
  itemText: {
    flex: 2,
    fontSize: 9,
    color: '#1f2937',
    textAlign: 'right',
  },
  scoreCell: {
    flex: 1,
    alignItems: 'flex-end',
  },
  scorePill: {
    borderRadius: 4,
    padding: '2 8',
    fontSize: 9,
    fontWeight: 700,
    textAlign: 'center',
  },
  sectionTitle: {
    backgroundColor: '#fff',
    border: '1 solid #dbeafe',
    borderRadius: 8,
    marginBottom: 16,
  },
  textSection: {
    backgroundColor: '#fff',
    border: '1 solid #e5e7eb',
    borderRadius: 8,
    padding: '12 14',
    marginBottom: 10,
  },
  textSectionLabel: {
    fontWeight: 700,
    fontSize: 10,
    marginBottom: 4,
    textAlign: 'right',
  },
  textSectionValue: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.6,
    textAlign: 'right',
  },
  footer: {
    backgroundColor: '#f8fafc',
    borderTop: '1 solid #e2e8f0',
    padding: '10 32',
    textAlign: 'center',
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 8,
    textAlign: 'center',
  },
});

interface AssessmentData {
  participantName: string;
  evaluatorName: string;
  scenarioName?: string;
  sessionDate?: string;
  formType: string;
  scores: Record<string, number>;
  strengths: string;
  improvements: string;
  keyMessage?: string;
  total: number;
  selfAssessmentStrengths?: string;
  selfAssessmentImprovements?: string;
}

function formTypeLabel(t: string): string {
  if (t === 'resident')        return 'מתמחה בכיר';
  if (t === 'resident_junior') return 'מתמחה צעיר';
  if (t === 'midwife')         return 'מיילדת';
  return t;
}

function AssessmentDocument({ data }: { data: AssessmentData }) {
  const items     = getRubricItems(data.formType);
  const maxScore  = items.length * 5;
  const pct       = maxScore > 0 ? Math.round((data.total / maxScore) * 100) : 0;
  const isGreen   = maxScore > 0 && data.total >= maxScore * 0.75;
  const isYellow  = maxScore > 0 && data.total >= maxScore * 0.5 && !isGreen;
  const bandBg    = isGreen ? '#f0fdf4' : isYellow ? '#fffbeb' : '#fef2f2';
  const bandColor = isGreen ? '#16a34a' : isYellow ? '#d97706' : '#dc2626';
  const bandLabel = isGreen ? 'בוצע היטב' : isYellow ? 'בוצע חלקית' : 'דרוש שיפור';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>הערכת סימולציה — {formTypeLabel(data.formType)}</Text>
          <Text style={styles.headerSub}>Labor-AI Lab · Hadassah Mount Scopus</Text>
        </View>

        <View style={styles.body}>
          {/* Meta */}
          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>משתתף</Text>
              <Text style={styles.metaValue}>{data.participantName || '—'}</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>מעריך</Text>
              <Text style={styles.metaValue}>{data.evaluatorName || '—'}</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>תרחיש</Text>
              <Text style={styles.metaValue}>{data.scenarioName || '—'}</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>תאריך</Text>
              <Text style={styles.metaValue}>{data.sessionDate || '—'}</Text>
            </View>
          </View>

          {/* Score band (only for rubric-based forms) */}
          {maxScore > 0 && (
            <View style={[styles.scoreBand, { backgroundColor: bandBg, border: `2 solid ${bandColor}` }]}>
              <Text style={[styles.scoreBandTotal]}>{data.total}</Text>
              <Text style={styles.scoreBandMax}>/{maxScore} ({pct}%)</Text>
              <Text style={[styles.scoreBandLabel, { color: bandColor }]}> — {bandLabel}</Text>
            </View>
          )}

          {/* Rubric table */}
          {items.length > 0 && (
            <View style={styles.sectionTitle}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>פריט</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>ציון</Text>
              </View>
              {items.map((item, idx) => {
                const score = data.scores[item.id] ?? 1;
                const color = SCORE_COLORS[score] ?? '#6b7280';
                return (
                  <View key={item.id} style={[styles.tableRow, idx % 2 !== 0 ? styles.tableRowAlt : {}]}>
                    <Text style={styles.itemText}>{item.text}</Text>
                    <View style={styles.scoreCell}>
                      <Text style={[styles.scorePill, { color, backgroundColor: color + '18', border: `1 solid ${color}40` }]}>
                        {score}/5
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Free-text sections — rendered outside fixed-height containers so they
              can break across pages when content is long */}
          {data.strengths && (
            <View style={styles.textSection} wrap={true}>
              <Text style={[styles.textSectionLabel, { color: '#16a34a' }]}>נקודות לשימור</Text>
              <Text style={styles.textSectionValue}>{data.strengths}</Text>
            </View>
          )}
          {data.improvements && (
            <View style={styles.textSection} wrap={true}>
              <Text style={[styles.textSectionLabel, { color: '#d97706' }]}>נקודות לשיפור</Text>
              <Text style={styles.textSectionValue}>{data.improvements}</Text>
            </View>
          )}
          {data.keyMessage && (
            <View style={styles.textSection} wrap={true}>
              <Text style={[styles.textSectionLabel, { color: '#1e40af' }]}>מסר מרכזי</Text>
              <Text style={styles.textSectionValue}>{data.keyMessage}</Text>
            </View>
          )}

          {/* Self-assessment section */}
          {(data.selfAssessmentStrengths || data.selfAssessmentImprovements) && (
            <View wrap={true}>
              <View style={[styles.textSection, { borderColor: '#c7d2fe', backgroundColor: '#f0f4ff' }]} wrap={false}>
                <Text style={[styles.textSectionLabel, { color: '#4338ca', marginBottom: 8 }]}>הערכה עצמית — המתמחה</Text>
              </View>
              {data.selfAssessmentStrengths ? (
                <View style={styles.textSection} wrap={true}>
                  <Text style={[styles.textSectionLabel, { color: '#16a34a' }]}>נקודות לשימור (עצמי)</Text>
                  <Text style={styles.textSectionValue}>{data.selfAssessmentStrengths}</Text>
                </View>
              ) : null}
              {data.selfAssessmentImprovements ? (
                <View style={styles.textSection} wrap={true}>
                  <Text style={[styles.textSectionLabel, { color: '#d97706' }]}>נקודות לשיפור (עצמי)</Text>
                  <Text style={styles.textSectionValue}>{data.selfAssessmentImprovements}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Labor-AI Simulation Lab · Hadassah Medical Center, Mount Scopus</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderAssessmentPdf(data: AssessmentData): Promise<Buffer> {
  return renderToBuffer(<AssessmentDocument data={data} />) as Promise<Buffer>;
}
