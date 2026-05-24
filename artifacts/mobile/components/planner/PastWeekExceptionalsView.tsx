import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { api } from "@/lib/api";
import type { TrulyExceptional } from "@/lib/api";

interface PastWeekExceptionalsViewProps {
  weekStart: Date;
}

function formatDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function previousWeekStart(weekStart: Date): Date {
  const prev = new Date(weekStart);
  prev.setDate(prev.getDate() - 7);
  prev.setHours(0, 0, 0, 0);
  return prev;
}

interface CategoryConfig {
  key: string;
  title: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
}

const CATEGORIES: CategoryConfig[] = [
  { key: "personal", title: "Personal", color: "#5b8def", icon: "star" },
  { key: "professional", title: "Professional", color: Colors.goldDark, icon: "briefcase" },
  { key: "inner", title: "Inner", color: "#a78bfa", icon: "heart" },
];

export default function PastWeekExceptionalsView({
  weekStart,
}: PastWeekExceptionalsViewProps) {
  const prevStart = useMemo(() => previousWeekStart(weekStart), [weekStart]);
  const prevStartStr = formatDateParam(prevStart);

  const prevWeekQuery = useQuery({
    queryKey: ["planner", "week", prevStartStr],
    queryFn: () => api.getWeek(prevStartStr),
    retry: 1,
  });

  const byCategory = useMemo(() => {
    const map: Record<string, TrulyExceptional[]> = {
      personal: [],
      professional: [],
      inner: [],
    };
    (prevWeekQuery.data?.trulyExceptionals || []).forEach((te) => {
      if (map[te.category]) map[te.category].push(te);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => a.ordinal - b.ordinal);
    });
    return map;
  }, [prevWeekQuery.data]);

  const rangeLabel = useMemo(() => {
    const end = new Date(prevStart);
    end.setDate(end.getDate() + 6);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const sameMonth = prevStart.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${months[prevStart.getMonth()]} ${prevStart.getDate()} – ${end.getDate()}`;
    }
    return `${months[prevStart.getMonth()]} ${prevStart.getDate()} – ${months[end.getMonth()]} ${end.getDate()}`;
  }, [prevStart]);

  if (prevWeekQuery.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={Colors.gold} />
      </View>
    );
  }

  const hasAny = CATEGORIES.some((c) => byCategory[c.key].some((t) => t.text && t.text.trim().length > 0));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: Colors.goldLight }]}>
          <Feather name="rotate-ccw" size={14} color={Colors.goldDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Last Week's Exceptionals</Text>
          <Text style={styles.subtitle}>{rangeLabel}</Text>
        </View>
      </View>

      {!hasAny ? (
        <Text style={styles.empty}>
          No Truly Exceptionals were set for last week.
        </Text>
      ) : (
        CATEGORIES.map((cat) => {
          const items = byCategory[cat.key];
          const filled = items.filter((t) => t.text && t.text.trim().length > 0);
          return (
            <View key={cat.key} style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Feather name={cat.icon} size={13} color={cat.color} />
                <Text style={styles.categoryTitle}>{cat.title}</Text>
              </View>
              {filled.length === 0 ? (
                <Text style={styles.categoryEmpty}>— none —</Text>
              ) : (
                filled.map((t, i) => (
                  <View key={`${cat.key}-${i}`} style={styles.row}>
                    <Text style={styles.rowNum}>{t.ordinal + 1}.</Text>
                    <Text style={styles.rowText}>{t.text}</Text>
                    {t.status === "completed" ? (
                      <Feather name="check-circle" size={14} color={Colors.success} />
                    ) : null}
                  </View>
                ))
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: 40,
    alignItems: "center",
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
    paddingVertical: 18,
  },
  categoryBlock: {
    marginBottom: 14,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    letterSpacing: 0.2,
  },
  categoryEmpty: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    paddingLeft: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
    paddingLeft: 16,
  },
  rowNum: {
    width: 16,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    lineHeight: 20,
  },
});
