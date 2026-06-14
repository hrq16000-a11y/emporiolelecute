import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { FileEdit, Globe } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info } from 'lucide-react';
import SeoPreview from './SeoPreview';
import LucideIconPicker from './LucideIconPicker';
import { TAXONOMY_LABELS, TaxonomyEntity, TaxonomyKind, TaxonomyFaq, normalizeFaqs, slugify } from '@/lib/taxonomy';

interface Props {
  kind: TaxonomyKind;
  initial?: Partial<TaxonomyEntity>;
  // Slugs already in use across taxonomies, used for conflict warning
  existingSlugsByKind: Record<TaxonomyKind, Map<string, string>>; // slug -> name
  showSeo?: boolean; // tags don't have SEO fields
  saving?: boolean;
  onCancel: () => void;
  onSubmit: (values: Partial<TaxonomyEntity>) => Promise<void> | void;
}

const TaxonomyForm = ({
  kind,
  initial,
  existingSlugsByKind,
  showSeo = true,
  saving,
  onCancel,
  onSubmit,
}: Props) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [position, setPosition] = useState<number>(initial?.position ?? 0);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '');
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null);
  const [isIndexed, setIsIndexed] = useState<boolean>(initial?.is_indexed ?? true);
  // Bloco 3 SAFE: novos itens nascem como rascunho; existentes preservam o estado salvo.
  const [isDraft, setIsDraft] = useState<boolean>(initial?.is_draft ?? true);
  const [metaTitle, setMetaTitle] = useState(initial?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(initial?.meta_description ?? '');
  const [h1, setH1] = useState(initial?.h1_override ?? '');
  const [descSeo, setDescSeo] = useState(initial?.description_seo ?? '');
  const [faqs, setFaqs] = useState<TaxonomyFaq[]>(() => {
    const existing = normalizeFaqs(initial?.faqs);
    const padded: TaxonomyFaq[] = [...existing];
    while (padded.length < 3) padded.push({ question: '', answer: '' });
    return padded.slice(0, 3);
  });
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  // Conflict detection: slug used by another kind
  const conflicts: { kind: TaxonomyKind; name: string }[] = [];
  (Object.keys(existingSlugsByKind) as TaxonomyKind[]).forEach((k) => {
    if (k === kind) return;
    const match = existingSlugsByKind[k].get(slug);
    if (match) conflicts.push({ kind: k, name: match });
  });
  const sameKindMap = existingSlugsByKind[kind];
  const sameKindConflict = slug && sameKindMap.get(slug) && sameKindMap.get(slug) !== (initial?.name ?? null);

  const warnings: string[] = [];
  if (showSeo) {
    if (!metaTitle.trim()) warnings.push('Sem meta_title.');
    else if (metaTitle.trim().length < 30) warnings.push('meta_title muito curto (mín. 30).');
    if (!metaDescription.trim()) warnings.push('Sem meta_description.');
    else if (metaDescription.trim().length < 80) warnings.push('meta_description muito curta (mín. 80).');
    if (!imageUrl.trim()) warnings.push('Sem imagem.');
    if (!description.trim()) warnings.push('Sem descrição.');
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<TaxonomyEntity> = {
      name: name.trim(),
      slug: slug.trim(),
      position,
    };
    if (showSeo) {
      payload.description = description || null;
      payload.image_url = imageUrl || null;
      payload.is_indexed = isIndexed;
      payload.is_draft = isDraft;
      payload.meta_title = metaTitle || null;
      payload.meta_description = metaDescription || null;
      payload.h1_override = h1 || null;
      payload.description_seo = descSeo || null;
      payload.faqs = normalizeFaqs(faqs);
    }
    await onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Recomendação especial para tags */}
      {kind === 'tag' && (
        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
          <Info className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
          <p className="text-amber-900 dark:text-amber-200">
            Tags devem representar <strong>tema, estilo, cor ou característica visual</strong>.
            Evite criar tags que representem categoria, ocasião ou segmento.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="tx-name">Nome *</Label>
          <Input
            id="tx-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-slug">Slug *</Label>
          <Input
            id="tx-slug"
            value={slug}
            onChange={(e) => {
              setSlug(slugify(e.target.value));
              setSlugTouched(true);
            }}
            required
            maxLength={120}
          />
          <p className="text-xs text-muted-foreground">
            URL: {TAXONOMY_LABELS[kind].urlPrefix}{slug || 'slug'}
          </p>
        </div>
      </div>

      {(conflicts.length > 0 || sameKindConflict) && (
        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
          <div className="text-amber-900 dark:text-amber-200 space-y-1">
            {sameKindConflict && (
              <p>Já existe outro(a) {TAXONOMY_LABELS[kind].singular.toLowerCase()} com este slug.</p>
            )}
            {conflicts.map((c) => (
              <p key={c.kind}>
                Slug já usado em {TAXONOMY_LABELS[c.kind].plural} ("{c.name}"). Considere diferenciar para evitar canibalização SEO.
              </p>
            ))}
          </div>
        </div>
      )}

      {showSeo && (
        <>
          <div className="grid sm:grid-cols-[1fr_140px] gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tx-image">URL da imagem</Label>
              <Input
                id="tx-image"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-position">Posição</Label>
              <Input
                id="tx-position"
                type="number"
                value={position}
                onChange={(e) => setPosition(parseInt(e.target.value || '0', 10))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-desc">Descrição curta</Label>
            <Textarea
              id="tx-desc"
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {isDraft ? (
                  <FileEdit className="w-4 h-4 text-amber-600 shrink-0" aria-hidden />
                ) : (
                  <Globe className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />
                )}
                <Label htmlFor="tx-draft" className="cursor-pointer leading-tight">
                  {isDraft ? 'Rascunho' : 'Publicado'}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {isDraft
                      ? 'Invisível ao público, sitemap e Google. Só você vê no admin.'
                      : 'Visível ao público (respeitando "Indexável" abaixo).'}
                  </span>
                </Label>
              </div>
              <Switch
                id="tx-draft"
                checked={!isDraft}
                onCheckedChange={(checked) => setIsDraft(!checked)}
                aria-label="Alternar entre rascunho e publicado"
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <Label htmlFor="tx-indexed" className="cursor-pointer leading-tight">
                Indexável
                <span className="block text-xs font-normal text-muted-foreground">
                  Aparece no sitemap e permite robots index. Requer "Publicado".
                </span>
              </Label>
              <Switch id="tx-indexed" checked={isIndexed} onCheckedChange={setIsIndexed} />
            </div>
          </div>

          <div className="rounded-md border border-border p-4 space-y-4">
            <h4 className="font-medium text-sm">SEO</h4>
            <div className="space-y-1.5">
              <Label htmlFor="tx-mt">Meta title</Label>
              <Input
                id="tx-mt"
                value={metaTitle ?? ''}
                onChange={(e) => setMetaTitle(e.target.value)}
                maxLength={70}
              />
              <p className="text-xs text-muted-foreground">{(metaTitle ?? '').length}/60 ideal</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-md">Meta description</Label>
              <Textarea
                id="tx-md"
                value={metaDescription ?? ''}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={2}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">{(metaDescription ?? '').length}/160 ideal</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-h1">H1 override (opcional)</Label>
              <Input
                id="tx-h1"
                value={h1 ?? ''}
                onChange={(e) => setH1(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-ds">Descrição SEO (texto longo)</Label>
              <Textarea
                id="tx-ds"
                value={descSeo ?? ''}
                onChange={(e) => setDescSeo(e.target.value)}
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview do Google</p>
              <SeoPreview
                kind={kind}
                name={name}
                slug={slug}
                metaTitle={metaTitle ?? undefined}
                metaDescription={metaDescription ?? undefined}
              />
            </div>

            {warnings.length > 0 && (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-600 shrink-0" />
                <ul className="list-disc ml-4 text-amber-900 dark:text-amber-200 space-y-0.5">
                  {warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-md border border-border p-4 space-y-4">
            <div>
              <h4 className="font-medium text-sm">FAQ desta página (opcional)</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Até 3 perguntas curtas, humanas e específicas. Deixe em branco para ocultar.
                Gera schema FAQPage automaticamente.
              </p>
            </div>
            {faqs.map((f, idx) => (
              <div key={idx} className="space-y-2 border-l-2 border-border pl-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`tx-faq-q-${idx}`}>Pergunta {idx + 1}</Label>
                  <Input
                    id={`tx-faq-q-${idx}`}
                    value={f.question}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[idx] = { ...next[idx], question: e.target.value };
                      setFaqs(next);
                    }}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`tx-faq-a-${idx}`}>Resposta {idx + 1}</Label>
                  <Textarea
                    id={`tx-faq-a-${idx}`}
                    value={f.answer}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[idx] = { ...next[idx], answer: e.target.value };
                      setFaqs(next);
                    }}
                    rows={2}
                    maxLength={600}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving || !name.trim() || !slug.trim()}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
};

export default TaxonomyForm;
