/**
 * SEO System Audit — read-only diagnostic dashboard.
 * SAFE MODE absolute. Generates suggestions only — no mutations.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import SystemComplexityCard from "@/components/admin/SystemComplexityCard";
import NavigationEntropyPanel from "@/components/admin/NavigationEntropyPanel";
import DashboardOverlapMatrix from "@/components/admin/DashboardOverlapMatrix";
import OperationalFatigueHeatmap from "@/components/admin/OperationalFatigueHeatmap";
import ExecutiveCompressionGauge from "@/components/admin/ExecutiveCompressionGauge";
import ArchitecturalDebtPanel from "@/components/admin/ArchitecturalDebtPanel";
import MenuCompressionSuggestions from "@/components/admin/MenuCompressionSuggestions";
import DashboardMergeCandidates from "@/components/admin/DashboardMergeCandidates";
import CognitiveLoadTimeline from "@/components/admin/CognitiveLoadTimeline";
import ExecutiveAuditSummary from "@/components/admin/ExecutiveAuditSummary";

import {
  generateSystemAuditReport,
  type DashboardDescriptor,
} from "@/lib/systemAudit";
import {
  groupNavigation,
  calculateNavigationEntropy,
  calculateMenuFatigue,
  calculateAdminDiscoverability,
  detectRedundantLabels,
  detectSemanticallyEquivalent,
  suggestMenuCompression,
  type NavItem,
} from "@/lib/navigationCompression";
import {
  buildMergeCandidates,
  detectWidgetCandidates,
  detectDuplicatedTelemetry,
  consolidationImpactScore,
} from "@/lib/dashboardConsolidation";
import {
  buildExecutiveAuditSummary,
  type DashboardSignals,
} from "@/lib/executiveCompressionAudit";

// Static seed of known admin dashboards — read-only sample for audit.
const DASHBOARDS: DashboardDescriptor[] = [
  { id: "seo-os", label: "SEO OS", path: "/admin/seo-os", domain: "intelligence",
    responsibilities: ["overview", "telemetry", "executive"], usageScore: 70, incrementalValue: 65 },
  { id: "seo-command", label: "Command Center", path: "/admin/seo-command-center", domain: "intelligence",
    responsibilities: ["overview", "telemetry", "executive", "operations"], usageScore: 55, incrementalValue: 50 },
  { id: "seo-control-tower", label: "Control Tower", path: "/admin/seo-control-tower", domain: "intelligence",
    responsibilities: ["overview", "operations", "executive"], usageScore: 35, incrementalValue: 40 },
  { id: "seo-kernel", label: "Kernel", path: "/admin/seo-kernel", domain: "intelligence",
    responsibilities: ["core", "telemetry"], usageScore: 30, incrementalValue: 30 },
  { id: "seo-executive-core", label: "Executive Core", path: "/admin/seo-executive-core", domain: "intelligence",
    responsibilities: ["executive", "overview"], usageScore: 45, incrementalValue: 40 },
  { id: "seo-executive-grid", label: "Executive Grid", path: "/admin/seo-executive-grid", domain: "intelligence",
    responsibilities: ["executive", "overview", "matrix"], usageScore: 35, incrementalValue: 35 },
  { id: "seo-executive-home", label: "SEO Executive Home", path: "/admin/seo-executive-home", domain: "intelligence",
    responsibilities: ["executive", "summary"], usageScore: 60, incrementalValue: 55 },
  { id: "seo-nexus-convergence", label: "Strategic Nexus", path: "/admin/seo-nexus-convergence", domain: "intelligence",
    responsibilities: ["nexus", "convergence", "strategy"], usageScore: 20, incrementalValue: 25 },
  { id: "seo-unified-nexus", label: "Unified Nexus", path: "/admin/seo-unified-nexus", domain: "intelligence",
    responsibilities: ["nexus", "convergence"], usageScore: 18, incrementalValue: 22 },
  { id: "seo-unified-intelligence", label: "Unified Intelligence", path: "/admin/seo-unified-intelligence", domain: "intelligence",
    responsibilities: ["intelligence", "convergence"], usageScore: 25, incrementalValue: 28 },
  { id: "seo-consciousness", label: "Consciousness", path: "/admin/seo-consciousness", domain: "intelligence",
    responsibilities: ["consciousness", "meta"], usageScore: 15, incrementalValue: 18 },
  { id: "seo-consciousness-fabric", label: "Consciousness Fabric", path: "/admin/seo-consciousness-fabric", domain: "intelligence",
    responsibilities: ["consciousness", "fabric", "meta"], usageScore: 12, incrementalValue: 15 },
  { id: "seo-cognitive-orch", label: "Cognitive Orchestration", path: "/admin/seo-cognitive-orchestration", domain: "intelligence",
    responsibilities: ["consciousness", "orchestration"], usageScore: 18, incrementalValue: 20 },
  { id: "seo-meta-reasoning", label: "Meta Reasoning", path: "/admin/seo-meta-reasoning", domain: "intelligence",
    responsibilities: ["meta", "reasoning"], usageScore: 18, incrementalValue: 22 },
  { id: "seo-meta-governance", label: "Meta Governance", path: "/admin/seo-meta-governance", domain: "governance",
    responsibilities: ["meta", "governance"], usageScore: 25, incrementalValue: 30 },
  { id: "seo-governance-matrix", label: "Governance Matrix", path: "/admin/seo-governance-matrix", domain: "governance",
    responsibilities: ["governance", "matrix"], usageScore: 35, incrementalValue: 38 },
  { id: "seo-final-governance", label: "Final Governance", path: "/admin/seo-final-governance", domain: "governance",
    responsibilities: ["governance", "hardening", "executive"], usageScore: 55, incrementalValue: 60 },
  { id: "seo-operational-reality", label: "Operational Reality", path: "/admin/seo-operational-reality", domain: "governance",
    responsibilities: ["operations", "reality", "executive"], usageScore: 55, incrementalValue: 58 },
  { id: "seo-strategic-reality", label: "Strategic Reality", path: "/admin/seo-strategic-reality", domain: "intelligence",
    responsibilities: ["strategy", "reality"], usageScore: 22, incrementalValue: 25 },
  { id: "seo-strategic-continuum", label: "Strategic Continuum", path: "/admin/seo-strategic-continuum", domain: "intelligence",
    responsibilities: ["strategy", "continuum"], usageScore: 18, incrementalValue: 22 },
  { id: "seo-stability-fabric", label: "Stability Fabric", path: "/admin/seo-stability-fabric", domain: "intelligence",
    responsibilities: ["fabric", "stability"], usageScore: 18, incrementalValue: 22 },
  { id: "seo-integrity-grid", label: "Integrity Grid", path: "/admin/seo-integrity-grid", domain: "intelligence",
    responsibilities: ["integrity", "grid"], usageScore: 20, incrementalValue: 25 },
  { id: "seo-coherence-matrix", label: "Coherence Matrix", path: "/admin/seo-coherence-matrix", domain: "intelligence",
    responsibilities: ["coherence", "matrix"], usageScore: 20, incrementalValue: 25 },
  { id: "seo-consolidation", label: "Consolidation", path: "/admin/seo-consolidation", domain: "intelligence",
    responsibilities: ["consolidation", "strategy"], usageScore: 25, incrementalValue: 30 },
  { id: "seo-execution-orchestrator", label: "Execution Orchestrator", path: "/admin/seo-execution-orchestrator", domain: "intelligence",
    responsibilities: ["orchestration", "execution", "operations"], usageScore: 40, incrementalValue: 45 },
  { id: "seo-operations", label: "SEO Operations", path: "/admin/seo-operations", domain: "governance",
    responsibilities: ["operations"], usageScore: 30, incrementalValue: 30 },
  { id: "seo-nervous-system", label: "Nervous System", path: "/admin/seo-nervous-system", domain: "intelligence",
    responsibilities: ["nervous", "telemetry"], usageScore: 15, incrementalValue: 18 },
  { id: "seo-operating-fabric", label: "Operating Fabric", path: "/admin/seo-operating-fabric", domain: "intelligence",
    responsibilities: ["fabric", "operations"], usageScore: 15, incrementalValue: 18 },
  { id: "seo-civilization", label: "Civilization", path: "/admin/seo-civilization", domain: "labs",
    responsibilities: ["meta", "civilization"], usageScore: 8, incrementalValue: 10 },
  { id: "seo-singularity", label: "Singularity", path: "/admin/seo-singularity", domain: "labs",
    responsibilities: ["meta", "singularity"], usageScore: 8, incrementalValue: 10 },
  { id: "seo-evolution", label: "Evolution", path: "/admin/seo-evolution", domain: "labs",
    responsibilities: ["meta", "evolution"], usageScore: 8, incrementalValue: 10 },
  { id: "seo-war-room", label: "War Room", path: "/admin/seo-war-room", domain: "intelligence",
    responsibilities: ["war room", "executive"], usageScore: 20, incrementalValue: 25 },
  { id: "seo-simulation-lab", label: "Simulation Lab", path: "/admin/seo-simulation-lab", domain: "labs",
    responsibilities: ["simulation"], usageScore: 25, incrementalValue: 30 },
  { id: "seo-strategic-simulation", label: "Strategic Simulation", path: "/admin/strategic-simulation", domain: "labs",
    responsibilities: ["simulation", "strategy"], usageScore: 20, incrementalValue: 25 },
  { id: "seo-autonomy", label: "Autonomy", path: "/admin/seo-autonomy", domain: "intelligence",
    responsibilities: ["autonomy"], usageScore: 15, incrementalValue: 18 },
  { id: "seo-knowledge-graph", label: "Knowledge Graph", path: "/admin/knowledge-graph", domain: "discovery",
    responsibilities: ["knowledge", "graph"], usageScore: 45, incrementalValue: 55 },
  { id: "seo-authority", label: "Authority", path: "/admin/authority", domain: "discovery",
    responsibilities: ["authority"], usageScore: 50, incrementalValue: 55 },
  { id: "seo-discovery", label: "Discovery", path: "/admin/discovery", domain: "discovery",
    responsibilities: ["discovery"], usageScore: 50, incrementalValue: 55 },
  { id: "seo-telemetry", label: "Telemetry", path: "/admin/telemetry", domain: "intelligence",
    responsibilities: ["telemetry"], usageScore: 45, incrementalValue: 50 },
];

const DASHBOARD_SIGNALS: DashboardSignals[] = DASHBOARDS.map((d) => ({
  id: d.id,
  kpiCount: 6 + Math.round((d.incrementalValue ?? 30) / 12),
  actionableKpis: Math.round(((d.incrementalValue ?? 30) / 100) * 6),
  uniqueInsights: Math.round((d.incrementalValue ?? 30) / 25),
  duplicatedInsights: Math.max(0, 4 - Math.round((d.usageScore ?? 30) / 25)),
}));

export default function AdminSeoSystemAudit() {
  const [planGenerated, setPlanGenerated] = useState(false);

  // Build the navigation list from current AdminLayout-style data
  const navItems: NavItem[] = useMemo(
    () => DASHBOARDS.map((d) => ({ label: d.label, path: d.path })),
    [],
  );

  const report = useMemo(
    () => generateSystemAuditReport(DASHBOARDS, navItems.length, 2),
    [navItems.length],
  );

  const grouped = useMemo(() => groupNavigation(navItems), [navItems]);
  const entropy = useMemo(() => calculateNavigationEntropy(navItems), [navItems]);
  const redundantLabels = useMemo(() => detectRedundantLabels(navItems), [navItems]);
  const semanticDupes = useMemo(() => detectSemanticallyEquivalent(navItems), [navItems]);
  const fatigue = useMemo(
    () =>
      calculateMenuFatigue({
        itemCount: navItems.length,
        depth: 2,
        redundantLabels: redundantLabels.length,
        semanticDupes: semanticDupes.length,
      }),
    [navItems.length, redundantLabels.length, semanticDupes.length],
  );
  const discoverability = useMemo(
    () =>
      calculateAdminDiscoverability({
        fatigue,
        entropy,
        groupCount: grouped.length,
      }),
    [fatigue, entropy, grouped.length],
  );
  const menuSuggestions = useMemo(() => suggestMenuCompression(navItems), [navItems]);

  const mergeCandidates = useMemo(
    () => buildMergeCandidates(DASHBOARDS, report.redundancy),
    [report.redundancy],
  );
  const widgetCandidates = useMemo(() => detectWidgetCandidates(DASHBOARDS), []);
  const duplicatedTelemetry = useMemo(() => detectDuplicatedTelemetry(DASHBOARDS), []);
  const consolidationImpact = useMemo(
    () => consolidationImpactScore(mergeCandidates, DASHBOARDS.length),
    [mergeCandidates],
  );

  const execSummary = useMemo(
    () => buildExecutiveAuditSummary(DASHBOARD_SIGNALS),
    [],
  );

  const actionability = useMemo(() => {
    const a = DASHBOARD_SIGNALS.reduce((acc, d) => acc + d.actionableKpis, 0);
    const t = DASHBOARD_SIGNALS.reduce((acc, d) => acc + d.kpiCount, 0);
    return t === 0 ? 0 : Math.round((a / t) * 100);
  }, []);

  const cognitivePoints = useMemo(
    () => [
      { label: "Initial load", value: Math.min(100, report.cognitiveLoadScore - 10) },
      { label: "Navigation", value: report.cognitiveLoadScore },
      { label: "Dashboard scan", value: Math.min(100, report.cognitiveLoadScore + 5) },
      { label: "Action", value: Math.max(0, report.cognitiveLoadScore - 20) },
    ],
    [report.cognitiveLoadScore],
  );

  const topRedundant = useMemo(
    () => report.redundancy.slice(0, 8),
    [report.redundancy],
  );
  const topUseful = useMemo(
    () =>
      [...DASHBOARDS]
        .sort((a, b) => (b.incrementalValue ?? 0) - (a.incrementalValue ?? 0))
        .slice(0, 8),
    [],
  );

  const generatePlan = () => {
    setPlanGenerated(true);
    toast.success("Consolidation plan generated", {
      description: `${mergeCandidates.length} merges, ${widgetCandidates.length} widget candidates, ${menuSuggestions.length} menu actions.`,
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SEO System Audit</h1>
          <p className="text-sm text-muted-foreground">
            Read-only architectural diagnostics. SAFE MODE absolute. Nothing is
            removed or executed.
          </p>
        </div>
        <Button onClick={generatePlan}>Generate Consolidation Plan</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile label="Dashboards" value={report.totalDashboards} />
        <KpiTile label="Complexity" value={report.complexityScore} />
        <KpiTile label="Usability" value={report.executiveUsabilityScore} />
        <KpiTile label="Cognitive load" value={report.cognitiveLoadScore} />
        <KpiTile label="Debt" value={report.architecturalDebt} />
        <KpiTile label="Compression impact" value={consolidationImpact} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="complexity">Complexity</TabsTrigger>
          <TabsTrigger value="navigation">Navigation</TabsTrigger>
          <TabsTrigger value="overlap">Overlap</TabsTrigger>
          <TabsTrigger value="fatigue">Fatigue</TabsTrigger>
          <TabsTrigger value="compression">Compression</TabsTrigger>
          <TabsTrigger value="debt">Debt</TabsTrigger>
          <TabsTrigger value="merge">Merge</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="cognitive">Cognitive</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid md:grid-cols-2 gap-3">
          <ExecutiveAuditSummary report={report} />
          <SystemComplexityCard
            complexity={report.complexityScore}
            cognitive={report.cognitiveLoadScore}
            usability={report.executiveUsabilityScore}
          />
        </TabsContent>

        <TabsContent value="complexity" className="grid md:grid-cols-2 gap-3">
          <SystemComplexityCard
            complexity={report.complexityScore}
            cognitive={report.cognitiveLoadScore}
            usability={report.executiveUsabilityScore}
          />
          <Card>
            <CardHeader><CardTitle className="text-base">Clusters by domain</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {Object.entries(report.clusters).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <b>{v.length}</b>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="navigation">
          <NavigationEntropyPanel
            entropy={entropy}
            fatigue={fatigue}
            discoverability={discoverability}
            groups={grouped}
          />
        </TabsContent>

        <TabsContent value="overlap">
          <DashboardOverlapMatrix hits={report.redundancy} />
        </TabsContent>

        <TabsContent value="fatigue">
          <OperationalFatigueHeatmap
            fatigue={execSummary.fatigue}
            theaterCount={execSummary.theaterCount}
            inflated={execSummary.inflatedDashboards}
            overloaded={execSummary.overloadedDashboards}
          />
        </TabsContent>

        <TabsContent value="compression">
          <ExecutiveCompressionGauge
            compression={execSummary.compression}
            actionability={actionability}
          />
        </TabsContent>

        <TabsContent value="debt">
          <ArchitecturalDebtPanel
            debt={report.architecturalDebt}
            orphans={report.orphans}
            thin={report.thin}
            metaExcess={report.metaAbstractionExcess}
          />
        </TabsContent>

        <TabsContent value="merge">
          <DashboardMergeCandidates candidates={mergeCandidates} />
        </TabsContent>

        <TabsContent value="menu">
          <MenuCompressionSuggestions suggestions={menuSuggestions} />
        </TabsContent>

        <TabsContent value="cognitive">
          <CognitiveLoadTimeline points={cognitivePoints} />
        </TabsContent>

        <TabsContent value="rankings" className="grid md:grid-cols-2 gap-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Most redundant pairs</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {topRedundant.length === 0 && <div className="text-muted-foreground">None.</div>}
              {topRedundant.map((r, i) => (
                <div key={i} className="flex justify-between">
                  <span className="truncate">{r.a} ↔ {r.b}</span>
                  <b>{r.overlap}%</b>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Most useful dashboards</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {topUseful.map((d) => (
                <div key={d.id} className="flex justify-between">
                  <span className="truncate">{d.label}</span>
                  <b>{d.incrementalValue}</b>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consolidation Plan (read-only)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {!planGenerated && (
                <div className="text-muted-foreground">
                  Click <b>Generate Consolidation Plan</b> to compute suggestions.
                </div>
              )}
              {planGenerated && (
                <>
                  <div>Merge candidates: <b>{mergeCandidates.length}</b></div>
                  <div>Widget candidates: <b>{widgetCandidates.length}</b></div>
                  <div>Duplicated telemetry surfaces: <b>{duplicatedTelemetry.length}</b></div>
                  <div>Menu actions: <b>{menuSuggestions.length}</b></div>
                  <div>Estimated compression impact: <b>{consolidationImpact}%</b></div>
                  <div className="pt-2 space-y-1">
                    {report.consolidationSuggestions.slice(0, 30).map((s, i) => (
                      <div key={i} className="border-b pb-1">
                        <div className="text-xs">
                          <b>{s.type}</b> — {s.targets.join(", ")}
                        </div>
                        <div className="text-xs text-muted-foreground">{s.rationale}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
