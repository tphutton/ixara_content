"use client";

import { useSyncExternalStore, type ComponentType } from "react";

type Theme = "light" | "dark";
type ThemeIcon = ComponentType<{ size?: number }>;

type ThemeToggleProps = {
  darkIcon: ThemeIcon;
  lightIcon: ThemeIcon;
};

function getActiveTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("ixara-theme-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("ixara-theme-change", onStoreChange);
  };
}

export function ThemeToggle({ darkIcon: Moon, lightIcon: Sun }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribeToTheme, getActiveTheme, () => "dark");

  function toggleTheme() {
    const nextTheme: Theme = getActiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem("ixara-content-theme", nextTheme);
    window.dispatchEvent(new Event("ixara-theme-change"));
  }

  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Use light mode" : "Use dark mode";

  return (
    <button aria-label={label} className="theme-toggle" onClick={toggleTheme} title={label} type="button">
      <Icon size={17} />
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
