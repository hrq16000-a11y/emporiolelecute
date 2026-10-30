// Processamento assíncrono de imagens (background job).
//
// Consome a fila `image_processing_jobs`: para cada imagem enviada pelo admin,
// gera versões responsivas em WebP (400/800/1200px) e um placeholder blur em
// base64, gravando tudo de volta no job para a UI exibir em tempo real.
//
// A conversão usa o endpoint de transformação de imagem do Storage — sem
// dependências binárias no runtime do Deno.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VARIANT_WIDTHS = [400, 800, 1200];
const PLACEHOLDER_WIDTH = 24;
const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 3;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const renderUrl = (bucket: string, path: string, width: number, quality = 80) =>
  `${SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${path}` +
  `?width=${width}&resize=contain&quality=${quality}`;

const fetchTransformed = async (bucket: string, path: string, width: number, quality?: number) => {
  const res = await fetch(renderUrl(bucket, path, width, quality), {
    headers: { Accept: 'image/webp,image/*', apikey: SERVICE_ROLE },
  });
  if (!res.ok) throw new Error(`transform ${width}px falhou (${res.status})`);
  const type = res.headers.get('content-type') ?? 'image/webp';
  return { bytes: new Uint8Array(await res.arrayBuffer()), type };
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const stripExt = (path: string) => path.replace(/\.[^./]+$/, '');

interface Job {
  id: string;
  bucket: string;
  storage_path: string;
  attempts: number;
}

async function processJob(job: Job) {
  const { bucket, storage_path: path } = job;

  const original = await admin.storage.from(bucket).download(path);
  if (original.error) throw original.error;
  const sourceBytes = original.data.size;

  const variants: Array<{ width: number; path: string; url: string; bytes: number }> = [];
  let outputBytes = 0;

  for (const width of VARIANT_WIDTHS) {
    const { bytes, type } = await fetchTransformed(bucket, path, width);
    const ext = type.includes('webp') ? 'webp' : 'jpg';
    const variantPath = `variants/${stripExt(path)}-${width}.${ext}`;
    const up = await admin.storage.from(bucket).upload(variantPath, bytes, {
      contentType: type,
      cacheControl: '31536000',
      upsert: true,
    });
    if (up.error) throw up.error;
    const { data: pub } = admin.storage.from(bucket).getPublicUrl(variantPath);
    variants.push({ width, path: variantPath, url: pub.publicUrl, bytes: bytes.byteLength });
    outputBytes += bytes.byteLength;
  }

  const ph = await fetchTransformed(bucket, path, PLACEHOLDER_WIDTH, 40);
  const placeholder = `data:${ph.type};base64,${toBase64(ph.bytes)}`;

  await admin
    .from('image_processing_jobs')
    .update({
      status: 'done',
      error: null,
      source_bytes: sourceBytes,
      output_bytes: outputBytes,
      placeholder,
      variants,
      processed_at: new Date().toISOString(),
    })
    .eq('id', job.id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { data: jobs, error } = await admin
      .from('image_processing_jobs')
      .select('id, bucket, storage_path, attempts')
      .in('status', ['pending', 'retry'])
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const job of (jobs ?? []) as Job[]) {
      await admin
        .from('image_processing_jobs')
        .update({ status: 'processing', attempts: job.attempts + 1 })
        .eq('id', job.id);
      try {
        await processJob(job);
        results.push({ id: job.id, status: 'done' });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'erro desconhecido';
        const exhausted = job.attempts + 1 >= MAX_ATTEMPTS;
        await admin
          .from('image_processing_jobs')
          .update({ status: exhausted ? 'error' : 'retry', error: message })
          .eq('id', job.id);
        results.push({ id: job.id, status: exhausted ? 'error' : 'retry', error: message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
