import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, ShieldCheck, Check, X, Mail, History, Send, Copy, Link2, FileText } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

interface AccessRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'denied';
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  rejection_reason: string | null;
  user_email_snapshot: string | null;
}

interface AuditEntry {
  id: string;
  created_at: string;
  status: string;
  message: string | null;
  promoted_by_email: string | null;
}

interface NotificationEntry {
  id: string;
  created_at: string;
  status: string;
  admin_count: number;
  sent_count: number;
  error_message: string | null;
  details: any;
}

const AdminAccessRequestDetail = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { toast } = useToast();
  const { refreshRole, roleRefreshing } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendReason, setResendReason] = useState('');

  const COOLDOWN_SECONDS = 60;
  const cooldownKey = id ? `notify_resend_cooldown:${id}` : '';

  // Hydrate cooldown from localStorage
  useEffect(() => {
    if (!cooldownKey) return;
    const raw = localStorage.getItem(cooldownKey);
    if (!raw) return;
    const remaining = Math.max(0, Math.ceil((Number(raw) - Date.now()) / 1000));
    if (remaining > 0) setCooldown(remaining);
    else localStorage.removeItem(cooldownKey);
  }, [cooldownKey]);

  // Tick cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const copyToClipboard = async (text: string, label = 'Mensagem') => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copiada` });
    } catch {
      toast({ title: 'Falha ao copiar', variant: 'destructive' });
    }
  };

  const pendingRequest = requests.find((r) => r.status === 'pending') ?? null;
  const lastRequest = requests[0] ?? null;
  const lastRequestedAt = lastRequest?.requested_at ?? null;

  const resendNotification = async () => {
    if (!profile || cooldown > 0) return;
    const reasonTrimmed = resendReason.trim().slice(0, 500);
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('notify-admins-new-request', {
        body: {
          user_id: profile.id,
          email: profile.email,
          requested_at: lastRequestedAt ?? new Date().toISOString(),
          request_id: pendingRequest?.id ?? lastRequest?.id ?? null,
          source: 'manual_resend',
          reason: reasonTrimmed || null,
        },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; sent?: number; admin_count?: number; errors?: string[] } | null;
      if (result?.ok === false) {
        toast({
          title: 'Notificação registrada com falhas',
          description: (result?.errors || []).join(' | ').slice(0, 200) || 'Veja o histórico abaixo.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Notificação reenviada',
          description: `${result?.sent ?? 0} de ${result?.admin_count ?? 0} admin(s) notificado(s).`,
        });
      }
      const until = Date.now() + COOLDOWN_SECONDS * 1000;
      if (cooldownKey) localStorage.setItem(cooldownKey, String(until));
      setCooldown(COOLDOWN_SECONDS);
      setResendReason('');
      await load();
    } catch (e: any) {
      toast({ title: 'Erro ao reenviar', description: e.message, variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  const requestPermalink = typeof window !== 'undefined' && id
    ? `${window.location.origin}/admin/usuarios/solicitacoes/${id}`
    : '';

  const buildLogPayload = (n: NotificationEntry) => {
    const lines = [
      `Tentativa: ${n.id}`,
      `Data: ${new Date(n.created_at).toLocaleString('pt-BR')}`,
      `Status: ${n.status}`,
      `Admins: ${n.admin_count} • Enviados: ${n.sent_count}`,
    ];
    const reason = n.details?.reason;
    const sourceTag = n.details?.source;
    if (sourceTag) lines.push(`Origem: ${sourceTag}`);
    if (reason) lines.push(`Motivo informado: ${reason}`);
    if (n.error_message) {
      lines.push('---');
      lines.push('Erro completo:');
      lines.push(n.error_message);
    }
    if (n.details && Object.keys(n.details).length) {
      lines.push('---');
      lines.push('Detalhes (JSON):');
      lines.push(JSON.stringify(n.details, null, 2));
    }
    return lines.join('\n');
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: p }, { data: roles }, { data: reqs }] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, created_at, updated_at').eq('id', id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', id).eq('role', 'admin'),
      (supabase as any)
        .from('admin_access_requests')
        .select('*')
        .eq('user_id', id)
        .order('requested_at', { ascending: false })
        .limit(50),
    ]);
    setProfile((p as Profile) || null);
    setIsAdmin(!!(roles && roles.length));
    setRequests((reqs as AccessRequest[]) || []);

    if (p?.email) {
      const [{ data: a }, { data: n }] = await Promise.all([
        supabase
          .from('role_promotion_audit')
          .select('id, created_at, status, message, promoted_by_email')
          .eq('target_email', p.email)
          .order('created_at', { ascending: false })
          .limit(100),
        (supabase as any)
          .from('access_request_notifications')
          .select('*')
          .or(`requester_id.eq.${id},requester_email.eq.${p.email}`)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      setAudit((a as AuditEntry[]) || []);
      setNotifications((n as NotificationEntry[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const approve = async () => {
    if (!profile) return;
    setActing(true);
    try {
      const { data, error } = await supabase.rpc('promote_user_to_admin', { _email: profile.email });
      if (error) throw error;
      const result = data as { success?: boolean; already?: boolean; error?: string } | null;
      if (result?.success === false) {
        toast({ title: 'Não foi possível aprovar', description: result.error || '—', variant: 'destructive' });
      } else {
        toast({ title: result?.already ? 'Já era admin' : 'Acesso aprovado', description: profile.email });
        void refreshRole();
        await load();
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setActing(false);
    }
  };

  const reject = async () => {
    if (!profile) return;
    if (reason.trim().length < 3) {
      toast({ title: 'Motivo obrigatório', variant: 'destructive' });
      return;
    }
    setActing(true);
    try {
      const { error } = await (supabase as any).rpc('reject_admin_request', {
        _user_id: profile.id, _reason: reason.trim(),
      });
      if (error) throw error;
      toast({ title: 'Solicitação reprovada' });
      setRejecting(false);
      setReason('');
      await load();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setActing(false);
    }
  };

  if (loading) return <div className="p-4 sm:p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!profile) return (
    <div className="p-4 sm:p-6 space-y-3">
      <p className="text-sm text-muted-foreground">Solicitação não encontrada.</p>
      <Button variant="outline" onClick={() => nav('/admin/usuarios/solicitacoes')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
      </Button>
    </div>
  );

  const notifBadge = (s: string): 'default' | 'destructive' | 'secondary' | 'outline' =>
    s === 'sent' ? 'default' : s === 'partial' ? 'secondary' : 'destructive';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link to="/admin/usuarios/solicitacoes" className="inline-flex items-center hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Solicitações
            </Link>
          </div>
          <h1 className="text-2xl font-display flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> Detalhes da solicitação
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {requestPermalink && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(requestPermalink, 'Link da solicitação')}
              title="Copiar link permanente desta solicitação"
            >
              <Link2 className="w-4 h-4 mr-1" /> Copiar link
            </Button>
          )}
          {pendingRequest && !isAdmin && (
            <>
              <Button variant="destructive" onClick={() => setRejecting(true)} disabled={acting}>
                <X className="w-4 h-4 mr-1" /> Reprovar
              </Button>
              <Button onClick={approve} disabled={acting || roleRefreshing}>
                <Check className="w-4 h-4 mr-1" />
                {acting || roleRefreshing ? 'Aprovando…' : 'Aprovar'}
              </Button>
            </>
          )}
        </div>
      </div>

      {pendingRequest && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4" /> Reenviar notificação aos administradores
            </CardTitle>
            <CardDescription className="text-xs">
              Cooldown de {COOLDOWN_SECONDS}s por solicitação. O motivo será gravado na auditoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={resendReason}
              onChange={(e) => setResendReason(e.target.value.slice(0, 500))}
              placeholder='Motivo / observação (ex.: "cliente solicitou", "primeiro envio rejeitado")'
              maxLength={500}
              disabled={resending || cooldown > 0}
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[11px] text-muted-foreground">
                {resendReason.length}/500 caracteres · opcional, mas recomendado para rastreabilidade.
              </span>
              <Button
                onClick={resendNotification}
                disabled={resending || cooldown > 0}
                title={cooldown > 0 ? `Aguarde ${cooldown}s para reenviar` : 'Reenviar e-mail aos admins'}
              >
                <Send className="w-4 h-4 mr-1" />
                {resending
                  ? 'Enviando…'
                  : cooldown > 0
                    ? `Reenviar (${cooldown}s)`
                    : 'Reenviar notificação'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usuário</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div><span className="text-muted-foreground">user_id:</span> <code className="text-xs">{profile.id}</code></div>
          {pendingRequest && (
            <div><span className="text-muted-foreground">request_id:</span> <code className="text-xs">{pendingRequest.id}</code></div>
          )}
          <div><span className="text-muted-foreground">E-mail:</span> {profile.email}</div>
          <div><span className="text-muted-foreground">Nome:</span> {profile.full_name || '—'}</div>
          <div>
            <span className="text-muted-foreground">Status atual:</span>{' '}
            {isAdmin
              ? <Badge>Admin</Badge>
              : pendingRequest
                ? <Badge variant="secondary">Em análise</Badge>
                : lastRequest?.status === 'denied'
                  ? <Badge variant="destructive">Reprovada</Badge>
                  : lastRequest?.status === 'approved'
                    ? <Badge>Aprovada</Badge>
                    : <Badge variant="outline">Sem solicitação</Badge>}
          </div>
          <div>
            <span className="text-muted-foreground">Última solicitação em:</span>{' '}
            {lastRequestedAt ? new Date(lastRequestedAt).toLocaleString('pt-BR') : '—'}
          </div>
          {lastRequest?.rejection_reason && (
            <div>
              <span className="text-muted-foreground">Motivo da reprovação:</span>{' '}
              {lastRequest.rejection_reason}
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Última atualização do perfil:</span>{' '}
            {new Date(profile.updated_at).toLocaleString('pt-BR')}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5" /> Histórico de alterações
          </CardTitle>
          <CardDescription>{audit.length} evento(s) na auditoria.</CardDescription>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum evento registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Por</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell><Badge variant={a.status === 'success' ? 'default' : a.status === 'rejected' || a.status === 'error' ? 'destructive' : 'secondary'}>{a.status}</Badge></TableCell>
                      <TableCell className="text-xs">{a.promoted_by_email || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.message || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5" /> Tentativas de notificação por e-mail
          </CardTitle>
          <CardDescription>{notifications.length} envio(s) registrado(s).</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhuma tentativa de notificação registrada para este usuário.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Admins</TableHead>
                    <TableHead>Enviados</TableHead>
                    <TableHead>Erro / Log</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((n) => {
                    const reason = n.details?.reason as string | undefined;
                    const sourceTag = (n.details?.source as string | undefined) || 'trigger';
                    return (
                      <TableRow key={n.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(n.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell><Badge variant={notifBadge(n.status)}>{n.status}</Badge></TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px]">
                            {sourceTag === 'manual_resend' ? 'Reenvio manual' : 'Automático'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] break-words">
                          {reason || <span className="opacity-50">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">{n.admin_count}</TableCell>
                        <TableCell className="text-xs">{n.sent_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-md break-words">
                          <div className="flex flex-col gap-2">
                            {n.error_message ? (
                              <div className="flex items-start gap-2">
                                <pre className="whitespace-pre-wrap break-words text-xs flex-1 m-0 font-mono">
                                  {n.error_message}
                                </pre>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  onClick={() => copyToClipboard(n.error_message!, 'Mensagem de erro')}
                                  title="Copiar mensagem de erro"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <span className="opacity-60">sem erro</span>
                            )}
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] px-2"
                                onClick={() => copyToClipboard(buildLogPayload(n), 'Log completo')}
                                title="Copiar log/causa completa (JSON + erro)"
                              >
                                <FileText className="w-3 h-3 mr-1" /> Copiar log
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={rejecting} onOpenChange={(o) => { if (!o) { setRejecting(false); setReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reprovar solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Informe um motivo claro. O usuário poderá solicitar novamente após 24 h.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
            placeholder="Motivo da reprovação (mín. 3 caracteres)" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); reject(); }}
              disabled={acting || reason.trim().length < 3}
            >Confirmar reprovação</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminAccessRequestDetail;
