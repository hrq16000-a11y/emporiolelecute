import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import SingleImageUpload from '@/components/admin/SingleImageUpload';
import { ArrowDown, ArrowUp, Plus, Trash2, Type, Palette, Image as ImageIcon, ListChecks } from 'lucide-react';
import {
  OPTION_TYPE_LABEL,
  createChoice,
  createOption,
  isChoiceType,
  type PersonalizationOption,
  type PersonalizationOptionType,
} from '@/lib/personalizationOptions';

interface Props {
  value: PersonalizationOption[];
  onChange: (options: PersonalizationOption[]) => void;
}

const TYPE_ICON: Record<PersonalizationOptionType, typeof Type> = {
  text: Type,
  color: Palette,
  image: ImageIcon,
  select: ListChecks,
};

/**
 * Construtor simples de opções de personalização por produto.
 * Cada opção vira um campo no PDP (texto, cores, imagens ou variações).
 */
export default function PersonalizationOptionsEditor({ value, onChange }: Props) {
  const update = (id: string, patch: Partial<PersonalizationOption>) =>
    onChange(value.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(OPTION_TYPE_LABEL) as PersonalizationOptionType[]).map((type) => {
          const Icon = TYPE_ICON[type];
          return (
            <Button
              key={type}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange([...value, createOption(type)])}
            >
              <Icon className="w-4 h-4 mr-1.5" />
              {OPTION_TYPE_LABEL[type]}
            </Button>
          );
        })}
      </div>

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma condição extra. Use os botões acima para criar campos de texto, cores, imagens ou variações
          que o cliente escolhe na página do produto.
        </p>
      )}

      <div className="space-y-4">
        {value.map((option, index) => {
          const Icon = TYPE_ICON[option.type];
          return (
            <div key={option.id} className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {OPTION_TYPE_LABEL[option.type]}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => move(index, -1)} aria-label="Subir">
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => move(index, 1)} aria-label="Descer">
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    aria-label="Remover opção"
                    onClick={() => onChange(value.filter((o) => o.id !== option.id))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Título exibido</Label>
                  <Input
                    value={option.label}
                    onChange={(e) => update(option.id, { label: e.target.value })}
                    placeholder="Ex: Escolha a cor da fita"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Texto de ajuda (opcional)</Label>
                  <Input
                    value={option.help || ''}
                    onChange={(e) => update(option.id, { help: e.target.value })}
                    placeholder="Ex: A cor pode variar levemente"
                  />
                </div>
              </div>

              {option.type === 'text' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Placeholder</Label>
                    <Input
                      value={option.placeholder || ''}
                      onChange={(e) => update(option.id, { placeholder: e.target.value })}
                      placeholder="Ex: Nome do bebê"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Limite de caracteres</Label>
                    <Input
                      type="number"
                      min={1}
                      value={option.max_length ?? ''}
                      onChange={(e) =>
                        update(option.id, { max_length: e.target.value ? parseInt(e.target.value) : undefined })
                      }
                      placeholder="60"
                    />
                  </div>
                </div>
              )}

              {isChoiceType(option.type) && (
                <div className="space-y-2">
                  <Label>{option.type === 'select' ? 'Variações' : option.type === 'color' ? 'Cores' : 'Imagens'}</Label>
                  {(option.choices || []).map((choice) => (
                    <div key={choice.id} className="rounded-md border bg-background p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={choice.label}
                          onChange={(e) =>
                            update(option.id, {
                              choices: (option.choices || []).map((c) =>
                                c.id === choice.id ? { ...c, label: e.target.value } : c,
                              ),
                            })
                          }
                          placeholder="Nome exibido (ex: Rosa bebê)"
                        />
                        {option.type === 'color' && (
                          <input
                            type="color"
                            aria-label={`Cor de ${choice.label || 'opção'}`}
                            value={/^#[0-9a-fA-F]{6}$/.test(choice.value || '') ? choice.value : '#f4a4a0'}
                            onChange={(e) =>
                              update(option.id, {
                                choices: (option.choices || []).map((c) =>
                                  c.id === choice.id ? { ...c, value: e.target.value } : c,
                                ),
                              })
                            }
                            className="h-9 w-12 shrink-0 cursor-pointer rounded border bg-background"
                          />
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive shrink-0"
                          aria-label="Remover item"
                          onClick={() =>
                            update(option.id, {
                              choices: (option.choices || []).filter((c) => c.id !== choice.id),
                            })
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {option.type === 'image' && (
                        <SingleImageUpload
                          value={choice.value || ''}
                          folder="personalizacao"
                          previewMaxWidth={140}
                          hint="Miniatura quadrada (ex: 400x400)"
                          onChange={(url) =>
                            update(option.id, {
                              choices: (option.choices || []).map((c) =>
                                c.id === choice.id ? { ...c, value: url } : c,
                              ),
                            })
                          }
                        />
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => update(option.id, { choices: [...(option.choices || []), createChoice()] })}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Adicionar item
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Label htmlFor={`req-${option.id}`} className="text-sm">
                  Preenchimento obrigatório
                </Label>
                <Switch
                  id={`req-${option.id}`}
                  checked={option.required === true}
                  onCheckedChange={(checked) => update(option.id, { required: checked })}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
