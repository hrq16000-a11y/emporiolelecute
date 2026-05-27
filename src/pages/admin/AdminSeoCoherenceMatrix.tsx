import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import CoherenceMatrixCard from "@/components/admin/CoherenceMatrixCard";
import StrategicAlignmentPanel from "@/components/admin/StrategicAlignmentPanel";
import CognitiveConsistencyGauge from "@/components/admin/CognitiveConsistencyGauge";
import SemanticCoherenceMap from "@/components/admin/SemanticCoherenceMap";
import OperationalAlignmentHeatmap from "@/components/admin/OperationalAlignmentHeatmap";
import GovernanceAlignmentRadar from "@/components/admin/GovernanceAlignmentRadar";
import ContinuityCoherenceTimeline from "@/components/admin/ContinuityCoherenceTimeline";
import CoherenceBreakAlert from "@/components/admin/CoherenceBreakAlert";
import StrategicPersistencePanel from "@/components/admin/StrategicPersistencePanel";
import CoherenceExecutiveSummary from "@/components/admin/CoherenceExecutiveSummary";

import {
  buildCoherenceVerdict, calculateSystemicCoherence, calculateStrategicAlignment,
  estimateCoherencePersistence, type CoherenceMatrixInputs,
} from "@/lib/strategicCoherenceMatrix";
import {
  calculateCognitiveConsistency, classifyCognitive, buildConsistencyMap,
  detectCognitiveDrift, estimateDecisionConsistency,
  type CognitiveConsistencyInputs,
} from "@/lib/cognitiveConsistency";
import {
  calculateSemanticCoherence, classifySemanticCoherence, buildSemanticCoherenceMap,
  type SemanticCoherenceInputs,
} from "@/lib/semanticCoherenceEngine";
import {
  calculateOperationalAlignment, classifyOperationalAlignment, buildOperationalAlignmentHeatmap,
  detectExecutionDispersion, detectOperationalDissonance,
  type OperationalAlignmentInputs,
} from "@/lib/operationalAlignment";
import {
  calculateGovernanceAlignment, classifyGovernance, buildGovernanceAlignmentMap,
  detectGovernanceConflicts, detectStrategicGovernanceDrift, calculateGovernanceHarmony,
  type GovernanceAlignmentInputs,
} from "@/lib/governanceAlignment";
import {
  calculateContinuityCoherence, classifyContinuityCoherence, buildContinuityCoherenceProjection,
  detectContinuityDissonance, detectTemporalInconsistency, estimateStrategicPersistence,
  estimateContinuityResilience,
  type ContinuityCoherenceInputs,
} from "@/lib/continuityCoherence";

// Read-only demo inputs.
const CM: CoherenceMatrixInputs = {
  systemic: 74, alignment: 73, cognitive: 72, semantic: 73, operational: 72,
  governance: 74, continuity: 73, resilience: 72, execution: 71,
  misalignment: 22, divergence: 23, dispersion: 24,
};
const CC: CognitiveConsistencyInputs = {
  clarity: 74, decisionStability: 73, reasoningCoherence: 72, drift: 22, conflicts: 21, confusion: 23,
};
const SC: SemanticCoherenceInputs = {
  flow: 73, consistency: 72, density: 71, divergence: 23, noise: 22, meaningConflicts: 21,
};
const OA: OperationalAlignmentInputs = {
  execution: 72, coordination: 73, alignment: 74, dispersion: 23, dissonance: 22, conflicts: 21,
};
const GA: GovernanceAlignmentInputs = {
  authority: 74, consistency: 73, continuity: 72, conflicts: 22, drift: 21, harmony: 73,
};
const CO: ContinuityCoherenceInputs = {
  persistence: 73, resilience: 72, endurance: 74, dissonance: 22, inconsistency: 21, decay: 23,
};

export default function AdminSeoCoherenceMatrix() {
  const [saving, setSaving] = useState(false);

  const verdict = useMemo(() => buildCoherenceVerdict(CM), []);
  const systemic = calculateSystemicCoherence(CM);
  const alignment = calculateStrategicAlignment(CM);
  const persistence = estimateCoherencePersistence(CM);

  const cogScore = calculateCognitiveConsistency(CC);
  const cogVerdict = classifyCognitive(cogScore);
  const cogMap = useMemo(() => buildConsistencyMap(CC), []);
  const cogDrift = detectCognitiveDrift(CC);
  const cogDecisions = estimateDecisionConsistency(CC);

  const semScore = calculateSemanticCoherence(SC);
  const semVerdict = classifySemanticCoherence(semScore);
  const semMap = useMemo(() => buildSemanticCoherenceMap(SC), []);

  const opScore = calculateOperationalAlignment(OA);
  const opVerdict = classifyOperationalAlignment(opScore);
  const opCells = useMemo(() => buildOperationalAlignmentHeatmap(OA), []);
  const opDispersion = detectExecutionDispersion(OA);
  const opDissonance = detectOperationalDissonance(OA);

  const govScore = calculateGovernanceAlignment(GA);
  const govVerdict = classifyGovernance(govScore);
  const govMap = useMemo(() => buildGovernanceAlignmentMap(GA), []);
  const govConflicts = detectGovernanceConflicts(GA);
  const govDrift = detectStrategicGovernanceDrift(GA);
  const govHarmony = calculateGovernanceHarmony(GA);

  const contScore = calculateContinuityCoherence(CO);
  const contVerdict = classifyContinuityCoherence(contScore);
  const contProjection = useMemo(() => buildContinuityCoherenceProjection(CO), []);
  const contDissonance = detectContinuityDissonance(CO);
  const contInconsistency = detectTemporalInconsistency(CO);
  const contStrategicPersistence = estimateStrategicPersistence(CO);
  const contResilience = estimateContinuityResilience(CO);

  const execSummary = {
    coherence: verdict.score,
    alignment,
    cognition: cogScore,
    continuity: contScore,
    resilience: contResilience,
    persistence,
    verdict: verdict.verdict,
  };

  async function captureSnapshot() {
    setSaving(true);
    try {
      const { error } = await supabase.from("seo_coherence_matrix_snapshots").insert({
        coherence_matrix_score: verdict.score,
        systemic_coherence_score: systemic,
        strategic_alignment_score: alignment,
        cognitive_consistency_score: cogScore,
        semantic_coherence_score: semScore,
        operational_alignment_score: opScore,
        governance_alignment_score: govScore,
        continuity_coherence_score: contScore,
        resilience_coherence_score: contResilience,
        execution_coherence_score: OA.execution,
        strategic_misalignment_risk: CM.misalignment,
        semantic_divergence_risk: semMap.divergence_score,
        operational_dispersion_risk: opDispersion,
        governance_dissonance_risk: govConflicts,
        cognitive_fragmentation_risk: cogMap.confusion_score,
        coherence_map: JSON.parse(JSON.stringify({ systemic, alignment, persistence, verdict: verdict.verdict })),
        alignment_matrix: JSON.parse(JSON.stringify({ strengths: verdict.strengths, aligned: verdict.aligned_clusters })),
        semantic_flow_map: JSON.parse(JSON.stringify(semMap)),
        operational_dissonance_map: JSON.parse(JSON.stringify({ cells: opCells, dispersion: opDispersion, dissonance: opDissonance })),
        resilience_alignment_map: JSON.parse(JSON.stringify({ ...govMap, harmony: govHarmony, drift: govDrift })),
        continuity_coherence_graph: JSON.parse(JSON.stringify({ projection: contProjection, dissonance: contDissonance, inconsistency: contInconsistency })),
        snapshot_type: "manual",
      });
      if (error) throw error;
      toast.success("Coherence snapshot captured");
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
          <Boxes className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-semibold">Strategic Coherence Matrix</h1>
            <p className="text-sm text-muted-foreground">
              Cross-engine coherence, alignment, cognition, continuity and persistence.
            </p>
          </div>
        </div>
        <Button onClick={captureSnapshot} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Capture Coherence Snapshot"}
        </Button>
      </div>

      <CoherenceExecutiveSummary metrics={execSummary} />

      <Tabs defaultValue="matrix">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="matrix">Coherence Matrix</TabsTrigger>
          <TabsTrigger value="systemic">Systemic Coherence</TabsTrigger>
          <TabsTrigger value="alignment">Strategic Alignment</TabsTrigger>
          <TabsTrigger value="cognitive">Cognitive Consistency</TabsTrigger>
          <TabsTrigger value="semantic">Semantic Coherence</TabsTrigger>
          <TabsTrigger value="operational">Operational Alignment</TabsTrigger>
          <TabsTrigger value="governance">Governance Alignment</TabsTrigger>
          <TabsTrigger value="continuity">Continuity Coherence</TabsTrigger>
          <TabsTrigger value="persistence">Strategic Persistence</TabsTrigger>
          <TabsTrigger value="risks">Fragmentation Risks</TabsTrigger>
          <TabsTrigger value="coh-persistence">Coherence Persistence</TabsTrigger>
          <TabsTrigger value="summary">Executive Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix"><CoherenceMatrixCard verdict={verdict} /></TabsContent>
        <TabsContent value="systemic">
          <Card>
            <CardHeader><CardTitle>Systemic Coherence</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="text-3xl font-semibold">{systemic}<span className="text-base text-muted-foreground">/100</span></div>
              <p className="text-muted-foreground">Composite cross-layer coherence across all strategic engines.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="alignment">
          <StrategicAlignmentPanel alignment={alignment} systemic={systemic} persistence={persistence} />
        </TabsContent>
        <TabsContent value="cognitive">
          <CognitiveConsistencyGauge
            score={cogScore} verdict={cogVerdict} map={cogMap}
            drift={cogDrift} decisions={cogDecisions}
          />
        </TabsContent>
        <TabsContent value="semantic">
          <SemanticCoherenceMap score={semScore} verdict={semVerdict} map={semMap} />
        </TabsContent>
        <TabsContent value="operational">
          <OperationalAlignmentHeatmap
            score={opScore} verdict={opVerdict} cells={opCells}
            dispersion={opDispersion} dissonance={opDissonance}
          />
        </TabsContent>
        <TabsContent value="governance">
          <GovernanceAlignmentRadar
            score={govScore} verdict={govVerdict} map={govMap}
            conflicts={govConflicts} drift={govDrift} harmony={govHarmony}
          />
        </TabsContent>
        <TabsContent value="continuity">
          <ContinuityCoherenceTimeline
            score={contScore} verdict={contVerdict} points={contProjection}
            dissonance={contDissonance} inconsistency={contInconsistency}
          />
        </TabsContent>
        <TabsContent value="persistence">
          <StrategicPersistencePanel
            persistence={contStrategicPersistence} resilience={contResilience} continuity={contScore}
          />
        </TabsContent>
        <TabsContent value="risks">
          <Card>
            <CardHeader><CardTitle>Fragmentation Risks</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Stat label="Strategic misalignment" v={CM.misalignment} />
                <Stat label="Semantic divergence" v={semMap.divergence_score} />
                <Stat label="Operational dispersion" v={opDispersion} />
                <Stat label="Governance dissonance" v={govConflicts} />
                <Stat label="Cognitive fragmentation" v={cogMap.confusion_score} />
                <Stat label="Continuity dissonance" v={contDissonance} />
              </div>
              <CoherenceBreakAlert breaks={verdict.divergence_points} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="coh-persistence">
          <Card>
            <CardHeader><CardTitle>Coherence Persistence</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="text-3xl font-semibold">{persistence}<span className="text-base text-muted-foreground">/100</span></div>
              <p className="text-muted-foreground">Resilience-weighted longitudinal coherence durability.</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Continuity resilience" v={contResilience} />
                <Stat label="Strategic persistence" v={contStrategicPersistence} />
                <Stat label="Governance harmony" v={govHarmony} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="summary"><CoherenceExecutiveSummary metrics={execSummary} /></TabsContent>
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
