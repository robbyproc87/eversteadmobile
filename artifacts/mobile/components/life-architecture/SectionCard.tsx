import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";
import type {
  LABlueprint,
  LAPillar,
  LARitual,
  LifeArchitectureData,
} from "@/lib/api";
import {
  SECTIONS,
  type SectionId,
  type SectionMeta,
  isSectionComplete,
} from "@/lib/life-architecture";

interface Props {
  section: SectionMeta;
  data: LifeArchitectureData;
  onEvolve: (id: SectionId) => void;
}

export function SectionCard({ section, data, onEvolve }: Props) {
  const [expanded, setExpanded] = useState(false);
  const complete = isSectionComplete(data, section.id);

  return (
    <View style={[styles.card, { borderLeftColor: section.color }]}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [
          styles.head,
          pressed && { backgroundColor: Colors.background },
        ]}
      >
        <View
          style={[
            styles.icon,
            {
              backgroundColor: complete ? section.bg : Colors.background,
            },
          ]}
        >
          <Feather
            name={section.icon as never}
            size={18}
            color={complete ? section.color : Colors.textTertiary}
          />
        </View>
        <View style={styles.headText}>
          <View style={styles.titleRow}>
            <Text style={styles.label}>{section.label}</Text>
            {complete && (
              <View
                style={[styles.badge, { backgroundColor: section.bg }]}
              >
                <Feather name="check" size={10} color={section.color} />
                <Text style={[styles.badgeText, { color: section.color }]}>
                  Shaped
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.tagline}>{section.tagline}</Text>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={Colors.textTertiary}
        />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <Text style={styles.metaphor}>{section.metaphor}</Text>
          <Text style={styles.description}>{section.description}</Text>
          <SectionPreview section={section} data={data} />
          <Pressable
            onPress={() => onEvolve(section.id)}
            style={({ pressed }) => [
              styles.evolveBtn,
              { backgroundColor: section.color },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Feather name="edit-3" size={14} color="#fff" />
            <Text style={styles.evolveText}>
              {complete ? "Evolve" : "Begin"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function SectionPreview({
  section,
  data,
}: {
  section: SectionMeta;
  data: LifeArchitectureData;
}) {
  switch (section.id) {
    case "foundation":
      return <FoundationPreview data={data} />;
    case "pillars":
      return <PillarsPreview data={data} />;
    case "blueprints":
      return <BlueprintsPreview data={data} />;
    case "rituals":
      return <RitualsPreview data={data} />;
    case "guardrails":
      return <GuardrailsPreview data={data} />;
    case "vision":
      return <VisionPreview data={data} />;
    default:
      return null;
  }
}

function EmptyHint({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

function FoundationPreview({ data }: { data: LifeArchitectureData }) {
  const { values, nonNegotiables } = data.foundation;
  if (values.length === 0 && nonNegotiables.length === 0) {
    return <EmptyHint text="No values captured yet." />;
  }
  return (
    <View style={styles.previewBox}>
      {values.length > 0 && (
        <>
          <Text style={styles.previewSubhead}>Values</Text>
          <View style={styles.chipRow}>
            {values.map((v) => (
              <View key={v.id} style={[styles.chip, { backgroundColor: SECTIONS[0].bg }]}>
                <Text style={[styles.chipText, { color: SECTIONS[0].color }]}>
                  {v.text}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
      {nonNegotiables.length > 0 && (
        <>
          <Text style={styles.previewSubhead}>Non-negotiables</Text>
          {nonNegotiables.map((n, i) => (
            <Text key={i} style={styles.bullet}>
              • {n}
            </Text>
          ))}
        </>
      )}
    </View>
  );
}

function PillarsPreview({ data }: { data: LifeArchitectureData }) {
  if (data.pillars.length === 0) {
    return <EmptyHint text="No pillars defined yet." />;
  }
  return (
    <View style={styles.previewBox}>
      {data.pillars.map((p: LAPillar) => (
        <View key={p.id} style={styles.nestedItem}>
          <View
            style={[
              styles.nestedDot,
              { backgroundColor: SECTIONS[1].color },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.nestedTitle}>{p.name}</Text>
            {p.description ? (
              <Text style={styles.nestedSub}>{p.description}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function BlueprintsPreview({ data }: { data: LifeArchitectureData }) {
  if (data.blueprints.length === 0) {
    return <EmptyHint text="No blueprints yet — define pillars first." />;
  }
  // group by pillar
  const byPillar: Record<string, LABlueprint[]> = {};
  for (const b of data.blueprints) {
    (byPillar[b.pillarId] ||= []).push(b);
  }
  return (
    <View style={styles.previewBox}>
      {data.pillars.map((p) => {
        const items = byPillar[p.id] || [];
        if (items.length === 0) return null;
        return (
          <View key={p.id} style={{ gap: 4 }}>
            <Text style={styles.previewSubhead}>{p.name}</Text>
            {items.map((b) => (
              <View key={b.id} style={styles.nestedItem}>
                <Feather
                  name="file-text"
                  size={12}
                  color={SECTIONS[2].color}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nestedTitle}>{b.title}</Text>
                  {b.targetDate ? (
                    <Text style={styles.nestedSub}>by {b.targetDate}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function RitualsPreview({ data }: { data: LifeArchitectureData }) {
  if (data.rituals.length === 0) {
    return <EmptyHint text="No rituals captured yet." />;
  }
  const pillarName = (id: string) =>
    data.pillars.find((p) => p.id === id)?.name;
  return (
    <View style={styles.previewBox}>
      {data.rituals.map((r: LARitual) => (
        <View key={r.id} style={styles.nestedItem}>
          <Feather name="repeat" size={12} color={SECTIONS[3].color} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nestedTitle}>{r.name}</Text>
            <Text style={styles.nestedSub}>
              {r.cadence}
              {r.pillarIds.length > 0
                ? ` · ${r.pillarIds
                    .map(pillarName)
                    .filter(Boolean)
                    .join(", ")}`
                : ""}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function GuardrailsPreview({ data }: { data: LifeArchitectureData }) {
  if (data.guardrails.length === 0) {
    return <EmptyHint text="No guardrails set yet." />;
  }
  return (
    <View style={styles.previewBox}>
      {data.guardrails.map((g) => (
        <View key={g.id} style={styles.nestedItem}>
          <Feather name="shield" size={12} color={SECTIONS[4].color} />
          <Text style={[styles.nestedTitle, { flex: 1 }]}>{g.rule}</Text>
        </View>
      ))}
    </View>
  );
}

function VisionPreview({ data }: { data: LifeArchitectureData }) {
  if (!data.vision.narrative.trim()) {
    return <EmptyHint text="No vision written yet." />;
  }
  return (
    <View style={styles.previewBox}>
      <Text style={styles.visionText}>"{data.vision.narrative}"</Text>
    </View>
  );
}

const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  android: { elevation: 1 },
  web: { boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 4,
    borderRadius: 14,
    overflow: "hidden",
    ...shadow,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  tagline: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    paddingTop: 12,
  },
  metaphor: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
    fontStyle: "italic",
  },
  description: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  previewBox: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  previewSubhead: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  bullet: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    lineHeight: 18,
  },
  nestedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nestedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nestedTitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  nestedSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  visionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    lineHeight: 21,
    fontStyle: "italic",
  },
  empty: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    fontStyle: "italic",
  },
  evolveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  evolveText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
