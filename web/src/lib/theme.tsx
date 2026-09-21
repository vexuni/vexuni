import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "auto" | "light" | "dark";
export type Resolved = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  resolved: Resolved;
  setTheme: (t: Theme) => void;
}>({
  theme: "auto",
  resolved: "light",
  setTheme: () => {},
});

function resolve(theme: Theme): Resolved {
  if (theme !== "auto") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem("vexuni.theme") as Theme) || "auto",
  );
  const [resolved, setResolved] = useState<Resolved>(() => resolve(theme));
  useEffect(() => {
    const apply = () => {
      const r = resolve(theme);
      setResolved(r);
      document.documentElement.setAttribute("data-theme", r);
    };
    apply();
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("vexuni.theme", t);
  }, []);
  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
