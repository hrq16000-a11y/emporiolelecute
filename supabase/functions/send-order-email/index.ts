import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Simple in-memory per-IP rate limiter (best-effort, per warm instance) ---
const rateBucket = new Map<string, { count: number; reset: number }>();
function rateLimit(ip: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateBucket.get(ip);
  if (!entry || entry.reset < now) {
    rateBucket.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}
function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
function isValidEmail(s: unknown): s is string {
  return typeof s === "string" && s.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  personalization?: string;
}

interface ShippingOption {
  id: string;
  name: string;
  price: number;
  days: string;
  company: string;
}

interface OrderRequest {
  orderCode: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  address: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  items: OrderItem[];
  shipping: ShippingOption;
  subtotal: number;
  shippingPrice: number;
  total: number;
}

// Legacy request for quote forms
interface QuoteRequest {
  name: string;
  email: string;
  whatsapp: string;
  product?: string;
  occasion?: string;
  quantity?: string;
  message?: string;
  type: "product" | "quote";
}

function escapeHtml(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function generateOrderEmailHtml(order: OrderRequest): string {
  const itemsHtml = order.items
    .map((item, index) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 8px; text-align: left;">${index + 1}. ${escapeHtml(item.name)}${item.personalization ? `<br><small style="color: #666;">Personalização: ${escapeHtml(item.personalization)}</small>` : ''}</td>
        <td style="padding: 12px 8px; text-align: center;">${item.quantity}x</td>
        <td style="padding: 12px 8px; text-align: right;">${formatCurrency(item.price)}</td>
        <td style="padding: 12px 8px; text-align: right; font-weight: bold;">${formatCurrency(item.price * item.quantity)}</td>
      </tr>
    `)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Nunito', Arial, sans-serif; background: #fdf8f7; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #f88770 0%, #e66753 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .header p { color: white; margin: 10px 0 0 0; opacity: 0.9; font-size: 14px; }
        .order-code { background: #fff3e0; padding: 20px; text-align: center; border-bottom: 2px solid #f88770; }
        .order-code h2 { margin: 0; font-size: 14px; color: #666; }
        .order-code p { margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #f88770; letter-spacing: 2px; }
        .content { padding: 30px; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 14px; font-weight: 600; color: #f88770; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .field { background: #f8f8f8; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
        .field-label { font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 3px; }
        .field-value { font-size: 14px; color: #333; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8f8f8; padding: 12px 8px; font-size: 12px; text-transform: uppercase; color: #666; }
        .totals { background: #f8f8f8; border-radius: 8px; padding: 15px; margin-top: 15px; }
        .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
        .totals-row.total { font-size: 18px; font-weight: bold; color: #f88770; border-top: 2px solid #ddd; padding-top: 12px; margin-top: 8px; }
        .footer { background: #fdf8f7; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .cta { display: inline-block; background: #25D366; color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌸 Empório LeleCute</h1>
          <p>Novo Pedido Recebido!</p>
        </div>
        
        <div class="order-code">
          <h2>Código do Pedido</h2>
          <p>${escapeHtml(order.orderCode)}</p>
        </div>
        
        <div class="content">
          <div class="section">
            <div class="section-title">👤 Dados do Cliente</div>
            <div class="field">
              <div class="field-label">Nome</div>
              <div class="field-value">${escapeHtml(order.customer.name)}</div>
            </div>
            <div class="field">
              <div class="field-label">Email</div>
              <div class="field-value">${escapeHtml(order.customer.email)}</div>
            </div>
            <div class="field">
              <div class="field-label">WhatsApp</div>
              <div class="field-value">${escapeHtml(order.customer.phone)}</div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">📍 Endereço de Entrega</div>
            <div class="field">
              <div class="field-label">CEP</div>
              <div class="field-value">${escapeHtml(order.address.cep)}</div>
            </div>
            <div class="field">
              <div class="field-label">Endereço</div>
              <div class="field-value">${escapeHtml(order.address.street)}, ${escapeHtml(order.address.number)}${order.address.complement ? `, ${escapeHtml(order.address.complement)}` : ''}</div>
            </div>
            <div class="field">
              <div class="field-label">Cidade</div>
              <div class="field-value">${escapeHtml(order.address.city)} - ${escapeHtml(order.address.state)}</div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">📦 Produtos</div>
            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">Produto</th>
                  <th style="text-align: center;">Qtd</th>
                  <th style="text-align: right;">Unit.</th>
                  <th style="text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <div class="section-title">🚚 Frete Selecionado</div>
            <div class="field">
              <div class="field-label">Transportadora</div>
              <div class="field-value">${escapeHtml(order.shipping?.name)} - ${escapeHtml(order.shipping?.company)}</div>
            </div>
            <div class="field">
              <div class="field-label">Prazo</div>
              <div class="field-value">${escapeHtml(order.shipping?.days)}</div>
            </div>
          </div>
          
          <div class="totals">
            <div class="totals-row">
              <span>Subtotal</span>
              <span>${formatCurrency(order.subtotal)}</span>
            </div>
            <div class="totals-row">
              <span>Frete</span>
              <span>${formatCurrency(order.shippingPrice)}</span>
            </div>
            <div class="totals-row total">
              <span>TOTAL</span>
              <span>${formatCurrency(order.total)}</span>
            </div>
          </div>
          
          <center>
            <a href="https://wa.me/55${order.customer.phone.replace(/\D/g, '')}" class="cta">📱 Responder via WhatsApp</a>
          </center>
        </div>
        
        <div class="footer">
          <p>Este email foi enviado automaticamente pelo site Empório LeleCute</p>
          <p>© ${new Date().getFullYear()} Empório LeleCute - Ateliê Criativo</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateCustomerEmailHtml(order: OrderRequest): string {
  const itemsHtml = order.items
    .map((item, index) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 8px; text-align: left;">${index + 1}. ${escapeHtml(item.name)}${item.personalization ? `<br><small style="color: #666;">Personalização: ${escapeHtml(item.personalization)}</small>` : ''}</td>
        <td style="padding: 12px 8px; text-align: center;">${item.quantity}x</td>
        <td style="padding: 12px 8px; text-align: right; font-weight: bold;">${formatCurrency(item.price * item.quantity)}</td>
      </tr>
    `)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Nunito', Arial, sans-serif; background: #fdf8f7; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #f88770 0%, #e66753 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .header p { color: white; margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
        .order-code { background: #fff3e0; padding: 20px; text-align: center; border-bottom: 2px solid #f88770; }
        .order-code h2 { margin: 0; font-size: 14px; color: #666; }
        .order-code p { margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #f88770; letter-spacing: 2px; }
        .content { padding: 30px; }
        .message { background: #e8f5e9; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #2e7d32; text-align: center; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 14px; font-weight: 600; color: #f88770; text-transform: uppercase; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8f8f8; padding: 12px 8px; font-size: 12px; text-transform: uppercase; color: #666; }
        .totals { background: #f8f8f8; border-radius: 8px; padding: 15px; margin-top: 15px; }
        .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
        .totals-row.total { font-size: 18px; font-weight: bold; color: #f88770; border-top: 2px solid #ddd; padding-top: 12px; margin-top: 8px; }
        .footer { background: #fdf8f7; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .cta { display: inline-block; background: #25D366; color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; margin-top: 15px; }
        .next-steps { background: #fff3e0; border-radius: 8px; padding: 20px; margin-top: 20px; }
        .next-steps h3 { margin: 0 0 15px 0; color: #f88770; font-size: 16px; }
        .next-steps ol { margin: 0; padding-left: 20px; color: #666; }
        .next-steps li { margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌸 Empório LeleCute</h1>
          <p>Recebemos seu pedido!</p>
        </div>
        
        <div class="order-code">
          <h2>Seu Código de Pedido</h2>
          <p>${escapeHtml(order.orderCode)}</p>
        </div>
        
        <div class="content">
          <div class="message">
            <strong>Olá, ${escapeHtml(order.customer.name)}!</strong><br>
            Recebemos seu pedido e estamos muito felizes em atendê-lo(a)!
          </div>
          
          <div class="section">
            <div class="section-title">📦 Resumo do Pedido</div>
            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">Produto</th>
                  <th style="text-align: center;">Qtd</th>
                  <th style="text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <div class="section-title">🚚 Entrega</div>
            <p style="margin: 0; color: #666;">${escapeHtml(order.shipping?.name)} - ${escapeHtml(order.shipping?.days)}</p>
            <p style="margin: 5px 0 0 0; color: #666;">${escapeHtml(order.address.street)}, ${escapeHtml(order.address.number)} - ${escapeHtml(order.address.city)}/${escapeHtml(order.address.state)}</p>
          </div>
          
          <div class="totals">
            <div class="totals-row">
              <span>Subtotal</span>
              <span>${formatCurrency(order.subtotal)}</span>
            </div>
            <div class="totals-row">
              <span>Frete</span>
              <span>${formatCurrency(order.shippingPrice)}</span>
            </div>
            <div class="totals-row total">
              <span>TOTAL</span>
              <span>${formatCurrency(order.total)}</span>
            </div>
          </div>
          
          <div class="next-steps">
            <h3>📋 Próximos Passos</h3>
            <ol>
              <li>Em breve entraremos em contato pelo WhatsApp para confirmar seu pedido</li>
              <li>Enviaremos os dados para pagamento (PIX ou transferência)</li>
              <li>Após confirmação do pagamento, iniciaremos a produção</li>
              <li>Você receberá atualizações sobre o status do pedido</li>
            </ol>
          </div>
          
          <center>
            <a href="https://wa.me/5541992214299" class="cta">📱 Falar conosco no WhatsApp</a>
          </center>
        </div>
        
        <div class="footer">
          <p>Dúvidas? Entre em contato pelo WhatsApp (41) 99221-4299</p>
          <p>© ${new Date().getFullYear()} Empório LeleCute - Ateliê Criativo</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Legacy quote email
function generateQuoteEmailHtml(data: QuoteRequest): string {
  const sanitizedWhatsappNumber = data.whatsapp.replace(/\D/g, '');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Nunito', Arial, sans-serif; background: #fdf8f7; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #f88770 0%, #e66753 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .field { margin-bottom: 20px; }
        .label { font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
        .value { color: #333; font-size: 16px; padding: 12px; background: #f8f8f8; border-radius: 8px; word-break: break-word; }
        .footer { background: #fdf8f7; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .cta { display: inline-block; background: #25D366; color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌸 Empório LeleCute</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">${data.type === 'product' ? 'Novo Pedido de Produto' : 'Nova Solicitação de Orçamento'}</p>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Nome</div>
            <div class="value">${escapeHtml(data.name)}</div>
          </div>
          <div class="field">
            <div class="label">Email</div>
            <div class="value">${escapeHtml(data.email)}</div>
          </div>
          <div class="field">
            <div class="label">WhatsApp</div>
            <div class="value">${escapeHtml(data.whatsapp)}</div>
          </div>
          ${data.product ? `
          <div class="field">
            <div class="label">Produto</div>
            <div class="value">${escapeHtml(data.product)}</div>
          </div>
          ` : ""}
          ${data.occasion ? `
          <div class="field">
            <div class="label">Ocasião</div>
            <div class="value">${escapeHtml(data.occasion)}</div>
          </div>
          ` : ""}
          ${data.quantity ? `
          <div class="field">
            <div class="label">Quantidade</div>
            <div class="value">${escapeHtml(data.quantity)}</div>
          </div>
          ` : ""}
          ${data.message ? `
          <div class="field">
            <div class="label">Mensagem</div>
            <div class="value">${escapeHtml(data.message)}</div>
          </div>
          ` : ""}
          <center>
            <a href="https://wa.me/55${sanitizedWhatsappNumber}" class="cta">📱 Responder via WhatsApp</a>
          </center>
        </div>
        <div class="footer">
          <p>Este email foi enviado automaticamente pelo site Empório LeleCute</p>
          <p>© ${new Date().getFullYear()} Empório LeleCute - Ateliê Criativo</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Status update email
interface StatusUpdateRequest {
  type: 'status_update';
  orderCode: string;
  customerEmail: string;
  customerName: string;
  newStatus: string;
  statusLabel: string;
  trackingCode?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
}

function generateStatusUpdateEmailHtml(data: StatusUpdateRequest): string {
  const statusColors: Record<string, string> = {
    pending: '#EAB308',
    confirmed: '#3B82F6',
    processing: '#8B5CF6',
    shipped: '#6366F1',
    delivered: '#22C55E',
    cancelled: '#EF4444',
  };

  const statusMessages: Record<string, string> = {
    pending: 'Seu pedido está aguardando confirmação de pagamento.',
    confirmed: 'Pagamento confirmado! Iniciaremos a produção em breve.',
    processing: 'Seu pedido está sendo produzido com muito carinho.',
    shipped: 'Seu pedido foi enviado! Em breve chegará até você.',
    delivered: 'Seu pedido foi entregue. Esperamos que você adore!',
    cancelled: 'Infelizmente seu pedido foi cancelado.',
  };

  const statusColor = statusColors[data.newStatus] || '#f88770';
  const statusMessage = statusMessages[data.newStatus] || 'O status do seu pedido foi atualizado.';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Nunito', Arial, sans-serif; background: #fdf8f7; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #f88770 0%, #e66753 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .status-badge { display: inline-block; background: ${statusColor}; color: white; padding: 8px 20px; border-radius: 50px; font-weight: bold; font-size: 14px; margin: 20px 0; }
        .content { padding: 30px; text-align: center; }
        .order-code { font-size: 24px; font-weight: bold; color: #f88770; margin: 10px 0; }
        .message { color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0; }
        .cta { display: inline-block; background: #f88770; color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; margin-top: 15px; }
        .footer { background: #fdf8f7; padding: 20px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌸 Empório LeleCute</h1>
        </div>
        
        <div class="content">
          <p style="color: #666; margin: 0;">Olá, <strong>${escapeHtml(data.customerName)}</strong>!</p>
          
          <p class="order-code">Pedido ${escapeHtml(data.orderCode)}</p>
          
          <p style="color: #666; margin: 10px 0;">Novo status:</p>
          <span class="status-badge">${escapeHtml(data.statusLabel)}</span>
          
          <p class="message">${statusMessage}</p>

          ${data.trackingCode ? `
          <div style="background:#f3f4f6;border-radius:12px;padding:18px;margin:20px 0;text-align:left;">
            <p style="margin:0 0 8px 0;font-size:12px;color:#666;text-transform:uppercase;font-weight:600;">📦 Código de Rastreio</p>
            <p style="margin:0;font-size:18px;font-weight:bold;color:#111;letter-spacing:1px;">${escapeHtml(data.trackingCode)}</p>
            ${data.trackingCarrier ? `<p style="margin:6px 0 0 0;font-size:13px;color:#666;">Transportadora: ${escapeHtml(data.trackingCarrier)}</p>` : ''}
            ${data.trackingUrl ? `<p style="margin:10px 0 0 0;"><a href="${escapeHtml(data.trackingUrl)}" style="color:#f88770;font-weight:600;text-decoration:none;">🔍 Rastrear na transportadora →</a></p>` : ''}
          </div>
          ` : ''}
          
          <a href="https://emporiolelecute.lovable.app/rastrear?code=${escapeHtml(data.orderCode)}" class="cta">📦 Acompanhar Pedido</a>
          
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Dúvidas? Entre em contato pelo WhatsApp (41) 99221-4299
          </p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Empório LeleCute - Ateliê Criativo</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

const STORE_INBOX = "emporiolelecute@gmail.com";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate-limit anonymous/public invocations per IP
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ success: false, error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const requestData = await req.json().catch(() => ({}));

    // ---------------- Status update (admin-triggered) ----------------
    if (requestData.type === "status_update") {
      const orderCode = clampStr(requestData.orderCode, 32);
      const customerEmail = clampStr(requestData.customerEmail, 320);
      if (!orderCode || !isValidEmail(customerEmail)) {
        return new Response(JSON.stringify({ success: false, error: "Invalid payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Verify order exists and email matches what's on file (anti-phishing)
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("order_code, customer_email")
        .eq("order_code", orderCode)
        .maybeSingle();
      if (!order || order.customer_email?.toLowerCase() !== customerEmail.toLowerCase()) {
        return new Response(JSON.stringify({ success: false, error: "Order not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const statusData = requestData as StatusUpdateRequest;
      const statusEmailHtml = generateStatusUpdateEmailHtml(statusData);
      await resend.emails.send({
        from: "Empório LeleCute <onboarding@resend.dev>",
        to: [customerEmail],
        subject: `📦 Atualização do Pedido ${orderCode} - ${escapeHtml(statusData.statusLabel || "")}`,
        html: statusEmailHtml,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ---------------- New order confirmation ----------------
    if (requestData.orderCode) {
      const order = requestData as OrderRequest;
      const orderCode = clampStr(order.orderCode, 32);

      // Verify the order actually exists in DB before sending any email.
      // This prevents arbitrary phishing via fake orderCode + recipient email.
      const { data: dbOrder } = await supabaseAdmin
        .from("orders")
        .select("order_code, customer_email")
        .eq("order_code", orderCode)
        .maybeSingle();
      if (!dbOrder) {
        return new Response(JSON.stringify({ success: false, error: "Order not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const storeEmailHtml = generateOrderEmailHtml(order);
      await resend.emails.send({
        from: "Empório LeleCute <onboarding@resend.dev>",
        to: [STORE_INBOX],
        subject: `🛒 Novo Pedido ${orderCode} - ${escapeHtml(order.customer?.name || "")}`,
        html: storeEmailHtml,
      });

      // Always use the canonical email from DB (not client-supplied) to send confirmation
      const recipient = dbOrder.customer_email;
      if (recipient && isValidEmail(recipient)) {
        const customerEmailHtml = generateCustomerEmailHtml(order);
        await resend.emails.send({
          from: "Empório LeleCute <onboarding@resend.dev>",
          to: [recipient],
          subject: `✨ Pedido ${orderCode} recebido - Empório LeleCute`,
          html: customerEmailHtml,
        });
      }

      return new Response(JSON.stringify({ success: true, orderCode }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ---------------- Legacy quote / contact form ----------------
    const quoteData = requestData as QuoteRequest;
    // Validate inputs strictly
    const name = clampStr(quoteData.name, 120);
    const whatsapp = clampStr(quoteData.whatsapp, 40);
    const email = clampStr(quoteData.email, 320);
    if (!name || !whatsapp || !isValidEmail(email)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    // Clamp optional fields
    const cleanQuote: QuoteRequest = {
      type: quoteData.type === "product" ? "product" : "quote",
      name,
      email,
      whatsapp,
      product: clampStr(quoteData.product, 200),
      occasion: clampStr(quoteData.occasion, 120),
      quantity: clampStr(quoteData.quantity, 40),
      message: clampStr(quoteData.message, 2000),
    };

    const subject = cleanQuote.type === "product"
      ? `🎁 Novo Pedido de Produto - ${escapeHtml(cleanQuote.product || "")}`
      : `💬 Nova Solicitação de Orçamento - ${escapeHtml(cleanQuote.occasion || "Geral")}`;

    await resend.emails.send({
      from: "Empório LeleCute <onboarding@resend.dev>",
      to: [STORE_INBOX], // Always to store inbox — never to client-supplied address
      subject,
      html: generateQuoteEmailHtml(cleanQuote),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-order-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro ao processar solicitação" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

function clampStr(s: unknown, max: number): string {
  return typeof s === "string" ? s.slice(0, max) : "";
}

serve(handler);