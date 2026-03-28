import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthGuard } from "@/components/AuthGuard";
import Colors from "@/constants/colors";

export default function SageModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const handleSend = () => {
    if (!message.trim()) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMessage("");
  };

  return (
    <AuthGuard>
      <View
        style={[
          styles.container,
          {
            paddingTop: Platform.OS === "web" ? webTopInset : 0,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.sageAvatar}>
              <Feather name="zap" size={18} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Sage</Text>
              <Text style={styles.headerSubtitle}>AI Coach</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Feather name="x" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.welcomeCard}>
              <View style={styles.welcomeIcon}>
                <Feather name="zap" size={32} color={Colors.gold} />
              </View>
              <Text style={styles.welcomeTitle}>
                Hi! I'm Sage, your AI coach.
              </Text>
              <Text style={styles.welcomeSubtext}>
                Ask me anything about your goals, habits, or personal growth.
                I'm here to guide and support your journey.
              </Text>
              <View style={styles.suggestionsRow}>
                {["How can I build better habits?", "Help me set goals"].map(
                  (suggestion) => (
                    <Pressable
                      key={suggestion}
                      style={({ pressed }) => [
                        styles.suggestion,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => setMessage(suggestion)}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </Pressable>
                  ),
                )}
              </View>
            </View>
          </ScrollView>

          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask Sage anything..."
              placeholderTextColor={Colors.textTertiary}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={2000}
            />
            <Pressable
              onPress={handleSend}
              style={({ pressed }) => [
                styles.sendButton,
                !message.trim() && styles.sendButtonDisabled,
                pressed && message.trim() && { opacity: 0.8 },
              ]}
              disabled={!message.trim()}
            >
              <Feather
                name="send"
                size={18}
                color={message.trim() ? "#fff" : Colors.textTertiary}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    backgroundColor: Colors.card,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  chatArea: {
    flex: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  welcomeCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  welcomeTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    textAlign: "center",
  },
  welcomeSubtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    justifyContent: "center",
  },
  suggestion: {
    backgroundColor: Colors.goldLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestionText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.card,
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: Colors.background,
  },
});
