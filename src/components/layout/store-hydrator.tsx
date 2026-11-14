"use client";

import { useEffect } from "react";
import { usePrefs } from "@/lib/store/prefs-store";
import { useSettings } from "@/lib/store/settings-store";
import { useForecast } from "@/lib/store/forecast-store";

export function StoreHydrator() {
  useEffect(() => {
    usePrefs.getState().hydrate();
    useSettings.getState().hydrate();
    useForecast.getState().hydrate();
  }, []);

  return null;
}
