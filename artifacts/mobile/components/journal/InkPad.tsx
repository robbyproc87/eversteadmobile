import { Feather } from "@expo/vector-icons";
import { getStroke } from "perfect-freehand";
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path as SvgPath } from "react-native-svg";
import ViewShot, { captureRef, type ViewShotRef } from "react-native-view-shot";

import Colors from "@/constants/colors";

export interface InkPoint {
  x: number;
  y: number;
  p?: number;
  t?: number;
}

export interface InkStroke {
  color: string;
  size: number;
  points: InkPoint[];
  opacity?: number;
  tool?: ToolKind;
}

export type ToolKind = "pen" | "pencil" | "highlighter" | "eraser";

export interface TemplateSection {
  heading: string;
  prompt?: string;
}

export interface InkPadHandles {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  exportPagesAsPng: () => Promise<string[]>;
  getPages: () => InkStroke[][];
}

interface InkPadProps {
  pages?: InkStroke[][];
  onChange?: (pages: InkStroke[][]) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  tool: ToolKind;
  color: string;
  size: number;
  templateSections?: TemplateSection[];
  paddingBottom?: number;
}

const PAGE_HEIGHT = 1056;
const ERASER_RADIUS = 22;
const AUTO_APPEND_THRESHOLD = 100;
const PAGE_BG = "#f5f0e8";
const LINE_HEIGHT = 32;
const LINE_TOP_OFFSET = 56;
const MARGIN_X = 64;

function svgPathFromOutline(outline: number[][]): string {
  if (!outline.length) return "";
  let d = `M ${outline[0][0]} ${outline[0][1]} Q`;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += ` ${x0} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`;
  }
  d += " Z";
  return d;
}

function strokeOpacity(s: InkStroke): number {
  if (typeof s.opacity === "number") return s.opacity;
  if (s.tool === "highlighter") return 0.35;
  if (s.tool === "pencil") return 0.7;
  return 1;
}

function getStrokeOptions(stroke: InkStroke) {
  const tool = stroke.tool ?? "pen";
  const simulatePressure = stroke.points[0]?.p === undefined;
  if (tool === "highlighter") {
    return {
      size: stroke.size,
      thinning: 0,
      smoothing: 0.6,
      streamline: 0.6,
      simulatePressure: false,
    };
  }
  if (tool === "pencil") {
    return {
      size: stroke.size,
      thinning: 0.7,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure,
    };
  }
  return {
    size: stroke.size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure,
  };
}

function strokeToPath(stroke: InkStroke): string {
  const outline = getStroke(
    stroke.points.map((p) => [p.x, p.y, p.p ?? 0.5]),
    getStrokeOptions(stroke),
  );
  return svgPathFromOutline(outline);
}

function PageBackground({ width, height }: { width: number; height: number }) {
  const lines: number[] = useMemo(() => {
    const arr: number[] = [];
    for (let y = LINE_TOP_OFFSET; y < height - 8; y += LINE_HEIGHT) {
      arr.push(y);
    }
    return arr;
  }, [height]);
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <SvgPath d={`M0 0 H${width} V${height} H0 Z`} fill={PAGE_BG} />
      {lines.map((y) => (
        <SvgPath
          key={y}
          d={`M${MARGIN_X - 8} ${y} H${width - 16}`}
          stroke="rgba(120,100,70,0.18)"
          strokeWidth={1}
        />
      ))}
      <SvgPath
        d={`M${MARGIN_X} 8 V${height - 8}`}
        stroke="rgba(200,80,80,0.32)"
        strokeWidth={1}
      />
    </Svg>
  );
}

interface DraggableTemplateOverlayProps {
  sections: TemplateSection[];
  containerWidth: number;
}

function DraggableTemplateOverlay({
  sections,
  containerWidth,
}: DraggableTemplateOverlayProps) {
  const [pos, setPos] = useState({ x: Math.max(80, containerWidth - 240), y: 24 });
  const startRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          startRef.current = {
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
            posX: pos.x,
            posY: pos.y,
          };
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const dx = e.nativeEvent.pageX - startRef.current.x;
          const dy = e.nativeEvent.pageY - startRef.current.y;
          setPos({
            x: Math.max(0, Math.min(containerWidth - 180, startRef.current.posX + dx)),
            y: Math.max(0, startRef.current.posY + dy),
          });
        },
      }),
    [pos.x, pos.y, containerWidth],
  );

  if (sections.length === 0) return null;

  return (
    <View
      style={[styles.templateOverlay, { left: pos.x, top: pos.y }]}
      pointerEvents="box-none"
    >
      <View {...responder.panHandlers} style={styles.templateGrip}>
        <Feather name="more-horizontal" size={14} color="rgba(255,255,255,0.5)" />
        <Text style={styles.templateGripText}>Template guide</Text>
      </View>
      <View style={{ gap: 8 }}>
        {sections.map((s, i) => (
          <View key={i} style={{ gap: 2 }}>
            <Text style={styles.templateHeading}>{s.heading}</Text>
            {s.prompt ? <Text style={styles.templatePrompt}>{s.prompt}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const Page = React.memo(function Page({
  pageIndex,
  strokes,
  width,
  activeStroke,
  activeColor,
  activeTool,
  activeSize,
  pageNumber,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  cursor,
  viewShotRef,
}: {
  pageIndex: number;
  strokes: InkStroke[];
  width: number;
  activeStroke: InkStroke | null;
  activeColor: string;
  activeTool: ToolKind;
  activeSize: number;
  pageNumber: number;
  onTouchStart: (pageIndex: number, x: number, y: number, pressure?: number) => void;
  onTouchMove: (pageIndex: number, x: number, y: number, pressure?: number) => void;
  onTouchEnd: (pageIndex: number) => void;
  cursor: { x: number; y: number } | null;
  viewShotRef?: (instance: ViewShotRef | null) => void;
}) {
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const t = e.nativeEvent.touches?.[0] ?? e.nativeEvent;
          const p = (t as { force?: number }).force;
          onTouchStart(pageIndex, e.nativeEvent.locationX, e.nativeEvent.locationY, p);
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const t = e.nativeEvent.touches?.[0] ?? e.nativeEvent;
          const p = (t as { force?: number }).force;
          onTouchMove(pageIndex, e.nativeEvent.locationX, e.nativeEvent.locationY, p);
        },
        onPanResponderRelease: () => onTouchEnd(pageIndex),
        onPanResponderTerminate: () => onTouchEnd(pageIndex),
      }),
    [pageIndex, onTouchStart, onTouchMove, onTouchEnd],
  );

  const renderedStrokes = useMemo(
    () =>
      strokes.map((s, i) => {
        const d = strokeToPath(s);
        if (!d) return null;
        return (
          <SvgPath
            key={i}
            d={d}
            fill={s.color}
            opacity={strokeOpacity(s)}
          />
        );
      }),
    [strokes],
  );

  const activePath = useMemo(() => {
    if (!activeStroke || activeStroke.points.length === 0) return null;
    const d = strokeToPath(activeStroke);
    if (!d) return null;
    return (
      <SvgPath
        d={d}
        fill={activeTool === "eraser" ? "rgba(180,160,140,0.35)" : activeColor}
        opacity={strokeOpacity(activeStroke)}
      />
    );
  }, [activeStroke, activeColor, activeTool]);

  const cursorSize =
    activeTool === "eraser" ? ERASER_RADIUS * 2 : Math.max(activeSize * 0.9, 4);

  return (
    <ViewShot
      ref={viewShotRef}
      style={[styles.page, { height: PAGE_HEIGHT, width }]}
      options={{ format: "png", result: "data-uri", quality: 0.92 }}
    >
      <PageBackground width={width} height={PAGE_HEIGHT} />
      <View
        {...responder.panHandlers}
        style={StyleSheet.absoluteFill}
      >
        <Svg width={width} height={PAGE_HEIGHT} pointerEvents="none">
          {renderedStrokes}
          {activePath}
        </Svg>
      </View>
      {cursor ? (
        <View
          pointerEvents="none"
          style={[
            styles.cursorDot,
            {
              left: cursor.x - cursorSize / 2,
              top: cursor.y - cursorSize / 2,
              width: cursorSize,
              height: cursorSize,
              borderRadius: cursorSize / 2,
              backgroundColor:
                activeTool === "eraser"
                  ? "rgba(200,190,175,0.45)"
                  : activeColor,
              borderWidth: activeTool === "eraser" ? 1 : 0,
              borderColor: "rgba(150,130,110,0.55)",
            },
          ]}
        />
      ) : null}
      <Text style={styles.pageNumber}>{pageNumber}</Text>
    </ViewShot>
  );
});

export const InkPad = forwardRef<InkPadHandles, InkPadProps>(function InkPad(
  {
    pages: initialPages,
    onChange,
    onHistoryChange,
    tool,
    color,
    size,
    templateSections,
    paddingBottom = 80,
  },
  ref,
) {
  const [pages, setPages] = useState<InkStroke[][]>(
    initialPages && initialPages.length > 0 ? initialPages : [[]],
  );
  const [activeStroke, setActiveStroke] = useState<{
    pageIndex: number;
    stroke: InkStroke;
  } | null>(null);
  const [undoStack, setUndoStack] = useState<InkStroke[][][]>([]);
  const [redoStack, setRedoStack] = useState<InkStroke[][][]>([]);
  const [containerWidth, setContainerWidth] = useState(360);
  const [cursor, setCursor] = useState<{ pageIndex: number; x: number; y: number } | null>(
    null,
  );

  const pageShotRefs = useRef<Array<ViewShotRef | null>>([]);
  const setPageShotRef = useCallback(
    (index: number) => (instance: ViewShotRef | null) => {
      pageShotRefs.current[index] = instance;
    },
    [],
  );

  const initRef = useRef(false);
  React.useEffect(() => {
    if (initRef.current) return;
    if (initialPages && initialPages.length > 0) {
      initRef.current = true;
      setPages(initialPages);
    }
  }, [initialPages]);

  React.useEffect(() => {
    onHistoryChange?.(undoStack.length > 0, redoStack.length > 0);
  }, [undoStack.length, redoStack.length, onHistoryChange]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 0 && w !== containerWidth) setContainerWidth(w);
  }, [containerWidth]);

  const commitPages = useCallback(
    (next: InkStroke[][], pushUndo: boolean) => {
      if (pushUndo) {
        setUndoStack((u) => [...u, pages]);
        setRedoStack([]);
      }
      setPages(next);
      onChange?.(next);
    },
    [pages, onChange],
  );

  const addPage = useCallback(() => {
    const next = [...pages, []];
    commitPages(next, false);
  }, [pages, commitPages]);

  const handleTouchStart = useCallback(
    (pageIndex: number, x: number, y: number, pressure?: number) => {
      const point: InkPoint = {
        x,
        y,
        p: typeof pressure === "number" && pressure > 0 ? pressure : undefined,
        t: Date.now(),
      };
      const newStroke: InkStroke = {
        color,
        size: tool === "highlighter" ? Math.max(size * 3, 14) : size,
        points: [point],
        tool,
      };
      setActiveStroke({ pageIndex, stroke: newStroke });
      setCursor({ pageIndex, x, y });
    },
    [color, size, tool],
  );

  const handleTouchMove = useCallback(
    (pageIndex: number, x: number, y: number, pressure?: number) => {
      setCursor({ pageIndex, x, y });
      setActiveStroke((prev) => {
        if (!prev || prev.pageIndex !== pageIndex) return prev;
        const point: InkPoint = {
          x,
          y,
          p: typeof pressure === "number" && pressure > 0 ? pressure : undefined,
          t: Date.now(),
        };
        return {
          pageIndex,
          stroke: { ...prev.stroke, points: [...prev.stroke.points, point] },
        };
      });
      if (pageIndex === pages.length - 1 && y > PAGE_HEIGHT - AUTO_APPEND_THRESHOLD) {
        if (pages[pages.length - 1].length > 0 || (activeStroke?.stroke.points.length ?? 0) > 4) {
          addPage();
        }
      }
    },
    [pages, activeStroke, addPage],
  );

  const handleTouchEnd = useCallback(
    (pageIndex: number) => {
      setCursor(null);
      setActiveStroke((prev) => {
        if (!prev || prev.pageIndex !== pageIndex) return null;
        const stroke = prev.stroke;
        if (stroke.points.length === 0) return null;
        if (stroke.tool === "eraser") {
          const before = pages[pageIndex];
          const filtered = before.filter((s) => {
            return !s.points.some((p) =>
              stroke.points.some(
                (ep) => Math.hypot(p.x - ep.x, p.y - ep.y) < ERASER_RADIUS,
              ),
            );
          });
          if (filtered.length !== before.length) {
            const next = pages.slice();
            next[pageIndex] = filtered;
            commitPages(next, true);
          }
        } else {
          const next = pages.slice();
          next[pageIndex] = [...pages[pageIndex], stroke];
          commitPages(next, true);
        }
        return null;
      });
    },
    [pages, commitPages],
  );

  const handleUndo = useCallback(() => {
    setUndoStack((u) => {
      if (u.length === 0) return u;
      const previous = u[u.length - 1];
      setRedoStack((r) => [...r, pages]);
      setPages(previous);
      onChange?.(previous);
      return u.slice(0, -1);
    });
  }, [pages, onChange]);

  const handleRedo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setUndoStack((u) => [...u, pages]);
      setPages(next);
      onChange?.(next);
      return r.slice(0, -1);
    });
  }, [pages, onChange]);

  const handleClear = useCallback(() => {
    if (!pages.some((p) => p.length > 0)) return;
    commitPages([[]], true);
  }, [pages, commitPages]);

  const exportPagesAsPng = useCallback(async (): Promise<string[]> => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
      const out: string[] = [];
      for (const pageStrokes of pages) {
        if (pageStrokes.length === 0) continue;
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(containerWidth * dpr);
        canvas.height = Math.floor(PAGE_HEIGHT * dpr);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.scale(dpr, dpr);
        ctx.fillStyle = PAGE_BG;
        ctx.fillRect(0, 0, containerWidth, PAGE_HEIGHT);
        for (const stroke of pageStrokes) {
          const outline = getStroke(
            stroke.points.map((p) => [p.x, p.y, p.p ?? 0.5]),
            getStrokeOptions(stroke),
          );
          if (!outline.length) continue;
          ctx.fillStyle = stroke.color;
          ctx.globalAlpha = strokeOpacity(stroke);
          ctx.beginPath();
          ctx.moveTo(outline[0][0], outline[0][1]);
          for (let i = 0; i < outline.length; i++) {
            const [x0, y0] = outline[i];
            const [x1, y1] = outline[(i + 1) % outline.length];
            ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        out.push(canvas.toDataURL("image/png"));
      }
      return out;
    }

    const out: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].length === 0) continue;
      const node = pageShotRefs.current[i];
      if (!node) continue;
      try {
        const uri = await captureRef(node, {
          format: "png",
          quality: 0.92,
          result: "data-uri",
        });
        if (typeof uri === "string" && uri.length > 0) {
          out.push(uri);
        }
      } catch {
        // Skip pages that fail to capture; transcription will degrade gracefully.
      }
    }
    return out;
  }, [pages, containerWidth]);

  useImperativeHandle(
    ref,
    () => ({
      undo: handleUndo,
      redo: handleRedo,
      clear: handleClear,
      canUndo: () => undoStack.length > 0,
      canRedo: () => redoStack.length > 0,
      exportPagesAsPng,
      getPages: () => pages,
    }),
    [handleUndo, handleRedo, handleClear, undoStack.length, redoStack.length, exportPagesAsPng, pages],
  );

  return (
    <View style={[styles.container, { paddingBottom }]} onLayout={onLayout}>
      {templateSections && templateSections.length > 0 && containerWidth > 0 ? (
        <DraggableTemplateOverlay
          sections={templateSections}
          containerWidth={containerWidth}
        />
      ) : null}
      {pages.map((p, i) => (
        <Page
          key={i}
          pageIndex={i}
          strokes={p}
          width={containerWidth}
          activeStroke={
            activeStroke && activeStroke.pageIndex === i ? activeStroke.stroke : null
          }
          activeColor={color}
          activeTool={tool}
          activeSize={size}
          pageNumber={i + 1}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          cursor={cursor && cursor.pageIndex === i ? { x: cursor.x, y: cursor.y } : null}
          viewShotRef={setPageShotRef(i)}
        />
      ))}
      <View style={styles.addPageRow}>
        <Pressable
          onPress={addPage}
          style={({ pressed }) => [
            styles.addPageBtn,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityLabel="Add page"
        >
          <Feather name="plus" size={16} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "stretch",
  },
  page: {
    position: "relative",
    marginBottom: 14,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: PAGE_BG,
  },
  pageNumber: {
    position: "absolute",
    bottom: 8,
    right: 14,
    fontSize: 10,
    color: "rgba(80,60,40,0.35)",
    fontFamily: "Inter_500Medium",
  },
  cursorDot: {
    position: "absolute",
  },
  addPageRow: {
    alignItems: "center",
    paddingVertical: 10,
  },
  addPageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  templateOverlay: {
    position: "absolute",
    zIndex: 5,
    minWidth: 160,
    maxWidth: 220,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(30,20,10,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  templateGrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  templateGripText: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_600SemiBold",
  },
  templateHeading: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(220,200,160,0.8)",
  },
  templatePrompt: {
    fontSize: 9,
    fontStyle: "italic",
    color: "rgba(220,200,160,0.55)",
    lineHeight: 12,
  },
});
