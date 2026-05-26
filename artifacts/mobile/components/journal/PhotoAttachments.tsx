import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import { api, ApiError } from "@/lib/api";
import PhotoLightbox from "@/components/journal/PhotoLightbox";

interface PhotoAttachmentsProps {
  entryId: string | null;
  readOnly?: boolean;
  onRequireSaveFirst?: () => Promise<string | null>;
}

async function uploadToSignedUrl(
  signedUrl: string,
  uri: string,
  mime: string,
): Promise<number> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const put = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: blob,
  });
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status})`);
  }
  return blob.size;
}

export default function PhotoAttachments({
  entryId,
  readOnly,
  onRequireSaveFirst,
}: PhotoAttachmentsProps) {
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const mediaQuery = useQuery({
    queryKey: ["journal", "media", entryId ?? "new"],
    queryFn: () => api.listJournalEntryMedia(entryId as string),
    enabled: !!entryId,
  });

  const photos = (mediaQuery.data ?? []).filter((m) =>
    (m.mime || "").startsWith("image/"),
  );

  const pickAndUpload = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showError("Photo library permission is needed.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];

      let id = entryId;
      if (!id) {
        if (!onRequireSaveFirst) {
          showError("Save your entry first to attach photos.");
          return;
        }
        id = await onRequireSaveFirst();
        if (!id) return;
      }

      setUploading(true);
      const mime = asset.mimeType || "image/jpeg";
      const { path, signedUrl } = await api.requestJournalMediaUpload(id, mime);
      const bytes = await uploadToSignedUrl(signedUrl, asset.uri, mime);
      await api.confirmJournalMedia(id, {
        path,
        mime,
        bytes,
        width: asset.width,
        height: asset.height,
      });
      queryClient.invalidateQueries({ queryKey: ["journal", "media", id] });
      queryClient.invalidateQueries({ queryKey: ["journal", "media-all"] });
      showSuccess("Photo attached");
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Couldn't attach photo.";
      showError(msg);
    } finally {
      setUploading(false);
    }
  }, [entryId, onRequireSaveFirst, queryClient, showError, showSuccess]);

  const handleDeletePhoto = useCallback(
    async (mediaId: string) => {
      if (!entryId) return;
      try {
        await api.deleteJournalMedia(entryId, mediaId);
        queryClient.invalidateQueries({ queryKey: ["journal", "media", entryId] });
        queryClient.invalidateQueries({ queryKey: ["journal", "media-all"] });
        showSuccess("Photo removed");
        setLightboxIndex(null);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Couldn't remove photo.";
        showError(msg);
      }
    },
    [entryId, queryClient, showError, showSuccess],
  );

  const renderGrid = () => {
    if (mediaQuery.isLoading) {
      return <ActivityIndicator color={Colors.gold} style={{ marginVertical: 12 }} />;
    }
    if (photos.length === 0) {
      return readOnly ? null : (
        <Text style={styles.emptyText}>No photos attached yet.</Text>
      );
    }
    return (
      <View style={styles.grid}>
        {photos.map((p, idx) => (
          <Pressable
            key={p.id}
            onPress={() => setLightboxIndex(idx)}
            accessibilityLabel="Open photo"
            style={({ pressed }) => [
              styles.thumbWrap,
              pressed && { opacity: 0.85 },
            ]}
          >
            {p.signedUrl ? (
              <Image
                source={{ uri: p.signedUrl }}
                style={styles.thumb}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Feather name="image" size={20} color={Colors.textTertiary} />
              </View>
            )}
          </Pressable>
        ))}
      </View>
    );
  };

  const lightbox = (
    <PhotoLightbox
      visible={lightboxIndex !== null}
      photos={photos.map((p) => ({ id: p.id, signedUrl: p.signedUrl }))}
      initialIndex={lightboxIndex ?? 0}
      onClose={() => setLightboxIndex(null)}
      onDelete={readOnly ? undefined : (photo) => handleDeletePhoto(photo.id)}
    />
  );

  if (readOnly) {
    if (!entryId) return null;
    if (mediaQuery.isLoading) return null;
    if (photos.length === 0) return null;
    return (
      <View style={styles.readWrap}>
        <Text style={styles.sectionLabel}>Photos</Text>
        {renderGrid()}
        {lightbox}
      </View>
    );
  }

  return (
    <View>
      <Pressable
        onPress={pickAndUpload}
        disabled={uploading}
        accessibilityLabel="Add photo"
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.toolbarBtn,
          uploading && { opacity: 0.5 },
          pressed && !uploading && { opacity: 0.7 },
        ]}
        hitSlop={6}
      >
        {uploading ? (
          <ActivityIndicator size="small" color={Colors.goldDark} />
        ) : (
          <Feather name="image" size={14} color={Colors.goldDark} />
        )}
        <Text style={styles.toolbarBtnText}>
          {uploading ? "Uploading…" : "Photo"}
        </Text>
      </Pressable>
      {entryId ? renderGrid() : null}
      {lightbox}
    </View>
  );
}

const styles = StyleSheet.create({
  readWrap: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.goldLight,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  toolbarBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  thumbWrap: {
    width: 88,
    height: 88,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    fontStyle: "italic",
    marginTop: 10,
  },
});
