import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";

export interface LightboxPhoto {
  id: string;
  signedUrl?: string | null;
}

interface PhotoLightboxProps {
  visible: boolean;
  photos: LightboxPhoto[];
  initialIndex: number;
  onClose: () => void;
  onDelete?: (photo: LightboxPhoto) => void;
}

export default function PhotoLightbox({
  visible,
  photos,
  initialIndex,
  onClose,
  onDelete,
}: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const { width, height } = useMemo(() => Dimensions.get("window"), []);

  useEffect(() => {
    if (visible) {
      setIndex(Math.max(0, Math.min(initialIndex, photos.length - 1)));
      translateX.setValue(0);
      translateY.setValue(0);
    }
  }, [visible, initialIndex, photos.length, translateX, translateY]);

  const goPrev = useCallback(() => {
    if (index <= 0) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setIndex(index - 1);
    translateX.setValue(0);
  }, [index, translateX]);

  const goNext = useCallback(() => {
    if (index >= photos.length - 1) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setIndex(index + 1);
    translateX.setValue(0);
  }, [index, photos.length, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8,
        onPanResponderMove: (_, gs) => {
          if (Math.abs(gs.dy) > Math.abs(gs.dx)) {
            translateY.setValue(gs.dy);
            translateX.setValue(0);
          } else {
            translateX.setValue(gs.dx);
            translateY.setValue(0);
          }
        },
        onPanResponderRelease: (_, gs) => {
          const horizDistance = width / 3;
          const vertDismiss = height / 4;
          const velocityX = Math.abs(gs.vx);
          const velocityY = Math.abs(gs.vy);

          if (Math.abs(gs.dy) > Math.abs(gs.dx)) {
            if (Math.abs(gs.dy) > vertDismiss || velocityY > 0.6) {
              onClose();
              return;
            }
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
            return;
          }

          if (gs.dx < -horizDistance || (gs.dx < -40 && gs.vx < -0.3)) {
            if (index < photos.length - 1) {
              Animated.timing(translateX, {
                toValue: -width,
                duration: 180,
                useNativeDriver: true,
              }).start(() => {
                setIndex((i) => Math.min(i + 1, photos.length - 1));
                translateX.setValue(0);
              });
              if (Platform.OS !== "web") Haptics.selectionAsync();
              return;
            }
          } else if (gs.dx > horizDistance || (gs.dx > 40 && gs.vx > 0.3)) {
            if (index > 0) {
              Animated.timing(translateX, {
                toValue: width,
                duration: 180,
                useNativeDriver: true,
              }).start(() => {
                setIndex((i) => Math.max(i - 1, 0));
                translateX.setValue(0);
              });
              if (Platform.OS !== "web") Haptics.selectionAsync();
              return;
            }
          }
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [width, height, index, photos.length, onClose, translateX, translateY],
  );

  const current = photos[index];

  const handleDelete = useCallback(() => {
    if (!current || !onDelete) return;
    const proceed = () => onDelete(current);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Delete this photo? This cannot be undone.")) {
        proceed();
      }
      return;
    }
    Alert.alert(
      "Delete photo?",
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: proceed },
      ],
    );
  }, [current, onDelete]);

  if (!current) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          style={[
            styles.imageWrap,
            { width, height },
            { transform: [{ translateX }, { translateY }] },
          ]}
          {...panResponder.panHandlers}
        >
          {current.signedUrl ? (
            <Image
              source={{ uri: current.signedUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.placeholder}>
              <Feather name="image" size={56} color={Colors.textTertiary} />
            </View>
          )}
        </Animated.View>

        {index > 0 ? (
          <Pressable
            onPress={goPrev}
            accessibilityLabel="Previous photo"
            style={({ pressed }) => [
              styles.chevron,
              styles.chevronLeft,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={10}
          >
            <Feather name="chevron-left" size={28} color="#fff" />
          </Pressable>
        ) : null}
        {index < photos.length - 1 ? (
          <Pressable
            onPress={goNext}
            accessibilityLabel="Next photo"
            style={({ pressed }) => [
              styles.chevron,
              styles.chevronRight,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={10}
          >
            <Feather name="chevron-right" size={28} color="#fff" />
          </Pressable>
        ) : null}

        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            style={({ pressed }) => [
              styles.topBtn,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={10}
          >
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.counter}>
            {index + 1} / {photos.length}
          </Text>
          {onDelete ? (
            <Pressable
              onPress={handleDelete}
              accessibilityLabel="Delete photo"
              style={({ pressed }) => [
                styles.topBtn,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={10}
            >
              <Feather name="trash-2" size={20} color={Colors.error} />
            </Pressable>
          ) : (
            <View style={styles.topBtn} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  chevron: {
    position: "absolute",
    top: "50%",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
  },
  chevronLeft: {
    left: 12,
  },
  chevronRight: {
    right: 12,
  },
});
