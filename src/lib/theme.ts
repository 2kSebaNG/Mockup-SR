export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ecosistema-theme";

/** The saved choice, or null when the viewer never picked one (then the system setting rules). */
export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function saveTheme(theme: Theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Without storage the choice lasts until the page reloads.
  }
}

/** Runs in <head> before the app renders, so the dark theme never flashes light first. */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var r=document.documentElement;if(t==="dark")r.classList.add("dark");r.style.colorScheme=t;}catch(e){}})();`;
