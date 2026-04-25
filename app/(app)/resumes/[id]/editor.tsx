"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Star, X, Plus, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setActiveResume, deleteResume, updateParsedResume } from "../actions";
import type { ParsedResume } from "@/lib/resume/schema";

export function ResumeEditor({
  id,
  isActive,
  parsed: initial,
}: {
  id: string;
  isActive: boolean;
  parsed: ParsedResume;
}) {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParsedResume>(initial);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof ParsedResume>(key: K, value: ParsedResume[K]) {
    setParsed((p) => ({ ...p, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      await updateParsedResume(id, parsed as unknown as Record<string, unknown>);
      toast.success("Saved");
    });
  }

  function makeActive() {
    startTransition(async () => {
      await setActiveResume(id);
      toast.success("Set as active");
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Delete this resume?")) return;
    startTransition(async () => {
      await deleteResume(id);
      router.push("/resumes");
    });
  }

  const skillCats = ["languages", "frameworks", "tools", "databases", "cloud", "soft"] as const;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" value={parsed.fullName} onChange={(v) => update("fullName", v)} />
            <Field
              label="Headline"
              value={parsed.headline}
              onChange={(v) => update("headline", v)}
            />
            <Field label="Email" value={parsed.email} onChange={(v) => update("email", v)} />
            <Field label="Phone" value={parsed.phone} onChange={(v) => update("phone", v)} />
            <Field label="Location" value={parsed.location} onChange={(v) => update("location", v)} />
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                value={parsed.summary}
                onChange={(e) => update("summary", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Years of experience</Label>
              <Input
                type="number"
                min={0}
                value={parsed.totalYearsExperience}
                onChange={(e) =>
                  update("totalYearsExperience", Number(e.target.value) || 0)
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Inferred seniority</Label>
              <select
                className="flex h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm"
                value={parsed.inferredSeniority}
                onChange={(e) =>
                  update("inferredSeniority", e.target.value as ParsedResume["inferredSeniority"])
                }
              >
                {["junior", "mid", "senior", "staff"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(["website", "linkedin", "github", "portfolio", "twitter"] as const).map((k) => (
              <Field
                key={k}
                label={k[0].toUpperCase() + k.slice(1)}
                value={parsed.links?.[k] ?? ""}
                onChange={(v) =>
                  update("links", { ...parsed.links, [k]: v })
                }
              />
            ))}
            {parsed.links?.other?.length > 0 && (
              <div className="sm:col-span-2 space-y-1">
                <Label>Other links</Label>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.links.other.map((u, i) => (
                    <a
                      // biome-ignore lint/suspicious/noArrayIndexKey: stable list
                      key={i}
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--color-bg-subtle)] px-2 py-0.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                    >
                      {u}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {skillCats.map((cat) => (
              <SkillRow
                key={cat}
                label={cat}
                items={parsed.skills[cat]}
                onChange={(items) => update("skills", { ...parsed.skills, [cat]: items })}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Experience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.experience.length === 0 && (
              <p className="text-sm text-[var(--color-fg-muted)]">No entries.</p>
            )}
            {parsed.experience.map((e, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable list
              <div key={i} className="rounded-md border border-[var(--color-border)] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                  <span className="font-medium">
                    {e.role}
                    {e.company && <span className="text-[var(--color-fg-muted)]"> @ {e.company}</span>}
                  </span>
                  <span className="text-xs text-[var(--color-fg-muted)]">
                    {[e.startDate, e.endDate].filter(Boolean).join(" – ")}
                    {e.location && ` · ${e.location}`}
                  </span>
                </div>
                {e.description && (
                  <p className="mt-1 whitespace-pre-line text-xs text-[var(--color-fg-muted)]">
                    {e.description}
                  </p>
                )}
                {e.skills?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {e.skills.map((s, j) => (
                      <Badge
                        // biome-ignore lint/suspicious/noArrayIndexKey: stable
                        key={`${s}-${j}`}
                        variant="mono"
                        className="text-[10px]"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Education</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {parsed.education.length === 0 && (
              <p className="text-sm text-[var(--color-fg-muted)]">No entries.</p>
            )}
            {parsed.education.map((e, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable list
              <div key={i} className="rounded-md border border-[var(--color-border)] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                  <span className="font-medium">{e.school || "—"}</span>
                  <span className="text-xs text-[var(--color-fg-muted)]">
                    {[e.startDate, e.endDate].filter(Boolean).join(" – ")}
                    {e.location && ` · ${e.location}`}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[var(--color-fg-muted)]">
                  {[e.degree, e.field].filter(Boolean).join(", ")}
                  {e.gpa && <span> · GPA {e.gpa}</span>}
                  {e.honors && <span> · {e.honors}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {parsed.projects.length === 0 && (
              <p className="text-sm text-[var(--color-fg-muted)]">No entries.</p>
            )}
            {parsed.projects.map((p, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable list
              <div key={i} className="rounded-md border border-[var(--color-border)] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                  <span className="font-medium">{p.name || "—"}</span>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {p.description && (
                  <p className="mt-1 whitespace-pre-line text-xs text-[var(--color-fg-muted)]">
                    {p.description}
                  </p>
                )}
                {p.skills?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.skills.map((s, j) => (
                      <Badge
                        // biome-ignore lint/suspicious/noArrayIndexKey: stable
                        key={`${s}-${j}`}
                        variant="mono"
                        className="text-[10px]"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {parsed.certifications.length === 0 && (
              <p className="text-sm text-[var(--color-fg-muted)]">No entries.</p>
            )}
            {parsed.certifications.map((c, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: stable list
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-x-2 rounded-md border border-[var(--color-border)] p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{c.name || "—"}</div>
                  {(c.issuer || c.date) && (
                    <div className="text-xs text-[var(--color-fg-muted)]">
                      {[c.issuer, c.date].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {(parsed.achievements.length > 0 ||
          parsed.awards.length > 0 ||
          parsed.publications.length > 0 ||
          parsed.languagesSpoken.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>More</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ListBlock label="Achievements" items={parsed.achievements} />
              <ListBlock label="Awards" items={parsed.awards} />
              <ListBlock label="Publications" items={parsed.publications} />
              <ListBlock label="Languages" items={parsed.languagesSpoken} inline />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <Card>
          <CardContent className="space-y-3 p-5">
            <Button className="w-full" variant="accent" onClick={save} disabled={pending}>
              Save changes
            </Button>
            {!isActive && (
              <Button className="w-full" variant="outline" onClick={makeActive} disabled={pending}>
                <Star className="h-4 w-4" /> Make active
              </Button>
            )}
            <Button
              className="w-full"
              variant="ghost"
              onClick={remove}
              disabled={pending}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ListBlock({
  label,
  items,
  inline = false,
}: {
  label: string;
  items: string[];
  inline?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </div>
      {inline ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((s, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable
            <Badge key={`${s}-${i}`} variant="mono" className="text-[10px]">
              {s}
            </Badge>
          ))}
        </div>
      ) : (
        <ul className="space-y-1 text-sm text-[var(--color-fg-muted)]">
          {items.map((s, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable
            <li key={`${s}-${i}`} className="flex gap-2">
              <span className="text-[var(--color-fg-subtle)]">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SkillRow({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((s, i) => (
          <Badge
            // biome-ignore lint/suspicious/noArrayIndexKey: stable
            key={`${s}-${i}`}
            variant="mono"
            className="gap-1.5 pr-1"
          >
            {s}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="rounded p-0.5 hover:bg-[var(--color-bg-muted)]"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                e.preventDefault();
                onChange([...items, draft.trim()]);
                setDraft("");
              }
            }}
            placeholder="add..."
            className="h-7 w-24 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              if (draft.trim()) {
                onChange([...items, draft.trim()]);
                setDraft("");
              }
            }}
            className="rounded p-1 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)]"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
