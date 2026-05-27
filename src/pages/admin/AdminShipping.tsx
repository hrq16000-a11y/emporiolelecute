import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import ShippingSettingsTab from "@/components/admin/shipping/ShippingSettingsTab";
import ShippingProvidersTab from "@/components/admin/shipping/ShippingProvidersTab";
import ShippingRulesTab from "@/components/admin/shipping/ShippingRulesTab";
import ShippingAuditTab from "@/components/admin/shipping/ShippingAuditTab";
import { Truck, Settings as SettingsIcon, ExternalLink } from "lucide-react";

export default function AdminShipping() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-foreground flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" /> Gestão de Fretes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure origem, provedores, regras promocionais e acompanhe falhas de cálculo.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            A <strong>mensagem ao cliente</strong> e o <strong>valor mínimo para frete grátis</strong> ficam em{" "}
            <Link to="/admin/configuracoes" className="text-primary hover:underline inline-flex items-center gap-1">
              Configurações → Política de Frete
              <ExternalLink className="h-3 w-3" />
            </Link>
            .
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/admin/configuracoes">
            <SettingsIcon className="h-4 w-4" />
            Política de Frete
          </Link>
        </Button>
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
