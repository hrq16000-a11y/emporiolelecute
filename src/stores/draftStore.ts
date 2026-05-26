import { create } from 'zustand';

/**
 * Store global de rascunhos de formulário do admin.
 * Chave = pathname da rota; valor = snapshot serializável do formulário.
 *
 * Mantém também a timestamp da última alteração para diagnóstico/UX.
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
};

export const useDraftStore = create<DraftStore>((set, get) => ({
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
}));
