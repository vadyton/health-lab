import { makeAutoObservable } from "mobx";

type Theme = "light" | "dark";

function storedTheme(): Theme {
  const s = localStorage.getItem("theme");
  if (s === "dark" || s === "light") return s;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export class UiStore {
  theme: Theme = storedTheme();

  constructor() {
    makeAutoObservable(this);
    document.documentElement.setAttribute("data-theme", this.theme);
  }

  toggleTheme() {
    this.theme = this.theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", this.theme);
    localStorage.setItem("theme", this.theme);
  }
}
