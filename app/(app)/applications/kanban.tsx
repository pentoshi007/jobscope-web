"use client";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ExternalLink, GripVertical } from "lucide-react";
import { motion } from "motion/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { removeApplication, updateApplicationStatus } from "./actions";

type Status = "saved" | "applied" | "interview" | "offer" | "rejected";
const COLUMNS: { id: Status; label: string }[] = [
  { id: "saved", label: "Saved" },
  { id: "applied", label: "Applied" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "rejected", label: "Rejected" },
];

export interface Card {
  id: string;
  jobId: string;
  status: Status;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  score: number;
  notes: string;
}

export function KanbanBoard({ initial }: { initial: Card[] }) {
  const [cards, setCards] = useState(initial);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(e: DragEndEvent) {
    const id = e.active.id as string;
    const over = e.over?.id as Status | undefined;
    if (!over) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === over) return;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: over } : c)));
    startTransition(async () => {
      await updateApplicationStatus(card.jobId, over);
      toast.success(`Moved to ${over}`);
    });
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] p-12 text-center">
        <p className="text-sm text-[var(--color-fg-muted)]">
          No applications yet. Save jobs from the jobs list or detail page.
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = cards.filter((c) => c.status === col.id);
          return (
            <Column key={col.id} id={col.id} label={col.label} count={items.length}>
              {items.map((c) => (
                <DraggableCard
                  key={c.id}
                  card={c}
                  onRemove={() => {
                    setCards((cs) => cs.filter((x) => x.id !== c.id));
                    startTransition(async () => {
                      await removeApplication(c.jobId);
                    });
                  }}
                />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}

function Column({
  id,
  label,
  count,
  children,
}: {
  id: Status;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] sm:min-h-[300px] rounded-[var(--radius-card)] border bg-[var(--color-bg-subtle)] p-3 transition-colors ${
        isOver ? "border-[var(--color-accent)]" : "border-[var(--color-border)]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
          {label}
        </span>
        <span className="text-xs font-mono text-[var(--color-fg-subtle)]">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DraggableCard({ card, onRemove }: { card: Card; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layoutId={card.id}
      className={`group cursor-grab rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-fg-subtle)]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{card.title}</div>
          <div className="truncate text-xs text-[var(--color-fg-muted)]">{card.company}</div>
          <div className="mt-1.5 flex items-center justify-between">
            {card.score > 0 ? (
              <Badge variant="accent" className="font-mono text-[10px]">
                {card.score}
              </Badge>
            ) : (
              <span />
            )}
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              className="text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        className="mt-2 hidden text-[10px] text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] group-hover:block"
      >
        remove
      </button>
    </motion.div>
  );
}
