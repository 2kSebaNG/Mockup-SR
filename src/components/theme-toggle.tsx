import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, saveTheme, storedTheme, systemTheme, type Theme } from "@/lib/theme";

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
];

/** Light / dark switch shown as two labelled options, so both the current theme and the other one are visible. */
export function ThemeToggle() {
  // Unknown until mounted: the server cannot know the viewer's choice.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    // Follow the system setting until the viewer picks a theme here.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      if (storedTheme()) return;
      const next = systemTheme();
      applyTheme(next);
      setTheme(next);
    };
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  function choose(next: Theme) {
    saveTheme(next);
    setTheme(next);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Tema de la interfaz">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          className="theme-option"
          aria-pressed={theme === value}
          aria-label={`Tema ${label.toLowerCase()}`}
          title={`Usar tema ${label.toLowerCase()}`}
          onClick={() => choose(value)}
        >
          <Icon aria-hidden="true" />
          <span className="theme-option-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
