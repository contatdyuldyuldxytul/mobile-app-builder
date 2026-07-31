import { useEffect, useState } from "react";

/** Claro ou escuro — escolhido nos ajustes, guardado no aparelho. */
export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("tema") === "dark";
    setDark(stored);
    document.documentElement.classList.toggle("dark", stored);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("tema", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  return { dark, toggle };
}
