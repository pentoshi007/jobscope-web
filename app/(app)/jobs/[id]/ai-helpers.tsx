"use client";
import { Brain, Copy, Loader2, Mail, MessagesSquare, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MarkdownView } from "@/components/app/markdown-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Helper = "cover-letter" | "skill-gap" | "interview-prep";

export function AIHelpers({ jobId, hasResume }: { jobId: string; hasResume: boolean }) {
  if (!hasResume) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-[var(--color-fg-muted)]">
          Set an active resume to use AI helpers.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" /> AI helpers
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-3">
        <HelperButton kind="cover-letter" label="Cover letter" Icon={Mail} jobId={jobId} />
        <HelperButton kind="skill-gap" label="Skill gap" Icon={Brain} jobId={jobId} />
        <HelperButton
          kind="interview-prep"
          label="Interview prep"
          Icon={MessagesSquare}
          jobId={jobId}
        />
      </CardContent>
    </Card>
  );
}

function HelperButton({
  kind,
  label,
  Icon,
  jobId,
}: {
  kind: Helper;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  jobId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string>("");

  async function run() {
    setLoading(true);
    setOutput("");
    try {
      const r = await fetch(`/api/ai/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: string;
        error?: { message?: string };
      };
      if (!r.ok || !j.ok) {
        throw new Error(j?.error?.message || `HTTP ${r.status}`);
      }
      setOutput(j.data ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !output) run();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="justify-start">
          <Icon className="h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>AI-generated draft · stripped of PII before send.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 text-sm leading-relaxed">
          {loading && !output ? (
            <span className="inline-flex items-center gap-2 text-[var(--color-fg-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
            </span>
          ) : output ? (
            kind === "cover-letter" ? (
              <div className="whitespace-pre-wrap">{output}</div>
            ) : (
              <MarkdownView source={output} />
            )
          ) : (
            "—"
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!output}
            onClick={() => {
              navigator.clipboard.writeText(output);
              toast.success("Copied");
            }}
          >
            <Copy className="h-4 w-4" /> Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={() => run()} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Regenerate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
