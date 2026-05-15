import { useState } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "@/shared/stores/StoreContext";
import { api } from "@/shared/api/client";
import s from "./AuthPage.module.scss";

export const AuthPage = observer(() => {
  const { auth } = useStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ access_token: string; username: string }>(
        `/api/auth/${mode}`,
        { username: username.trim(), password },
      );
      auth.setAuth(res.access_token, res.username);
    } catch (err: unknown) {
      setError((err as Error).message || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={s.root}>
      <div className={s.card}>
        <div className={s.logo}>
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#ef4444"/>
            <polyline points="4,16 7.5,16 9.5,11 12,21 14.5,13 16,17.5 18,16 21,16 23,11 26.5,16 28,16"
              stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className={s.brand}>Health Lab</span>
        </div>

        <div className={s.tabs}>
          <button className={`${s.tab} ${mode === "login" ? s.tabActive : ""}`} onClick={() => { setMode("login"); setError(""); }}>
            Войти
          </button>
          <button className={`${s.tab} ${mode === "register" ? s.tabActive : ""}`} onClick={() => { setMode("register"); setError(""); }}>
            Регистрация
          </button>
        </div>

        <form className={s.form} onSubmit={handleSubmit}>
          <label className={s.label}>
            Имя пользователя
            <input
              className={s.input}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              placeholder="Введите логин"
            />
          </label>
          <label className={s.label}>
            Пароль
            <input
              className={s.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
              minLength={6}
              placeholder="Минимум 6 символов"
            />
          </label>

          {error && <div className={s.error}>{error}</div>}

          <button className={s.submit} type="submit" disabled={loading}>
            {loading ? "Загрузка…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
});
