"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UserPreferences } from "@/lib/preferences";
import { updatePreferences } from "../actions";

export function PreferencesForm({ initial }: { initial: UserPreferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");

  function save() {
    startTransition(async () => {
      await updatePreferences(prefs);
      toast.success("Preferences saved");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Preferred locations</Label>
          <div className="flex flex-wrap gap-1.5">
            {prefs.preferredLocations.map((l) => (
              <Badge key={l} variant="mono" className="gap-1.5 pr-1">
                {l}
                <button
                  type="button"
                  onClick={() =>
                    setPrefs({
                      ...prefs,
                      preferredLocations: prefs.preferredLocations.filter((x) => x !== l),
                    })
                  }
                  className="rounded p-0.5 hover:bg-[var(--color-bg-muted)]"
                >
                  ×
                </button>
              </Badge>
            ))}
            <Input
              className="h-7 w-40 text-xs"
              placeholder="Add city..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  e.preventDefault();
                  setPrefs({
                    ...prefs,
                    preferredLocations: [...prefs.preferredLocations, draft.trim()],
                  });
                  setDraft("");
                }
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] p-3">
          <div>
            <div className="text-sm font-medium">Remote only</div>
            <div className="text-xs text-[var(--color-fg-muted)]">Hide non-remote jobs</div>
          </div>
          <input
            type="checkbox"
            checked={prefs.remoteOnly}
            onChange={(e) => setPrefs({ ...prefs, remoteOnly: e.target.checked })}
            className="h-4 w-4"
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] p-3">
          <div>
            <div className="text-sm font-medium">Daily digest email</div>
            <div className="text-xs text-[var(--color-fg-muted)]">Top 5 matches at 9am IST</div>
          </div>
          <input
            type="checkbox"
            checked={prefs.alerts.dailyDigest}
            onChange={(e) =>
              setPrefs({ ...prefs, alerts: { ...prefs.alerts, dailyDigest: e.target.checked } })
            }
            className="h-4 w-4"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="min">Minimum match score for digest ({prefs.minMatchScore})</Label>
          <input
            id="min"
            type="range"
            min={40}
            max={95}
            value={prefs.minMatchScore}
            onChange={(e) => setPrefs({ ...prefs, minMatchScore: Number(e.target.value) })}
            className="w-full accent-[var(--color-accent)]"
          />
        </div>

        <Button variant="accent" onClick={save} disabled={pending}>
          Save preferences
        </Button>
      </CardContent>
    </Card>
  );
}
