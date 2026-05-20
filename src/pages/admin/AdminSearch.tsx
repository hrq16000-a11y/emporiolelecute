// Fase 2 — Página administrativa: cockpit da busca.
// Reúne Insights, Sinônimos e Boosts em abas.

import { useState } from "react";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import SearchInsights from "@/components/admin/SearchInsights";
import SynonymEditor from "@/components/admin/SynonymEditor";
import SearchBoostEditor from "@/components/admin/SearchBoostEditor";

export default function AdminSearch() {
  const [tab, setTab] = useState("insights");
  const [presetSyn, setPresetSyn] = useState<string | null>(null);
  const [presetBoost, setPresetBoost] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display flex items-center gap-2">
          <Search className="h-5 w-5" /> Busca · Cockpit do lojista
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Veja o que os visitantes procuram, crie sinônimos para cobrir gírias e erros, e fixe
          produtos em campanhas. Toda mudança é refletida na vitrine imediatamente.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground space-y-1">
          <p>
            <strong>Quando criar um sinônimo?</strong> Quando um termo aparece nos Insights com
            várias buscas e taxa alta de "zero resultado". Adicione o termo como alias de um
            produto que já existe no catálogo.
          </p>
          <p>
            <strong>Quando pinar (boost)?</strong> Em campanhas sazonais ou lançamentos: cadastre
            o termo (ex.: "dia das mães") e pine os produtos que devem aparecer primeiro.
          </p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="synonyms">Sinônimos</TabsTrigger>
          <TabsTrigger value="boosts">Boosts</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-4">
          <SearchInsights
            onCreateSynonym={(t) => {
              setPresetSyn(t);
              setTab("synonyms");
            }}
            onCreateBoost={(t) => {
              setPresetBoost(t);
              setTab("boosts");
            }}
          />
        </TabsContent>

        <TabsContent value="synonyms" className="mt-4">
          <SynonymEditor
            presetCanonical={presetSyn}
            onConsumePreset={() => setPresetSyn(null)}
          />
        </TabsContent>

        <TabsContent value="boosts" className="mt-4">
          <SearchBoostEditor
            presetTerm={presetBoost}
            onConsumePreset={() => setPresetBoost(null)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
