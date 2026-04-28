"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadResume } from "./actions";
import { cn } from "@/lib/utils";

export function ResumeUploader() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name || file.name.replace(/\.(pdf|docx?)$/i, ""));
    startTransition(async () => {
      const res = await uploadResume(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Resume parsed · finding matches");
      router.push("/dashboard?refresh=1");
    });
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) submit(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) submit(f);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="resume-name" className="text-xs font-medium text-[var(--color-fg-muted)]">
          Name (optional)
        </label>
        <Input
          id="resume-name"
          placeholder="e.g. Backend Resume"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed p-10 text-center transition-colors",
          dragOver
            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
            : "border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]",
        )}
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-card)] text-[var(--color-fg-muted)] shadow-sm">
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">
            {pending ? "Parsing your resume..." : "Drop a PDF or DOCX, or click to select"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">Max 5MB · PII never logged</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          Select file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={onChange}
        />
      </div>
    </div>
  );
}
