import { makeAutoObservable } from "mobx";
import { getToken, setToken } from "@/shared/api/client";
import { queryClient } from "@/shared/api/queryClient";

export class AuthStore {
  token: string | null = getToken();
  username: string | null = localStorage.getItem("username");

  constructor() {
    makeAutoObservable(this);
    window.addEventListener("auth:logout", () => this.clear());
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  setAuth(token: string, username: string) {
    queryClient.clear();
    this.token = token;
    this.username = username;
    setToken(token);
    localStorage.setItem("username", username);
  }

  clear() {
    queryClient.clear();
    this.token = null;
    this.username = null;
    setToken(null);
    localStorage.removeItem("username");
  }
}
