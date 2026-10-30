"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { api } from "@/lib/client";
import {
  DEFAULT_THEME,
  PRESETS,
  BACKGROUND_LIGHT,
  BACKGROUND_DARK,
  applyTheme,
  clearAppliedTheme,
  isDefaultTheme,
  loadLocalTheme,
  saveLocalTheme,
  type ThemeConfig,
} from "@/lib/theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Palette, Sun, Moon, Check, RotateCcw, Save, MousePointerClick } from "lucide-react";

function SwatchDots({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <span className="flex -space-x-1.5">
      {[a, b, c].map((h, i) => (
        <span key={i} className="h-5 w-5 rounded-full border-2 border-card" style={{ background: h }} />
      ))}
    </span>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold">{label}</Label>
      <label className="flex items-center gap-2 rounded-lg border bg-card p-2 cursor-pointer hover:border-mint/60 transition-colors">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={`${label} colour picker`}
        />
        <span className="font-mono text-xs text-muted-foreground uppercase">{value}</span>
      </label>
    </div>
  );
}

export function ThemeCustomiser() {
  const { toast } = useToast();
  const { setTheme, resolvedTheme } = useTheme();
  const [config, setConfig] = useState<ThemeConfig>(DEFAULT_THEME);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(false);

  // Load saved theme once; live-apply it as the preview
  useEffect(() => {
    const local = loadLocalTheme();
    const start = local ?? DEFAULT_THEME;
    setConfig(start);
    if (local && !isDefaultTheme(local)) applyTheme(local);
    mounted.current = true;
  }, []);

  function update(next: Partial<ThemeConfig>) {
    setConfig((c) => {
      const merged = { ...c, ...next };
      if (mounted.current) applyTheme(merged); // live preview
      return merged;
    });
    setDirty(true);
  }

  function choosePreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    update({ preset: p.id, primary: p.primary, secondary: p.secondary, accent: p.accent, backgroundLight: p.backgroundLight });
  }

  async function save() {
    setSaving(true);
    try {
      await api("/api/profile", { method: "PATCH", body: { themePrefs: JSON.stringify(config) } });
      saveLocalTheme(config);
      setDirty(false);
      toast({ title: "Theme saved 🎨", description: "It will greet you every time you log in." });
    } catch (e) {
      toast({ title: "Could not save theme", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    clearAppliedTheme();
    saveLocalTheme(null);
    setConfig(DEFAULT_THEME);
    setDirty(false);
    api("/api/profile", { method: "PATCH", body: { themePrefs: null } }).catch(() => undefined);
    toast({ title: "Back to the classic mint look 🌿" });
  }

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-extrabold flex items-center gap-2">
          <Palette className="h-4.5 w-4.5 text-peach" /> Customise appearance
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Everything updates live as you click — press <b>Save theme</b> to keep it on your profile.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Presets */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Preset themes</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESETS.map((p) => {
              const active = config.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePreset(p.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all hover:shadow-sm",
                    active ? "border-mint ring-2 ring-mint/40 bg-mint-soft/40" : "bg-card hover:border-mint/50"
                  )}
                  aria-pressed={active}
                >
                  <div className="flex items-center justify-between">
                    <SwatchDots a={p.primary} b={p.secondary} c={p.accent} />
                    {active ? <Check className="h-4 w-4 text-mint" /> : null}
                  </div>
                  <p className="text-xs font-bold mt-2">{p.name}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom colours */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Your own colours {config.preset === "custom" ? "(custom)" : "(overrides the preset)"}
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ColorField label="Primary" value={config.primary} onChange={(hex) => update({ primary: hex, preset: "custom" })} />
            <ColorField label="Secondary" value={config.secondary} onChange={(hex) => update({ secondary: hex, preset: "custom" })} />
            <ColorField label="Accent" value={config.accent} onChange={(hex) => update({ accent: hex, preset: "custom" })} />
          </div>
        </div>

        {/* Backgrounds */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Light-mode background</Label>
            <Select value={config.backgroundLight} onValueChange={(v) => update({ backgroundLight: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(BACKGROUND_LIGHT).map(([k, b]) => (
                  <SelectItem key={k} value={k}>
                    <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border inline-block" style={{ background: b.hex }} />{b.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Dark-mode background</Label>
            <Select value={config.backgroundDark} onValueChange={(v) => update({ backgroundDark: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(BACKGROUND_DARK).map(([k, b]) => (
                  <SelectItem key={k} value={k}>
                    <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border inline-block" style={{ background: b.hex }} />{b.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mode */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold">Mode</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={resolvedTheme === "light" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setTheme("light")}
            >
              <Sun className="h-4 w-4 mr-1" /> Light
            </Button>
            <Button
              type="button"
              variant={resolvedTheme === "dark" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-4 w-4 mr-1" /> Dark
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button className="rounded-full" onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Save theme"}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => toast({ title: "Theme applied ✨", description: "Live preview is on — press Save theme to keep it permanently." })}>
            <MousePointerClick className="h-4 w-4 mr-1.5" /> Apply
          </Button>
          <Button variant="ghost" className="rounded-full" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reset to default
          </Button>
          {dirty ? <span className="text-xs text-muted-foreground">Unsaved changes</span> : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Text contrast is checked automatically, and layout, cards, charts and navigation keep their existing style — only the
          colours change.
        </p>
      </CardContent>
    </Card>
  );
}
