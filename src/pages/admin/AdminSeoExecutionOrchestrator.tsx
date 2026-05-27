import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Rocket, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import ExecutionCadenceCard from "@/components/admin/ExecutionCadenceCard";
import StrategicPacingGauge from "@/components/admin/StrategicPacingGauge";
import CompoundingLeveragePanel from "@/components/admin/CompoundingLeveragePanel";
import ExecutionWasteHeatmap from "@/components/admin/ExecutionWasteHeatmap";
import OperationalRhythmTimeline from "@/components/admin/OperationalRhythmTimeline";
import ExecutionConflictMatrix from "@/components/admin/ExecutionConflictMatrix";
import FocusWindowPlanner from "@/components/admin/FocusWindowPlanner";
import StrategicFatigueAlert from "@/components/admin/StrategicFatigueAlert";
import ExecutionSustainabilityCard from "@/components/admin/ExecutionSustainabilityCard";
import ExecutiveActionSummary from "@/components/admin/ExecutiveActionSummary";

import { buildCoreMetricsCanon } from "@/lib/coreMetricsCanon";
import {
  buildExecutionCycles, buildStrategicExecutionQueue, buildOperationalCadence,
  buildRecoverySequence, buildCompoundingSequence,
  detectExecutionOverload, detectStrategicThrashing,
  calculateExecutionSustainability, estimateOperationalDrag,
} from "@/lib/executionOrchestrator";
import {
  buildSustainableCadence, detectStrategicFatigue, detectOverextension,
  calculateOperationalBreathingRoom, detectMaintenanceDebtAcceleration,
  estimateExecutionCapacityWindow,
} from "@/lib/strategicPacing";
import {
  calculateExecutionLeverage, detectExecutionWaste,
  estimateCompoundingAuthority, estimateSemanticCompounding,
  estimateLongTermStrategicValue, detectLowLeverageExecution,
} from "@/lib/executionLeverage";
import {
  buildExecutionRhythm, detectRhythmInstability, detectStrategicChaos,
  calculateOperationalHarmony, buildFocusWindows, estimateRecoveryIntervals,
} from "@/lib/operationalRhythm";
import {
  detectPriorityConflicts, detectResourceConflicts, detectStrategicCollision,
  detectQueueCannibalization, buildConflictResolutionSuggestions,
} from "@/lib/executionConflictEngine";
import {
  buildTopExecutiveActions, buildTopSuppressions, buildStrategicFocusMap,
  buildExecutionNarrative, buildOperationalSummary, buildWeeklyExecutionMap,
} from "@/lib/executiveActionEngine";

export default function AdminSeoExecutionOrchestrator() {
  const [saving, setSaving] = useState(false);

  const canon = useMemo(() => buildCoreMetricsCanon(), []);
  const cycles = useMemo(() => buildExecutionCycles(canon), [canon]);
  const queue = useMemo(() => buildStrategicExecutionQueue(canon), [canon]);
  const cadence = useMemo(() => buildOperationalCadence(canon), [canon]);
  const sustainable = useMemo(() => buildSustainableCadence(canon), [canon]);
  const recovery = useMemo(() => buildRecoverySequence(canon), [canon]);
  const compounding = useMemo(() => buildCompoundingSequence(canon), [canon]);
  const overload = detectExecutionOverload(canon);
  const thrashing = detectStrategicThrashing(canon);
  const sustainability = calculateExecutionSustainability(canon);
  const drag = estimateOperationalDrag(canon);

  const fatigue = detectStrategicFatigue(canon);
  const overext = detectOverextension(canon);
  const breathing = calculateOperationalBreathingRoom(canon);
  const debt = detectMaintenanceDebtAcceleration(canon);
  const capacity = estimateExecutionCapacityWindow(canon);

  const leverage = calculateExecutionLeverage(canon);
  const waste = useMemo(() => detectExecutionWaste(canon), [canon]);
  const lowLev = useMemo(() => detectLowLeverageExecution(canon), [canon]);
  const authority = estimateCompoundingAuthority(canon);
  const semantic = estimateSemanticCompounding(canon);
  const longTermValue = estimateLongTermStrategicValue(canon);

  const rhythm = useMemo(() => buildExecutionRhythm(canon), [canon]);
  const instability = detectRhythmInstability(canon);
  const chaos = detectStrategicChaos(canon);
  const harmony = calculateOperationalHarmony(canon);
  const focusWindows = useMemo(() => buildFocusWindows(canon), [canon]);
  const recoveryIntervals = estimateRecoveryIntervals(canon);

  const priorityConflicts = useMemo(() => detectPriorityConflicts(canon), [canon]);
  const resourceConflicts = useMemo(() => detectResourceConflicts(canon), [canon]);
  const collision = detectStrategicCollision(canon);
  const cannibalization = detectQueueCannibalization(canon);
  const conflictSuggestions = useMemo(() => buildConflictResolutionSuggestions(canon), [canon]);

  const topActions = useMemo(() => buildTopExecutiveActions(canon), [canon]);
  const topSuppress = useMemo(() => buildTopSuppressions(canon), [canon]);
  const focusMap = useMemo(() => buildStrategicFocusMap(canon), [canon]);
  const narrative = useMemo(() => buildExecutionNarrative(canon), [canon]);
  const summary = useMemo(() => buildOperationalSummary(canon), [canon]);
  const weekly = useMemo(() => buildWeeklyExecutionMap(canon), [canon]);

  async function captureSnapshot() {
    setSaving(true);
    try {
      const { error } = await supabase.from("seo_execution_orchestrator_snapshots").insert({
        execution_sustainability_score: sustainability,
        operational_rhythm_score: harmony,
        strategic_focus_score: leverage,
        compounding_leverage_score: longTermValue,
        execution_overload_score: overload.score,
        maintenance_pressure_score: debt,
        recovery_capacity_score: breathing,
        strategic_fatigue_score: fatigue,
        operational_drag_score: drag,
        execution_clarity_score: summary.sustainability,
        queue_conflict_score: collision,
        cadence_stability_score: cadence.pace,
        notes: "Manual snapshot — Phase 18 execution orchestrator",
        payload: JSON.parse(JSON.stringify({
          focusMap, weekly, narrative,
          queue_by_class: queue.by_class,
          cadence_label: cadence.cadence_label,
        })),
      });
      if (error) throw error;
      toast.success("Execution snapshot captured");
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
          <Rocket className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-semibold">Execution Orchestrator</h1>
            <p className="text-sm text-muted-foreground">
              Phase 18 — Queues, cadence, leverage, conflicts and sustainability. Read-only.
            </p>
          </div>
        </div>
        <Button onClick={captureSnapshot} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Capture Execution Snapshot"}
        </Button>
      </div>

      <ExecutiveActionSummary summary={summary} narrative={narrative} />

      <Tabs defaultValue="queue">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="queue">Executive Queue</TabsTrigger>
          <TabsTrigger value="cadence">Strategic Cadence</TabsTrigger>
          <TabsTrigger value="compounding">Compounding</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="focus">Focus Windows</TabsTrigger>
          <TabsTrigger value="waste">Execution Waste</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="sustain">Sustainability</TabsTrigger>
          <TabsTrigger value="rhythm">Operational Rhythm</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Map</TabsTrigger>
          <TabsTrigger value="summary">Executive Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <Card>
            <CardHeader><CardTitle>Executive Queue</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
              <Section title={`Do now (${topActions.length})`}>
                {topActions.map((i) => <li key={i.metric} className="border rounded p-2 text-xs">{i.metric} — {i.classification} · lev {i.leverage}</li>)}
              </Section>
              <Section title={`Suppress / ignore (${topSuppress.length})`}>
                {topSuppress.map((i) => <li key={i.metric} className="border rounded p-2 text-xs">{i.metric} — {i.classification}</li>)}
              </Section>
              <Section title={`Strategic focus map`}>
                <li className="text-xs text-muted-foreground">Now: {focusMap.now.join(", ") || "—"}</li>
                <li className="text-xs text-muted-foreground">Compounding: {focusMap.compounding.join(", ") || "—"}</li>
                <li className="text-xs text-muted-foreground">Suppress: {focusMap.suppress.join(", ") || "—"}</li>
                <li className="text-xs text-muted-foreground">Recover: {focusMap.recover.join(", ") || "—"}</li>
              </Section>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cadence">
          <div className="grid gap-4 md:grid-cols-2">
            <StrategicPacingGauge cadence={sustainable} />
            <ExecutionCadenceCard cycles={cycles} />
          </div>
        </TabsContent>

        <TabsContent value="compounding">
          <CompoundingLeveragePanel
            compounding={compounding}
            authority={authority} semantic={semantic} longTermValue={longTermValue}
          />
        </TabsContent>

        <TabsContent value="recovery">
          <Card>
            <CardHeader><CardTitle>Recovery Sequence</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-muted-foreground">
                Recovery interval ~{recoveryIntervals.interval_days} days · {recoveryIntervals.blocks_per_month} blocks/month.
              </p>
              <ul className="space-y-1">
                {recovery.map((r) => (
                  <li key={r.metric} className="border rounded p-2 text-xs flex justify-between">
                    <span>{r.metric}</span><span>pressure {r.pressure}</span>
                  </li>
                ))}
                {!recovery.length && <li className="text-muted-foreground">No recovery items.</li>}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader><CardTitle>Maintenance Pressure</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Maintenance debt acceleration" v={debt} />
                <Stat label="Operational drag" v={drag} />
                <Stat label="Low-leverage items" v={lowLev.length} raw />
              </div>
              <ul className="space-y-1 max-h-[320px] overflow-y-auto">
                {lowLev.map((i) => (
                  <li key={i.metric} className="border rounded p-2 text-xs">
                    <div className="flex justify-between"><span>{i.metric}</span><span>{i.leverage}</span></div>
                    <div className="text-muted-foreground">{i.reason}</div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="focus"><FocusWindowPlanner windows={focusWindows} /></TabsContent>
        <TabsContent value="waste"><ExecutionWasteHeatmap waste={waste} /></TabsContent>

        <TabsContent value="conflicts">
          <ExecutionConflictMatrix
            priorityConflicts={priorityConflicts}
            resourceConflicts={resourceConflicts}
            suggestions={conflictSuggestions}
            collision={collision}
            cannibalization={cannibalization}
          />
        </TabsContent>

        <TabsContent value="sustain">
          <div className="grid gap-4 md:grid-cols-2">
            <ExecutionSustainabilityCard
              sustainability={sustainability}
              harmony={harmony}
              overload={overload.score}
              drag={drag}
              thrashing={thrashing}
            />
            <StrategicFatigueAlert
              fatigue={fatigue} breathingRoom={breathing}
              overextended={overext.overextended} activeThreads={overext.active_threads}
            />
          </div>
        </TabsContent>

        <TabsContent value="rhythm">
          <OperationalRhythmTimeline
            points={rhythm} harmony={harmony} instability={instability} chaos={chaos}
          />
        </TabsContent>

        <TabsContent value="weekly">
          <Card>
            <CardHeader><CardTitle>Weekly Execution Map</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                {weekly.map((w) => (
                  <div key={w.week} className="border rounded p-3">
                    <div className="flex justify-between font-medium">
                      <span>{w.week}</span><span>load {w.load}</span>
                    </div>
                    <div className="text-xs mt-1"><strong>Focus</strong></div>
                    <ul className="text-xs text-muted-foreground list-disc pl-4">
                      {w.focus.map((f) => <li key={f}>{f}</li>)}
                      {!w.focus.length && <li className="italic">—</li>}
                    </ul>
                    <div className="text-xs mt-2"><strong>Maintenance</strong></div>
                    <ul className="text-xs text-muted-foreground list-disc pl-4">
                      {w.maintenance.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                    <div className="text-xs mt-2 text-muted-foreground">Recovery blocks: {w.recovery_blocks}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-3">
                Capacity window ~{capacity.window_days} days · safe capacity {capacity.safe_capacity}/100.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary"><ExecutiveActionSummary summary={summary} narrative={narrative} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, v, raw }: { label: string; v: number; raw?: boolean }) {
  return (
    <div className="border rounded p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{v}{!raw && <span className="text-xs text-muted-foreground">/100</span>}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-medium mb-1">{title}</div>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}
