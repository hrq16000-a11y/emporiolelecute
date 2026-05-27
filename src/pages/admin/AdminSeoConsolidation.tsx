import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import CoreMetricsCanonCard from "@/components/admin/CoreMetricsCanonCard";
import SignalCompressionPanel from "@/components/admin/SignalCompressionPanel";
import ExecutiveSignalMap from "@/components/admin/ExecutiveSignalMap";
import MetricOverlapMatrix from "@/components/admin/MetricOverlapMatrix";
import NoiseVsSignalGauge from "@/components/admin/NoiseVsSignalGauge";
import StrategicLeverageRadar from "@/components/admin/StrategicLeverageRadar";
import VanitySeoAlert from "@/components/admin/VanitySeoAlert";
import DeduplicationHeatmap from "@/components/admin/DeduplicationHeatmap";
import ComplexityPressureCard from "@/components/admin/ComplexityPressureCard";
import ExecutiveCompressionSummary from "@/components/admin/ExecutiveCompressionSummary";

import { buildCoreMetricsCanon } from "@/lib/coreMetricsCanon";
import {
  buildCompressedSignalMap, calculateObservabilityNoise, calculateSignalEntropy,
  detectSignalInflation,
} from "@/lib/metricCompression";
import {
  buildExecutivePriorityQueue, detectVanitySeoPatterns, detectLowLeverageWork,
  detectOperationalWasteChains,
} from "@/lib/executiveDecisionEngine";
import {
  calculateObservabilityEfficiency, calculateSignalToNoiseRatio,
  detectArtificialComplexity, normalizeTelemetry,
} from "@/lib/observabilityNormalization";
import {
  detectDuplicatedEngines, detectMirrorSystems, buildConsolidationSuggestions,
  estimateMaintenanceReduction,
} from "@/lib/systemicDeduplication";

export default function AdminSeoConsolidation() {
  const [saving, setSaving] = useState(false);

  const canon = useMemo(() => buildCoreMetricsCanon(), []);
  const compression = useMemo(() => buildCompressedSignalMap(canon), [canon]);
  const queue = useMemo(() => buildExecutivePriorityQueue(canon), [canon]);
  const vanity = useMemo(() => detectVanitySeoPatterns(canon), [canon]);
  const lowLev = useMemo(() => detectLowLeverageWork(canon), [canon]);
  const wasteChains = useMemo(() => detectOperationalWasteChains(canon), [canon]);
  const duplicates = useMemo(() => detectDuplicatedEngines(canon), [canon]);
  const mirrors = useMemo(() => detectMirrorSystems(canon), [canon]);
  const suggestions = useMemo(() => buildConsolidationSuggestions(canon), [canon]);
  const maintenanceReduction = useMemo(() => estimateMaintenanceReduction(canon), [canon]);

  const observabilityNoise = calculateObservabilityNoise(canon);
  const entropy = calculateSignalEntropy(canon);
  const efficiency = calculateObservabilityEfficiency(canon);
  const snr = calculateSignalToNoiseRatio(canon);
  const complexity = detectArtificialComplexity(canon);
  const inflation = detectSignalInflation(canon);
  const normalized = normalizeTelemetry(canon);

  const summary = {
    canon_score: canon.canon_score,
    compression_ratio: compression.compression_ratio,
    signal_to_noise: snr,
    observability_efficiency: efficiency,
    decision_confidence: queue.decision_confidence,
    artificial_complexity: complexity,
    redundant_count: canon.byClass.REDUNDANT ?? 0,
    core_count: canon.byClass.CORE ?? 0,
  };

  async function captureSnapshot() {
    setSaving(true);
    try {
      const { error } = await supabase.from("seo_consolidation_snapshots").insert({
        compression_score: Math.round(compression.compression_ratio * 100),
        observability_efficiency: efficiency,
        signal_noise_ratio: snr,
        executive_clarity_score: queue.decision_confidence,
        systemic_complexity_score: complexity,
        redundancy_score: canon.byClass.REDUNDANT ?? 0,
        strategic_focus_score: queue.by_class.HIGH_LEVERAGE + queue.by_class.COMPOUNDING,
        telemetry_entropy_score: entropy,
        operational_noise_score: observabilityNoise,
        executive_signal_quality: Math.round(
          compression.signals.reduce((a, s) => a + s.confidence, 0) / Math.max(compression.signals.length, 1),
        ),
        consolidation_confidence: maintenanceReduction,
        notes: "Manual snapshot — Phase 17 consolidation",
        payload: JSON.parse(JSON.stringify({
          canon_byClass: canon.byClass, signals: compression.signals,
          suggestions, mirrors, duplicates,
        })),
      });
      if (error) throw error;
      toast.success("Consolidation snapshot captured");
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
            <h1 className="text-2xl font-semibold">SEO Consolidation & Compression</h1>
            <p className="text-sm text-muted-foreground">
              Phase 17 — Canon, compression, deduplication and executive clarity. Read-only.
            </p>
          </div>
        </div>
        <Button onClick={captureSnapshot} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Capture Consolidation Snapshot"}
        </Button>
      </div>

      <ExecutiveCompressionSummary m={summary} />

      <Tabs defaultValue="canon">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="canon">Core Canon</TabsTrigger>
          <TabsTrigger value="compression">Compression</TabsTrigger>
          <TabsTrigger value="signals">Executive Signals</TabsTrigger>
          <TabsTrigger value="overlap">Metric Overlap</TabsTrigger>
          <TabsTrigger value="noise">Observability Noise</TabsTrigger>
          <TabsTrigger value="leverage">Strategic Leverage</TabsTrigger>
          <TabsTrigger value="vanity">Vanity SEO</TabsTrigger>
          <TabsTrigger value="dedup">Deduplication</TabsTrigger>
          <TabsTrigger value="complexity">Complexity</TabsTrigger>
          <TabsTrigger value="quality">Signal Quality</TabsTrigger>
          <TabsTrigger value="queue">Executive Queue</TabsTrigger>
          <TabsTrigger value="roadmap">Consolidation Roadmap</TabsTrigger>
        </TabsList>

        <TabsContent value="canon"><CoreMetricsCanonCard canon={canon} /></TabsContent>
        <TabsContent value="compression"><SignalCompressionPanel map={compression} /></TabsContent>
        <TabsContent value="signals"><ExecutiveSignalMap signals={compression.signals} /></TabsContent>
        <TabsContent value="overlap"><MetricOverlapMatrix overlaps={canon.overlap} /></TabsContent>
        <TabsContent value="noise">
          <NoiseVsSignalGauge
            signalToNoise={snr}
            observabilityNoise={observabilityNoise}
            entropy={entropy}
            efficiency={efficiency}
          />
        </TabsContent>
        <TabsContent value="leverage"><StrategicLeverageRadar items={queue.priority} /></TabsContent>
        <TabsContent value="vanity"><VanitySeoAlert vanity={vanity} lowLeverage={lowLev} /></TabsContent>
        <TabsContent value="dedup">
          <DeduplicationHeatmap
            duplicates={duplicates} mirrors={mirrors}
            suggestions={suggestions} maintenanceReduction={maintenanceReduction}
          />
        </TabsContent>
        <TabsContent value="complexity">
          <ComplexityPressureCard
            artificialComplexity={complexity}
            inflationScore={inflation.inflation_score}
            inflated={inflation.inflated_metrics}
          />
        </TabsContent>
        <TabsContent value="quality">
          <Card>
            <CardHeader><CardTitle>Signal Quality</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-muted-foreground">
                Normalized telemetry keeps {normalized.after_count} of {normalized.before_count} metrics
                (drop ratio {(normalized.drop_ratio * 100).toFixed(1)}%).
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {compression.signals.map((s) => (
                  <div key={s.key} className="border rounded p-2">
                    <div className="font-medium">{s.label}</div>
                    <div className="text-muted-foreground">Confidence {s.confidence}%</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="queue">
          <Card>
            <CardHeader><CardTitle>Executive Queue</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
              <div>
                <div className="font-medium">Do first ({queue.priority.length})</div>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {queue.priority.map((p) => <li key={p.metric}>{p.metric} — {p.classification}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-medium">Suppress / ignore ({queue.suppression.length})</div>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {queue.suppression.map((p) => <li key={p.metric}>{p.metric} — {p.classification}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-medium">Waste chains ({wasteChains.length})</div>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {wasteChains.map((w, i) => <li key={i}>{w.chain.join(" → ")} — {w.reason}</li>)}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="roadmap">
          <Card>
            <CardHeader><CardTitle>Consolidation Roadmap</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-muted-foreground">
                Suggestions are advisory. Nothing is removed or merged automatically.
              </p>
              <ul className="space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i} className="border rounded p-2 text-xs">
                    <div>Merge <strong>{s.merge.join(", ")}</strong> into <strong>{s.into}</strong></div>
                    <div className="text-muted-foreground">Savings ~{s.savings}/100 · {s.rationale}</div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
