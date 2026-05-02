"use client";

import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { getStroke } from "perfect-freehand";
import { Button } from "@/components/ui/button";
import { GripHorizontal, Plus } from "lucide-react";
import type { InkPoint, InkStroke } from "@/lib/dexie";

const PAGE_HEIGHT = 1056;
const AUTO_APPEND_THRESHOLD = 100;
const ERASER_SIZE = 20;

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: InkStroke[],
  activePoints: InkPoint[] | null,
  activeColor: string,
  activeSize: number,
  activeIsEraser: boolean,
) {
  for (const stroke of strokes) {
    const outline = getStroke(
      stroke.points.map((p) => [p.x, p.y, p.p ?? 0.5]),
      { size: stroke.size, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: stroke.points[0]?.p === undefined }
    );
    const path = new Path2D(getSvgPathFromStroke(outline));
    ctx.fillStyle = stroke.color;
    ctx.fill(path);
  }

  if (activePoints && activePoints.length > 0) {
    const outline = getStroke(
      activePoints.map((p) => [p.x, p.y, p.p ?? 0.5]),
      { size: activeIsEraser ? ERASER_SIZE : activeSize, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: activePoints[0]?.p === undefined }
    );
    const path = new Path2D(getSvgPathFromStroke(outline));
    ctx.fillStyle = activeIsEraser ? "rgba(229,231,235,0.6)" : activeColor;
    ctx.fill(path);
  }
}

export interface TemplateSection {
  heading: string;
  prompt?: string;
}

function DraggableTemplateOverlay({ sections }: { sections: TemplateSection[] }) {
  const [pos, setPos] = useState({ x: 60, y: 24 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: pos.x, posY: pos.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({
        x: Math.max(0, dragStart.current.posX + (e.clientX - dragStart.current.mouseX)),
        y: Math.max(0, dragStart.current.posY + (e.clientY - dragStart.current.mouseY)),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  if (sections.length === 0) return null;

  return (
    <div
      className="absolute z-[5] select-none pointer-events-auto"
      style={{ left: pos.x, top: pos.y, cursor: dragging ? "grabbing" : "default" }}
    >
      <div className="rounded-xl border border-white/10 bg-black/10 backdrop-blur-sm p-3 min-w-[160px] max-w-[220px]">
        <div
          className="flex items-center gap-1.5 mb-2 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          data-testid="template-overlay-drag-handle"
        >
          <GripHorizontal className="h-3 w-3 text-white/20" />
          <span className="text-[9px] uppercase tracking-wider text-white/20 font-medium">Template guide</span>
        </div>
        <div className="space-y-2">
          {sections.map((s, i) => (
            <div key={i} className="space-y-0.5">
              <p
                className="text-[11px] font-medium leading-tight"
                style={{ color: "rgba(180,160,120,0.45)" }}
              >
                {s.heading}
              </p>
              {s.prompt && (
                <p
                  className="text-[9px] leading-snug italic"
                  style={{ color: "rgba(180,160,120,0.28)" }}
                >
                  {s.prompt}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface InkPadHandles {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  exportPages: () => Promise<string[]>;
}

interface InkPadProps {
  pages?: InkStroke[][];
  onChange?: (pages: InkStroke[][]) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  className?: string;
  color?: string;
  size?: number;
  isEraser?: boolean;
  templateSections?: TemplateSection[];
}

export const InkPad = forwardRef<InkPadHandles, InkPadProps>(function InkPad({
  pages: initialPages,
  onChange,
  onHistoryChange,
  className,
  color = "#1a1a1a",
  size = 4,
  isEraser = false,
  templateSections,
}, ref) {
  const [pages, setPages] = useState<InkStroke[][]>(
    initialPages && initialPages.length > 0 ? initialPages : [[]]
  );
  const [activeStroke, setActiveStroke] = useState<{ pageIndex: number; points: InkPoint[] } | null>(null);
  const [undoStack, setUndoStack] = useState<InkStroke[][][]>([]);
  const [redoStack, setRedoStack] = useState<InkStroke[][][]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorPage, setCursorPage] = useState(-1);
  const [containerWidth, setContainerWidth] = useState(800);
  const [isPenActive, setIsPenActive] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateWidth = () => setContainerWidth(Math.floor(container.getBoundingClientRect().width));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const redraw = useCallback(() => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    for (let i = 0; i < pages.length; i++) {
      const canvas = canvasRefs.current.get(i);
      if (!canvas) continue;
      canvas.width = containerWidth * dpr;
      canvas.height = PAGE_HEIGHT * dpr;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${PAGE_HEIGHT}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, containerWidth, PAGE_HEIGHT);
      const activePoints = activeStroke && activeStroke.pageIndex === i ? activeStroke.points : null;
      drawStrokes(ctx, pages[i], activePoints, color, size, isEraser);
    }
  }, [pages, activeStroke, color, size, isEraser, containerWidth]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    onHistoryChange?.(undoStack.length > 0, redoStack.length > 0);
  }, [undoStack.length, redoStack.length, onHistoryChange]);

  const addPage = useCallback(() => {
    const newPages = [...pages, []];
    setPages(newPages);
    onChange?.(newPages);
  }, [pages, onChange]);

  const commitStroke = useCallback((pageIndex: number, strokePoints: InkPoint[]) => {
    if (strokePoints.length === 0) return;
    const newPages = pages.map((p) => [...p]);
    if (isEraser) {
      const filtered = newPages[pageIndex].filter((stroke) =>
        !stroke.points.some((p) =>
          strokePoints.some((ep) => Math.hypot(p.x - ep.x, p.y - ep.y) < ERASER_SIZE)
        )
      );
      if (filtered.length !== newPages[pageIndex].length) {
        setUndoStack((prev) => [...prev, pages]);
        setRedoStack([]);
        newPages[pageIndex] = filtered;
        setPages(newPages);
        onChange?.(newPages);
      }
    } else {
      const newStroke: InkStroke = { color, size, points: strokePoints };
      setUndoStack((prev) => [...prev, pages]);
      setRedoStack([]);
      newPages[pageIndex] = [...newPages[pageIndex], newStroke];
      setPages(newPages);
      onChange?.(newPages);
    }
  }, [pages, isEraser, color, size, onChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent, pageIndex: number) => {
    if (e.pointerType === "touch" && isPenActive) return;
    if (e.pointerType === "pen") setIsPenActive(true);
    const canvas = canvasRefs.current.get(pageIndex);
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const point: InkPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: e.pressure > 0 ? e.pressure : undefined,
      tiltX: e.tiltX,
      tiltY: e.tiltY,
      t: Date.now(),
    };
    setActiveStroke({ pageIndex, points: [point] });
  }, [isPenActive]);

  const handlePointerMove = useCallback((e: React.PointerEvent, pageIndex: number) => {
    if (e.pointerType === "touch" && isPenActive) return;
    const canvas = canvasRefs.current.get(pageIndex);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursorPos({ x, y });
    setCursorPage(pageIndex);

    if (!activeStroke || activeStroke.pageIndex !== pageIndex) return;
    const point: InkPoint = { x, y, p: e.pressure > 0 ? e.pressure : undefined, tiltX: e.tiltX, tiltY: e.tiltY, t: Date.now() };
    setActiveStroke((prev) => prev ? { ...prev, points: [...prev.points, point] } : null);

    if (pageIndex === pages.length - 1 && y > PAGE_HEIGHT - AUTO_APPEND_THRESHOLD) {
      addPage();
    }
  }, [isPenActive, activeStroke, pages.length, addPage]);

  const handlePointerUp = useCallback((e: React.PointerEvent, pageIndex: number) => {
    if (e.pointerType === "touch" && isPenActive) return;
    if (e.pointerType === "pen") setIsPenActive(false);
    if (activeStroke && activeStroke.pageIndex === pageIndex && activeStroke.points.length > 0) {
      commitStroke(pageIndex, activeStroke.points);
    }
    setActiveStroke(null);
  }, [isPenActive, activeStroke, commitStroke]);

  const handlePointerLeaveCanvas = useCallback((pageIndex: number) => {
    if (cursorPage === pageIndex) {
      setCursorPos(null);
      setCursorPage(-1);
    }
  }, [cursorPage]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, pages]);
    setPages(previous);
    onChange?.(previous);
    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack, pages, onChange]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, pages]);
    setPages(next);
    onChange?.(next);
    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack, pages, onChange]);

  const handleClear = useCallback(() => {
    const hasStrokes = pages.some((p) => p.length > 0);
    if (!hasStrokes) return;
    setUndoStack((prev) => [...prev, pages]);
    setRedoStack([]);
    const cleared: InkStroke[][] = [[]];
    setPages(cleared);
    onChange?.(cleared);
  }, [pages, onChange]);

  const exportPages = useCallback(async (): Promise<string[]> => {
    const result: string[] = [];
    const dpr = window.devicePixelRatio || 1;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].length === 0) continue;
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = containerWidth * dpr;
      tempCanvas.height = PAGE_HEIGHT * dpr;
      const ctx = tempCanvas.getContext("2d");
      if (!ctx) continue;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#f5f0e8";
      ctx.fillRect(0, 0, containerWidth, PAGE_HEIGHT);
      drawStrokes(ctx, pages[i], null, color, size, false);
      result.push(tempCanvas.toDataURL("image/png"));
    }
    return result;
  }, [pages, containerWidth, color, size]);

  useImperativeHandle(ref, () => ({
    undo: handleUndo,
    redo: handleRedo,
    clear: handleClear,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    exportPages,
  }), [handleUndo, handleRedo, handleClear, undoStack.length, redoStack.length, exportPages]);

  const cursorSize = isEraser ? ERASER_SIZE : Math.max(size * 0.8, 3);

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      {templateSections && templateSections.length > 0 && (
        <DraggableTemplateOverlay sections={templateSections} />
      )}
      {pages.map((_, pageIndex) => (
        <div
          key={pageIndex}
          className="ink-page relative mb-4 overflow-hidden"
          style={{ height: PAGE_HEIGHT }}
        >
          <div className="absolute inset-0 journal-paper">
            <div className="journal-paper-margin" />
          </div>
          <canvas
            ref={(el) => {
              if (el) canvasRefs.current.set(pageIndex, el);
              else canvasRefs.current.delete(pageIndex);
            }}
            className="absolute inset-0 z-[2]"
            style={{ cursor: "none", touchAction: "none", background: "transparent" }}
            onPointerDown={(e) => handlePointerDown(e, pageIndex)}
            onPointerMove={(e) => handlePointerMove(e, pageIndex)}
            onPointerUp={(e) => handlePointerUp(e, pageIndex)}
            onPointerLeave={(e) => {
              if (activeStroke && activeStroke.pageIndex === pageIndex) {
                handlePointerUp(e, pageIndex);
              }
              handlePointerLeaveCanvas(pageIndex);
            }}
            data-testid={`canvas-ink-page-${pageIndex}`}
          />
          {cursorPage === pageIndex && cursorPos && (
            <div
              className="ink-cursor absolute pointer-events-none z-[3] rounded-full"
              style={{
                width: cursorSize,
                height: cursorSize,
                left: cursorPos.x - cursorSize / 2,
                top: cursorPos.y - cursorSize / 2,
                backgroundColor: isEraser ? "rgba(200, 190, 175, 0.5)" : color,
                border: isEraser ? "1px solid rgba(150,130,110,0.4)" : "none",
              }}
              data-testid="ink-cursor-dot"
            />
          )}
          <div className="absolute bottom-2 right-4 text-xs text-muted-foreground/30 pointer-events-none select-none z-[3]">
            {pageIndex + 1}
          </div>
        </div>
      ))}
      <div className="flex justify-center py-2 pb-20">
        <Button
          variant="outline"
          size="icon"
          onClick={addPage}
          className="h-8 w-8 rounded-full text-muted-foreground"
          data-testid="button-add-page"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});
