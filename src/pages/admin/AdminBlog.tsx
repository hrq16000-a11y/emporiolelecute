import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, EyeOff, Star } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useAdminBlogPosts,
  useDeleteBlogPost,
  useUpsertBlogPost,
} from "@/hooks/useAdminBlogPosts";
import type { DbBlogPost } from "@/hooks/useDbBlogPosts";
import { evaluateBlogPost } from "@/lib/blogSeo";

const empty: Partial<DbBlogPost> = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  cover_image: "",
  cover_image_alt: "",
  meta_title: "",
  meta_description: "",
  is_indexed: true,
  is_published: false,
  featured: false,
  reading_time: 5,
  author: "Empório LeleCute",
  faqs: [],
  related_products: [],
  related_categories: [],
  related_occasions: [],
  related_segments: [],
  related_tags: [],
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const AdminBlog = () => {
  const { data: posts = [], isLoading } = useAdminBlogPosts();
  const upsert = useUpsertBlogPost();
  const del = useDeleteBlogPost();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<DbBlogPost> | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return posts.filter(
      (p) =>
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    );
  }, [posts, search]);

  const save = async () => {
    if (!editing) return;
    if (!editing.title || !editing.slug) return;
    await upsert.mutateAsync(editing);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Blog</h1>
          <p className="text-sm text-muted-foreground">
            Conteúdo editorial conectado ao catálogo e taxonomias.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/blog/health">
            <Button variant="outline">Saúde do Blog</Button>
          </Link>
          <Button onClick={() => setEditing({ ...empty })}>
            <Plus className="h-4 w-4 mr-2" /> Novo post
          </Button>
        </div>
      </div>

      <Input
        placeholder="Buscar posts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SEO</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum post ainda. Crie o primeiro.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((post) => {
              const seo = evaluateBlogPost(post);
              return (
                <TableRow key={post.id}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      {post.featured && <Star className="h-3 w-3 text-primary" />}
                      {post.title}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {post.excerpt}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{post.slug}</TableCell>
                  <TableCell>
                    {post.is_published ? (
                      <Badge className="gap-1">
                        <Eye className="h-3 w-3" /> Publicado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <EyeOff className="h-3 w-3" /> Rascunho
                      </Badge>
                    )}
                    {!post.is_indexed && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        noindex
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        seo.classification === "excellent"
                          ? "default"
                          : seo.classification === "good"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {seo.score}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(post)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover post?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O post <strong>{post.title}</strong> será removido permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className={buttonVariants({ variant: "destructive" })}
                            onClick={() => del.mutate(post.id)}
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar post" : "Novo post"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Título</Label>
                  <Input
                    value={editing.title || ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        title: e.target.value,
                        slug: editing.slug || slugify(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input
                    value={editing.slug || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, slug: slugify(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label>Tempo de leitura (min)</Label>
                  <Input
                    type="number"
                    value={editing.reading_time || 5}
                    onChange={(e) =>
                      setEditing({ ...editing, reading_time: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>Resumo</Label>
                  <Textarea
                    rows={2}
                    value={editing.excerpt || ""}
                    onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Conteúdo (HTML)</Label>
                  <Textarea
                    rows={10}
                    value={editing.content || ""}
                    onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <Label>Imagem de capa (URL)</Label>
                  <Input
                    value={editing.cover_image || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, cover_image: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Alt da capa</Label>
                  <Input
                    value={editing.cover_image_alt || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, cover_image_alt: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Meta título (SEO)</Label>
                  <Input
                    value={editing.meta_title || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, meta_title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Meta descrição (SEO)</Label>
                  <Input
                    value={editing.meta_description || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, meta_description: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={!!editing.is_published}
                    onCheckedChange={(v) => setEditing({ ...editing, is_published: v })}
                  />
                  <span className="text-sm">Publicado</span>
                </label>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={editing.is_indexed !== false}
                    onCheckedChange={(v) => setEditing({ ...editing, is_indexed: v })}
                  />
                  <span className="text-sm">Indexável</span>
                </label>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={!!editing.featured}
                    onCheckedChange={(v) => setEditing({ ...editing, featured: v })}
                  />
                  <span className="text-sm">Destaque</span>
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={upsert.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBlog;
