import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Store global de rascunhos de formulário do admin.
 * Chave = pathname da rota; valor = snapshot serializável do formulário.
 *
 * Persiste em localStorage para que rascunhos sobrevivam a:
 * - Navegação entre telas do admin
 * - Reload da aba
 * - Fechamento e reabertura do navegador
 *
 * Rascunhos só são apagados explicitamente após salvamento bem-sucedido
 * (via `clearDraft`) — nunca em navegação.
 */
type DraftEntry = {
  data: unknown;
  updatedAt: number;
};

type DraftStore = {
  drafts: Record<string, DraftEntry>;
  setDraft: (path: string, data: unknown) => void;
  clearDraft: (path: string) => void;
  hasDraft: (path: string) => boolean;
  getDraft: <T = unknown>(path: string) => T | undefined;
  getDraftAge: (path: string) => number | undefined;
};

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},
      setDraft: (path, data) =>
        set((state) => ({
          drafts: { ...state.drafts, [path]: { data, updatedAt: Date.now() } },
        })),
      clearDraft: (path) =>
        set((state) => {
          if (!state.drafts[path]) return state;
          const next = { ...state.drafts };
          delete next[path];
          return { drafts: next };
        }),
      hasDraft: (path) => Boolean(get().drafts[path]),
      getDraft: <T = unknown>(path: string) => get().drafts[path]?.data as T | undefined,
      getDraftAge: (path) => get().drafts[path]?.updatedAt,
    }),
    {
      name: 'lc-admin-drafts',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
