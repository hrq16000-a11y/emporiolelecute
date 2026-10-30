import { Helmet } from "react-helmet-async";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useContactInfo } from '@/hooks/useContactInfo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ShieldAlert, CheckCircle2, MessageCircle, LogOut } from 'lucide-react';

const AcessoRestrito = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading, signOut } = useAuth();
  const { buildWhatsappUrl } = useContactInfo();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/admin/login', { replace: true });
    if (!loading && user && isAdmin) navigate('/admin', { replace: true });
  }, [user, isAdmin, loading, navigate]);

  // Pre-load existing pending request
  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from('admin_access_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: { id: string } | null }) => {
        if (data?.id) setRequested(true);
      });
  }, [user]);

  const handleRequest = async () => {
    if (!user || submitting || requested) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('request_admin_access');
      if (error) {
        // pending or rate_limit → still show the persistent "in review" state
        const isPendingOrLimited = /análise|24 horas|recente/i.test(error.message);
        if (isPendingOrLimited) setRequested(true);
        toast({
          title: isPendingOrLimited ? 'Solicitação em análise' : 'Erro ao solicitar',
          description: error.message,
          variant: isPendingOrLimited ? 'default' : 'destructive',
        });
        return;
      }

      setRequested(true);
      toast({ title: 'Solicitação enviada', description: 'Aguarde a aprovação de um administrador.' });

      const msg = `Olá! Solicito acesso administrativo ao painel.\nE-mail: ${user.email}\nUsuário: ${user.id}`;
      window.open(buildWhatsappUrl(msg), '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast({ title: 'Erro ao solicitar', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>Acesso restrito</title>
        <meta name="robots" content="noindex,follow" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream to-background p-4">
      <Card className="w-full max-w-md shadow-medium">
        <CardHeader className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-display">Acesso Restrito</CardTitle>
          <CardDescription>
            Sua conta não tem permissão de administrador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">E-mail:</span> <strong className="break-all">{user.email}</strong></div>
            <div><span className="text-muted-foreground">Provedor:</span> {user.app_metadata?.provider || '—'}</div>
            <div><span className="text-muted-foreground">Role admin:</span> <strong className="text-destructive">não</strong></div>
          </div>

          {requested ? (
            <>
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3 items-start">
                <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong className="block text-amber-700 dark:text-amber-300">Solicitação em análise</strong>
                  <span className="text-muted-foreground">Você será notificado por e-mail assim que um administrador aprovar seu acesso.</span>
                </div>
              </div>
              <Button disabled className="w-full" size="lg" variant="secondary">
                <MessageCircle className="w-4 h-4 mr-2" />
                Solicitação em análise pela administração
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Clique abaixo para solicitar acesso. Registramos sua solicitação no painel e abrimos o WhatsApp como canal alternativo de contato.
              </p>
              <Button onClick={handleRequest} disabled={submitting} className="w-full" size="lg">
                <MessageCircle className="w-4 h-4 mr-2" />
                {submitting ? 'Enviando...' : 'Solicitar Acesso Administrativo'}
              </Button>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={async () => { await signOut(); navigate('/admin/login'); }}>
              <LogOut className="w-4 h-4 mr-2" />
              Trocar de conta
            </Button>
            <Button variant="ghost" className="flex-1" asChild>
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
};

export default AcessoRestrito;
