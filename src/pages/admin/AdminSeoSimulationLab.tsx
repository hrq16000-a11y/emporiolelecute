import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { computeTelemetry } from "@/lib/seoTelemetry";
import {
  buildDigitalTwin,
  simulateGrowthScenario,
  simulateDecayScenario,
  simulateRecoveryScenario,
  simulateCollapseScenario,
  simulateExpansionScenario,
  simulateAuthorityRedistribution,
  simulateClusterEvolution,
  simulateOperationalStress,
  type ScenarioType,
} from "@/lib/seoDigitalTwin";
import { runStressTest } from "@/lib/stressTesting";
import {
  forecastSystemEvolution,
  forecastAuthorityCompounding,
  forecastExecutionFatigue,
  forecastRecoveryCapacity,
  buildFutureScenarios,
} from "@/lib/futureForecast";
import { runAllInvestments } from "@/lib/strategicSimulator";
import {
  estimateCascadePropagation,
  estimateCriticalFailureProbability,
  estimateLongTermResilience,
  simulateRecoveryElasticity,
} from "@/lib/resilienceEngine";

import SimulationScenarioCard from "@/components/admin/SimulationScenarioCard";
import StressLevelGauge from "@/components/admin/StressLevelGauge";
import ForecastTimeline from "@/components/admin/ForecastTimeline";
import CollapseProbabilityCard from "@/components/admin/CollapseProbabilityCard";
import GrowthProjectionPanel from "@/components/admin/GrowthProjectionPanel";
import SimulationConfidenceBadge from "@/components/admin/SimulationConfidenceBadge";
import ResilienceForecastMatrix from "@/components/admin/ResilienceForecastMatrix";
import StrategicInvestmentSimulator from "@/components/admin/StrategicInvestmentSimulator";

export default function AdminSeoSimulationLab() {
  // SAFE: usa telemetria vazia (zerada) — somente leitura, sem modificar nada público.
  const telemetry = useMemo(() => computeTelemetry([]), []);

  const [scenario, setScenario] = useState<ScenarioType>("balanced");
  const [horizonWeeks, setHorizonWeeks] = useState(12);
  const [name, setName] = useState("Simulação manual");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const twin = useMemo(() => buildDigitalTwin(telemetry), [telemetry]);
  const growth = useMemo(() => simulateGrowthScenario(telemetry, scenario, horizonWeeks), [telemetry, scenario, horizonWeeks]);
  const decay = useMemo(() => simulateDecayScenario(telemetry), [telemetry]);
  const recovery = useMemo(() => simulateRecoveryScenario(telemetry), [telemetry]);
  const collapse = useMemo(() => simulateCollapseScenario(telemetry), [telemetry]);
  const expansion = useMemo(() => simulateExpansionScenario(telemetry), [telemetry]);
  const authRedistribution = useMemo(() => simulateAuthorityRedistribution(telemetry), [telemetry]);
  const clusterEvo = useMemo(() => simulateClusterEvolution(telemetry, horizonWeeks), [telemetry, horizonWeeks]);
  const opStress = useMemo(() => simulateOperationalStress(telemetry), [telemetry]);
  const stress = useMemo(() => runStressTest(telemetry), [telemetry]);
  const forecast = useMemo(() => forecastSystemEvolution(telemetry), [telemetry]);
  const scenarios = useMemo(() => buildFutureScenarios(telemetry), [telemetry]);
  const investments = useMemo(() => runAllInvestments(telemetry), [telemetry]);
  const cascade = useMemo(() => estimateCascadePropagation(telemetry), [telemetry]);
  const criticalProb = useMemo(() => estimateCriticalFailureProbability(telemetry), [telemetry]);
  const longTermResilience = useMemo(() => estimateLongTermResilience(telemetry), [telemetry]);
  const elasticity = useMemo(() => simulateRecoveryElasticity(telemetry), [telemetry]);

  const handleRunSimulation = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("seo_simulation_runs").insert({
        simulation_name: name || "Simulação manual",
        simulation_type: "digital_twin",
        scenario_type: scenario,
        input_snapshot: telemetry as never,
        simulation_inputs: { scenario, horizonWeeks } as never,
        predicted_authority: growth.authority,
        predicted_semantic_coverage: growth.semanticCoverage,
        predicted_resilience: growth.resilience,
        predicted_operational_load: growth.operationalLoad,
        predicted_execution_cost: growth.executionCost,
        predicted_growth_velocity: growth.growthVelocity,
        predicted_decay_risk: growth.decayRisk,
        predicted_collapse_risk: growth.collapseRisk,
        predicted_saturation: growth.saturation,
        predicted_roi: growth.roi,
        predicted_cluster_health: growth.clusterHealth,
        predicted_recovery_time: growth.recoveryTime,
        confidence_score: growth.confidence,
        simulation_notes: notes || null,
      });
      if (error) throw error;
      toast.success("Simulação registrada com sucesso");
      setNotes("");
    } catch (e) {
      toast.error("Erro ao registrar simulação: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">SEO Simulation Lab</h1>
          <p className="text-sm text-muted-foreground">
            Digital Twin do ecossistema SEO. Simulações 100% read-only — nenhum efeito público.
          </p>
        </div>
        <SimulationConfidenceBadge confidence={growth.confidence} />
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Executar Simulação</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Cenário</label>
            <select
              className="w-full border rounded h-10 px-3 bg-background"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as ScenarioType)}
            >
              {(["conservative", "balanced", "aggressive", "unstable", "recovery", "collapse"] as ScenarioType[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Horizonte (semanas)</label>
            <Input type="number" min={1} max={104} value={horizonWeeks} onChange={(e) => setHorizonWeeks(Number(e.target.value) || 12)} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleRunSimulation} disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Executar Simulação"}
            </Button>
          </div>
        </div>
        <Textarea placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Card>

      <Tabs defaultValue="twin">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="twin">Digital Twin</TabsTrigger>
          <TabsTrigger value="growth">Growth</TabsTrigger>
          <TabsTrigger value="collapse">Collapse</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="stress">Stress Testing</TabsTrigger>
          <TabsTrigger value="forecast">Future Forecast</TabsTrigger>
          <TabsTrigger value="cluster">Cluster Evolution</TabsTrigger>
          <TabsTrigger value="authority">Authority</TabsTrigger>
          <TabsTrigger value="ops">Op Stress</TabsTrigger>
          <TabsTrigger value="sustain">Sustainability</TabsTrigger>
          <TabsTrigger value="roi">ROI</TabsTrigger>
          <TabsTrigger value="summary">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="twin" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Digital Twin atual</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {Object.entries(twin).map(([k, val]) => (
                <div key={k} className="flex justify-between border-b border-border/40 py-1">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{Math.round(Number(val))}</span>
                </div>
              ))}
            </div>
          </Card>
          <GrowthProjectionPanel projection={growth} />
        </TabsContent>

        <TabsContent value="growth" className="grid gap-4 md:grid-cols-2">
          <SimulationScenarioCard projection={growth} />
          <SimulationScenarioCard projection={expansion} />
        </TabsContent>

        <TabsContent value="collapse" className="grid gap-4 md:grid-cols-2">
          <SimulationScenarioCard projection={collapse} />
          <CollapseProbabilityCard probability={criticalProb} />
          <Card className="p-4 space-y-2">
            <h4 className="font-medium text-sm">Propagação em Cascata</h4>
            <p className="text-sm">Imediata: <strong>{cascade.immediate}%</strong></p>
            <p className="text-sm">Curto prazo: <strong>{cascade.shortTerm}%</strong></p>
            <p className="text-sm">Longo prazo: <strong>{cascade.longTerm}%</strong></p>
          </Card>
        </TabsContent>

        <TabsContent value="recovery" className="grid gap-4 md:grid-cols-2">
          <SimulationScenarioCard projection={recovery} />
          <Card className="p-4 space-y-2">
            <h4 className="font-medium text-sm">Elasticidade de Recuperação</h4>
            <p className="text-3xl font-bold">{elasticity}</p>
            <p className="text-xs text-muted-foreground">Resiliência de longo prazo (12m): {longTermResilience}</p>
          </Card>
        </TabsContent>

        <TabsContent value="stress" className="grid gap-3 md:grid-cols-2">
          {stress.map((r) => <StressLevelGauge key={r.scenario} result={r} />)}
        </TabsContent>

        <TabsContent value="forecast" className="grid gap-4 md:grid-cols-2">
          <ForecastTimeline points={forecast} metricKey="projectedAuthority" label="Autoridade projetada" />
          <ForecastTimeline points={forecast} metricKey="projectedCoverage" label="Cobertura semântica" />
          <ForecastTimeline points={forecast} metricKey="projectedROI" label="ROI projetado" />
          <ForecastTimeline points={forecast} metricKey="projectedDecayRisk" label="Risco de decaimento" />
          <ResilienceForecastMatrix points={forecast} />
        </TabsContent>

        <TabsContent value="cluster">
          <Card className="p-4 space-y-2">
            <h4 className="font-medium">Evolução de Clusters</h4>
            <p>Crescimento esperado: <strong>{clusterEvo.expectedGrowth}</strong></p>
            <p>Probabilidade de colapso: <strong>{clusterEvo.collapseProbability}%</strong></p>
            <p>Ganho de consolidação: <strong>{clusterEvo.consolidationGain}</strong></p>
          </Card>
        </TabsContent>

        <TabsContent value="authority">
          <Card className="p-4 space-y-2">
            <h4 className="font-medium">Redistribuição de Autoridade</h4>
            <p>Autoridade rebalanceada: <strong>{authRedistribution.rebalancedAuthority}</strong></p>
            <p>Δ Entropia: <strong>{authRedistribution.entropyDelta}</strong></p>
            <p>Redução de risco: <strong>{authRedistribution.riskReduction}</strong></p>
            <p className="text-xs text-muted-foreground mt-2">
              Compounding em 365d: {Math.round(forecastAuthorityCompounding(telemetry))}
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="ops" className="grid gap-3 md:grid-cols-3">
          <Card className="p-4"><h4 className="text-sm font-medium">Score operacional</h4><p className="text-3xl font-bold">{opStress.operationalScore}</p></Card>
          <Card className="p-4"><h4 className="text-sm font-medium">Risco de burnout</h4><p className="text-3xl font-bold">{opStress.burnoutRisk}</p></Card>
          <Card className="p-4"><h4 className="text-sm font-medium">Recuperação (semanas)</h4><p className="text-3xl font-bold">{opStress.recoveryWeeks}</p></Card>
          <Card className="p-4 md:col-span-3">
            <h4 className="text-sm font-medium">Fadiga futura / capacidade de recuperação</h4>
            <p className="text-sm">Fadiga estimada (90d): <strong>{Math.round(forecastExecutionFatigue(telemetry))}</strong></p>
            <p className="text-sm">Capacidade de recuperação (90d): <strong>{Math.round(forecastRecoveryCapacity(telemetry))}</strong></p>
          </Card>
        </TabsContent>

        <TabsContent value="sustain" className="grid gap-4 md:grid-cols-3">
          {(["pessimistic", "realistic", "optimistic"] as const).map((k) => (
            <Card key={k} className="p-4">
              <h4 className="font-medium text-sm capitalize mb-2">{k}</h4>
              <ForecastTimeline points={scenarios[k]} metricKey="projectedResilience" label="Resiliência" />
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="roi">
          <StrategicInvestmentSimulator simulations={investments} />
        </TabsContent>

        <TabsContent value="summary">
          <Card className="p-4 sm:p-6 space-y-3">
            <h3 className="text-lg font-semibold">Resumo Executivo de Simulação</h3>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Confiança da simulação atual: <strong>{growth.confidence}%</strong></li>
              <li>Risco crítico estimado: <strong>{criticalProb}%</strong></li>
              <li>Resiliência longo prazo (12m): <strong>{longTermResilience}</strong></li>
              <li>Elasticidade de recuperação: <strong>{elasticity}</strong></li>
              <li>Cenário simulado: <strong className="capitalize">{scenario}</strong> ({horizonWeeks}w)</li>
              <li>Sustentabilidade projetada: <strong>{growth.sustainability}</strong></li>
            </ul>
            <p className="text-xs text-muted-foreground">
              SAFE MODE ABSOLUTO — nenhuma alteração foi feita em conteúdo, indexação, sitemap, robots ou rotas públicas.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
