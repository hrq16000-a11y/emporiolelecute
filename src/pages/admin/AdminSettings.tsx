import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Save, Phone, Mail, MapPin, Instagram, Facebook, ShoppingBag, Truck, Loader2, CreditCard, Percent, Plus, X, FileText, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FooterConfig, defaultFooterConfig, defaultTrustBadgesConfig, TrustBadgesConfig, TrustBadgeItem } from '@/hooks/useStoreSettings';

interface StoreSettings {
  homepage_config: {
    featured_products_count: number;
    featured_order: 'recent' | 'random' | 'category';
    show_categories_highlight: boolean;
    show_bestsellers: boolean;
    show_occasions: boolean;
  };
  contact_info: {
    whatsapp: string;
    email: string;
    address: string;
  };
  social_links: {
    instagram: string;
    facebook: string;
  };
  shipping_policy: {
    note: string;
    free_shipping_threshold: number;
  };
  payment_config: {
    pix_discount: number;
    installments: number;
    accepted_methods: {
      pix: boolean;
      credit_card: boolean;
      boleto: boolean;
    };
  };
  footer_config: FooterConfig;
  trust_badges_config: TrustBadgesConfig;
}

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<StoreSettings>({
    homepage_config: {
      featured_products_count: 6,
      featured_order: 'recent',
      show_categories_highlight: true,
      show_bestsellers: true,
      show_occasions: true,
    },
    contact_info: {
      whatsapp: '5541992214299',
      email: 'contato@emporiolelecute.com.br',
      address: 'São José dos Pinhais, PR',
    },
    social_links: {
      instagram: 'https://www.instagram.com/emporiolelecute',
      facebook: 'https://www.facebook.com/emporiolelecute',
    },
    shipping_policy: {
      note: 'O frete será calculado após a confirmação do pedido via WhatsApp',
      free_shipping_threshold: 0,
    },
    payment_config: {
      pix_discount: 7,
      installments: 3,
      accepted_methods: {
        pix: true,
        credit_card: true,
        boleto: false,
      },
    },
    footer_config: defaultFooterConfig,
    trust_badges_config: defaultTrustBadgesConfig,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*');

      if (error) throw error;

      if (data) {
        const newSettings = { ...settings };
        data.forEach((item: { key: string; value: any }) => {
          if (item.key in newSettings) {
            (newSettings as any)[item.key] = item.value;
          }
        });
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update each setting
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from('store_settings')
          .upsert({
            key,
            value,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'key'
          });

        if (error) throw error;
      }

      toast({
        title: "Configurações salvas!",
        description: "As alterações foram aplicadas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">Configurações</span>
          </div>
          <h1 className="text-4xl font-display font-semibold text-foreground">Configurações da Loja</h1>
          <p className="text-muted-foreground mt-2">Gerencie as configurações gerais da sua loja</p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary-dark text-primary-foreground"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Alterações
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Homepage Configuration */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              Página Inicial
            </CardTitle>
            <CardDescription>Configure a exibição de produtos na home</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Quantidade de Produtos em Destaque</Label>
              <Select 
                value={settings.homepage_config.featured_products_count.toString()}
                onValueChange={(value) => setSettings({
                  ...settings,
                  homepage_config: {
                    ...settings.homepage_config,
                    featured_products_count: parseInt(value)
                  }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 produtos</SelectItem>
                  <SelectItem value="6">6 produtos</SelectItem>
                  <SelectItem value="9">9 produtos</SelectItem>
                  <SelectItem value="12">12 produtos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ordem de Exibição</Label>
              <Select 
                value={settings.homepage_config.featured_order}
                onValueChange={(value: 'recent' | 'random' | 'category') => setSettings({
                  ...settings,
                  homepage_config: {
                    ...settings.homepage_config,
                    featured_order: value
                  }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais Recentes</SelectItem>
                  <SelectItem value="random">Aleatório</SelectItem>
                  <SelectItem value="category">Por Categoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Exibir Categorias em Destaque</Label>
                  <p className="text-sm text-muted-foreground">Sabonetes, Velas, etc.</p>
                </div>
                <Switch 
                  checked={settings.homepage_config.show_categories_highlight}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    homepage_config: {
                      ...settings.homepage_config,
                      show_categories_highlight: checked
                    }
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Exibir Mais Vendidos</Label>
                  <p className="text-sm text-muted-foreground">Seção "Nossos Favoritos"</p>
                </div>
                <Switch 
                  checked={settings.homepage_config.show_bestsellers}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    homepage_config: {
                      ...settings.homepage_config,
                      show_bestsellers: checked
                    }
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Exibir Ocasiões Especiais</Label>
                  <p className="text-sm text-muted-foreground">Maternidade, Casamento, etc.</p>
                </div>
                <Switch 
                  checked={settings.homepage_config.show_occasions}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    homepage_config: {
                      ...settings.homepage_config,
                      show_occasions: checked
                    }
                  })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Informações de Contato
            </CardTitle>
            <CardDescription>Dados de contato exibidos no site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                WhatsApp
              </Label>
              <Input 
                value={settings.contact_info.whatsapp}
                onChange={(e) => setSettings({
                  ...settings,
                  contact_info: {
                    ...settings.contact_info,
                    whatsapp: e.target.value
                  }
                })}
                placeholder="5541999999999"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input 
                type="email"
                value={settings.contact_info.email}
                onChange={(e) => setSettings({
                  ...settings,
                  contact_info: {
                    ...settings.contact_info,
                    email: e.target.value
                  }
                })}
                placeholder="contato@suaempresa.com.br"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Endereço
              </Label>
              <Input 
                value={settings.contact_info.address}
                onChange={(e) => setSettings({
                  ...settings,
                  contact_info: {
                    ...settings.contact_info,
                    address: e.target.value
                  }
                })}
                placeholder="Cidade, Estado"
              />
            </div>
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-primary" />
              Redes Sociais
            </CardTitle>
            <CardDescription>Links para suas redes sociais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="w-4 h-4" />
                Instagram
              </Label>
              <Input 
                value={settings.social_links.instagram}
                onChange={(e) => setSettings({
                  ...settings,
                  social_links: {
                    ...settings.social_links,
                    instagram: e.target.value
                  }
                })}
                placeholder="https://instagram.com/..."
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Facebook className="w-4 h-4" />
                Facebook
              </Label>
              <Input 
                value={settings.social_links.facebook}
                onChange={(e) => setSettings({
                  ...settings,
                  social_links: {
                    ...settings.social_links,
                    facebook: e.target.value
                  }
                })}
                placeholder="https://facebook.com/..."
              />
            </div>

          </CardContent>
        </Card>

        {/* Shipping Policy */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Política de Frete
            </CardTitle>
            <CardDescription>Mensagem ao cliente e meta de frete grátis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nota sobre Frete</Label>
              <Textarea 
                value={settings.shipping_policy.note}
                onChange={(e) => setSettings({
                  ...settings,
                  shipping_policy: {
                    ...settings.shipping_policy,
                    note: e.target.value
                  }
                })}
                placeholder="Mensagem exibida sobre o frete..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Esta mensagem será exibida na página do produto e no carrinho
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="free-shipping-threshold">Valor mínimo para frete grátis (R$)</Label>
              <Input
                id="free-shipping-threshold"
                type="number"
                min={0}
                step="0.01"
                value={settings.shipping_policy.free_shipping_threshold || 0}
                onChange={(e) => setSettings({
                  ...settings,
                  shipping_policy: {
                    ...settings.shipping_policy,
                    free_shipping_threshold: Number(e.target.value) || 0,
                  },
                })}
                placeholder="0 (desativado)"
              />
              <p className="text-xs text-muted-foreground">
                Exibe a barra progressiva "Faltam R$ X para frete grátis" no carrinho. Deixe em <strong>0</strong> para desativar.
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="text-foreground font-medium mb-1 flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Configurações avançadas de frete
              </p>
              <p className="text-muted-foreground text-xs mb-2">
                Origem, provedores (Melhor Envio), regras por região/peso e auditoria de cálculos ficam em <strong>Gestão de Fretes</strong>.
              </p>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/admin/fretes">
                  Abrir Gestão de Fretes
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Configuration */}
        <Card className="border-0 shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Pagamento
            </CardTitle>
            <CardDescription>Configure desconto PIX, parcelamento e métodos aceitos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Settings */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    Desconto no PIX (%)
                  </Label>
                  <Input 
                    type="number"
                    min="0"
                    max="30"
                    value={settings.payment_config.pix_discount}
                    onChange={(e) => setSettings({
                      ...settings,
                      payment_config: {
                        ...settings.payment_config,
                        pix_discount: parseInt(e.target.value) || 0
                      }
                    })}
                    placeholder="7"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Parcelamento no Cartão</Label>
                  <Select 
                    value={settings.payment_config.installments.toString()}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      payment_config: {
                        ...settings.payment_config,
                        installments: parseInt(value)
                      }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2x sem juros</SelectItem>
                      <SelectItem value="3">3x sem juros</SelectItem>
                      <SelectItem value="6">6x sem juros</SelectItem>
                      <SelectItem value="12">12x sem juros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <Label>Métodos de Pagamento Aceitos</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center">
                          <span className="text-green-600 font-bold text-xs">PIX</span>
                        </div>
                        <span className="font-medium">PIX</span>
                      </div>
                      <Switch 
                        checked={settings.payment_config.accepted_methods?.pix ?? true}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          payment_config: {
                            ...settings.payment_config,
                            accepted_methods: {
                              ...settings.payment_config.accepted_methods,
                              pix: checked
                            }
                          }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="font-medium">Cartão de Crédito</span>
                      </div>
                      <Switch 
                        checked={settings.payment_config.accepted_methods?.credit_card ?? true}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          payment_config: {
                            ...settings.payment_config,
                            accepted_methods: {
                              ...settings.payment_config.accepted_methods,
                              credit_card: checked
                            }
                          }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center">
                          <span className="text-amber-600 font-bold text-[10px]">BOL</span>
                        </div>
                        <span className="font-medium">Boleto Bancário</span>
                      </div>
                      <Switch 
                        checked={settings.payment_config.accepted_methods?.boleto ?? false}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          payment_config: {
                            ...settings.payment_config,
                            accepted_methods: {
                              ...settings.payment_config.accepted_methods,
                              boleto: checked
                            }
                          }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Preview em Tempo Real</Label>
                <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                  <div className="text-center border-b border-border pb-4">
                    <p className="text-sm text-muted-foreground mb-1">Valor total (exemplo)</p>
                    <p className="text-3xl font-bold text-foreground">R$ 100,00</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ou {settings.payment_config.installments}x sem juros de R$ {(100 / settings.payment_config.installments).toFixed(2).replace('.', ',')} no cartão
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                      -{settings.payment_config.pix_discount}% no Pix
                    </span>
                    <span className="text-lg font-semibold text-green-600">
                      R$ {(100 * (1 - settings.payment_config.pix_discount / 100)).toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-3">Formas de pagamento aceitas:</p>
                    <div className="flex flex-wrap gap-2">
                      {settings.payment_config.accepted_methods?.pix && (
                        <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          PIX
                        </span>
                      )}
                      {settings.payment_config.accepted_methods?.credit_card && (
                        <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          Cartão de Crédito
                        </span>
                      )}
                      {settings.payment_config.accepted_methods?.boleto && (
                        <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                          Boleto Bancário
                        </span>
                      )}
                      {!settings.payment_config.accepted_methods?.pix && 
                       !settings.payment_config.accepted_methods?.credit_card && 
                       !settings.payment_config.accepted_methods?.boleto && (
                        <span className="text-sm text-muted-foreground">Nenhum método selecionado</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Este é um exemplo de como as informações aparecerão na página do produto
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Footer Configuration */}
        <Card className="border-0 shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Configuração do Rodapé
            </CardTitle>
            <CardDescription>Personalize o conteúdo do rodapé do site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Descrição da Marca</Label>
                  <Textarea 
                    value={settings.footer_config.brand_description}
                    onChange={(e) => setSettings({
                      ...settings,
                      footer_config: {
                        ...settings.footer_config,
                        brand_description: e.target.value
                      }
                    })}
                    placeholder="Descrição exibida no rodapé..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Telefone de Contato</Label>
                  <Input 
                    value={settings.footer_config.contacts.phone}
                    onChange={(e) => setSettings({
                      ...settings,
                      footer_config: {
                        ...settings.footer_config,
                        contacts: {
                          ...settings.footer_config.contacts,
                          phone: e.target.value
                        }
                      }
                    })}
                    placeholder="(41) 99999-9999"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Textarea 
                    value={settings.footer_config.contacts.address}
                    onChange={(e) => setSettings({
                      ...settings,
                      footer_config: {
                        ...settings.footer_config,
                        contacts: {
                          ...settings.footer_config.contacts,
                          address: e.target.value
                        }
                      }
                    })}
                    placeholder="Cidade, Estado"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Texto do Copyright</Label>
                  <Input 
                    value={settings.footer_config.footer_text}
                    onChange={(e) => setSettings({
                      ...settings,
                      footer_config: {
                        ...settings.footer_config,
                        footer_text: e.target.value
                      }
                    })}
                    placeholder="© {year} Sua Empresa..."
                  />
                  <p className="text-xs text-muted-foreground">Use {'{year}'} para inserir o ano atual automaticamente</p>
                </div>

                <div className="space-y-2">
                  <Label>Texto "Feito com Amor"</Label>
                  <Input 
                    value={settings.footer_config.made_with_love}
                    onChange={(e) => setSettings({
                      ...settings,
                      footer_config: {
                        ...settings.footer_config,
                        made_with_love: e.target.value
                      }
                    })}
                    placeholder="Feito com ❤️ em Cidade, Estado"
                  />
                </div>
              </div>

              {/* Right Column - Links */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Links Úteis</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {settings.footer_config.useful_links.map((link, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input 
                          value={link.label}
                          onChange={(e) => {
                            const newLinks = [...settings.footer_config.useful_links];
                            newLinks[index] = { ...newLinks[index], label: e.target.value };
                            setSettings({
                              ...settings,
                              footer_config: { ...settings.footer_config, useful_links: newLinks }
                            });
                          }}
                          placeholder="Texto"
                          className="flex-1"
                        />
                        <Input 
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...settings.footer_config.useful_links];
                            newLinks[index] = { ...newLinks[index], url: e.target.value };
                            setSettings({
                              ...settings,
                              footer_config: { ...settings.footer_config, useful_links: newLinks }
                            });
                          }}
                          placeholder="URL"
                          className="flex-1"
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            const newLinks = settings.footer_config.useful_links.filter((_, i) => i !== index);
                            setSettings({
                              ...settings,
                              footer_config: { ...settings.footer_config, useful_links: newLinks }
                            });
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSettings({
                      ...settings,
                      footer_config: {
                        ...settings.footer_config,
                        useful_links: [...settings.footer_config.useful_links, { label: '', url: '' }]
                      }
                    })}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Link
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Ocasiões</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {settings.footer_config.occasions.map((occasion, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input 
                          value={occasion.label}
                          onChange={(e) => {
                            const newOccasions = [...settings.footer_config.occasions];
                            newOccasions[index] = { ...newOccasions[index], label: e.target.value };
                            setSettings({
                              ...settings,
                              footer_config: { ...settings.footer_config, occasions: newOccasions }
                            });
                          }}
                          placeholder="Nome da ocasião"
                          className="flex-1"
                        />
                        <Input 
                          value={occasion.url}
                          onChange={(e) => {
                            const newOccasions = [...settings.footer_config.occasions];
                            newOccasions[index] = { ...newOccasions[index], url: e.target.value };
                            setSettings({
                              ...settings,
                              footer_config: { ...settings.footer_config, occasions: newOccasions }
                            });
                          }}
                          placeholder="URL"
                          className="flex-1"
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            const newOccasions = settings.footer_config.occasions.filter((_, i) => i !== index);
                            setSettings({
                              ...settings,
                              footer_config: { ...settings.footer_config, occasions: newOccasions }
                            });
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSettings({
                      ...settings,
                      footer_config: {
                        ...settings.footer_config,
                        occasions: [...settings.footer_config.occasions, { label: '', url: '' }]
                      }
                    })}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Ocasião
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trust Badges */}
        <Card className="border-0 shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              Selos de Confiança (Trust Badges)
            </CardTitle>
            <CardDescription>
              Edite os 4 selos exibidos em todas as páginas (Home, Loja, Produto, Carrinho, Landings).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              {settings.trust_badges_config.items.map((item, index) => (
                <div key={index} className="grid md:grid-cols-[180px_1fr_1fr_auto] gap-2 items-center">
                  <Select
                    value={item.icon}
                    onValueChange={(v) => {
                      const items = [...settings.trust_badges_config.items];
                      items[index] = { ...items[index], icon: v as TrustBadgeItem['icon'] };
                      setSettings({ ...settings, trust_badges_config: { ...settings.trust_badges_config, items } });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['Truck','Percent','Headset','CreditCard','Shield','Heart','Sparkles','Package','Clock','Star'] as const).map(ic => (
                        <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={item.title}
                    placeholder="Título (ex: Envio para)"
                    onChange={(e) => {
                      const items = [...settings.trust_badges_config.items];
                      items[index] = { ...items[index], title: e.target.value };
                      setSettings({ ...settings, trust_badges_config: { ...settings.trust_badges_config, items } });
                    }}
                  />
                  <Input
                    value={item.subtitle}
                    placeholder="Subtítulo (ex: Todo o Brasil)"
                    onChange={(e) => {
                      const items = [...settings.trust_badges_config.items];
                      items[index] = { ...items[index], subtitle: e.target.value };
                      setSettings({ ...settings, trust_badges_config: { ...settings.trust_badges_config, items } });
                    }}
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => {
                      const items = settings.trust_badges_config.items.filter((_, i) => i !== index);
                      setSettings({ ...settings, trust_badges_config: { ...settings.trust_badges_config, items } });
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setSettings({
                  ...settings,
                  trust_badges_config: {
                    ...settings.trust_badges_config,
                    items: [...settings.trust_badges_config.items, { icon: 'Truck', title: '', subtitle: '' }],
                  },
                })}
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar Selo
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;