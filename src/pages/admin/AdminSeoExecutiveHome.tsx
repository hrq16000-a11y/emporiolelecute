/**
 * Final Phase — SEO Executive Home (12-tab consolidated executive surface).
 * Read-only. Manual snapshot only. SAFE MODE.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import SystemMaintainabilityCard from "@/components/admin/SystemMaintainabilityCard";
import TelemetryCompressionPanel from "@/components/admin/TelemetryCompressionPanel";
import ExecutiveClarityGauge from "@/components/admin/ExecutiveClarityGauge";
import OperationalDragHeatmap from "@/components/admin/OperationalDragHeatmap";
import DashboardNoiseMatrix from "@/components/admin/DashboardNoiseMatrix";
import ScalabilityRiskCard from "@/components/admin/ScalabilityRiskCard";
import DependencyComplexityGraph from "@/components/admin/DependencyComplexityGraph";
import SignalEfficiencyPanel from "@/components/admin/SignalEfficiencyPanel";
import StrategicSimplificationRadar from "@/components/admin/StrategicSimplificationRadar";
import ExecutiveFinalizationSummary from "@/components/admin/ExecutiveFinalizationSummary";
import ExecutiveOverviewCard from "@/components/admin/ExecutiveOverviewCard";
import GovernanceTopologyMap from "@/components/admin/GovernanceTopologyMap";

import {
  detectDeadLayers, detectUnusedSignals, detectMetricInflation, detectObservabilityBloat,
  detectTelemetryNoise, calculateSystemMaintainability, calculateExecutiveClarity,
  buildHardeningRecommendations,
} from "@/lib/systemHardening";
import {
  calculateSignalDensity, calculateSignalEfficiency,
} from "@/lib/telemetryPruning";
import {
  detectDashboardNoise, calculateCognitiveLoad, suggestUiSimplification,
  buildExecutiveOverview, compressOperationalNarrative,
  buildTopCriticalRisks, buildExecutiveFocusAreas,
} from "@/lib/executiveUxCompression";
import {
  estimateDashboardWeight, calculateSystemLatencyRisk, calculateScalabilityScore,
  buildOptimizationSuggestions, estimateTelemetryLoad, estimateSnapshotGrowth,
} from "@/lib/performanceStabilization";
import {
  buildSystemTopology, buildLayerRelationships,
} from "@/lib/systemDocumentation";
import {
  detectExcessiveGovernance, calculateOperationalDrag, calculateStrategicFriction,
  calculateOperationalSimplicity, detectOperationalOverload,
  buildSimplificationRoadmap,
} from "@/lib/operationalSimplification";

export default function AdminSeoExecutiveHome() {
  const [saving, setSaving] = useState(false);

  const view = useMemo(() => {
    // Approximations from current architectural state.
    const dashboards = 36, activeDashboards = 14, totalMetrics = 200, totalSignals = 200;
    const engines = 32, governanceLayers = 7, metaLayers = 8, decisionSurfaces = 14;

    const deadLayers = detectDeadLayers([]);
    const unusedSignals = detectUnusedSignals([]);
    const inflation = detectMetricInflation(totalMetrics, 90);
    const bloat = detectObservabilityBloat(dashboards, 14);
    const noise = detectTelemetryNoise(Array.from({ length: 20 }, () => ({ variance: 2 })));
    const maintainability = calculateSystemMaintainability({
      deadLayers: deadLayers.length, unusedSignals: unusedSignals.length,
      inflation, bloat, noise,
    });

    const dashboardNoise = detectDashboardNoise(dashboards, activeDashboards);
    const cognitiveLoad = calculateCognitiveLoad({ widgets: 60, metrics: totalMetrics, dashboards });
    const navDepth = 30;
    const uiTips = suggestUiSimplification({ noise: dashboardNoise, cognitiveLoad, navDepth });

    const density = calculateSignalDensity(80, totalSignals);
    const signalEfficiency = calculateSignalEfficiency({ obesity: inflation, noise, density });

    const dashboardWeight = estimateDashboardWeight({ widgets: 60, charts: 14, queries: 22 });
    const telemetryLoad = estimateTelemetryLoad(totalMetrics, 5);
    const snapshotGrowth = estimateSnapshotGrowth(120, 30);
    const latency = calculateSystemLatencyRisk({
      heavyFlows: 1, overlapping: 2, dashboardWeight,
    });
    const scalability = calculateScalabilityScore({
      latencyRisk: latency, snapshotGrowth, telemetryLoad,
    });
    const optimization = buildOptimizationSuggestions({
      heavyFlows: [], overlapping: [], latencyRisk: latency,
    });

    const overload = detectOperationalOverload({ dashboards, metrics: totalMetrics, engines });
    const governanceExcess = detectExcessiveGovernance(governanceLayers, 5);
    const drag = calculateOperationalDrag({ overload, redundancy: 35, governanceExcess });
    const fragmentation = 60, abstraction = 65;
    const friction = calculateStrategicFriction({ fragmentation, abstraction, drag });
    const simplicity = calculateOperationalSimplicity({
      overload, fatigue: dashboardNoise, abstraction, fragmentation,
    });
    const roadmap = buildSimplificationRoadmap({ overload, fatigue: dashboardNoise, abstraction, fragmentation });

    const clarity = calculateExecutiveClarity({
      maintainability, simplicity, signalEfficiency,
    });

    const recs = buildHardeningRecommendations({
      deadLayers, unusedSignals, bloat, noise,
    });

    const topology = buildSystemTopology([
      { name: "Indexation", layer: "core", purpose: "" },
      { name: "Authority", layer: "core", purpose: "" },
      { name: "Discovery", layer: "core", purpose: "" },
      { name: "Knowledge Graph", layer: "intelligence", purpose: "" },
      { name: "Forecasting", layer: "intelligence", purpose: "" },
      { name: "Governance Matrix", layer: "governance", purpose: "" },
      { name: "Execution Orchestrator", layer: "execution", purpose: "" },
      { name: "Consolidation", layer: "executive", purpose: "" },
      { name: "Executive Home", layer: "executive", purpose: "" },
    ]);
    const layerRels = buildLayerRelationships(
      [
        { name: "Authority", layer: "core", purpose: "" },
        { name: "Knowledge Graph", layer: "intelligence", purpose: "" },
        { name: "Governance Matrix", layer: "governance", purpose: "" },
      ],
      [
        { from: "Authority", to: "Knowledge Graph", kind: "feeds" },
        { from: "Knowledge Graph", to: "Governance Matrix", kind: "feeds" },
      ],
    );
    const dependencyComplexity = Math.min(100, layerRels.reduce((a, b) => a + b.count, 0) * 12);

    const overview = buildExecutiveOverview([
      maintainability, simplicity, clarity, scalability, signalEfficiency,
    ]);
    const risks = buildTopCriticalRisks([
      { name: "Inflação de telemetria", severity: inflation },
      { name: "Sobrecarga operacional", severity: overload },
      { name: "Fragmentação decisória", severity: fragmentation },
      { name: "Atrito estratégico", severity: friction },
      { name: "Carga cognitiva", severity: cognitiveLoad },
    ]);
    const focusAreas = buildExecutiveFocusAreas({
      maintainability, simplicity, clarity, scalability, signalEfficiency,
    });
    const narrative = compressOperationalNarrative(overview, [], risks);

    const dragContrib = { overload, redundancy: 35, "gov. excess": governanceExcess };

    const simplificationReadiness = Math.max(0, Math.min(100, Math.round(100 - friction / 1.5)));

    return {
      maintainability, simplicity, clarity, scalability, signalEfficiency, density,
      dashboardNoise, cognitiveLoad, navDepth, dashboardWeight, latency, telemetryLoad, snapshotGrowth,
      overload, governanceExcess, drag, friction, fragmentation, abstraction,
      inflation, bloat, noise, recs, optimization, roadmap, topology, layerRels, dependencyComplexity,
      overview, risks, focusAreas, narrative, dragContrib, simplificationReadiness, uiTips,
      dashboards, activeDashboards, totalMetrics,
      systemWeight: Math.min(100, Math.round((dashboardWeight + telemetryLoad + dependencyComplexity) / 3)),
      executiveFocus: Math.round((clarity + simplicity + signalEfficiency) / 3),
    };
  }, []);

  const handleSnapshot = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("seo_system_finalization_snapshots")
        .insert({
          maintainability_score: view.maintainability,
          operational_simplicity_score: view.simplicity,
          executive_clarity_score: view.clarity,
          scalability_score: view.scalability,
          signal_efficiency_score: view.signalEfficiency,
          telemetry_density_score: view.density,
          operational_drag_score: view.drag,
          governance_overhead_score: view.governanceExcess,
          dashboard_noise_score: view.dashboardNoise,
          dependency_complexity_score: view.dependencyComplexity,
          strategic_friction_score: view.friction,
          simplification_readiness_score: view.simplificationReadiness,
          // legacy/back-compat columns (still present):
          runtime_stability_score: 78,
          governance_integrity_score: 82,
          documentation_completeness_score: 72,
          observability_efficiency_score: view.signalEfficiency,
          performance_pressure_score: view.latency,
          operational_overload_score: view.overload,
          scalability_risk_score: 100 - view.scalability,
          finalization_confidence_score: view.executiveFocus,
          notes: view.narrative,
        });
      if (error) throw error;
      toast.success("Finalization snapshot capturado.");
    } catch (e: any) {
      toast.error("Falha ao capturar snapshot", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const header = [
    { label: "Maintainability", value: view.maintainability },
    { label: "Clarity", value: view.clarity },
    { label: "Simplicity", value: view.simplicity },
    { label: "Scalability", value: view.scalability },
    { label: "Op. Drag", value: view.drag },
    { label: "Signal Eff.", value: view.signalEfficiency },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">SEO Executive Home</h1>
          <p className="text-sm text-muted-foreground">
            Camada final consolidada — leitura executiva compacta. Read-only · SAFE MODE.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">SAFE MODE</Badge>
          <Button onClick={handleSnapshot} disabled={saving} size="sm">
            {saving ? "Capturando…" : "Capture Finalization Snapshot"}
          </Button>
        </div>
      </div>

      {/* Executive header */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {header.map((h) => (
          <Card key={h.label}>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">{h.label}</p>
              <p className="text-2xl font-bold">{h.value}</p>
              <Progress value={Math.max(0, Math.min(100, h.value))} className="mt-2 h-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="maintainability">Maintainability</TabsTrigger>
          <TabsTrigger value="simplicity">Simplicity</TabsTrigger>
          <TabsTrigger value="compression">Compression</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="scalability">Scalability</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="signal">Signal Efficiency</TabsTrigger>
          <TabsTrigger value="drag">Operational Drag</TabsTrigger>
          <TabsTrigger value="simplification">Simplification</TabsTrigger>
          <TabsTrigger value="summary">Final Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          <ExecutiveOverviewCard
            status={view.overview.systemStatus}
            score={view.overview.headlineScore}
            narrative={view.narrative}
          />
          <ExecutiveClarityGauge clarity={view.clarity} cognitiveLoad={view.cognitiveLoad} />
          <Card>
            <CardHeader><CardTitle className="text-base">Risks & Focus</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>
                <p className="font-medium">Riscos críticos</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {view.risks.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
              <div>
                <p className="font-medium">Áreas de foco</p>
                <p className="text-muted-foreground">{view.focusAreas.join(", ") || "—"}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintainability" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <SystemMaintainabilityCard
            score={view.maintainability}
            deadLayers={0}
            unusedSignals={0}
          />
          <Card>
            <CardHeader><CardTitle className="text-base">Hardening Recommendations</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm list-disc pl-5 text-muted-foreground space-y-1">
                {view.recs.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simplicity" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Operational Simplicity</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-3xl font-bold">{view.simplicity}</div>
              <Progress value={view.simplicity} />
              <div className="flex justify-between"><span className="text-muted-foreground">Sobrecarga</span><b>{view.overload}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fragmentação</span><b>{view.fragmentation}</b></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">UI Simplification Tips</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm list-disc pl-5 text-muted-foreground space-y-1">
                {view.uiTips.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compression" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <TelemetryCompressionPanel
            density={view.density} efficiency={view.signalEfficiency} redundant={[]}
          />
          <DashboardNoiseMatrix
            noise={view.dashboardNoise} idle={view.dashboards - view.activeDashboards} total={view.dashboards}
          />
        </TabsContent>

        <TabsContent value="performance" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Latency & Load</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Latência estimada</span><b>{view.latency}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Carga de telemetria</span><b>{view.telemetryLoad}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Peso de dashboards</span><b>{view.dashboardWeight}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Crescimento de snapshots</span><b>{view.snapshotGrowth}</b></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Optimization Suggestions</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm list-disc pl-5 text-muted-foreground space-y-1">
                {view.optimization.map((o) => <li key={o}>{o}</li>)}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scalability" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <ScalabilityRiskCard
            risk={100 - view.scalability}
            scalability={view.scalability}
            latency={view.latency}
          />
          <Card>
            <CardHeader><CardTitle className="text-base">System Weight</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-3xl font-bold">{view.systemWeight}</div>
              <Progress value={view.systemWeight} />
              <p className="text-xs text-muted-foreground">
                Estimativa agregada de peso operacional do SEO OS.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <GovernanceTopologyMap topology={view.topology} />
          <Card>
            <CardHeader><CardTitle className="text-base">Governance Overhead</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-3xl font-bold">{view.governanceExcess}</div>
              <Progress value={view.governanceExcess} />
              <p className="text-xs text-muted-foreground">
                Mede excesso de camadas de supervisão acima do baseline saudável.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependencies" className="mt-4">
          <DependencyComplexityGraph complexity={view.dependencyComplexity} layers={view.layerRels} />
        </TabsContent>

        <TabsContent value="signal" className="mt-4">
          <SignalEfficiencyPanel
            efficiency={view.signalEfficiency} density={view.density} noise={view.noise}
          />
        </TabsContent>

        <TabsContent value="drag" className="mt-4">
          <OperationalDragHeatmap drag={view.drag} contributors={view.dragContrib} />
        </TabsContent>

        <TabsContent value="simplification" className="mt-4">
          <StrategicSimplificationRadar
            roadmap={view.roadmap} friction={view.friction} readiness={view.simplificationReadiness}
          />
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <ExecutiveFinalizationSummary
            status={view.overview.systemStatus}
            score={view.executiveFocus}
            narrative={view.narrative}
            highlights={[
              `Maintainability ${view.maintainability}`,
              `Clarity ${view.clarity}`,
              `Simplicity ${view.simplicity}`,
              `Scalability ${view.scalability}`,
              `Signal efficiency ${view.signalEfficiency}`,
              `Operational drag ${view.drag}`,
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
