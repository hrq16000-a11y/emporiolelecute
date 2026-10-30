import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BellRing, CheckCircle2, XCircle, MinusCircle, Loader2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Step {
  step: string;
  status: 'success' | 'error' | 'skipped';
  detail: string;
}

interface TestResult {
  ok: boolean;
  channel: 'push' | 'email' | 'none';
  email: string;
  order_code: string;
  devices: number;
  steps: Step[];
  tested_at: string;
}

const STEP_ICON = {
  success: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  error: <XCircle className="w-4 h-4 text-destructive" />,
  skipped: <MinusCircle className="w-4 h-4 text-muted-foreground" />,
};

const CHANNEL_LABEL: Record<TestResult['channel'], string> = {
  push: 'Entregue por Web Push',
  email: 'Fallback por e-mail utilizado',
  none: 'Nenhum canal entregou a notificação',
};

export default function AdminNotificationTest() {
  const [email, setEmail] = useState('');
  const [orderCode, setOrderCode] = useState('');
  const [fallback, setFallback] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Informe um e-mail válido.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('notification-test', {
        body: {
          email: email.trim(),
          order_code: orderCode.trim() || undefined,
          send_email_fallback: fallback,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setResult(data as TestResult);
      const res = data as TestResult;
      if (res.ok) toast.success(CHANNEL_LABEL[res.channel]);
      else toast.error('Nenhum canal conseguiu entregar. Veja o resumo.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao executar o teste.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BellRing className="w-5 h-5 text-primary" />
          Teste de notificações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simula um aviso de mudança de status: tenta Web Push nos dispositivos inscritos e usa e-mail como
          fallback automático quando o push não chega.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Executar teste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="test-email">E-mail do cliente</Label>
              <Input
                id="test-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="test-code">Código do pedido (opcional)</Label>
              <Input
                id="test-code"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                placeholder="LC123456"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="test-fallback" className="text-sm">Enviar e-mail se o push falhar</Label>
              <p className="text-xs text-muted-foreground">Reproduz exatamente o comportamento real do sistema.</p>
            </div>
            <Switch id="test-fallback" checked={fallback} onCheckedChange={setFallback} />
          </div>

          <Button onClick={runTest} disabled={loading} className="min-h-[44px]">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BellRing className="w-4 h-4 mr-2" />}
            {loading ? 'Testando…' : 'Enviar notificação de teste'}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Resumo do teste</CardTitle>
            <Badge variant={result.ok ? 'default' : 'destructive'} className={result.ok && result.channel === 'push' ? 'bg-green-600' : undefined}>
              {result.channel === 'email' && <Mail className="w-3 h-3 mr-1" />}
              {CHANNEL_LABEL[result.channel]}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {result.email} · pedido {result.order_code} · {result.devices} dispositivo(s) ·{' '}
              {new Date(result.tested_at).toLocaleString('pt-BR')}
            </p>
            <ul className="divide-y rounded-lg border">
              {result.steps.map((step) => (
                <li key={step.step} className="flex items-start gap-3 p-3">
                  <span className="mt-0.5">{STEP_ICON[step.status]}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{step.step}</p>
                    <p className="text-xs text-muted-foreground break-words">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
