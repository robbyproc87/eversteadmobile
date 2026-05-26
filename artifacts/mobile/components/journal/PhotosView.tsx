import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import { api, ApiError } from "@/lib/api";
import PhotoLightbox from "@/components/journal/PhotoLightbox";

const COLUMNS = 3;
const GUTTER = 6;

interface PhotosViewProps {
  bottomInset?: number;
}

export default function PhotosView({ bottomInset = 0 }: PhotosViewProps) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const query = useInfiniteQuery({
    queryKey: ["journal", "media-all"],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api.listAllJournalMedia(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
  });

  const items = useMemo(() => {
    const all = (query.data?.pages ?? []).flatMap((p) => p.items);
    return all.filter((m) => (m.mime || "").startsWith("image/"));
  }, [query.data]);

  const onOpen = useCallback((idx: number) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setLightboxIndex(idx);
  }, []);

  const handleDelete = useCallback(
    async (photo: { id: string; entryId: string }) => {
      try {
        await api.deleteJournalMedia(photo.entryId, photo.id);
        queryClient.invalidateQueries({ queryKey: ["journal", "media-all"] });
        queryClient.invalidateQueries({ queryKey: ["journal", "media", photo.entryId] });
        showSuccess("Photo removed");
        setLightboxIndex(null);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Couldn't remove photo.";
        showError(msg);
      }
    },
    [queryClient, showError, showSuccess],
  );

  if (query.isLoading) {
    return (
      <View style={[styles.center, { paddingBottom: bottomInset }]}>
        <ActivityIndicator color={Colors.gold} size="large" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.center, { paddingBottom: bottomInset }]}>
        <View style={styles.emptyIcon}>
          <Feather name="image" size={32} color={Colors.gold} />
        </View>
        <Text style={styles.emptyTitle}>No photos yet</Text>
        <Text style={styles.emptyBody}>
          Attach photos to a journal entry and they&apos;ll appear here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: bottomInset + 40 }}
      showsVerticalScrollIndicator={false}
      onScroll={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        const distanceFromBottom =
          contentSize.height - (contentOffset.y + layoutMeasurement.height);
        if (
          distanceFromBottom < 240 &&
          query.hasNextPage &&
          !query.isFetchingNextPage
        ) {
          query.fetchNextPage();
        }
      }}
      scrollEventThrottle={200}
      refreshControl={undefined}
    >
      <View style={styles.grid}>
        {items.map((p, idx) => (
          <Pressable
            key={p.id}
            onPress={() => onOpen(idx)}
            style={({ pressed }) => [
              styles.cellWrap,
              pressed && { opacity: 0.8 },
            ]}
          >
            {p.signedUrl ? (
              <Image source={{ uri: p.signedUrl }} style={styles.cell} resizeMode="cover" />
            ) : (
              <View style={[styles.cell, styles.cellPlaceholder]}>
                <Feather name="image" size={20} color={Colors.textTertiary} />
              </View>
            )}
          </Pressable>
        ))}
      </View>
      {query.hasNextPage ? (
        <Pressable
          onPress={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          style={({ pressed }) => [
            styles.loadMore,
            pressed && { opacity: 0.7 },
          ]}
        >
          {query.isFetchingNextPage ? (
            <ActivityIndicator color={Colors.gold} />
          ) : (
            <Text style={styles.loadMoreText}>Load more</Text>
          )}
        </Pressable>
      ) : null}
      <PhotoLightbox
        visible={lightboxIndex !== null}
        photos={items.map((p) => ({ id: p.id, signedUrl: p.signedUrl }))}
        initialIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
        onDelete={(photo) => {
          const found = items.find((i) => i.id === photo.id);
          if (found) handleDelete({ id: found.id, entryId: found.entryId });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  emptyBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: GUTTER,
    paddingTop: GUTTER,
  },
  cellWrap: {
    width: `${100 / COLUMNS}%`,
    aspectRatio: 1,
    padding: GUTTER / 2,
  },
  cell: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  cellPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  loadMore: {
    paddingVertical: 14,
    alignItems: "center",
  },
  loadMoreText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
  },
});
