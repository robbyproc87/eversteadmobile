import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import Colors from "@/constants/colors";
import type { MeditationSession } from "@/lib/api";

interface TrendsChartProps {
  sessions: MeditationSession[];
}

interface SeriesPoint {
  x: number;
  y: number;
  raw: number;
}

const WIDTH = 320;
const HEIGHT = 180;
const PADDING_LEFT = 28;
const PADDING_RIGHT = 12;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 28;
const PLOT_W = WIDTH - PADDING_LEFT - PADDING_RIGHT;
const PLOT_H = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const MIN_RATING = 1;
const MAX_RATING = 10;

function buildPath(points: SeriesPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  return points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
}

function toPoints(
  values: Array<number | null | undefined>,
): SeriesPoint[] {
  const result: SeriesPoint[] = [];
  const n = values.length;
  if (n === 0) return result;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v == null) continue;
    const clamped = Math.max(MIN_RATING, Math.min(MAX_RATING, v));
    const x =
      PADDING_LEFT +
      (n === 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W);
    const y =
      PADDING_TOP +
      PLOT_H -
      ((clamped - MIN_RATING) / (MAX_RATING - MIN_RATING)) * PLOT_H;
    result.push({ x, y, raw: clamped });
  }
  return result;
}

export default function TrendsChart({ sessions }: TrendsChartProps) {
  const data = useMemo(() => {
    const recent = [...sessions]
      .sort(
        (a, b) =>
          new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
      )
      .slice(-30);
    const tensionBefore = recent.map((s) => s.tensionBefore ?? null);
    const tensionAfter = recent.map((s) => s.tensionAfter ?? null);
    const stressBefore = recent.map((s) => s.stressBefore ?? null);
    const stressAfter = recent.map((s) => s.stressAfter ?? null);
    const hasAny =
      tensionBefore.some((v) => v != null) ||
      tensionAfter.some((v) => v != null) ||
      stressBefore.some((v) => v != null) ||
      stressAfter.some((v) => v != null);
    return {
      count: recent.length,
      hasAny,
      firstDate: recent[0]?.startedAt,
      lastDate: recent[recent.length - 1]?.startedAt,
      series: {
        tensionBefore: toPoints(tensionBefore),
        tensionAfter: toPoints(tensionAfter),
        stressBefore: toPoints(stressBefore),
        stressAfter: toPoints(stressAfter),
      },
    };
  }, [sessions]);

  if (!data.hasAny) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>
          Complete the before/after check-ins on a few sessions to see your
          trends.
        </Text>
      </View>
    );
  }

  const yTicks = [1, 4, 7, 10];

  return (
    <View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {yTicks.map((t) => {
          const y =
            PADDING_TOP +
            PLOT_H -
            ((t - MIN_RATING) / (MAX_RATING - MIN_RATING)) * PLOT_H;
          return (
            <React.Fragment key={`tick-${t}`}>
              <Line
                x1={PADDING_LEFT}
                y1={y}
                x2={PADDING_LEFT + PLOT_W}
                y2={y}
                stroke={Colors.cardBorder}
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              <SvgText
                x={PADDING_LEFT - 6}
                y={y + 3}
                fontSize="9"
                fill={Colors.textSecondary}
                textAnchor="end"
              >
                {t}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Tension before (light) */}
        <Path
          d={buildPath(data.series.tensionBefore)}
          stroke="#F59E0B"
          strokeWidth={1.5}
          strokeDasharray="4,3"
          fill="none"
        />
        {/* Tension after (solid) */}
        <Path
          d={buildPath(data.series.tensionAfter)}
          stroke="#F59E0B"
          strokeWidth={2.25}
          fill="none"
        />
        {/* Stress before (light) */}
        <Path
          d={buildPath(data.series.stressBefore)}
          stroke="#7C3AED"
          strokeWidth={1.5}
          strokeDasharray="4,3"
          fill="none"
        />
        {/* Stress after (solid) */}
        <Path
          d={buildPath(data.series.stressAfter)}
          stroke="#7C3AED"
          strokeWidth={2.25}
          fill="none"
        />

        {data.series.tensionAfter.map((p, i) => (
          <Circle key={`ta-${i}`} cx={p.x} cy={p.y} r={2.5} fill="#F59E0B" />
        ))}
        {data.series.stressAfter.map((p, i) => (
          <Circle key={`sa-${i}`} cx={p.x} cy={p.y} r={2.5} fill="#7C3AED" />
        ))}

        <SvgText
          x={PADDING_LEFT}
          y={HEIGHT - 8}
          fontSize="9"
          fill={Colors.textSecondary}
        >
          {data.firstDate
            ? new Date(data.firstDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : ""}
        </SvgText>
        <SvgText
          x={PADDING_LEFT + PLOT_W}
          y={HEIGHT - 8}
          fontSize="9"
          fill={Colors.textSecondary}
          textAnchor="end"
        >
          {data.lastDate
            ? new Date(data.lastDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : ""}
        </SvgText>
      </Svg>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: "#F59E0B" }]} />
          <Text style={styles.legendText}>Tension (after)</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendSwatch,
              { backgroundColor: "#F59E0B", opacity: 0.5 },
            ]}
          />
          <Text style={styles.legendText}>Tension (before)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: "#7C3AED" }]} />
          <Text style={styles.legendText}>Stress (after)</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendSwatch,
              { backgroundColor: "#7C3AED", opacity: 0.5 },
            ]}
          />
          <Text style={styles.legendText}>Stress (before)</Text>
        </View>
      </View>
      <Text style={styles.helperText}>
        Last {data.count} session{data.count === 1 ? "" : "s"} · scale 1–10
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    padding: 16,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 17,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  helperText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: 6,
  },
});
