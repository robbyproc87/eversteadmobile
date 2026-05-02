import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthGuard } from "@/components/AuthGuard";
import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import {
  type Book,
  type Course,
  type GoogleBookResult,
  type OgMetadata,
  booksApi,
  coursesApi,
  normalizeImageUrl,
} from "@/lib/api";

const MODAL_PRESENTATION = Platform.OS === "ios" ? "formSheet" : "fullScreen";

type Tab = "books" | "courses";

export default function GrowthLibraryScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("books");

  const switchTab = (tab: Tab) => {
    if (tab === activeTab) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  return (
    <AuthGuard>
      <View style={styles.container}>
        <View style={styles.tabBar}>
          <TabButton
            label="Books"
            icon="book"
            active={activeTab === "books"}
            onPress={() => switchTab("books")}
          />
          <TabButton
            label="Courses"
            icon="play-circle"
            active={activeTab === "courses"}
            onPress={() => switchTab("courses")}
          />
        </View>

        {activeTab === "books" ? <BooksTab /> : <CoursesTab />}
      </View>
    </AuthGuard>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
    >
      <Feather
        name={icon}
        size={16}
        color={active ? Colors.gold : Colors.textSecondary}
      />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// =============================================================================
// BOOKS TAB
// =============================================================================

function BooksTab() {
  const { showError, showSuccess } = useToast();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await booksApi.list();
        setBooks(data ?? []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not load books";
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleAdded = (book: Book) => {
    setBooks((prev) => (prev ? [book, ...prev] : [book]));
    setShowAdd(false);
    showSuccess(`Added "${book.title}"`);
  };

  const handleProgressSaved = (updated: Book) => {
    setBooks((prev) =>
      prev ? prev.map((b) => (b.id === updated.id ? updated : b)) : prev,
    );
    setEditingBook(null);
    showSuccess("Progress updated");
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Colors.gold}
          />
        }
      >
        {loading && !books ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={Colors.gold} />
          </View>
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => load()} />
        ) : !books || books.length === 0 ? (
          <EmptyBlock
            icon="book"
            title="No books yet"
            subtext="Track your reading progress, set goals, and build a reading habit."
            ctaLabel="Add a book"
            onPress={() => setShowAdd(true)}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {books.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                onPress={() => setEditingBook(b)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <AddFab label="Add book" onPress={() => setShowAdd(true)} />

      <Modal
        visible={showAdd}
        animationType="slide"
        presentationStyle={MODAL_PRESENTATION}
        onRequestClose={() => setShowAdd(false)}
      >
        <AddBookModal
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
          onError={showError}
        />
      </Modal>

      <Modal
        visible={!!editingBook}
        animationType="slide"
        presentationStyle={MODAL_PRESENTATION}
        onRequestClose={() => setEditingBook(null)}
      >
        {editingBook ? (
          <UpdateProgressModal
            book={editingBook}
            onClose={() => setEditingBook(null)}
            onSaved={handleProgressSaved}
            onError={showError}
          />
        ) : (
          <View />
        )}
      </Modal>
    </View>
  );
}

function BookCard({ book, onPress }: { book: Book; onPress: () => void }) {
  const total = Math.max(book.totalPages ?? 0, 0);
  const read = Math.max(0, Math.min(book.pagesRead ?? 0, total || Infinity));
  const pct = total > 0 ? Math.round((read / total) * 100) : 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.bookCover}>
        {normalizeImageUrl(book.coverUrl) ? (
          <Image
            source={{ uri: normalizeImageUrl(book.coverUrl) }}
            style={styles.bookCoverImg}
            contentFit="cover"
          />
        ) : (
          <Feather name="book" size={24} color={Colors.gold} />
        )}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {book.title}
        </Text>
        {book.author ? (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {book.author}
          </Text>
        ) : null}
        <View style={styles.progressRow}>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(0, Math.min(100, pct))}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {total > 0
              ? `${read} / ${total} pages`
              : `${read} pages read`}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
    </Pressable>
  );
}

function AddBookModal({
  onClose,
  onAdded,
  onError,
}: {
  onClose: () => void;
  onAdded: (book: Book) => void;
  onError: (msg: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleBookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    const seq = ++seqRef.current;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const r = await booksApi.searchGoogle(query);
        if (seq === seqRef.current) setResults(r);
      } catch (e) {
        if (seq === seqRef.current) {
          onError(e instanceof Error ? e.message : "Search failed");
          setResults([]);
        }
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, onError]);

  const handlePick = async (r: GoogleBookResult) => {
    if (adding) return;
    setAdding(r.googleBooksId);
    try {
      const book = await booksApi.add({
        title: r.title,
        author: r.author,
        coverUrl: r.coverUrl,
        totalPages: r.totalPages,
        googleBooksId: r.googleBooksId,
      });
      onAdded(book);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not add book");
    } finally {
      setAdding(null);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.modalRoot}
    >
      <ModalHeader title="Add a book" onClose={onClose} />
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={Colors.textSecondary} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search by title or author"
          placeholderTextColor={Colors.textTertiary}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <Feather name="x" size={16} color={Colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        keyboardShouldPersistTaps="handled"
      >
        {searching ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={Colors.gold} />
          </View>
        ) : query.trim() === "" ? (
          <Text style={styles.helperText}>
            Search Google Books to find your title.
          </Text>
        ) : results.length === 0 ? (
          <Text style={styles.helperText}>No results yet.</Text>
        ) : (
          results.map((r) => (
            <Pressable
              key={r.googleBooksId}
              onPress={() => handlePick(r)}
              disabled={adding !== null}
              style={({ pressed }) => [
                styles.resultRow,
                pressed && { opacity: 0.85 },
                adding === r.googleBooksId && { opacity: 0.6 },
              ]}
            >
              <View style={styles.resultCover}>
                {r.coverUrl ? (
                  <Image
                    source={{ uri: r.coverUrl }}
                    style={styles.resultCoverImg}
                    contentFit="cover"
                  />
                ) : (
                  <Feather name="book" size={18} color={Colors.gold} />
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {r.title}
                </Text>
                {r.author ? (
                  <Text style={styles.resultMeta} numberOfLines={1}>
                    {r.author}
                  </Text>
                ) : null}
                {r.totalPages ? (
                  <Text style={styles.resultMeta}>{r.totalPages} pages</Text>
                ) : null}
              </View>
              {adding === r.googleBooksId ? (
                <ActivityIndicator color={Colors.gold} />
              ) : (
                <Feather name="plus" size={18} color={Colors.gold} />
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function UpdateProgressModal({
  book,
  onClose,
  onSaved,
  onError,
}: {
  book: Book;
  onClose: () => void;
  onSaved: (book: Book) => void;
  onError: (msg: string) => void;
}) {
  const [pages, setPages] = useState(String(book.pagesRead ?? 0));
  const [saving, setSaving] = useState(false);

  const total = book.totalPages ?? 0;

  const handleSave = async () => {
    const n = parseInt(pages, 10);
    if (Number.isNaN(n) || n < 0) {
      onError("Please enter a valid number of pages.");
      return;
    }
    if (total > 0 && n > total) {
      onError(`Pages can't exceed ${total}.`);
      return;
    }
    setSaving(true);
    try {
      const updated = await booksApi.updateProgress(book.id, n);
      onSaved(updated);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save progress");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.modalRoot}
    >
      <ModalHeader title="Update progress" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={[styles.card, { gap: 12 }]}>
          <View style={styles.bookCover}>
            {normalizeImageUrl(book.coverUrl) ? (
              <Image
                source={{ uri: normalizeImageUrl(book.coverUrl) }}
                style={styles.bookCoverImg}
                contentFit="cover"
              />
            ) : (
              <Feather name="book" size={24} color={Colors.gold} />
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {book.title}
            </Text>
            {book.author ? (
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {book.author}
              </Text>
            ) : null}
          </View>
        </View>

        <View>
          <Text style={styles.label}>Pages read</Text>
          <TextInput
            value={pages}
            onChangeText={(t) => setPages(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            style={styles.numberInput}
            placeholder="0"
            placeholderTextColor={Colors.textTertiary}
          />
          {total > 0 ? (
            <Text style={styles.helperText}>of {total} total pages</Text>
          ) : null}
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { opacity: 0.85 },
            saving && { opacity: 0.6 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={Colors.dark} />
          ) : (
            <Text style={styles.primaryButtonText}>Save</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =============================================================================
// COURSES TAB
// =============================================================================

function CoursesTab() {
  const { showError, showSuccess } = useToast();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await coursesApi.list();
      setCourses(data ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load courses";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdded = (course: Course) => {
    setCourses((prev) => (prev ? [course, ...prev] : [course]));
    setShowAdd(false);
    showSuccess(`Added "${course.title}"`);
  };

  const handleSaved = (updated: Course) => {
    setCourses((prev) =>
      prev ? prev.map((c) => (c.id === updated.id ? updated : c)) : prev,
    );
    setEditing(null);
    showSuccess("Progress updated");
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Colors.gold}
          />
        }
      >
        {loading && !courses ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={Colors.gold} />
          </View>
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => load()} />
        ) : !courses || courses.length === 0 ? (
          <EmptyBlock
            icon="play-circle"
            title="No courses yet"
            subtext="Paste a course URL to track learning paths and modules."
            ctaLabel="Add a course"
            onPress={() => setShowAdd(true)}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {courses.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                onPress={() => setEditing(c)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <AddFab label="Add course" onPress={() => setShowAdd(true)} />

      <Modal
        visible={showAdd}
        animationType="slide"
        presentationStyle={MODAL_PRESENTATION}
        onRequestClose={() => setShowAdd(false)}
      >
        <AddCourseModal
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
          onError={showError}
        />
      </Modal>

      <Modal
        visible={!!editing}
        animationType="slide"
        presentationStyle={MODAL_PRESENTATION}
        onRequestClose={() => setEditing(null)}
      >
        {editing ? (
          <UpdateCourseModal
            course={editing}
            onClose={() => setEditing(null)}
            onSaved={handleSaved}
            onError={showError}
          />
        ) : (
          <View />
        )}
      </Modal>
    </View>
  );
}

function CourseCard({
  course,
  onPress,
}: {
  course: Course;
  onPress: () => void;
}) {
  const total = Math.max(course.totalModules ?? 0, 0);
  const done = Math.max(
    0,
    Math.min(course.completedModules ?? 0, total || Infinity),
  );
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.courseThumb}>
        {normalizeImageUrl(course.thumbnailUrl) ? (
          <Image
            source={{ uri: normalizeImageUrl(course.thumbnailUrl) }}
            style={styles.courseThumbImg}
            contentFit="cover"
          />
        ) : (
          <Feather name="play-circle" size={24} color={Colors.gold} />
        )}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {course.title}
        </Text>
        {course.platform ? (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {course.platform}
          </Text>
        ) : null}
        <View style={styles.progressRow}>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(0, Math.min(100, pct))}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {total > 0
              ? `${done} / ${total} modules`
              : `${done} modules done`}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
    </Pressable>
  );
}

function AddCourseModal({
  onClose,
  onAdded,
  onError,
}: {
  onClose: () => void;
  onAdded: (course: Course) => void;
  onError: (msg: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState<OgMetadata | null>(null);
  const [scraping, setScraping] = useState(false);
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [totalModulesStr, setTotalModulesStr] = useState("");
  const [saving, setSaving] = useState(false);

  const handleScrape = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      onError("Paste a course URL first.");
      return;
    }
    setScraping(true);
    try {
      const og = await coursesApi.scrapeOg(trimmed);
      setMeta(og);
      setTitle(og.title ?? "");
      setPlatform(og.siteName ?? "");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not read that link");
    } finally {
      setScraping(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      onError("A title is required.");
      return;
    }
    const totalModules = totalModulesStr.trim()
      ? parseInt(totalModulesStr, 10)
      : undefined;
    if (totalModulesStr && (Number.isNaN(totalModules) || totalModules! < 0)) {
      onError("Total modules must be a positive number.");
      return;
    }
    setSaving(true);
    try {
      const course = await coursesApi.add({
        title: title.trim(),
        url: url.trim() || undefined,
        platform: platform.trim() || undefined,
        thumbnailUrl: meta?.imageUrl,
        totalModules,
      });
      onAdded(course);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not add course");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.modalRoot}
    >
      <ModalHeader title="Add a course" onClose={onClose} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text style={styles.label}>Course URL</Text>
          <View style={styles.searchRow}>
            <Feather name="link" size={16} color={Colors.textSecondary} />
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://…"
              placeholderTextColor={Colors.textTertiary}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onSubmitEditing={handleScrape}
              returnKeyType="go"
            />
          </View>
          <Pressable
            onPress={handleScrape}
            disabled={scraping || !url.trim()}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && { opacity: 0.85 },
              (scraping || !url.trim()) && { opacity: 0.5 },
            ]}
          >
            {scraping ? (
              <ActivityIndicator color={Colors.gold} />
            ) : (
              <>
                <Feather name="download" size={14} color={Colors.goldDark} />
                <Text style={styles.secondaryButtonText}>Read link</Text>
              </>
            )}
          </Pressable>
        </View>

        {normalizeImageUrl(meta?.imageUrl) ? (
          <View style={styles.previewCard}>
            <Image
              source={{ uri: normalizeImageUrl(meta?.imageUrl) }}
              style={styles.previewImg}
              contentFit="cover"
            />
          </View>
        ) : null}

        <View>
          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Course title"
            placeholderTextColor={Colors.textTertiary}
            style={styles.textInput}
          />
        </View>

        <View>
          <Text style={styles.label}>Platform</Text>
          <TextInput
            value={platform}
            onChangeText={setPlatform}
            placeholder="e.g. Coursera, Udemy"
            placeholderTextColor={Colors.textTertiary}
            style={styles.textInput}
          />
        </View>

        <View>
          <Text style={styles.label}>Total modules (optional)</Text>
          <TextInput
            value={totalModulesStr}
            onChangeText={(t) => setTotalModulesStr(t.replace(/[^0-9]/g, ""))}
            placeholder="0"
            placeholderTextColor={Colors.textTertiary}
            style={styles.numberInput}
            keyboardType="number-pad"
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { opacity: 0.85 },
            saving && { opacity: 0.6 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={Colors.dark} />
          ) : (
            <Text style={styles.primaryButtonText}>Save course</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function UpdateCourseModal({
  course,
  onClose,
  onSaved,
  onError,
}: {
  course: Course;
  onClose: () => void;
  onSaved: (course: Course) => void;
  onError: (msg: string) => void;
}) {
  const [done, setDone] = useState(String(course.completedModules ?? 0));
  const [saving, setSaving] = useState(false);
  const total = course.totalModules ?? 0;

  const handleSave = async () => {
    const n = parseInt(done, 10);
    if (Number.isNaN(n) || n < 0) {
      onError("Enter a valid number of modules.");
      return;
    }
    if (total > 0 && n > total) {
      onError(`Modules can't exceed ${total}.`);
      return;
    }
    setSaving(true);
    try {
      const updated = await coursesApi.updateProgress(course.id, n);
      onSaved(updated);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save progress");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.modalRoot}
    >
      <ModalHeader title="Update progress" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={[styles.card, { gap: 12 }]}>
          <View style={styles.courseThumb}>
            {normalizeImageUrl(course.thumbnailUrl) ? (
              <Image
                source={{ uri: normalizeImageUrl(course.thumbnailUrl) }}
                style={styles.courseThumbImg}
                contentFit="cover"
              />
            ) : (
              <Feather name="play-circle" size={24} color={Colors.gold} />
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {course.title}
            </Text>
            {course.platform ? (
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {course.platform}
              </Text>
            ) : null}
          </View>
        </View>

        <View>
          <Text style={styles.label}>Modules completed</Text>
          <TextInput
            value={done}
            onChangeText={(t) => setDone(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            style={styles.numberInput}
            placeholder="0"
            placeholderTextColor={Colors.textTertiary}
          />
          {total > 0 ? (
            <Text style={styles.helperText}>of {total} total modules</Text>
          ) : null}
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { opacity: 0.85 },
            saving && { opacity: 0.6 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={Colors.dark} />
          ) : (
            <Text style={styles.primaryButtonText}>Save</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =============================================================================
// SHARED PIECES
// =============================================================================

function ModalHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>{title}</Text>
      <Pressable onPress={onClose} hitSlop={10}>
        <Feather name="x" size={22} color={Colors.dark} />
      </Pressable>
    </View>
  );
}

function EmptyBlock({
  icon,
  title,
  subtext,
  ctaLabel,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtext: string;
  ctaLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={36} color={Colors.gold} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtext}>{subtext}</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.primaryButton,
          { marginTop: 12, alignSelf: "stretch" },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.primaryButtonText}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: "#fdecea" }]}>
        <Feather name="alert-circle" size={28} color={Colors.error} />
      </View>
      <Text style={styles.emptyTitle}>Something went wrong</Text>
      <Text style={styles.emptySubtext}>{message}</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          styles.secondaryButton,
          { marginTop: 12 },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Feather name="refresh-cw" size={14} color={Colors.goldDark} />
        <Text style={styles.secondaryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

function AddFab({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
    >
      <Feather name="plus" size={20} color={Colors.dark} />
      <Text style={styles.fabText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: { backgroundColor: Colors.goldLight },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  tabTextActive: { color: Colors.dark },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  centerState: { paddingVertical: 48, alignItems: "center" },
  emptyState: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 36,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  bookCover: {
    width: 56,
    height: 78,
    borderRadius: 6,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  bookCoverImg: { width: "100%", height: "100%" },
  courseThumb: {
    width: 84,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  courseThumbImg: { width: "100%", height: "100%" },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  progressRow: { gap: 4 },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.background,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    backgroundColor: Colors.gold,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  modalRoot: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    backgroundColor: Colors.card,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    padding: 0,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  resultCover: {
    width: 40,
    height: 56,
    borderRadius: 4,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  resultCoverImg: { width: "100%", height: "100%" },
  resultTitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  resultMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  helperText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  textInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  numberInput: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.goldLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  secondaryButtonText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
  },
  previewCard: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  previewImg: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
});
