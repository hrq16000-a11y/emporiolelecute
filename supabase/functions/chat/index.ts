import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const buildSystemPrompt = (products: any[]) => {
  const productList = products.map(p => 
    `- ${p.name}: R$ ${Number(p.price).toFixed(2).replace('.', ',')}${p.description ? ` - ${p.description}` : ''}`
  ).join('\n');

  return `Você é a LeleCute, assistente virtual do Empório LeleCute, uma loja de sabonetes e velas artesanais para lembrancinhas de eventos.

SOBRE A LOJA:
- Somos especialistas em lembrancinhas artesanais para maternidade, chá de bebê, batizado, casamento, aniversário e eventos corporativos
- Todos os produtos são feitos à mão com matéria-prima hipoalergênica de alta qualidade
- Oferecemos personalização com tags, laços e cores conforme o tema do evento
- Compra mínima: 10 unidades por produto
- Prazo de produção: até 7 dias úteis
- Desconto de 3% no PIX
- Enviamos para todo o Brasil

CATÁLOGO DE PRODUTOS ATUALIZADO:
${productList}

CONTATO:
- WhatsApp: (41) 99221-4299
- Site: emporiolelecute.com.br

INSTRUÇÕES:
- Seja simpática, acolhedora e use emojis ocasionalmente
- Responda em português do Brasil
- Ajude clientes a escolher produtos para seus eventos
- Sugira produtos baseados na ocasião mencionada
- SEMPRE recomende finalizar a compra pelo nosso checkout interno do site (página do produto → "Comprar" → carrinho → checkout) ou pelo WhatsApp (41) 99221-4299 com a mensagem já pré-preenchida do produto
- NUNCA mencione, recomende ou direcione para marketplaces externos ou qualquer outra plataforma de venda. Estamos vendendo apenas pelo nosso site e WhatsApp oficial
- Para pedidos personalizados/orçamentos, direcione ao WhatsApp oficial
- Mantenha respostas concisas (máximo 3-4 frases)
- Quando mencionar produtos, cite os preços atualizados
- Se não souber responder algo específico, sugira entrar em contato pelo WhatsApp oficial`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    // Harden against prompt injection & abuse:
    // - only allow user/assistant roles (never caller-supplied `system`)
    // - cap the number of messages and the length of each message
    const allowedRoles = new Set(["user", "assistant"]);
    const safeMessages = (Array.isArray(messages) ? messages : [])
      .filter((m: any) => allowedRoles.has(m?.role) && typeof m?.content === "string")
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    if (safeMessages.length === 0) {
      return new Response(JSON.stringify({ error: "Mensagem inválida." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch products from database
    let products: any[] = [];
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await supabase
        .from('products')
        .select('name, price, description, slug, category_id, badge')
        .eq('is_active', true)
        .order('name');
      
      if (!error && data) {
        products = data;
        console.log(`Loaded ${products.length} products for chatbot context`);
      } else {
        console.error('Error fetching products:', error);
      }
    }

    const systemPrompt = buildSystemPrompt(products);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...safeMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns segundos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Entre em contato pelo WhatsApp.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'Erro ao processar sua mensagem.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
