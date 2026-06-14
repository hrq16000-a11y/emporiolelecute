import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Plus, Trash2, GripVertical, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDbProducts } from "@/hooks/useProducts";
import type { KitBundleType } from "@/hooks/useKits";
import { useFormDraft } from "@/hooks/useFormDraft";
import DraftStatusBadge from "@/components/admin/DraftStatusBadge";
import StickySaveBar from "@/components/admin/StickySaveBar";

interface KitItem {
  product_id: string;
  quantity: number;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminKitForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== "novo";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: allProducts } = useDbProducts();

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    image_url: "",
    bundle_type: "curated" as KitBundleType,
    estimated_savings: "",
    position: 0,
    is_active: true,
    show_on_home: false,
    home_position: 0,
    meta_title: "",
    meta_description: "",
  });
  const [items, setItems] = useState<KitItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Rascunho global persistente (mesmo padrão de Coleção/Página/Produto).
  const draft = useFormDraft({ form, items }, hydrated);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["admin-kit", id],
    enabled: isEdit,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kits")
        .select("*, kit_products(product_id, quantity, position)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Hidratação: prioriza rascunho local; só usa servidor se não houver rascunho.
  useEffect(() => {
    if (hydrated) return;
    const saved = draft.hydrate<{ form: typeof form; items: KitItem[] }>();
    if (saved?.form) {
      setForm(saved.form);
      setItems(saved.items ?? []);
      setHydrated(true);
      return;
    }
    if (!isEdit) {
      setHydrated(true);
    }
  }, [hydrated, isEdit, draft]);

  useEffect(() => {
    if (!existing || hydrated) return;
    setForm({
      name: existing.name ?? "",
      slug: existing.slug ?? "",
      description: existing.description ?? "",
      image_url: existing.image_url ?? "",
      bundle_type: (existing.bundle_type ?? "curated") as KitBundleType,
      estimated_savings: existing.estimated_savings != null ? String(existing.estimated_savings) : "",
      position: existing.position ?? 0,
      is_active: existing.is_active ?? true,
      show_on_home: existing.show_on_home ?? false,
      home_position: existing.home_position ?? 0,
      meta_title: existing.meta_title ?? "",
      meta_description: existing.meta_description ?? "",
    });
    const rows = (existing.kit_products || []) as { product_id: string; quantity: number; position: number }[];
    setItems(
      rows
        .sort((a, b) => a.position - b.position)
        .map((r) => ({ product_id: r.product_id, quantity: r.quantity ?? 1 }))
    );
    setHydrated(true);
  }, [existing, hydrated]);

  const productMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; slug: string; images: string[]; min_quantity: number }>();
    (allProducts ?? []).forEach((p) =>
      m.set(p.id, { id: p.id, name: p.name, slug: p.slug, images: p.images, min_quantity: p.min_quantity ?? 1 })
    );
    return m;
  }, [allProducts]);

  const usedIds = useMemo(() => new Set(items.map((i) => i.product_id)), [items]);
  const availableProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return (allProducts ?? [])
      .filter((p) => !usedIds.has(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
      .slice(0, 20);
  }, [allProducts, usedIds, productSearch]);

  const addProduct = (pid: string) => {
    const p = productMap.get(pid);
    setItems((prev) => [...prev, { product_id: pid, quantity: p?.min_quantity ?? 1 }]);
  };
  const removeProduct = (pid: string) => setItems((prev) => prev.filter((x) => x.product_id !== pid));
  const updateQty = (pid: string, qty: number) =>
    setItems((prev) =>
      prev.map((it) => (it.product_id === pid ? { ...it, quantity: Math.max(1, Math.floor(qty || 1)) } : it))
    );
  const move = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      if (items.length === 0) throw new Error("Adicione pelo menos um produto ao kit");
      const slug = form.slug.trim() || slugify(form.name);
      const payload = {
        name: form.name.trim(),
        slug,
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        bundle_type: form.bundle_type,
        estimated_savings: form.estimated_savings.trim() ? Number(form.estimated_savings) : null,
        position: Number(form.position) || 0,
        is_active: form.is_active,
        show_on_home: form.show_on_home,
        home_position: Number(form.home_position) || 0,
        meta_title: form.meta_title.trim() || null,
        meta_description: form.meta_description.trim() || null,
      };

      let kid = id;
      if (isEdit && kid) {
        const { error } = await (supabase as any).from("kits").update(payload).eq("id", kid);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("kits").insert(payload).select("id").single();
        if (error) throw error;
        kid = data.id;
      }

      const { error: delErr } = await (supabase as any).from("kit_products").delete().eq("kit_id", kid!);
      if (delErr) throw delErr;
      const rows = items.map((it, i) => ({
        kit_id: kid!,
        product_id: it.product_id,
        quantity: it.quantity,
        position: i,
      }));
      const { error: insErr } = await (supabase as any).from("kit_products").insert(rows);
      if (insErr) throw insErr;
      return kid!;
    },
    onSuccess: (kid) => {
      qc.invalidateQueries({ queryKey: ["admin-kits"] });
      qc.invalidateQueries({ queryKey: ["admin-kit", kid] });
      qc.invalidateQueries({ queryKey: ["kits"] });
      qc.invalidateQueries({ queryKey: ["kit"] });
      qc.invalidateQueries({ queryKey: ["kits-of-product"] });
      draft.clear();
      toast({ title: "Kit salvo" });
      if (!isEdit) navigate(`/admin/kits/${kid}`);
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    onSettled: () => setSaving(false),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    save.mutate();
  };

  if (isEdit && isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <form onSubmit={onSubmit} className="container max-w-4xl mx-auto py-6 sm:py-8 px-3 sm:px-4 space-y-6 pb-28 sm:pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button asChild variant="ghost" size="sm"><Link to="/admin/kits"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-xl sm:text-2xl font-display font-semibold truncate">{isEdit ? "Editar kit" : "Novo kit"}</h1>
          <DraftStatusBadge className="hidden sm:inline-flex" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DraftStatusBadge className="sm:hidden" />
          {isEdit && form.slug && (
            <Button asChild type="button" variant="outline" size="sm">
              <a href={`/kit/${form.slug}`} target="_blank" rel="noreferrer">Preview</a>
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>


      <Card>
        <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))} required />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} placeholder="ex: kit-cha-de-bebe" />
            {form.slug && <p className="text-[11px] text-muted-foreground">URL: /kit/{form.slug}</p>}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Imagem (URL)</Label>
            <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Tipo do kit</Label>
            <Select value={form.bundle_type} onValueChange={(v) => setForm((f) => ({ ...f, bundle_type: v as KitBundleType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="suggested">Sugerido</SelectItem>
                <SelectItem value="curated">Curado</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Economia estimada (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.estimated_savings}
              onChange={(e) => setForm((f) => ({ ...f, estimated_savings: e.target.value }))}
              placeholder="opcional"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Visibilidade & Ordenação</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Kit ativo</p>
              <p className="text-xs text-muted-foreground">Quando desativado, fica oculto no site.</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Exibir na home</p>
              <p className="text-xs text-muted-foreground">Bloco "Monte seu kit" / "Coleções completas".</p>
            </div>
            <Switch checked={form.show_on_home} onCheckedChange={(v) => setForm((f) => ({ ...f, show_on_home: v }))} />
          </label>
          <div className="space-y-2">
            <Label>Posição (listagens)</Label>
            <Input type="number" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: Number(e.target.value) }))} />
          </div>
          <div className="space-y-2">
            <Label>Posição (home)</Label>
            <Input type="number" value={form.home_position} onChange={(e) => setForm((f) => ({ ...f, home_position: Number(e.target.value) }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">SEO</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Meta title</Label>
            <Input value={form.meta_title} onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))} maxLength={70} />
          </div>
          <div className="space-y-2">
            <Label>Meta description</Label>
            <Textarea rows={2} value={form.meta_description} onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))} maxLength={170} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Itens do kit ({items.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto adicionado.</p>
            )}
            {items.map((it, idx) => {
              const p = productMap.get(it.product_id);
              return (
                <div key={it.product_id} className="flex items-center gap-3 rounded-md border p-2 bg-card">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  {p?.images?.[0] && (
                    <img src={p.images[0]} alt={p.name} className="h-10 w-10 rounded object-cover" loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p?.name ?? "(produto removido)"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">/{p?.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] text-muted-foreground">Qtd</Label>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => updateQty(it.product_id, Number(e.target.value))}
                      className="h-8 w-20"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}>↓</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeProduct(it.product_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Adicionar produto</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar por nome ou slug..."
                className="pl-8"
              />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {availableProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted text-left"
                >
                  {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="h-8 w-8 rounded object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">/{p.slug}</p>
                  </div>
                  <Plus className="h-4 w-4 text-primary" />
                </button>
              ))}
              {availableProducts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  {productSearch ? "Nenhum produto encontrado." : "Comece a digitar para buscar produtos."}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <StickySaveBar
        saving={saving}
        onSave={() => onSubmit({ preventDefault: () => {} } as React.FormEvent)}
        label="Salvar kit"
      />
    </form>
  );
}
