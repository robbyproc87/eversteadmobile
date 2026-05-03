import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

import { AuthGuard } from "@/components/AuthGuard";
import Colors from "@/constants/colors";
import {
  type DashboardStats,
  api,
  isPreviewAuthError,
} from "@/lib/api";

interface TrendsState {
  stats: DashboardStats | null;
  isPreview: boolean;
  isDemo: boolean;
}

const SAMPLE_WEEKLY_SCORES = [62, 71, 68, 78, 74, 82, 79, 85];
const SAMPLE_MEDITATION_MIN = [10, 0, 15, 12, 0, 18, 20];
const SAMPLE_READING_PAGES = [12, 18, 0, 22, 14, 28, 19];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function TrendsScreen() {
  return (
    <AuthGuard>
      <TrendsContent />
    </AuthGuard>
  );
}

function TrendsContent() {
  const query = useQuery<TrendsState>({
    queryKey: ["trends", "dashboard"],
    queryFn: async () => {
      try {
        const stats = await api.getDashboardStats();
        const hasAny =
          (stats?.weeklyScore ?? 0) > 0 ||
          (stats?.journalStreak ?? 0) > 0 ||
          (stats?.plannerStreak ?? 0) > 0 ||
          (stats?.pagesRead ?? 0) > 0 ||
          (stats?.daysPlanned ?? 0) > 0;
        return { stats: stats ?? null, isPreview: false, isDemo: !hasAny };
      } catch (e) {
        if (isPreviewAuthError(e)) {
          return { stats: null, isPreview: true, isDemo: true };
        }
        throw e;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const refreshing = query.isFetching && !query.isLoading;

  if (query.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  if (query.isError || !query.data) {
    const message =
      query.error instanceof Error
        ? query.error.message
        : "Could not load your trends.";
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => query.refetch()}
            tintColor={Colors.gold}
          />
        }
      >
        <View style={styles.errorCard}>
          <View style={styles.errorIconWrap}>
            <Feather name="alert-circle" size={28} color={Colors.error} />
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorSubtext}>{message}</Text>
          <Text style={styles.errorHint}>Pull down to retry.</Text>
        </View>
      </ScrollView>
    );
  }

  const { stats, isPreview, isDemo } = query.data;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => query.refetch()}
          tintColor={Colors.gold}
        />
      }
    >
      {(isPreview || isDemo) && (
        <View style={styles.banner}>
          <Feather name="info" size={16} color={Colors.gold} />
          <Text style={styles.bannerText}>
            {isPreview
              ? "Preview Mode — sign in to see your real progress. Charts below show sample data."
              : "Showing sample data. Your charts will populate as you use Everstead."}
          </Text>
        </View>
      )}

      <SectionTitle title="This week" />
      <View style={styles.statRow}>
        <BigStat
          label="Weekly score"
          value={
            stats?.weeklyScore != null
              ? `${stats.weeklyScore}`
              : isDemo
                ? "82"
                : "—"
          }
          suffix={stats?.weeklyScore != null || isDemo ? "/100" : undefined}
          color={Colors.gold}
          icon="award"
        />
      </View>

      <View style={styles.statRow}>
        <SmallStat
          label="Journal streak"
          value={stats?.journalStreak ?? (isDemo ? 7 : 0)}
          suffix="days"
          icon="book-open"
          color="#5b8def"
        />
        <SmallStat
          label="Planner streak"
          value={stats?.plannerStreak ?? (isDemo ? 5 : 0)}
          suffix="days"
          icon="check-square"
          color="#4a9c6d"
        />
      </View>

      <View style={styles.statRow}>
        <SmallStat
          label="Pages read"
          value={stats?.pagesRead ?? (isDemo ? 113 : 0)}
          suffix="this wk"
          icon="book"
          color="#d4534a"
        />
        <SmallStat
          label="Days planned"
          value={stats?.daysPlanned ?? (isDemo ? 6 : 0)}
          suffix="this wk"
          icon="calendar"
          color="#8B5CF6"
        />
      </View>

      <SectionTitle title="Weekly score" subtitle="Last 8 weeks" />
      <ChartCard demo={isDemo}>
        <BarChart
          values={SAMPLE_WEEKLY_SCORES}
          labels={["−7w", "−6w", "−5w", "−4w", "−3w", "−2w", "−1w", "Now"]}
          maxValue={100}
          color={Colors.gold}
          height={140}
        />
      </ChartCard>

      <SectionTitle title="Meditation minutes" subtitle="Last 7 days" />
      <ChartCard demo={isDemo}>
        <BarChart
          values={SAMPLE_MEDITATION_MIN}
          labels={DAY_LABELS}
          maxValue={Math.max(20, ...SAMPLE_MEDITATION_MIN)}
          color="#8B5CF6"
          height={120}
          unit="min"
        />
      </ChartCard>

      <SectionTitle title="Pages read" subtitle="Last 7 days" />
      <ChartCard demo={isDemo}>
        <BarChart
          values={SAMPLE_READING_PAGES}
          labels={DAY_LABELS}
          maxValue={Math.max(30, ...SAMPLE_READING_PAGES)}
          color="#d4534a"
          height={120}
          unit="pg"
        />
      </ChartCard>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function ChartCard({
  children,
  demo,
}: {
  children: React.ReactNode;
  demo?: boolean;
}) {
  return (
    <View style={styles.chartCard}>
      {children}
      {demo ? <Text style={styles.demoLabel}>Demo data</Text> : null}
    </View>
  );
}

function BigStat({
  label,
  value,
  suffix,
  color,
  icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
}) {
  return (
    <View style={[styles.bigStatCard, { borderLeftColor: color }]}>
      <View style={[styles.bigStatIconWrap, { backgroundColor: `${color}1f` }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.bigStatValueRow}>
          <Text style={[styles.bigStatValue, { color }]}>{value}</Text>
          {suffix ? <Text style={styles.bigStatSuffix}>{suffix}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function SmallStat({
  label,
  value,
  suffix,
  icon,
  color,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.smallStatCard}>
      <View style={styles.smallStatHeader}>
        <Feather name={icon} size={14} color={color} />
        <Text style={styles.smallStatLabel}>{label}</Text>
      </View>
      <View style={styles.smallStatValueRow}>
        <Text style={[styles.smallStatValue, { color }]}>{value}</Text>
        {suffix ? <Text style={styles.smallStatSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function BarChart({
  values,
  labels,
  maxValue,
  color,
  height,
  unit,
}: {
  values: number[];
  labels: string[];
  maxValue: number;
  color: string;
  height: number;
  unit?: string;
}) {
  const chartData = useMemo(() => {
    const padX = 8;
    const padTop = 18;
    const padBottom = 22;
    const width = 320;
    const innerH = height - padTop - padBottom;
    const slot = (width - padX * 2) / values.length;
    const barW = Math.max(8, slot * 0.55);
    return values.map((v, i) => {
      const ratio = maxValue > 0 ? Math.min(1, v / maxValue) : 0;
      const h = ratio * innerH;
      const x = padX + slot * i + (slot - barW) / 2;
      const y = padTop + (innerH - h);
      return { v, h, x, y, barW, label: labels[i], cx: x + barW / 2 };
    });
  }, [values, labels, maxValue, height]);

  const padX = 8;
  const padBottom = 22;
  const width = 320;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line
          x1={padX}
          y1={height - padBottom}
          x2={width - padX}
          y2={height - padBottom}
          stroke={Colors.separator}
          strokeWidth={1}
        />
        {chartData.map((d, i) => (
          <React.Fragment key={i}>
            <Rect
              x={d.x}
              y={d.y}
              width={d.barW}
              height={Math.max(d.h, 2)}
              rx={3}
              fill={d.v > 0 ? color : `${color}33`}
            />
            {d.v > 0 ? (
              <SvgText
                x={d.cx}
                y={d.y - 4}
                fontSize={9}
                fill={Colors.textSecondary}
                textAnchor="middle"
              >
                {unit ? `${d.v}${unit}` : `${d.v}`}
              </SvgText>
            ) : null}
            <SvgText
              x={d.cx}
              y={height - 6}
              fontSize={10}
              fill={Colors.textSecondary}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  errorCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginTop: 24,
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fdecea",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 6,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: Colors.goldLight,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
    lineHeight: 18,
  },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  bigStatCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 4,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bigStatIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bigStatValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
  },
  bigStatValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  bigStatSuffix: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  smallStatCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    gap: 6,
  },
  smallStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  smallStatLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  smallStatValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  smallStatValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  smallStatSuffix: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
  },
  demoLabel: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
    textAlign: "right",
  },
});
