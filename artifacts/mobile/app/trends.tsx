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
  type TrendDataPoint,
  type WeeklyScorePoint,
  api,
  isPreviewAuthError,
} from "@/lib/api";

interface TrendsState {
  stats: DashboardStats | null;
  daily: TrendDataPoint[];
  weeklyScores: WeeklyScorePoint[];
  isPreview: boolean;
}

const WEEKLY_SCORE_WEEKS = 8;

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Monday-start week, matching the web planner (planner-utils.getWeekStart). */
function getMondayWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Label for a week-start date, e.g. "5/12". */
function weekLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function dayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return SHORT_DAY[d.getUTCDay()];
}

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
        const [stats, daily, weekly] = await Promise.all([
          api.getDashboardStats(),
          api.getTrends(7),
          // 8 week slots need up to ~60 days of history.
          api.getWeeklyScores(WEEKLY_SCORE_WEEKS * 7 + 6),
        ]);
        return {
          stats: stats ?? null,
          daily: daily ?? [],
          weeklyScores: weekly?.scores ?? [],
          isPreview: false,
        };
      } catch (e) {
        if (isPreviewAuthError(e)) {
          return { stats: null, daily: [], weeklyScores: [], isPreview: true };
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

  const { stats, daily, weeklyScores, isPreview } = query.data;

  // Map returned scores by week-start key. Tolerate legacy Sunday-keyed
  // weeks created by older mobile builds (one day before the Monday key).
  const scoreByWeek = new Map(weeklyScores.map((s) => [s.weekStart, s.score]));
  const currentWeekStart = getMondayWeekStart(new Date());
  const weekSlots: { label: string; score: number | null }[] = [];
  for (let i = WEEKLY_SCORE_WEEKS - 1; i >= 0; i--) {
    const monday = new Date(currentWeekStart);
    monday.setDate(monday.getDate() - i * 7);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() - 1);
    const key = toDateParam(monday);
    const score = scoreByWeek.get(key) ?? scoreByWeek.get(toDateParam(sunday)) ?? null;
    weekSlots.push({ label: weekLabel(key), score });
  }

  const meditationValues = daily.map((p) => p.meditationMinutes);
  const pagesValues = daily.map((p) => p.pagesRead);
  const dailyLabels = daily.map((p) => dayLabel(p.date));

  const hasScores = weekSlots.some((w) => (w.score ?? 0) > 0);
  const hasMeditation = meditationValues.some((v) => v > 0);
  const hasPages = pagesValues.some((v) => v > 0);
  const hasAnyData =
    hasScores ||
    hasMeditation ||
    hasPages ||
    (stats?.journalStreak ?? 0) > 0 ||
    (stats?.plannerStreak ?? 0) > 0 ||
    (stats?.daysPlanned ?? 0) > 0;

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
      {isPreview && (
        <View style={styles.banner}>
          <Feather name="info" size={16} color={Colors.gold} />
          <Text style={styles.bannerText}>
            Preview Mode — sign in to see your real progress.
          </Text>
        </View>
      )}
      {!isPreview && !hasAnyData && (
        <View style={styles.banner}>
          <Feather name="info" size={16} color={Colors.gold} />
          <Text style={styles.bannerText}>
            Your charts fill in as you plan, journal, read, and meditate.
          </Text>
        </View>
      )}

      <SectionTitle title="This week" />
      <View style={styles.statRow}>
        <BigStat
          label="Weekly score"
          value={stats?.weeklyScore != null ? `${stats.weeklyScore}` : "—"}
          suffix={stats?.weeklyScore != null ? "/10" : undefined}
          color={Colors.gold}
          icon="award"
        />
      </View>

      <View style={styles.statRow}>
        <SmallStat
          label="Journal streak"
          value={stats?.journalStreak ?? 0}
          suffix="days"
          icon="book-open"
          color="#5b8def"
        />
        <SmallStat
          label="Planner streak"
          value={stats?.plannerStreak ?? 0}
          suffix="days"
          icon="check-square"
          color="#4a9c6d"
        />
      </View>

      <View style={styles.statRow}>
        <SmallStat
          label="Pages read"
          value={stats?.pagesRead ?? 0}
          suffix="this wk"
          icon="book"
          color="#d4534a"
        />
        <SmallStat
          label="Days planned"
          value={stats?.daysPlanned ?? 0}
          suffix="this wk"
          icon="calendar"
          color="#8B5CF6"
        />
      </View>

      <SectionTitle title="Weekly score" subtitle="Last 8 weeks" />
      <ChartCard
        emptyHint={hasScores ? undefined : "Score your week in the planner's Weekly Review to start this chart."}
      >
        <BarChart
          values={weekSlots.map((w) => w.score ?? 0)}
          labels={weekSlots.map((w) => w.label)}
          maxValue={10}
          color={Colors.gold}
          height={140}
        />
      </ChartCard>

      <SectionTitle title="Meditation minutes" subtitle="Last 7 days" />
      <ChartCard
        emptyHint={hasMeditation ? undefined : "Finish a meditation session and it shows up here."}
      >
        <BarChart
          values={meditationValues}
          labels={dailyLabels}
          maxValue={Math.max(20, ...meditationValues)}
          color="#8B5CF6"
          height={120}
          unit="min"
        />
      </ChartCard>

      <SectionTitle title="Pages read" subtitle="Last 7 days" />
      <ChartCard
        emptyHint={hasPages ? undefined : "Log reading in the Growth Library to track your pages."}
      >
        <BarChart
          values={pagesValues}
          labels={dailyLabels}
          maxValue={Math.max(30, ...pagesValues)}
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
  emptyHint,
}: {
  children: React.ReactNode;
  emptyHint?: string;
}) {
  return (
    <View style={styles.chartCard}>
      {children}
      {emptyHint ? <Text style={styles.emptyHint}>{emptyHint}</Text> : null}
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
  emptyHint: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
    lineHeight: 16,
  },
});
