/**
 * Fase 13.3 — SEO Control Tower (admin / safe-mode).
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
import { buildControlTowerReport } from "@/lib/seoControlTower";
import { buildWasteMap } from "@/lib/operationalWaste";
import { buildResilienceReport } from "@/lib/resilienceEngine";
import { buildExecutionMap } from "@/lib/executionIntelligence";
import {
  estimateOperationalCollapseRisk, estimateMaintenanceExplosionRisk,
  estimateSemanticFatigue, estimateExecutionDrift, calculateSystemSustainability,
} from "@/lib/seoOperatingSystem";
import {
  calculateRecoveryPressure, calculateExecutionPressure,
  calculateMaintenancePressure, calculateEntropyPressure, calculateStrategicFatigue,
} from "@/lib/strategicPressure";

import SystemHealthCard from "@/components/admin/SystemHealthCard";
import SustainabilityGauge from "@/components/admin/SustainabilityGauge";
import OperationalWastePanel from "@/components/admin/OperationalWastePanel";
import CollapseRiskCard from "@/components/admin/CollapseRiskCard";
import StrategicAlignmentMeter from "@/components/admin/StrategicAlignmentMeter";
import ExecutionDriftTimeline, { type DriftPoint } from "@/components/admin/ExecutionDriftTimeline";
import SemanticFatigueCard from "@/components/admin/SemanticFatigueCard";
import ResilienceMatrix from "@/components/admin/ResilienceMatrix";

interface SnapRow {
  id: string;
  snapshot_date: string;
  system_health_score: number;
  sustainability_score: number;
  execution_efficiency: number;
  execution_focus: number;
  notes: string | null;
}

export default function AdminSeoControlTower() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [history, setHistory] = useState<SnapRow[]>([]);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: products } = await supabase
        .from("products").select("id, slug, is_active").eq("is_active", true).limit(500);
      const items = (products ?? []).map((p) => ({
        id: p.id, slug: p.slug, type: "product" as const,
        authority_score: 50, readiness_score: 55, internal_links_count: 3,
        thin_content_risk: false, cannibalization_risk: "low" as const,
      }));
      setTelemetry(computeTelemetry(items as any));
      const { data: snaps } = await supabase
        .from("seo_system_health_snapshots")
        .select("id, snapshot_date, system_health_score, sustainability_score, execution_efficiency, execution_focus, notes")
        .order("snapshot_date", { ascending: false }).limit(30);
      setHistory((snaps ?? []) as SnapRow[]);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar Control Tower", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const report = useMemo(() => telemetry ? buildControlTowerReport(telemetry) : null, [telemetry]);
  const waste = useMemo(() => telemetry ? buildWasteMap(telemetry) : [], [telemetry]);
  const resilience = useMemo(() => telemetry ? buildResilienceReport(telemetry) : null, [telemetry]);
  const execMap = useMemo(() => telemetry ? buildExecutionMap(telemetry) : null, [telemetry]);
  const collapseRisk = useMemo(() => telemetry ? estimateOperationalCollapseRisk(telemetry) : 0, [telemetry]);
  const maintExplosion = useMemo(() => telemetry ? estimateMaintenanceExplosionRisk(telemetry) : 0, [telemetry]);
  const semanticFatigue = useMemo(() => telemetry ? estimateSemanticFatigue(telemetry) : 0, [telemetry]);
  const drift = useMemo(() => telemetry ? estimateExecutionDrift(telemetry) : 0, [telemetry]);
  const sustainability = useMemo(() => telemetry ? calculateSystemSustainability(telemetry) : 0, [telemetry]);

  const driftPoints: DriftPoint[] = useMemo(() => history.slice().reverse().map((h) => ({
    date: h.snapshot_date,
    drift: Math.max(0, 100 - (h.execution_focus ?? 0)),
    focus: h.execution_focus ?? 0,
    momentum: h.execution_efficiency ?? 0,
  })), [history]);

  async function captureSnapshot() {
    if (!telemetry || !report || !resilience || !execMap) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("seo_system_health_snapshots").insert({
        system_health_score: report.score,
        sustainability_score: sustainability,
        execution_efficiency: report.executionEfficiency,
        semantic_efficiency: report.semanticEfficiency,
        authority_efficiency: report.authorityEfficiency,
        operational_waste: report.operationalWaste,
        recovery_backlog: telemetry.content_gap_count ?? 0,
        strategic_alignment: report.strategicAlignment,
        execution_focus: report.focusScore,
        volatility_pressure: telemetry.volatility_score ?? 0,
        saturation_pressure: telemetry.saturation_score ?? 0,
        semantic_fragmentation: telemetry.fragmentation_score ?? 0,
        orphan_pressure: telemetry.orphan_entities ?? 0,
        content_decay_pressure: telemetry.content_decay_score ?? 0,
        competitive_pressure: telemetry.under_monetized_score ?? 0,
        system_resilience: resilience.systemResilience,
        cluster_stability: resilience.clusterResilience,
        execution_noise: report.executionNoise,
        notes: notes || null,
      });
      if (error) throw error;
      toast({ title: "Snapshot sistêmico capturado" });
      setNotes("");
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao salvar snapshot", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  if (loading || !telemetry || !report || !resilience || !execMap) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando Control Tower…</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">SEO Control Tower</h1>
          <p className="text-sm text-muted-foreground">Coordenação estratégica e inteligência de execução (Safe Mode absoluto).</p>
        </div>
        <div className="flex items-end gap-2">
          <Textarea placeholder="Notas opcionais…" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="min-h-[42px] h-[42px] w-72 resize-none" />
          <Button onClick={captureSnapshot} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
            Capturar Snapshot Sistêmico
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <SystemHealthCard report={report} />
        <SustainabilityGauge score={sustainability} />
        <CollapseRiskCard risk={collapseRisk} recoveryWeeks={resilience.recoveryWindowWeeks} />
        <SemanticFatigueCard fatigue={semanticFatigue} saturation={telemetry.saturation_score} exhaustion={telemetry.topic_exhaustion_score} />
      </div>

      <Tabs defaultValue="health" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="sustain">Sustainability</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
          <TabsTrigger value="waste">Operational Waste</TabsTrigger>
          <TabsTrigger value="resilience">Resilience</TabsTrigger>
          <TabsTrigger value="collapse">Collapse Risk</TabsTrigger>
          <TabsTrigger value="alignment">Strategic Alignment</TabsTrigger>
          <TabsTrigger value="focus">Focus</TabsTrigger>
          <TabsTrigger value="drift">Execution Drift</TabsTrigger>
          <TabsTrigger value="fatigue">Semantic Fatigue</TabsTrigger>
          <TabsTrigger value="cascade">Cascade Risks</TabsTrigger>
          <TabsTrigger value="summary">Executive Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="mt-4 grid md:grid-cols-3 gap-4">
          <Block title="Bloqueios" items={report.blockers} tone="text-red-600" />
          <Block title="Forças" items={report.strengths} tone="text-emerald-600" />
          <Block title="Avisos" items={report.warnings} tone="text-amber-600" />
        </TabsContent>

        <TabsContent value="sustain" className="mt-4">
          <SustainabilityGauge score={sustainability} />
        </TabsContent>

        <TabsContent value="efficiency" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Eficiência</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3 text-sm">
              <Stat label="Execução" v={report.executionEfficiency} />
              <Stat label="Semântica" v={report.semanticEfficiency} />
              <Stat label="Autoridade" v={report.authorityEfficiency} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waste" className="mt-4">
          <OperationalWastePanel items={waste} />
        </TabsContent>

        <TabsContent value="resilience" className="mt-4">
          <ResilienceMatrix report={resilience} />
        </TabsContent>

        <TabsContent value="collapse" className="mt-4 grid md:grid-cols-2 gap-4">
          <CollapseRiskCard risk={collapseRisk} recoveryWeeks={resilience.recoveryWindowWeeks} />
          <Card>
            <CardHeader><CardTitle className="text-base">Risco de explosão de manutenção</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-5xl font-bold ${maintExplosion >= 60 ? "text-red-600" : "text-amber-600"}`}>{maintExplosion}</div>
              <p className="text-sm text-muted-foreground mt-2">Indica pressão futura de manutenção.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alignment" className="mt-4">
          <StrategicAlignmentMeter alignment={report.strategicAlignment} focus={report.focusScore} drift={drift} />
        </TabsContent>

        <TabsContent value="focus" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Foco operacional</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3 text-sm">
              <Stat label="Foco" v={execMap.focusEfficiency} />
              <Stat label="Momentum" v={execMap.momentum} />
              <Stat label="Dispersão" v={execMap.dispersion} invert />
              <Stat label="Estabilidade" v={execMap.stability} />
              <Stat label="Ruído" v={report.executionNoise} invert />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drift" className="mt-4">
          <ExecutionDriftTimeline points={driftPoints} />
        </TabsContent>

        <TabsContent value="fatigue" className="mt-4">
          <SemanticFatigueCard fatigue={semanticFatigue} saturation={telemetry.saturation_score} exhaustion={telemetry.topic_exhaustion_score} />
        </TabsContent>

        <TabsContent value="cascade" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Risco de cascata</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-3 text-sm">
              <Stat label="Cascade failure" v={resilience.cascadeFailureRisk} invert />
              <Stat label="Pressão recuperação" v={calculateRecoveryPressure(telemetry)} invert />
              <Stat label="Pressão execução" v={calculateExecutionPressure(telemetry)} invert />
              <Stat label="Pressão manutenção" v={calculateMaintenancePressure(telemetry)} invert />
              <Stat label="Pressão entropia" v={calculateEntropyPressure(telemetry)} invert />
              <Stat label="Fadiga estratégica" v={calculateStrategicFatigue(telemetry)} invert />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Resumo executivo</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{report.executiveSummary}</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Block title="Prioridades" items={report.priorities} tone="text-foreground" />
                <Block title="Ineficiências" items={report.inefficiencies} tone="text-amber-700" />
              </div>
              {execMap.diagnostics.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Diagnóstico de execução</div>
                  <ul className="space-y-1">{execMap.diagnostics.map((d, i) => <li key={i}>• {d}</li>)}</ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Block({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <ul className={`space-y-1 text-sm ${tone}`}>
          {items.length ? items.map((s, i) => <li key={i}>• {s}</li>) : <li className="text-muted-foreground">—</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

function Stat({ label, v, invert }: { label: string; v: number; invert?: boolean }) {
  const good = invert ? v < 40 : v >= 60;
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${good ? "text-emerald-600" : ""}`}>{v}</div>
    </div>
  );
}
