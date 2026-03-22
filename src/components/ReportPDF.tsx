import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { AnalysisResult, ExpertName } from "@/lib/experts/types";

const EXPERT_LABELS: Record<ExpertName, string> = {
  "ui-design": "UI / Design System",
  "ux-research": "UX Research",
  experiment: "Experiment Designer",
  content: "Content / Copy",
  seo: "SEO Expert",
  psychology: "Marketing Psychology",
};

function averageScore(result: AnalysisResult): number {
  const scores = Object.values(result.experts).map((e) => e.score);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function scoreColor(score: number): string {
  if (score >= 75) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#f9fafb",
    fontSize: 10,
    color: "#111827",
  },
  // Header
  header: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  appLabel: {
    fontSize: 8,
    color: "#6366f1",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  url: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  metaText: {
    fontSize: 8,
    color: "#9ca3af",
  },
  overallScore: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
  },
  // Section titles
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 20,
  },
  // Expert cards — two-column grid
  expertGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  expertCard: {
    width: "49%",
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 10,
    marginBottom: 8,
    marginRight: "2%",
  },
  expertCardOdd: {
    marginRight: 0,
  },
  expertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  expertName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  expertScore: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  expertSummary: {
    fontSize: 7.5,
    color: "#374151",
    lineHeight: 1.5,
    marginBottom: 6,
  },
  recLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  recItem: {
    fontSize: 7,
    color: "#374151",
    lineHeight: 1.4,
    marginBottom: 2,
    paddingLeft: 6,
  },
  recDot: {
    color: "#6366f1",
    marginRight: 3,
  },
  // PostHog section
  postHogCard: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 8,
  },
  postHogStrategy: {
    fontSize: 8,
    color: "#374151",
    lineHeight: 1.5,
    marginBottom: 10,
  },
  postHogSubtitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  trackingItem: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 4,
  },
  trackingBadge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    backgroundColor: "#6366f1",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginRight: 6,
    alignSelf: "flex-start",
  },
  trackingText: {
    fontSize: 7,
    color: "#374151",
    flex: 1,
    lineHeight: 1.4,
  },
  dashboardItem: {
    fontSize: 7.5,
    color: "#374151",
    marginBottom: 3,
    paddingLeft: 6,
    lineHeight: 1.4,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerBrand: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#6366f1",
  },
  footerCta: {
    fontSize: 7.5,
    color: "#9ca3af",
  },
});

interface Props {
  result: AnalysisResult;
  slug?: string;
}

export function ReportPDF({ result, slug }: Props) {
  const overall = averageScore(result);
  const expertKeys = Object.keys(result.experts) as ExpertName[];
  const date = new Date(result.analysedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document
      title={`Landing Page Advisor — ${result.url}`}
      author="Landing Page Advisor"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appLabel}>Landing Page Advisor</Text>
          <Text style={styles.url}>{result.url}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Analysed {date}</Text>
            <Text style={styles.metaText}>·</Text>
            <Text style={styles.metaText}>{expertKeys.length} experts</Text>
            {slug && (
              <>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}>Report: {slug}</Text>
              </>
            )}
          </View>
          <Text style={[styles.overallScore, { color: scoreColor(overall) }]}>
            {overall}/100
          </Text>
        </View>

        {/* Expert cards */}
        <Text style={styles.sectionTitle}>Expert Analyses</Text>
        <View style={styles.expertGrid}>
          {expertKeys.map((k, i) => {
            const expert = result.experts[k];
            const isEven = i % 2 === 1;
            return (
              <View
                key={k}
                style={[styles.expertCard, isEven ? styles.expertCardOdd : {}]}
              >
                <View style={styles.expertHeader}>
                  <Text style={styles.expertName}>{EXPERT_LABELS[k]}</Text>
                  <Text
                    style={[
                      styles.expertScore,
                      { color: scoreColor(expert.score) },
                    ]}
                  >
                    {expert.score}/100
                  </Text>
                </View>
                <Text style={styles.expertSummary}>{expert.summary}</Text>
                {expert.recommendations.length > 0 && (
                  <>
                    <Text style={styles.recLabel}>Top Recommendations</Text>
                    {expert.recommendations.slice(0, 3).map((rec, j) => (
                      <Text key={j} style={styles.recItem}>
                        {"• "}
                        {rec.action}
                      </Text>
                    ))}
                  </>
                )}
              </View>
            );
          })}
        </View>

        {/* PostHog guide */}
        <Text style={styles.sectionTitle}>PostHog Tracking Plan</Text>
        <View style={styles.postHogCard}>
          <Text style={styles.postHogStrategy}>{result.posthog.strategy}</Text>

          {result.posthog.trackingPoints.length > 0 && (
            <>
              <Text style={styles.postHogSubtitle}>Key Tracking Events</Text>
              {result.posthog.trackingPoints.slice(0, 5).map((tp, i) => (
                <View key={i} style={styles.trackingItem}>
                  <Text style={styles.trackingBadge}>{tp.event}</Text>
                  <Text style={styles.trackingText}>
                    {tp.element} — {tp.benefit}
                  </Text>
                </View>
              ))}
            </>
          )}

          {result.posthog.dashboards && result.posthog.dashboards.length > 0 && (
            <>
              <Text style={[styles.postHogSubtitle, { marginTop: 8 }]}>
                Dashboard Suggestions
              </Text>
              {result.posthog.dashboards.map((d, i) => (
                <Text key={i} style={styles.dashboardItem}>
                  {"• "}
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{d.name}</Text>
                  {" — "}
                  {d.description}
                </Text>
              ))}
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerBrand}>Landing Page Advisor</Text>
          <Text style={styles.footerCta}>
            Analyze your page at landingpageadvisor.com
          </Text>
        </View>
      </Page>
    </Document>
  );
}
