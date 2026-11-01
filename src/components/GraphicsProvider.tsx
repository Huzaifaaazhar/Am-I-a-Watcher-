"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  TIER,
  initialTier,
  renderMode,
  type QualitySetting,
  type QualityTier,
  type RenderMode,
} from "@/lib/capabilities";
import { forceFlat, forcedTier } from "@/lib/debug";

/**
 * Graphics quality, shared by the scene and the settings control.
 *
 * The chosen setting and the tier actually in force are separate values. On
 * "auto" the tier starts from a device guess and is then corrected by
 * measured frame rate; if someone picks High explicitly, the measurement must
 * not quietly override them.
 */

interface GraphicsState {
  setting: QualitySetting;
  setSetting: (setting: QualitySetting) => void;
  tier: QualityTier;
  /** Called by PerformanceMonitor. Ignored unless the setting is "auto". */
  reportPerformance: (healthy: boolean) => void;
  mode: RenderMode;
  budget: (typeof TIER)[QualityTier];
}

const Context = createContext<GraphicsState | null>(null);

const STORAGE_KEY = "aiaw:graphics";

export function GraphicsProvider({ children }: { children: React.ReactNode }) {
  // Server and first client render must agree, so everything device-dependent
  // is resolved in an effect rather than during render.
  const [setting, setSettingState] = useState<QualitySetting>("auto");
  const [tier, setTier] = useState<QualityTier>("high");
  const [mode, setMode] = useState<RenderMode>("3d");

  useEffect(() => {
    let stored: QualitySetting = "auto";
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "auto" || raw === "high" || raw === "low") stored = raw;
    } catch {
      // Private mode, blocked storage - the default is fine.
    }
    const pinned = forcedTier();
    setSettingState(pinned ?? stored);
    setTier(pinned ?? initialTier(stored));
    setMode(renderMode(forceFlat()));
  }, []);

  const setSetting = useCallback((next: QualitySetting) => {
    setSettingState(next);
    setTier(initialTier(next));
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not worth telling anyone about.
    }
  }, []);

  const reportPerformance = useCallback(
    (healthy: boolean) => {
      // An explicit choice outranks the measurement.
      if (setting !== "auto") return;
      setTier(healthy ? "high" : "low");
    },
    [setting],
  );

  const value = useMemo<GraphicsState>(
    () => ({
      setting,
      setSetting,
      tier,
      reportPerformance,
      mode,
      budget: TIER[tier],
    }),
    [setting, setSetting, tier, reportPerformance, mode],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useGraphics(): GraphicsState {
  const value = useContext(Context);
  if (!value) throw new Error("useGraphics must be used inside GraphicsProvider");
  return value;
}
