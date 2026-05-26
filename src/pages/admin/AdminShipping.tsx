import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ShippingSettingsTab from "@/components/admin/shipping/ShippingSettingsTab";
import ShippingProvidersTab from "@/components/admin/shipping/ShippingProvidersTab";
import ShippingRulesTab from "@/components/admin/shipping/ShippingRulesTab";
import ShippingAuditTab from "@/components/admin/shipping/ShippingAuditTab";
import { Truck } from "lucide-react";

export default function AdminShipping() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground flex items-center gap-2">
          <Truck className="h-7 w-7 text-primary" /> Gestão de Fretes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure origem, provedores, regras promocionais e acompanhe falhas de cálculo.
        </p>
      </header>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="settings">Origem &amp; Padrões</TabsTrigger>
          <TabsTrigger value="providers">Provedores</TabsTrigger>
          <TabsTrigger value="rules">Regras &amp; Promoções</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="mt-6"><ShippingSettingsTab /></TabsContent>
        <TabsContent value="providers" className="mt-6"><ShippingProvidersTab /></TabsContent>
        <TabsContent value="rules" className="mt-6"><ShippingRulesTab /></TabsContent>
        <TabsContent value="audit" className="mt-6"><ShippingAuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}
