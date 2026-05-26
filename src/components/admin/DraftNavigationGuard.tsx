import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDraftStore } from '@/stores/draftStore';

/**
 * Guarda global de navegação para o painel administrativo.
 *
 * - Intercepta cliques em <a href> de navegação interna em fase de captura,
 *   antes que o React Router processe o clique.
 * - Se houver rascunho não salvo para a rota atual, abre um modal de confirmação.
 * - Para fechamento/recarregamento de aba, dispara o aviso nativo via beforeunload.
 *
 * Deve ser montado uma única vez dentro do AdminLayout.
 */
export default function DraftNavigationGuard() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { hasDraft, clearDraft } = useDraftStore();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  // Flag para permitir uma navegação após confirmação, sem reabrir o modal
  const bypassRef = useRef(false);

  // Captura cliques em links de navegação interna
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bypassRef.current) return;
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '' && anchor.target !== '_self') return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.startsWith('#')) return;
      if (href === pathname) return;
      if (!hasDraft(pathname)) return;

      // Bloqueia e abre o modal informativo
      e.preventDefault();
      e.stopImmediatePropagation();
      setPendingHref(href);
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname, hasDraft]);

  // Aviso nativo apenas para fechar aba/reload (drafts persistem em localStorage,
  // mas o usuário deve saber que tem trabalho não salvo no servidor)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasDraft(pathname)) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pathname, hasDraft]);

  // Sair mantendo o rascunho (padrão seguro — usuário pode voltar e continuar)
  const leaveKeepingDraft = () => {
    if (!pendingHref) return;
    const dest = pendingHref;
    setPendingHref(null);
    bypassRef.current = true;
    navigate(dest);
    setTimeout(() => {
      bypassRef.current = false;
    }, 0);
  };

  // Sair descartando explicitamente o rascunho
  const leaveDiscarding = () => {
    if (!pendingHref) return;
    clearDraft(pathname);
    const dest = pendingHref;
    setPendingHref(null);
    bypassRef.current = true;
    navigate(dest);
    setTimeout(() => {
      bypassRef.current = false;
    }, 0);
  };

  const cancelLeave = () => setPendingHref(null);

  return (
    <AlertDialog open={!!pendingHref} onOpenChange={(open) => !open && cancelLeave()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Você tem alterações não salvas</AlertDialogTitle>
          <AlertDialogDescription>
            Seu rascunho será mantido automaticamente — você pode voltar a esta tela e continuar
            de onde parou. Se preferir, descarte tudo agora.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel onClick={cancelLeave}>Continuar editando</AlertDialogCancel>
          <AlertDialogAction onClick={leaveKeepingDraft}>
            Sair (manter rascunho)
          </AlertDialogAction>
          <AlertDialogAction
            onClick={leaveDiscarding}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Descartar rascunho
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
