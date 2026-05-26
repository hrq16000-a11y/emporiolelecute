// Store global do workspace admin — persiste em sessionStorage.
// Mantém aba selecionada, busca e drawer aberto por rota, para que a navegação
// entre páginas do admin nunca perca o contexto de trabalho do operador.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type RouteKey = string; // ex: "/admin/clientes", "/admin/usuarios"

interface RouteState {
  tab?: string;
  subTab?: string;
  search?: string;
  // Drawer: { kind, id } — ex: { kind: "visitor", id: "uuid" }
  drawer?: { kind: string; id: string } | null;
  // Snapshot dos filtros globais (geolocalização, dispositivo, datas, etc.)
  filters?: Record<string, unknown>;
}

interface AdminWorkspaceState {
  byRoute: Record<RouteKey, RouteState>;
  getRoute: (route: RouteKey) => RouteState;
  patchRoute: (route: RouteKey, patch: Partial<RouteState>) => void;
  clearRoute: (route: RouteKey) => void;
}

export const useAdminWorkspaceStore = create<AdminWorkspaceState>()(
  persist(
    (set, get) => ({
      byRoute: {},
      getRoute: (route) => get().byRoute[route] || {},
      patchRoute: (route, patch) =>
        set((s) => ({
          byRoute: { ...s.byRoute, [route]: { ...(s.byRoute[route] || {}), ...patch } },
        })),
      clearRoute: (route) =>
        set((s) => {
          const next = { ...s.byRoute };
          delete next[route];
          return { byRoute: next };
        }),
    }),
    {
      name: "elc-admin-workspace",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
