import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import type { LifeArchitectureSnapshotMeta } from "@/lib/api";

interface Props {
  visible: boolean;
  versions: LifeArchitectureSnapshotMeta[];
  onClose: () => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function VersionHistoryModal({ visible, versions, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Feather name="clock" size={18} color={Colors.gold} />
              <Text style={styles.title}>Version history</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityLabel="Close version history"
            >
              <Feather name="x" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {versions.length === 0 ? (
              <Text style={styles.empty}>
                No saved versions yet. Each save creates a snapshot you can
                look back on.
              </Text>
            ) : (
              versions.map((v, i) => (
                <View key={v.id} style={styles.versionItem}>
                  <View style={styles.versionDot} />
                  <View style={styles.versionContent}>
                    <Text style={styles.versionDate}>
                      {formatDate(v.createdAt)}
                    </Text>
                    {v.note ? (
                      <Text style={styles.versionNote}>{v.note}</Text>
                    ) : (
                      <Text style={styles.versionMuted}>
                        {i === 0 ? "Most recent snapshot" : "Snapshot"}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20, 20, 20, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    maxHeight: 400,
  },
  listContent: {
    padding: 18,
    gap: 14,
  },
  empty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    paddingVertical: 24,
    lineHeight: 19,
  },
  versionItem: {
    flexDirection: "row",
    gap: 12,
    paddingLeft: 4,
  },
  versionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
    marginTop: 5,
  },
  versionContent: {
    flex: 1,
    gap: 2,
  },
  versionDate: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  versionNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  versionMuted: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
});
