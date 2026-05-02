"use client";

import { useState, useRef, type RefObject } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface TodoItem {
  id?: string;
  text: string;
  completed: boolean;
  ordinal: number;
  source?: string;
}

export interface BlueprintPickItem {
  id: string;
  text: string;
}

interface TodoListProps {
  items: TodoItem[];
  onAdd: (text: string) => void;
  onToggle: (index: number) => void;
  onUpdate: (index: number, text: string) => void;
  onDelete: (index: number) => void;
  placeholder?: string;
  addLabel?: string;
  className?: string;
  testIdPrefix?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  blueprintTodos?: BlueprintPickItem[];
  selectedBlueprintIds?: Set<string>;
  onBlueprintSelect?: (todoId: string, checked: boolean) => void;
}

export function TodoList({
  items,
  onAdd,
  onToggle,
  onUpdate,
  onDelete,
  placeholder = "Add a to-do...",
  addLabel = "Add to-do",
  className,
  testIdPrefix = "todo",
  inputRef,
  blueprintTodos,
  selectedBlueprintIds,
  onBlueprintSelect,
}: TodoListProps) {
  const [newText, setNewText] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const hasBlueprintTodos = blueprintTodos && blueprintTodos.length > 0;

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handlePlusClick = () => {
    if (hasBlueprintTodos) return;
    if (newText.trim()) {
      handleAdd();
    } else {
      inputRef?.current?.focus();
    }
  };

  const addButton = hasBlueprintTodos ? (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          data-testid={`${testIdPrefix}-add-btn`}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2" data-testid="add-todo-popover">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              setPopoverOpen(false);
              setTimeout(() => inputRef?.current?.focus(), 100);
            }}
            data-testid="btn-type-new-todo"
          >
            Type new
          </Button>
          <div className="border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
              Pick from Blueprint
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {blueprintTodos!.map((todo) => {
                const alreadyAdded = (selectedBlueprintIds?.has(todo.id) ?? false) ||
                  items.some((t) => t.text === todo.text && t.source === "wds");
                return (
                  <label
                    key={todo.id}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer hover-elevate",
                      alreadyAdded && "opacity-50"
                    )}
                    data-testid={`blueprint-pick-item-${todo.id}`}
                  >
                    <Checkbox
                      checked={alreadyAdded}
                      disabled={alreadyAdded}
                      onCheckedChange={(checked) => onBlueprintSelect?.(todo.id, checked as boolean)}
                    />
                    <span className={alreadyAdded ? "line-through" : ""}>
                      {todo.text}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ) : (
    <Button
      size="icon"
      variant="ghost"
      onClick={handlePlusClick}
      disabled={false}
      data-testid={`${testIdPrefix}-add-btn`}
    >
      <Plus className="h-3.5 w-3.5" />
    </Button>
  );

  const MIN_SLOTS = 3;
  const emptySlotCount = Math.max(0, MIN_SLOTS - items.length);
  const [slotTexts, setSlotTexts] = useState<Record<number, string>>({});
  const slotRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleSlotSubmit = (slotIndex: number) => {
    const text = (slotTexts[slotIndex] || "").trim();
    if (!text) return;
    onAdd(text);
    setSlotTexts((prev) => {
      const next = { ...prev };
      delete next[slotIndex];
      return next;
    });
  };

  const handleSlotKeyDown = (e: React.KeyboardEvent, slotIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSlotSubmit(slotIndex);
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      {items.map((item, i) => (
        <div
          key={item.id || i}
          className="group flex items-center gap-2 py-1 px-1 rounded-md"
          data-testid={`${testIdPrefix}-item-${i}`}
        >
          <Checkbox
            checked={item.completed}
            onCheckedChange={() => onToggle(i)}
            data-testid={`${testIdPrefix}-check-${i}`}
          />
          <input
            type="text"
            value={item.text}
            onChange={(e) => onUpdate(i, e.target.value)}
            className={cn(
              "flex-1 bg-transparent outline-none text-sm",
              item.completed && "line-through text-muted-foreground"
            )}
            data-testid={`${testIdPrefix}-text-${i}`}
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(i)}
            className="invisible group-hover:visible shrink-0"
            data-testid={`${testIdPrefix}-delete-${i}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {Array.from({ length: emptySlotCount }, (_, si) => {
        const slotIndex = items.length + si;
        return (
          <div key={`slot-${si}`} className="flex items-start gap-2">
            <span className="text-xs font-medium text-muted-foreground mt-2.5 w-4 text-right shrink-0">
              {slotIndex + 1}.
            </span>
            <input
              ref={(el) => { slotRefs.current[slotIndex] = el; }}
              type="text"
              value={slotTexts[slotIndex] || ""}
              onChange={(e) => setSlotTexts((prev) => ({ ...prev, [slotIndex]: e.target.value }))}
              onKeyDown={(e) => handleSlotKeyDown(e, slotIndex)}
              onBlur={() => handleSlotSubmit(slotIndex)}
              placeholder={placeholder}
              className="flex-1 bg-transparent border-b border-border/50 focus:border-primary/50 outline-none py-1.5 text-sm transition-colors placeholder:text-muted-foreground/50"
              data-testid={`${testIdPrefix}-slot-${slotIndex}`}
            />
          </div>
        );
      })}

      <div className="flex items-center gap-2 pt-1">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={items.length >= MIN_SLOTS ? placeholder : ""}
          className={cn(
            "flex-1 bg-transparent border-b border-border/50 focus:border-primary/50 outline-none py-1.5 text-sm transition-colors placeholder:text-muted-foreground/50",
            items.length < MIN_SLOTS && "sr-only"
          )}
          data-testid={`${testIdPrefix}-new-input`}
        />
        {addButton}
      </div>
    </div>
  );
}
