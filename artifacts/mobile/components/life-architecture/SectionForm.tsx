import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import type {
  LABlueprint,
  LAGuardrail,
  LAPillar,
  LARitual,
  LAValue,
  LifeArchitectureCadence,
  LifeArchitectureData,
} from "@/lib/api";
import {
  type SectionId,
  type SectionMeta,
  localId,
} from "@/lib/life-architecture";

interface Props {
  section: SectionMeta;
  data: LifeArchitectureData;
  onChange: (next: LifeArchitectureData) => void;
}

export function SectionForm({ section, data, onChange }: Props) {
  switch (section.id) {
    case "foundation":
      return <FoundationForm section={section} data={data} onChange={onChange} />;
    case "pillars":
      return <PillarsForm section={section} data={data} onChange={onChange} />;
    case "blueprints":
      return <BlueprintsForm section={section} data={data} onChange={onChange} />;
    case "rituals":
      return <RitualsForm section={section} data={data} onChange={onChange} />;
    case "guardrails":
      return <GuardrailsForm section={section} data={data} onChange={onChange} />;
    case "vision":
      return <VisionForm section={section} data={data} onChange={onChange} />;
    default:
      return null;
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function AddRow({
  placeholder,
  onAdd,
  color,
}: {
  placeholder: string;
  onAdd: (text: string) => void;
  color: string;
}) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
  };
  return (
    <View style={styles.addRow}>
      <TextInput
        style={styles.addInput}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        onSubmitEditing={submit}
        blurOnSubmit={false}
      />
      <Pressable
        onPress={submit}
        disabled={!text.trim()}
        style={({ pressed }) => [
          styles.addBtn,
          { backgroundColor: color },
          !text.trim() && { opacity: 0.4 },
          pressed && text.trim() && { opacity: 0.85 },
        ]}
        accessibilityLabel="Add"
      >
        <Feather name="plus" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

function ItemRow({
  text,
  onRemove,
  children,
}: {
  text?: string;
  onRemove: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={{ flex: 1 }}>
        {text ? <Text style={styles.itemText}>{text}</Text> : children}
      </View>
      <Pressable
        onPress={onRemove}
        style={({ pressed }) => [
          styles.removeBtn,
          pressed && { opacity: 0.6 },
        ]}
        accessibilityLabel="Remove"
      >
        <Feather name="x" size={14} color={Colors.textSecondary} />
      </Pressable>
    </View>
  );
}

// ----- Foundation -----

function FoundationForm({ section, data, onChange }: Props) {
  const addValue = (text: string) => {
    const v: LAValue = { id: localId("val"), text };
    onChange({
      ...data,
      foundation: {
        ...data.foundation,
        values: [...data.foundation.values, v],
      },
    });
  };
  const removeValue = (id: string) => {
    onChange({
      ...data,
      foundation: {
        ...data.foundation,
        values: data.foundation.values.filter((v) => v.id !== id),
      },
    });
  };
  const addNN = (text: string) => {
    onChange({
      ...data,
      foundation: {
        ...data.foundation,
        nonNegotiables: [...data.foundation.nonNegotiables, text],
      },
    });
  };
  const removeNN = (idx: number) => {
    onChange({
      ...data,
      foundation: {
        ...data.foundation,
        nonNegotiables: data.foundation.nonNegotiables.filter(
          (_, i) => i !== idx,
        ),
      },
    });
  };

  return (
    <View style={styles.formWrap}>
      <FieldLabel>Core values</FieldLabel>
      {data.foundation.values.map((v) => (
        <ItemRow key={v.id} text={v.text} onRemove={() => removeValue(v.id)} />
      ))}
      <AddRow
        placeholder="Add a value (e.g. honesty)"
        onAdd={addValue}
        color={section.color}
      />

      <View style={styles.divider} />

      <FieldLabel>Non-negotiables</FieldLabel>
      {data.foundation.nonNegotiables.map((nn, i) => (
        <ItemRow key={i} text={nn} onRemove={() => removeNN(i)} />
      ))}
      <AddRow
        placeholder="Add a non-negotiable"
        onAdd={addNN}
        color={section.color}
      />
    </View>
  );
}

// ----- Pillars -----

function PillarsForm({ section, data, onChange }: Props) {
  const add = (name: string) => {
    const p: LAPillar = { id: localId("pil"), name, description: "" };
    onChange({ ...data, pillars: [...data.pillars, p] });
  };
  const remove = (id: string) => {
    onChange({
      ...data,
      pillars: data.pillars.filter((p) => p.id !== id),
      blueprints: data.blueprints.filter((b) => b.pillarId !== id),
      rituals: data.rituals.map((r) => ({
        ...r,
        pillarIds: r.pillarIds.filter((pid) => pid !== id),
      })),
    });
  };
  const updateDesc = (id: string, description: string) => {
    onChange({
      ...data,
      pillars: data.pillars.map((p) =>
        p.id === id ? { ...p, description } : p,
      ),
    });
  };

  return (
    <View style={styles.formWrap}>
      <FieldLabel>Your pillars (3–5 recommended)</FieldLabel>
      {data.pillars.map((p) => (
        <View key={p.id} style={styles.cardRow}>
          <View style={styles.cardRowHead}>
            <Text style={styles.cardTitle}>{p.name}</Text>
            <Pressable
              onPress={() => remove(p.id)}
              style={({ pressed }) => [
                styles.removeBtn,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityLabel="Remove pillar"
            >
              <Feather name="x" size={14} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <TextInput
            style={styles.cardDescInput}
            value={p.description ?? ""}
            onChangeText={(t) => updateDesc(p.id, t)}
            placeholder="Why this pillar matters this year…"
            placeholderTextColor={Colors.textTertiary}
            multiline
          />
        </View>
      ))}
      <AddRow
        placeholder="Add a pillar (e.g. Health)"
        onAdd={add}
        color={section.color}
      />
    </View>
  );
}

// ----- Blueprints -----

function BlueprintsForm({ section, data, onChange }: Props) {
  if (data.pillars.length === 0) {
    return (
      <View style={[styles.formWrap, styles.emptyStateBox]}>
        <Feather name="alert-circle" size={20} color={Colors.textTertiary} />
        <Text style={styles.emptyStateText}>
          Define your pillars first — blueprints live under each pillar.
        </Text>
      </View>
    );
  }

  const add = (pillarId: string, title: string) => {
    const b: LABlueprint = {
      id: localId("bp"),
      pillarId,
      title,
      targetDate: null,
      description: null,
    };
    onChange({ ...data, blueprints: [...data.blueprints, b] });
  };
  const remove = (id: string) => {
    onChange({
      ...data,
      blueprints: data.blueprints.filter((b) => b.id !== id),
    });
  };
  const updateField = (id: string, patch: Partial<LABlueprint>) => {
    onChange({
      ...data,
      blueprints: data.blueprints.map((b) =>
        b.id === id ? { ...b, ...patch } : b,
      ),
    });
  };

  return (
    <View style={styles.formWrap}>
      {data.pillars.map((p) => {
        const items = data.blueprints.filter((b) => b.pillarId === p.id);
        return (
          <View key={p.id} style={styles.pillarGroup}>
            <Text style={styles.pillarHead}>{p.name}</Text>
            {items.map((b) => (
              <View key={b.id} style={styles.cardRow}>
                <View style={styles.cardRowHead}>
                  <TextInput
                    style={[styles.cardTitleInput, { flex: 1 }]}
                    value={b.title}
                    onChangeText={(t) => updateField(b.id, { title: t })}
                    placeholder="Blueprint title"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <Pressable
                    onPress={() => remove(b.id)}
                    style={({ pressed }) => [
                      styles.removeBtn,
                      pressed && { opacity: 0.6 },
                    ]}
                    accessibilityLabel="Remove blueprint"
                  >
                    <Feather name="x" size={14} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                <TextInput
                  style={styles.cardSmallInput}
                  value={b.targetDate ?? ""}
                  onChangeText={(t) =>
                    updateField(b.id, { targetDate: t || null })
                  }
                  placeholder="Target (e.g. Dec 2026, Q3)"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            ))}
            <AddRow
              placeholder={`Add blueprint for ${p.name}`}
              onAdd={(t) => add(p.id, t)}
              color={section.color}
            />
          </View>
        );
      })}
    </View>
  );
}

// ----- Rituals -----

const CADENCES: LifeArchitectureCadence[] = ["daily", "weekly", "monthly"];

function RitualsForm({ section, data, onChange }: Props) {
  const add = (name: string) => {
    const r: LARitual = {
      id: localId("rit"),
      name,
      cadence: "daily",
      pillarIds: [],
    };
    onChange({ ...data, rituals: [...data.rituals, r] });
  };
  const remove = (id: string) => {
    onChange({
      ...data,
      rituals: data.rituals.filter((r) => r.id !== id),
    });
  };
  const update = (id: string, patch: Partial<LARitual>) => {
    onChange({
      ...data,
      rituals: data.rituals.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };
  const toggleTag = (id: string, pillarId: string) => {
    const r = data.rituals.find((x) => x.id === id);
    if (!r) return;
    const next = r.pillarIds.includes(pillarId)
      ? r.pillarIds.filter((x) => x !== pillarId)
      : [...r.pillarIds, pillarId];
    update(id, { pillarIds: next });
  };

  return (
    <View style={styles.formWrap}>
      <FieldLabel>Daily & weekly rituals</FieldLabel>
      {data.rituals.map((r) => (
        <View key={r.id} style={styles.cardRow}>
          <View style={styles.cardRowHead}>
            <TextInput
              style={[styles.cardTitleInput, { flex: 1 }]}
              value={r.name}
              onChangeText={(t) => update(r.id, { name: t })}
              placeholder="Ritual name"
              placeholderTextColor={Colors.textTertiary}
            />
            <Pressable
              onPress={() => remove(r.id)}
              style={({ pressed }) => [
                styles.removeBtn,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityLabel="Remove ritual"
            >
              <Feather name="x" size={14} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.tagRow}>
            {CADENCES.map((c) => {
              const active = r.cadence === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => update(r.id, { cadence: c })}
                  style={({ pressed }) => [
                    styles.tag,
                    active && {
                      backgroundColor: section.bg,
                      borderColor: section.color,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      active && {
                        color: section.color,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {data.pillars.length > 0 && (
            <>
              <Text style={styles.smallHint}>Tag pillars:</Text>
              <View style={styles.tagRow}>
                {data.pillars.map((p) => {
                  const active = r.pillarIds.includes(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => toggleTag(r.id, p.id)}
                      style={({ pressed }) => [
                        styles.tag,
                        active && {
                          backgroundColor: section.bg,
                          borderColor: section.color,
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          active && {
                            color: section.color,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      ))}
      <AddRow
        placeholder="Add a ritual (e.g. Morning pages)"
        onAdd={add}
        color={section.color}
      />
    </View>
  );
}

// ----- Guardrails -----

function GuardrailsForm({ section, data, onChange }: Props) {
  const add = (rule: string) => {
    const g: LAGuardrail = { id: localId("gr"), rule };
    onChange({ ...data, guardrails: [...data.guardrails, g] });
  };
  const remove = (id: string) => {
    onChange({
      ...data,
      guardrails: data.guardrails.filter((g) => g.id !== id),
    });
  };

  return (
    <View style={styles.formWrap}>
      <FieldLabel>Your guardrails</FieldLabel>
      {data.guardrails.map((g) => (
        <ItemRow key={g.id} text={g.rule} onRemove={() => remove(g.id)} />
      ))}
      <AddRow
        placeholder='e.g. "Never schedule before 9am"'
        onAdd={add}
        color={section.color}
      />
    </View>
  );
}

// ----- Vision -----

function VisionForm({ section, data, onChange }: Props) {
  return (
    <View style={styles.formWrap}>
      <FieldLabel>Write your vision (present tense)</FieldLabel>
      <TextInput
        style={styles.visionInput}
        value={data.vision.narrative}
        onChangeText={(t) =>
          onChange({ ...data, vision: { narrative: t } })
        }
        placeholder="A year from now, I wake up… (write in present tense, vivid and specific)"
        placeholderTextColor={Colors.textTertiary}
        multiline
        textAlignVertical="top"
      />
      <Text style={styles.smallHint}>
        Sage's tip: write as if today is a year from now. The words shape what
        you'll build toward.
      </Text>
      <View style={{ height: 0, opacity: 0 }}>
        {/* keep section reference used for type narrowing */}
        <Text>{section.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.separator,
    marginVertical: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  itemText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  addRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 4,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardRow: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  cardRowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  cardTitleInput: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
    paddingVertical: 2,
  },
  cardDescInput: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
  },
  cardSmallInput: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillarGroup: {
    gap: 6,
    marginBottom: 12,
  },
  pillarHead: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  emptyStateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 14,
  },
  emptyStateText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  smallHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
  visionInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    minHeight: 160,
    lineHeight: 21,
  },
});
