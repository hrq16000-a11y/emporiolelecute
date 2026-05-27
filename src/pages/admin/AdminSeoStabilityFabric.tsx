import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import StabilityFabricCard from "@/components/admin/StabilityFabricCard";
import SilentDegradationPanel from "@/components/admin/SilentDegradationPanel";
import ConsensusIntegrityMatrix from "@/components/admin/ConsensusIntegrityMatrix";
import SystemicDispersionHeatmap from "@/components/admin/SystemicDispersionHeatmap";
import ResilienceContinuityGauge from "@/components/admin/ResilienceContinuityGauge";
import ExecutiveStabilityCard from "@/components/admin/ExecutiveStabilityCard";
import StrategicEquilibriumPanel from "@/components/admin/StrategicEquilibriumPanel";
import StabilityBreakAlert from "@/components/admin/StabilityBreakAlert";
import RecoveryCohesionTimeline from "@/components/admin/RecoveryCohesionTimeline";
import StabilityExecutiveSummary from "@/components/admin/StabilityExecutiveSummary";

import {
  buildFabricVerdict, calculateSystemicIntegrity, calculateStrategicEquilibrium,
  estimateStabilityPersistence, type StabilityFabricInputs,
} from "@/lib/stabilityFabric";
import {
  detectSilentDegradation, detectAuthorityDecay, detectSemanticErosion,
  detectOperationalRegression, estimateDegradationVelocity, classifyDegradationRisk,
  type DegradationInputs,
} from "@/lib/degradationDetection";
import {
  calculateConsensusIntegrity, buildConsensusMap, classifyConsensus,
  detectStrategicDivergence, detectEngineIsolation, estimateConsensusStability,
  detectConsensusBreaks, type ConsensusInputs,
} from "@/lib/consensusIntegrity";
import {
  calculateSystemicDispersion, buildDispersionHeatmap, classifyDispersion,
  type DispersionInputs,
} from "@/lib/systemicDispersion";
import {
  calculateResilienceContinuity, classifyResilience, buildContinuityProjection,
  estimateRecoveryCohesion, estimateRecoveryDurability, detectResilienceFatigue,
  type ResilienceContinuityInputs,
} from "@/lib/resilienceContinuity";
import {
  buildExecutiveSummary, type ExecutiveStabilityInputs,
} from "@/lib/executiveStability";

// Read-only demo inputs.
const SF: StabilityFabricInputs = {
  integrity: 74, resilience: 73, equilibrium: 72, consensus: 75,
  recovery: 73, signal: 74, degradation: 24, fragmentation: 23,
  volatility: 22, dispersion: 25,
};
const DG: DegradationInputs = {
  authorityDecay: 22, semanticErosion: 24, operationalRegression: 21,
  silentSignals: 25, velocity: 23,
};
const CI: ConsensusInputs = {
  agreement: 74, divergence: 22, isolatedEngines: 18,
  alignmentDepth: 73, contradictions: 20,
};
const SD: DispersionInputs = {
  signalDispersion: 24, authorityDispersion: 26, operationalScatter: 22,
  semanticDispersion: 25, concentrationIndex: 65,
};
const RC: ResilienceContinuityInputs = {
  recoveryCohesion: 74, recoveryDurability: 73, fatigue: 22,
  weakSpots: 21, recoveryVelocity: 72,
};
const EX: ExecutiveStabilityInputs = {
  decisionConsistency: 75, strategicLoad: 28, volatility: 24,
  clarity: 73, pressureIndex: 26,
};

export default function AdminSeoStabilityFabric() {
  const [saving, setSaving] = useState(false);

  const verdict = useMemo(() => buildFabricVerdict(SF), []);
  const integrity = calculateSystemicIntegrity(SF);
  const equilibrium = calculateStrategicEquilibrium(SF);
  const persistence = estimateStabilityPersistence(SF);

  const silent = detectSilentDegradation(DG);
  const authority = detectAuthorityDecay(DG);
  const semantic = detectSemanticErosion(DG);
  const operational = detectOperationalRegression(DG);
  const velocity = estimateDegradationVelocity(DG);
  const degradationRisk = classifyDegradationRisk(silent);

  const consensusScore = calculateConsensusIntegrity(CI);
  const consensusMap = useMemo(() => buildConsensusMap(CI), []);
  const consensusVerdict = classifyConsensus(consensusScore);
  const divergence = detectStrategicDivergence(CI);
  const isolation = detectEngineIsolation(CI);
  const consensusStability = estimateConsensusStability(CI);
  const consensusBreaks = detectConsensusBreaks(CI);

  const dispersionScore = calculateSystemicDispersion(SD);
  const dispersionCells = useMemo(() => buildDispersionHeatmap(SD), []);
  const dispersionVerdict = classifyDispersion(dispersionScore, SD.concentrationIndex);

  const resilienceScore = calculateResilienceContinuity(RC);
  const resilienceVerdict = classifyResilience(resilienceScore);
  const projection = useMemo(() => buildContinuityProjection(RC), []);
  const cohesion = estimateRecoveryCohesion(RC);
  const durability = estimateRecoveryDurability(RC);
  const fatigue = detectResilienceFatigue(RC);

  const executive = useMemo(() => buildExecutiveSummary(EX), []);

  const execSummary = {
    stability: verdict.score,
    integrity,
    equilibrium,
    resilience: resilienceScore,
    degradation: silent,
    continuity: persistence,
    verdict: verdict.verdict,
  };

  async function captureSnapshot() {
    setSaving(true);
    try {
      const { error } = await supabase.from("seo_stability_fabric_snapshots").insert({
        stability_fabric_score: verdict.score,
        systemic_integrity_score: integrity,
        executive_stability_score: executive.score,
        semantic_resilience_score: Math.round((SF.signal + resilienceScore) / 2),
        operational_resilience_score: Math.round((resilienceScore + SF.recovery) / 2),
        consensus_integrity_score: consensusScore,
        strategic_equilibrium_score: equilibrium,
        degradation_resistance_score: 100 - silent,
        recovery_cohesion_score: cohesion,
        signal_stability_score: SF.signal,
        silent_degradation_risk: silent,
        semantic_erosion_risk: semantic,
        consensus_fragmentation_risk: consensusBreaks,
        executive_instability_risk: executive.instability,
        systemic_dispersion_risk: dispersionScore,
        degradation_map: JSON.parse(JSON.stringify({ silent, authority, semantic, operational, velocity })),
        equilibrium_matrix: JSON.parse(JSON.stringify({ integrity, equilibrium, persistence })),
        resilience_projection: JSON.parse(JSON.stringify({ score: resilienceScore, projection, cohesion, durability, fatigue })),
        fragmentation_zones: JSON.parse(JSON.stringify(verdict.fracture_points)),
        stability_clusters: JSON.parse(JSON.stringify(verdict.resilient_clusters)),
        recovery_paths: JSON.parse(JSON.stringify(projection)),
        snapshot_type: "manual",
      });
      if (error) throw error;
      toast.success("Stability snapshot captured");
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
          <Shield className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-semibold">Stability Fabric</h1>
            <p className="text-sm text-muted-foreground">
              Cross-engine stability, degradation detection, consensus integrity and resilience continuity.
            </p>
          </div>
        </div>
        <Button onClick={captureSnapshot} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Capture Stability Snapshot"}
        </Button>
      </div>

      <StabilityExecutiveSummary metrics={execSummary} />

      <Tabs defaultValue="fabric">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="fabric">Stability Fabric</TabsTrigger>
          <TabsTrigger value="integrity">Systemic Integrity</TabsTrigger>
          <TabsTrigger value="executive">Executive Stability</TabsTrigger>
          <TabsTrigger value="semantic">Semantic Resilience</TabsTrigger>
          <TabsTrigger value="consensus">Consensus Integrity</TabsTrigger>
          <TabsTrigger value="dispersion">Systemic Dispersion</TabsTrigger>
          <TabsTrigger value="silent">Silent Degradation</TabsTrigger>
          <TabsTrigger value="equilibrium">Strategic Equilibrium</TabsTrigger>
          <TabsTrigger value="recovery">Recovery Cohesion</TabsTrigger>
          <TabsTrigger value="volatility">Operational Volatility</TabsTrigger>
          <TabsTrigger value="persistence">Stability Persistence</TabsTrigger>
          <TabsTrigger value="summary">Executive Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="fabric"><StabilityFabricCard verdict={verdict} /></TabsContent>
        <TabsContent value="integrity">
          <Card>
            <CardHeader><CardTitle>Systemic Integrity</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="text-3xl font-semibold">{integrity}<span className="text-base text-muted-foreground">/100</span></div>
              <p className="text-muted-foreground">Composite integrity across layers; consensus {consensusStability}/100.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="executive"><ExecutiveStabilityCard summary={executive} /></TabsContent>
        <TabsContent value="semantic">
          <ResilienceContinuityGauge
            score={resilienceScore} verdict={resilienceVerdict}
            cohesion={cohesion} durability={durability} fatigue={fatigue}
            projection={projection}
          />
        </TabsContent>
        <TabsContent value="consensus">
          <ConsensusIntegrityMatrix
            score={consensusScore} verdict={consensusVerdict}
            map={consensusMap} divergence={divergence} isolation={isolation}
          />
        </TabsContent>
        <TabsContent value="dispersion">
          <SystemicDispersionHeatmap score={dispersionScore} verdict={dispersionVerdict} cells={dispersionCells} />
        </TabsContent>
        <TabsContent value="silent">
          <SilentDegradationPanel
            silent={silent} authority={authority} semantic={semantic}
            operational={operational} velocity={velocity} risk={degradationRisk}
          />
        </TabsContent>
        <TabsContent value="equilibrium">
          <StrategicEquilibriumPanel equilibrium={equilibrium} integrity={integrity} persistence={persistence} />
        </TabsContent>
        <TabsContent value="recovery">
          <RecoveryCohesionTimeline points={projection} cohesion={cohesion} />
        </TabsContent>
        <TabsContent value="volatility">
          <Card>
            <CardHeader><CardTitle>Operational Volatility</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="text-3xl font-semibold">{executive.volatility}<span className="text-base text-muted-foreground">/100</span></div>
              <p className="text-muted-foreground">Volatility correlates with executive pressure ({executive.overload}/100).</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="persistence">
          <Card>
            <CardHeader><CardTitle>Stability Persistence</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="text-3xl font-semibold">{persistence}<span className="text-base text-muted-foreground">/100</span></div>
              <StabilityBreakAlert breaks={verdict.fracture_points} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="summary"><StabilityExecutiveSummary metrics={execSummary} /></TabsContent>
      </Tabs>
    </div>
  );
}
