import { useEffect, useState } from 'react';
import { Copy, Share2, Loader2, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useMyWishlistShare, useUpsertWishlistShare } from '@/hooks/useWishlistShare';

interface Props {
  productIds: string[];
  isAuthenticated: boolean;
}

/** Gera/atualiza o link público da lista de favoritos do cliente logado. */
const WishlistShareCard = ({ productIds, isAuthenticated }: Props) => {
  const { toast } = useToast();
  const { data: share } = useMyWishlistShare(isAuthenticated);
  const upsert = useUpsertWishlistShare();
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (share) {
      setTitle(share.title ?? '');
      setIsPublic(share.is_public);
    }
  }, [share]);

  const url = share ? `${window.location.origin}/lista/${share.token}` : '';

  const handleSave = async (nextPublic = isPublic) => {
    try {
      await upsert.mutateAsync({
        productIds,
        isPublic: nextPublic,
        title: title || null,
        token: share?.token ?? null,
      });
      toast({ title: share ? 'Link atualizado' : 'Link criado' });
    } catch (e) {
      toast({
        title: 'Não foi possível salvar o link',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast({ title: 'Link copiado' });
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground flex items-center gap-2">
        <Lock className="h-4 w-4" strokeWidth={1.5} />
        Entre na sua conta para gerar um link de compartilhamento da sua lista.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-primary" strokeWidth={1.5} />
        <h2 className="font-display text-base">Compartilhar minha lista</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <Label className="text-xs" htmlFor="wishlist-title">Nome da lista</Label>
          <Input
            id="wishlist-title"
            value={title}
            placeholder="Ex.: Chá de bebê da Manu"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <Button onClick={() => handleSave()} disabled={upsert.isPending} className="min-h-[44px]">
          {upsert.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {share ? 'Atualizar link' : 'Gerar link'}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="wishlist-public"
          checked={isPublic}
          onCheckedChange={(v) => { setIsPublic(v); if (share) void handleSave(v); }}
        />
        <Label htmlFor="wishlist-public" className="text-sm flex items-center gap-1.5">
          {isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {isPublic ? 'Público — qualquer pessoa com o link vê' : 'Privado — só você vê'}
        </Label>
      </div>

      {share && (
        <div className="flex items-center gap-2">
          <Input readOnly value={url} className="text-xs" />
          <Button variant="outline" size="icon" onClick={copy} aria-label="Copiar link">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default WishlistShareCard;
