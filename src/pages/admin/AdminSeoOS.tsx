/**
 * Fase 13.2 — SEO Operating System (admin / safe-mode).
 * Página de leitura e diagnóstico operacional.
 * Snapshots manuais persistem em seo_operational_snapshots.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Camera } from "lucide-react";

import { computeTelemetry, type TelemetrySnapshot } from "@/lib/seoTelemetry";
import { buildOperationalReport } from "@/lib/seoOperatingSystem";
import { detectExecutionBottlenecks, prioritizeBottlenecks } from "@/lib/executionBottlenecks";
import { buildCapacityScenarios, estimateExecutionHours, estimateEditorialLoad, estimateRecoveryLoad, estimateMaintenanceLoad } from "@/lib/capacityPlanner";
import { buildPressureMap } from "@/lib/strategicPressure";

import OperationalScoreCard from "@/components/admin/OperationalScoreCard";
import ExecutionLoadMeter from "@/components/admin/ExecutionLoadMeter";
import BottleneckMatrix from "@/components/admin/BottleneckMatrix";
import PressureHeatmap from "@/components/admin/PressureHeatmap";
import OperationalDebtCard from "@/components/admin/OperationalDebtCard";
import RecoveryCapacityGauge from "@/components/admin/RecoveryCapacityGauge";
import VelocityTimeline, { type VelocityPoint } from "@/components/admin/VelocityTimeline";
import ExecutionQueuePanel from "@/components/admin/ExecutionQueuePanel";

interface SnapRow {
  id: string;
  snapshot_date: string;
  operational_score: number;
  editorial_velocity: number;
  semantic_velocity: number;
  authority_velocity: number;
  recovery_capacity: number;
  risk_pressure: number;
  fragmentation_score: number;
  operational_debt: number;
  notes: string | null;
}

export default function AdminSeoOS() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<SnapRow[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      // Telemetry mínima a partir de produtos ativos. Safe-mode: somente leitura.
      const { data: products } = await supabase
        .from("products")
        .select("id, slug, is_active")
        .eq("is_active", true)
        .limit(500);

      const items = (products ?? []).map((p) => ({
        id: p.id, slug: p.slug, type: "product" as const,
        authority_score: 50, readiness_score: 55,
        internal_links_count: 3, thin_content_risk: false,
        cannibalization_risk: "low" as const,
      }));
      const t = computeTelemetry(items as any);
      setTelemetry(t);

      const { data: snaps } = await supabase
        .from("seo_operational_snapshots")
        .select("id, snapshot_date, operational_score, editorial_velocity, semantic_velocity, authority_velocity, recovery_capacity, risk_pressure, fragmentation_score, operational_debt, notes")
        .order("snapshot_date", { ascending: false })
        .limit(30);
      setHistory((snaps ?? []) as SnapRow[]);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar SEO OS", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const report = useMemo(() => telemetry ? buildOperationalReport(telemetry) : null, [telemetry]);
  const bottlenecks = useMemo(() => telemetry ? prioritizeBottlenecks(detectExecutionBottlenecks(telemetry)) : [], [telemetry]);
  const pressure = useMemo(() => telemetry ? buildPressureMap(telemetry) : [], [telemetry]);
  const scenarios = useMemo(() => telemetry ? buildCapacityScenarios(telemetry) : [], [telemetry]);

  const velocityPoints: VelocityPoint[] = useMemo(
    () => [...history].reverse().map((h) => ({
      date: h.snapshot_date,
      editorial: h.editorial_velocity,
      semantic: h.semantic_velocity,
      authority: h.authority_velocity,
    })),
    [history]
  );

  async function captureSnapshot() {
    if (!telemetry || !report) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("seo_operational_snapshots").insert({
        operational_score: report.score,
        execution_capacity: report.executionCapacity,
        editorial_velocity: report.editorialVelocity,
        semantic_velocity: report.semanticVelocity,
        authority_velocity: report.authorityVelocity,
        recovery_capacity: report.recoveryCapacity,
        risk_pressure: report.riskPressure,
        fragmentation_score: report.fragmentationScore,
        operational_debt: report.operationalDebt,
        editorial_backlog: telemetry.content_gap_count ?? 0,
        thin_content_entities: telemetry.thinContent ?? 0,
        orphan_entities: telemetry.orphan_entities ?? 0,
        blocked_entities: telemetry.blocked ?? 0,
        high_potential_entities: telemetry.quick_win_score ?? 0,
        strong_clusters: 0,
        weak_clusters: telemetry.fragile_cluster_count ?? 0,
        collapsing_clusters: 0,
        saturation_pressure: telemetry.saturation_score ?? 0,
        notes: notes || null,
      });
      if (error) throw error;
      toast({ title: "Snapshot capturado" });
      setNotes("");
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao salvar snapshot", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !telemetry || !report) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando SEO Operating System…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">SEO Operating System</h1>
          <p className="text-sm text-muted-foreground">Camada operacional interna — leitura/diagnóstico (Safe Mode absoluto).</p>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="Notas opcionais do snapshot…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[42px] h-[42px] w-72 resize-none"
          />
          <Button onClick={captureSnapshot} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
            Capturar Snapshot Operacional
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <OperationalScoreCard report={report} />
        <ExecutionLoadMeter load={report.executionLoad} capacity={report.executionCapacity} />
        <RecoveryCapacityGauge capacity={report.recoveryCapacity} complexity={report.recoveryComplexity} />
      </div>

      <Tabs defaultValue="os" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="os">Operating System</TabsTrigger>
          <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
          <TabsTrigger value="debt">Operational Debt</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="fragmentation">Fragmentation</TabsTrigger>
          <TabsTrigger value="velocity">Velocity</TabsTrigger>
          <TabsTrigger value="pressure">Pressure</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="queue">Execution Queue</TabsTrigger>
          <TabsTrigger value="compounding">Compounding</TabsTrigger>
          <TabsTrigger value="resilience">Resilience</TabsTrigger>
        </TabsList>

        <TabsContent value="os" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Diagnóstico</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
              <Block title="Bloqueios" items={report.blockers} tone="text-red-600" />
              <Block title="Forças" items={report.strengths} tone="text-emerald-600" />
              <Block title="Recomendações" items={report.recommendations} tone="text-foreground" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bottlenecks" className="mt-4">
          <BottleneckMatrix items={bottlenecks} />
        </TabsContent>

        <TabsContent value="capacity" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Cenários de capacidade</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {scenarios.map((s) => (
                  <div key={s.scenario} className="rounded-md border p-3">
                    <div className="font-medium capitalize">{s.scenario}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.weeklyHours}h/sem · {s.expectedEntitiesPerMonth} entidades/mês
                    </div>
                    <div className="mt-2 text-sm">ROI esperado: <span className="font-mono">{s.expectedROI}</span></div>
                    <div className="text-xs">Ganho autoridade: <span className="font-mono">{s.expectedAuthorityGain}</span></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debt" className="mt-4">
          <OperationalDebtCard
            debt={report.operationalDebt}
            breakdown={[
              { label: "Thin content", value: telemetry.thinContent },
              { label: "Órfãs", value: telemetry.orphan_entities },
              { label: "Lacunas", value: telemetry.content_gap_count },
              { label: "Bloqueadas", value: telemetry.blocked },
              { label: "Overlinked", value: telemetry.overlinked_pages },
            ]}
          />
        </TabsContent>

        <TabsContent value="recovery" className="mt-4">
          <RecoveryCapacityGauge capacity={report.recoveryCapacity} complexity={report.recoveryComplexity} />
        </TabsContent>

        <TabsContent value="fragmentation" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Fragmentação semântica</CardTitle></CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{report.fragmentationScore}</div>
              <p className="text-sm text-muted-foreground mt-2">
                Loops semânticos: {telemetry.semantic_loop_count} · Clusters frágeis: {telemetry.fragile_cluster_count}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="velocity" className="mt-4">
          <VelocityTimeline points={velocityPoints} />
        </TabsContent>

        <TabsContent value="pressure" className="mt-4">
          <PressureHeatmap items={pressure} />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Carga de manutenção</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3 text-sm">
              <Stat label="Editorial" value={estimateEditorialLoad(telemetry)} />
              <Stat label="Recuperação" value={estimateRecoveryLoad(telemetry)} />
              <Stat label="Manutenção" value={estimateMaintenanceLoad(telemetry)} />
              <Stat label="Total horas (proxy)" value={estimateExecutionHours(telemetry)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="mt-4">
          <ExecutionQueuePanel title="Fila operacional" items={[]} />
          <p className="text-xs text-muted-foreground mt-2">
            Conecta-se às decisões do War Room. Sem decisões carregadas neste contexto.
          </p>
        </TabsContent>

        <TabsContent value="compounding" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Compounding semântico</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Projeção heurística: ações com ROI ≥ 60 e confiança ≥ 0,6 geram efeito de composição.
              Use o War Room para detalhar os candidatos.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resilience" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Resiliência</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3 text-sm">
              <Stat label="Estabilidade semântica" value={telemetry.semantic_stability_score} />
              <Stat label="Entropia autoridade" value={telemetry.authority_entropy} />
              <Stat label="Equilíbrio semântico" value={telemetry.semantic_balance_score} />
              <Stat label="Volatilidade" value={telemetry.volatility_score} invert />
              <Stat label="Dificuldade recuperação" value={telemetry.recovery_difficulty_avg} invert />
              <Stat label="Concentração" value={telemetry.overcentralization_risk} invert />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Block({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <h3 className="font-medium mb-2">{title}</h3>
      <ul className={`space-y-1 ${tone}`}>
        {items.length ? items.map((s, i) => <li key={i}>• {s}</li>) : <li className="text-muted-foreground">—</li>}
      </ul>
    </div>
  );
}

function Stat({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const good = invert ? value < 40 : value >= 60;
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${good ? "text-emerald-600" : ""}`}>{value}</div>
    </div>
  );
}
