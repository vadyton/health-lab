import { createContext, useContext, type ReactNode } from "react";
import { rootStore, type RootStore } from "./RootStore";

const StoreContext = createContext<RootStore>(rootStore);

export function StoreProvider({ children }: { children: ReactNode }) {
  return <StoreContext.Provider value={rootStore}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);
