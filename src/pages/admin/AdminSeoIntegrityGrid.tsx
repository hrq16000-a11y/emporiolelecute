import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import IntegrityGridCard from "@/components/admin/IntegrityGridCard";
import StrategicCoherencePanel from "@/components/admin/StrategicCoherencePanel";
import SystemicTrustIntegrityMap from "@/components/admin/SystemicTrustIntegrityMap";
import SemanticIntegrityMatrix from "@/components/admin/SemanticIntegrityMatrix";
import OperationalConflictHeatmap from "@/components/admin/OperationalConflictHeatmap";
import ContinuityIntegrityGauge from "@/components/admin/ContinuityIntegrityGauge";
import ResilienceIntegrityRadar from "@/components/admin/ResilienceIntegrityRadar";
import IntegrityBreakAlert from "@/components/admin/IntegrityBreakAlert";
import StrategicHarmonyTimeline from "@/components/admin/StrategicHarmonyTimeline";
import IntegrityExecutiveSummary from "@/components/admin/IntegrityExecutiveSummary";

import {
  buildIntegrityVerdict, calculateExecutiveIntegrity, calculateStrategicCoherence,
  estimateIntegrityPersistence, type IntegrityGridInputs,
} from "@/lib/strategicIntegrityGrid";
import {
  calculateSystemicTrustIntegrity, classifyTrust, buildTrustIntegrityMap,
  detectTrustDisruptions, estimateTrustContinuity, detectConfidenceCollapse,
  type SystemicTrustInputs,
} from "@/lib/systemicTrustIntegrity";
import {
  calculateSemanticIntegrity, classifySemantic, buildSemanticIntegrityMap,
  estimateSemanticContinuity, detectSemanticAmbiguity,
  type SemanticIntegrityInputs,
} from "@/lib/semanticIntegrity";
import {
  calculateOperationalIntegrity, classifyConflict, buildConflictHeatmap,
  detectExecutionContradictions, detectStrategicPressureConflicts, estimateOperationalHarmony,
  type OperationalConflictInputs,
} from "@/lib/operationalConflictEngine";
import {
  calculateContinuityIntegrity, classifyContinuity, buildContinuityIntegrityProjection,
  detectContinuityFractures, detectPersistenceDecay, estimateRecoveryIntegrity,
  type ContinuityIntegrityInputs,
} from "@/lib/continuityIntegrity";
import {
  calculateResilienceIntegrity, classifyResilienceIntegrity, buildResilienceIntegrityMap,
  calculateAdaptiveIntegrity, detectRecoveryInstability, estimateResiliencePersistence,
  type ResilienceIntegrityInputs,
} from "@/lib/resilienceIntegrity";

// Read-only demo inputs.
const IG: IntegrityGridInputs = {
  executive: 75, coherence: 73, trust: 74, semantic: 72, continuity: 73,
  operational: 71, governance: 74, resilience: 73, convergence: 72,
  fragmentation: 22, erosion: 24, conflict: 23,
};
const ST: SystemicTrustInputs = {
  authority: 74, consistency: 73, reliability: 72, signalClarity: 71,
  distortion: 24, collapseSignals: 22,
};
const SE: SemanticIntegrityInputs = {
  clarity: 73, cohesion: 72, continuity: 71, conflicts: 23, corruption: 21, ambiguity: 22,
};
const OC: OperationalConflictInputs = {
  contradictions: 22, pressure: 26, execution: 72, alignment: 74, bottlenecks: 24, coordination: 73,
};
const CI: ContinuityIntegrityInputs = {
  persistence: 74, recovery: 72, decay: 22, fractures: 21, endurance: 73, momentum: 70,
};
const RI: ResilienceIntegrityInputs = {
  adaptiveness: 73, recovery: 72, durability: 74, weakness: 21, instability: 22, reserves: 71,
};

export default function AdminSeoIntegrityGrid() {
  const [saving, setSaving] = useState(false);

  const verdict = useMemo(() => buildIntegrityVerdict(IG), []);
  const executive = calculateExecutiveIntegrity(IG);
  const coherence = calculateStrategicCoherence(IG);
  const persistence = estimateIntegrityPersistence(IG);

  const trustScore = calculateSystemicTrustIntegrity(ST);
  const trustVerdict = classifyTrust(trustScore);
  const trustMap = useMemo(() => buildTrustIntegrityMap(ST), []);
  const trustDisruptions = detectTrustDisruptions(ST);
  const trustContinuity = estimateTrustContinuity(ST);
  const trustCollapse = detectConfidenceCollapse(ST);

  const semScore = calculateSemanticIntegrity(SE);
  const semVerdict = classifySemantic(semScore);
  const semMap = useMemo(() => buildSemanticIntegrityMap(SE), []);
  const semContinuity = estimateSemanticContinuity(SE);
  const semAmbiguity = detectSemanticAmbiguity(SE);

  const opScore = calculateOperationalIntegrity(OC);
  const opVerdict = classifyConflict(opScore);
  const opCells = useMemo(() => buildConflictHeatmap(OC), []);
  const opContradictions = detectExecutionContradictions(OC);
  const opPressure = detectStrategicPressureConflicts(OC);
  const opHarmony = estimateOperationalHarmony(OC);

  const contScore = calculateContinuityIntegrity(CI);
  const contVerdict = classifyContinuity(contScore);
  const contProjection = useMemo(() => buildContinuityIntegrityProjection(CI), []);
  const contFractures = detectContinuityFractures(CI);
  const contDecay = detectPersistenceDecay(CI);
  const contRecovery = estimateRecoveryIntegrity(CI);

  const resScore = calculateResilienceIntegrity(RI);
  const resVerdict = classifyResilienceIntegrity(resScore);
  const resMap = useMemo(() => buildResilienceIntegrityMap(RI), []);
  const resAdaptive = calculateAdaptiveIntegrity(RI);
  const resInstability = detectRecoveryInstability(RI);
  const resPersistence = estimateResiliencePersistence(RI);

  const harmony = Math.round((opHarmony + coherence + trustContinuity + resAdaptive) / 4);
  const harmonyPoints = [
    { label: "exec", value: executive },
    { label: "coh", value: coherence },
    { label: "trust", value: trustScore },
    { label: "sem", value: semScore },
    { label: "ops", value: opHarmony },
    { label: "res", value: resAdaptive },
  ];

  const execSummary = {
    integrity: verdict.score,
    coherence,
    trust: trustScore,
    resilience: resScore,
    continuity: contScore,
    harmony,
    verdict: verdict.verdict,
  };

  async function captureSnapshot() {
    setSaving(true);
    try {
      const { error } = await supabase.from("seo_integrity_grid_snapshots").insert({
        integrity_grid_score: verdict.score,
        executive_integrity_score: executive,
        strategic_coherence_score: coherence,
        systemic_trust_score: trustScore,
        semantic_integrity_score: semScore,
        continuity_integrity_score: contScore,
        operational_integrity_score: opScore,
        governance_integrity_score: IG.governance,
        resilience_integrity_score: resScore,
        convergence_integrity_score: IG.convergence,
        hidden_fragmentation_risk: IG.fragmentation,
        strategic_erosion_risk: IG.erosion,
        semantic_confusion_risk: semMap.conflict_score,
        operational_conflict_risk: opContradictions,
        continuity_break_risk: contFractures,
        integrity_matrix: JSON.parse(JSON.stringify({ executive, coherence, persistence, verdict: verdict.verdict })),
        strategic_alignment_map: JSON.parse(JSON.stringify({ strengths: verdict.strengths, resilient: verdict.resilient_domains })),
        semantic_integrity_map: JSON.parse(JSON.stringify(semMap)),
        governance_conflicts: JSON.parse(JSON.stringify({ cells: opCells, contradictions: opContradictions, pressure: opPressure })),
        resilience_distribution: JSON.parse(JSON.stringify({ ...resMap, adaptive: resAdaptive, persistence: resPersistence })),
        continuity_graph: JSON.parse(JSON.stringify({ projection: contProjection, decay: contDecay, recovery: contRecovery })),
        snapshot_type: "manual",
      });
      if (error) throw error;
      toast.success("Integrity snapshot captured");
    } catch (e) {
      toast.error("Failed to capture snapshot", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-semibold">Strategic Integrity Grid</h1>
            <p className="text-sm text-muted-foreground">
              Cross-engine integrity, trust, semantic coherence and resilience.
            </p>
          </div>
        </div>
        <Button onClick={captureSnapshot} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Capture Integrity Snapshot"}
        </Button>
      </div>

      <IntegrityExecutiveSummary metrics={execSummary} />

      <Tabs defaultValue="grid">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="grid">Integrity Grid</TabsTrigger>
          <TabsTrigger value="executive">Executive Integrity</TabsTrigger>
          <TabsTrigger value="coherence">Strategic Coherence</TabsTrigger>
          <TabsTrigger value="trust">Systemic Trust</TabsTrigger>
          <TabsTrigger value="semantic">Semantic Integrity</TabsTrigger>
          <TabsTrigger value="conflicts">Operational Conflicts</TabsTrigger>
          <TabsTrigger value="continuity">Continuity Integrity</TabsTrigger>
          <TabsTrigger value="resilience">Resilience Integrity</TabsTrigger>
          <TabsTrigger value="harmony">Strategic Harmony</TabsTrigger>
          <TabsTrigger value="fragmentation">Fragmentation Risks</TabsTrigger>
          <TabsTrigger value="persistence">Integrity Persistence</TabsTrigger>
          <TabsTrigger value="summary">Executive Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="grid"><IntegrityGridCard verdict={verdict} /></TabsContent>
        <TabsContent value="executive">
          <Card>
            <CardHeader><CardTitle>Executive Integrity</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="text-3xl font-semibold">{executive}<span className="text-base text-muted-foreground">/100</span></div>
              <p className="text-muted-foreground">Composite of executive clarity, coherence and operational conflict resistance.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="coherence">
          <StrategicCoherencePanel coherence={coherence} executive={executive} persistence={persistence} />
        </TabsContent>
        <TabsContent value="trust">
          <SystemicTrustIntegrityMap
            score={trustScore} verdict={trustVerdict} map={trustMap}
            disruptions={trustDisruptions} continuity={trustContinuity} collapse={trustCollapse}
          />
        </TabsContent>
        <TabsContent value="semantic">
          <SemanticIntegrityMatrix score={semScore} verdict={semVerdict} map={semMap} />
        </TabsContent>
        <TabsContent value="conflicts">
          <OperationalConflictHeatmap
            score={opScore} verdict={opVerdict} cells={opCells}
            contradictions={opContradictions} pressure={opPressure}
          />
        </TabsContent>
        <TabsContent value="continuity">
          <ContinuityIntegrityGauge
            score={contScore} verdict={contVerdict}
            fractures={contFractures} decay={contDecay} recovery={contRecovery}
            projection={contProjection}
          />
        </TabsContent>
        <TabsContent value="resilience">
          <ResilienceIntegrityRadar
            score={resScore} verdict={resVerdict} map={resMap}
            adaptive={resAdaptive} instability={resInstability}
          />
        </TabsContent>
        <TabsContent value="harmony">
          <StrategicHarmonyTimeline points={harmonyPoints} harmony={harmony} />
        </TabsContent>
        <TabsContent value="fragmentation">
          <Card>
            <CardHeader><CardTitle>Fragmentation & Erosion Risks</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Stat label="Hidden fragmentation" v={IG.fragmentation} />
                <Stat label="Strategic erosion" v={IG.erosion} />
                <Stat label="Semantic confusion" v={semMap.conflict_score} />
                <Stat label="Operational conflict" v={opContradictions} />
                <Stat label="Continuity break" v={contFractures} />
                <Stat label="Ambiguity" v={semAmbiguity} />
              </div>
              <IntegrityBreakAlert breaks={verdict.instability_points} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="persistence">
          <Card>
            <CardHeader><CardTitle>Integrity Persistence</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="text-3xl font-semibold">{persistence}<span className="text-base text-muted-foreground">/100</span></div>
              <p className="text-muted-foreground">Resilience-weighted continuity projection. Higher is more durable.</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Resilience persistence" v={resPersistence} />
                <Stat label="Trust continuity" v={trustContinuity} />
                <Stat label="Semantic continuity" v={semContinuity} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="summary"><IntegrityExecutiveSummary metrics={execSummary} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{v}<span className="text-sm text-muted-foreground">/100</span></div>
    </div>
  );
}
