import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Orbit, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import NexusConvergenceCard from "@/components/admin/NexusConvergenceCard";
import TemporalCoherenceTimeline from "@/components/admin/TemporalCoherenceTimeline";
import NexusSignalIntegrityPanel from "@/components/admin/NexusSignalIntegrityPanel";
import SemanticTrustMatrix from "@/components/admin/SemanticTrustMatrix";
import CausalAlignmentGraph from "@/components/admin/CausalAlignmentGraph";
import OperationalContinuityGauge from "@/components/admin/OperationalContinuityGauge";
import StrategicDriftPanel from "@/components/admin/StrategicDriftPanel";
import TrustLeakMap from "@/components/admin/TrustLeakMap";
import CircularReasoningAlert from "@/components/admin/CircularReasoningAlert";
import ExecutiveConvergenceSummary from "@/components/admin/ExecutiveConvergenceSummary";

import { buildNexusVerdict, type NexusConvergenceInputs } from "@/lib/nexusConvergence";
import {
  calculateTemporalCoherence, buildTimelineContinuity, classifyTemporal,
  detectStrategicDrift, detectExecutionOscillation, detectMemoryInconsistency,
  type TemporalCoherenceInputs,
} from "@/lib/temporalCoherence";
import {
  evaluateSignalIntegrity, classifySignalConfidence, detectNoiseAmplification,
  detectSignalDilution, detectContradictorySignals, type NexusSignalInputs,
} from "@/lib/nexusSignalIntegrity";
import {
  buildSemanticTrustMatrix, calculateSemanticTrust, classifyTrust,
  type SemanticTrustInputs,
} from "@/lib/semanticTrustMatrix";
import {
  buildCausalAlignmentGraph, classifyCausal, detectCircularReasoning,
  calculateStrategicDependency, type CausalAlignmentInputs,
} from "@/lib/causalAlignment";
import {
  calculateOperationalContinuity, classifyContinuity, buildContinuityForecast,
  estimateRecoveryContinuity, estimateStrategicPersistence, detectExecutionDecay,
  type OperationalContinuityInputs,
} from "@/lib/operationalContinuity";

// Read-only demo inputs — additive, no public impact.
const NEX: NexusConvergenceInputs = {
  governance: 74, consciousness: 73, reality: 72, continuity: 73, executive: 75,
  semantic: 72, operational: 73, resilience: 74,
  fragmentation: 25, dissonance: 24, drift: 22, entropy: 26,
};
const TC: TemporalCoherenceInputs = {
  longitudinalStability: 73, driftRate: 22, oscillation: 24,
  memoryConsistency: 75, trendStability: 72,
};
const SI: NexusSignalInputs = {
  clarity: 74, reliability: 73, noise: 24, dilution: 22, contradictions: 21,
};
const ST: SemanticTrustInputs = {
  semanticConfidence: 74, authorityMatch: 73, trustLeak: 22,
  citationStrength: 72, contradictions: 21,
};
const CA: CausalAlignmentInputs = {
  causalIntegrity: 73, dependencyStrength: 72, brokenChains: 22,
  falseCorrelations: 21, circularReasoning: 20,
};
const OC: OperationalContinuityInputs = {
  persistence: 73, recoveryCapacity: 72, decayRate: 22,
  continuityBreaks: 23, strategicPersistence: 74,
};

export default function AdminSeoNexusConvergence() {
  const [saving, setSaving] = useState(false);

  const verdict = useMemo(() => buildNexusVerdict(NEX), []);
  const tcScore = useMemo(() => calculateTemporalCoherence(TC), []);
  const tcVerdict = classifyTemporal(tcScore);
  const timeline = useMemo(() => buildTimelineContinuity(TC), []);
  const driftScore = detectStrategicDrift(TC);
  const oscScore = detectExecutionOscillation(TC);
  const memScore = detectMemoryInconsistency(TC);

  const siScore = useMemo(() => evaluateSignalIntegrity(SI), []);
  const siConfidence = classifySignalConfidence(SI);
  const noise = detectNoiseAmplification(SI);
  const dilution = detectSignalDilution(SI);
  const contradictions = detectContradictorySignals(SI);

  const trust = useMemo(() => buildSemanticTrustMatrix(ST), []);
  const trustScore = calculateSemanticTrust(ST);
  const trustVerdict = classifyTrust(trustScore);

  const causal = useMemo(() => buildCausalAlignmentGraph(CA), []);
  const causalVerdict = classifyCausal(causal.score);
  const circular = detectCircularReasoning(CA);
  const dependency = calculateStrategicDependency(CA);

  const contScore = useMemo(() => calculateOperationalContinuity(OC), []);
  const contVerdict = classifyContinuity(contScore);
  const forecast = useMemo(() => buildContinuityForecast(OC), []);
  const recovery = estimateRecoveryContinuity(OC);
  const persistence = estimateStrategicPersistence(OC);
  const decay = detectExecutionDecay(OC);

  const executiveSummary = {
    convergence: verdict.score,
    trust: trustScore,
    stability: contScore,
    coherence: tcScore,
    drift: driftScore,
    integrity: siScore,
    verdict: verdict.verdict,
  };

  async function captureSnapshot() {
    setSaving(true);
    try {
      const { error } = await supabase.from("seo_nexus_convergence_snapshots").insert({
        convergence_score: verdict.score,
        strategic_consistency_score: Math.round((verdict.score + tcScore) / 2),
        temporal_coherence_score: tcScore,
        signal_integrity_score: siScore,
        semantic_trust_score: trustScore,
        governance_confidence_score: Math.round((trustScore + verdict.score) / 2),
        operational_stability_score: contScore,
        causal_alignment_score: causal.score,
        entropy_resistance_score: 100 - NEX.entropy,
        executive_clarity_score: Math.round((verdict.score + siScore) / 2),
        dominant_cluster: verdict.dominant_engines[0] ?? null,
        weakest_cluster: verdict.unstable_domains[0] ?? null,
        highest_risk_domain: verdict.blockers[0] ?? null,
        strongest_domain: verdict.strengths[0] ?? null,
        convergence_map: JSON.parse(JSON.stringify({ engines: NEX, verdict: verdict.verdict })),
        trust_matrix: JSON.parse(JSON.stringify(trust)),
        causal_graph: JSON.parse(JSON.stringify({ nodes: causal.nodes, edges: causal.edges })),
        strategic_conflicts: JSON.parse(JSON.stringify(verdict.conflict_zones)),
        resilience_projection: JSON.parse(JSON.stringify({ recovery, persistence, decay })),
        continuity_projection: JSON.parse(JSON.stringify(forecast)),
        snapshot_type: "manual",
      });
      if (error) throw error;
      toast.success("Nexus snapshot captured");
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
          <Orbit className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-semibold">Strategic Nexus</h1>
            <p className="text-sm text-muted-foreground">
              Convergence, trust and continuity diagnostics across all strategic engines.
            </p>
          </div>
        </div>
        <Button onClick={captureSnapshot} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Capture Nexus Snapshot"}
        </Button>
      </div>

      <ExecutiveConvergenceSummary metrics={executiveSummary} />

      <Tabs defaultValue="convergence">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="convergence">Convergence</TabsTrigger>
          <TabsTrigger value="temporal">Temporal Coherence</TabsTrigger>
          <TabsTrigger value="signal">Signal Integrity</TabsTrigger>
          <TabsTrigger value="trust">Semantic Trust</TabsTrigger>
          <TabsTrigger value="causal">Causal Alignment</TabsTrigger>
          <TabsTrigger value="continuity">Operational Continuity</TabsTrigger>
          <TabsTrigger value="drift">Strategic Drift</TabsTrigger>
          <TabsTrigger value="leaks">Trust Leaks</TabsTrigger>
          <TabsTrigger value="dependency">Dependency Integrity</TabsTrigger>
          <TabsTrigger value="circular">Circular Reasoning</TabsTrigger>
          <TabsTrigger value="executive">Executive Stability</TabsTrigger>
          <TabsTrigger value="summary">Unified Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="convergence"><NexusConvergenceCard verdict={verdict} /></TabsContent>
        <TabsContent value="temporal"><TemporalCoherenceTimeline points={timeline} verdict={tcVerdict} /></TabsContent>
        <TabsContent value="signal">
          <NexusSignalIntegrityPanel score={siScore} confidence={siConfidence} noise={noise} dilution={dilution} contradictions={contradictions} />
        </TabsContent>
        <TabsContent value="trust">
          <SemanticTrustMatrix score={trust.score} confidence={trust.confidence} leak={trust.leak} mismatch={trust.mismatch} heatmap={trust.heatmap} verdict={trustVerdict} />
        </TabsContent>
        <TabsContent value="causal">
          <CausalAlignmentGraph nodes={causal.nodes} edges={causal.edges} score={causal.score} verdict={causalVerdict} />
        </TabsContent>
        <TabsContent value="continuity">
          <OperationalContinuityGauge score={contScore} verdict={contVerdict} recovery={recovery} persistence={persistence} decay={decay} forecast={forecast} />
        </TabsContent>
        <TabsContent value="drift">
          <StrategicDriftPanel drift={driftScore} oscillation={oscScore} memoryInconsistency={memScore} />
        </TabsContent>
        <TabsContent value="leaks">
          <TrustLeakMap heatmap={trust.heatmap} leakScore={trust.leak} />
        </TabsContent>
        <TabsContent value="dependency">
          <Card>
            <CardHeader><CardTitle>Dependency Integrity</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="text-3xl font-semibold">{dependency}<span className="text-base text-muted-foreground">/100</span></div>
              <p className="text-muted-foreground">Strategic dependency strength across causal pathways.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="circular"><CircularReasoningAlert risk={circular} /></TabsContent>
        <TabsContent value="executive">
          <Card>
            <CardHeader><CardTitle>Executive Stability</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>Composite stability ({Math.round((verdict.score + contScore + tcScore) / 3)}/100) blends convergence, continuity and coherence.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="summary">
          <ExecutiveConvergenceSummary metrics={executiveSummary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
