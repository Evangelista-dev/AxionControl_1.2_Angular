import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Axion Control <onboarding@resend.dev>';
const DESTINO_FIXO = 'afonso.oliveira2301@gmail.com';

type RelatorioPayload = {
  email?: string;
  dados?: Record<string, unknown>[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Metodo nao permitido.' }, 405);
  }

  try {
    if (!RESEND_API_KEY) {
      return json({ error: 'RESEND_API_KEY nao configurada.' }, 500);
    }

    const payload = (await req.json()) as RelatorioPayload;
    const dados = Array.isArray(payload.dados) ? payload.dados : [];
    const pdfBytes = await gerarPdfSemanal(dados);
    const pdfBase64 = bytesToBase64(pdfBytes);

    // Futuro: esta mesma Edge Function pode ser disparada por um job pg_cron
    // no Supabase, tornando o envio semanal 100% autonomo e independente do frontend.
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [DESTINO_FIXO],
        subject: 'Relatorio Semanal - Axion Control',
        html: `
          <h2>Relatorio Semanal - Axion Control</h2>
          <p>Segue em anexo o PDF semanal com os dados consolidados da producao.</p>
          <p>Destino operacional fixo: ${DESTINO_FIXO}</p>
        `,
        attachments: [
          {
            filename: `relatorio-semanal-${new Date().toISOString().slice(0, 10)}.pdf`,
            content: pdfBase64
          }
        ]
      })
    });

    if (!resendResponse.ok) {
      const detalhe = await resendResponse.text();
      return json({ error: 'Falha ao enviar email pelo Resend.', detalhe }, 502);
    }

    return json({ ok: true, email: DESTINO_FIXO });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, 500);
  }
});

async function gerarPdfSemanal(dados: Record<string, unknown>[]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
  let y = height - 56;

  page.drawText('Axion Control', { x: 48, y, size: 20, font: bold, color: rgb(0.05, 0.08, 0.14) });
  y -= 28;
  page.drawText('Relatorio semanal de producao diaria', { x: 48, y, size: 12, font });
  y -= 22;
  page.drawText(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { x: 48, y, size: 9, font });
  y -= 30;

  if (!dados.length) {
    page.drawText('Nenhum dado semanal recebido no payload.', { x: 48, y, size: 11, font });
    return pdf.save();
  }

  page.drawText('Data', { x: 48, y, size: 10, font: bold });
  page.drawText('Temperatura T1', { x: 150, y, size: 10, font: bold });
  page.drawText('Registo bruto', { x: 275, y, size: 10, font: bold });
  y -= 16;

  for (const row of dados.slice(0, 28)) {
    if (y < 60) {
      break;
    }

    const data = String(row.data_registro ?? '-');
    const temperatura = String(row.temperatura_t1 ?? '-');
    const resumo = JSON.stringify(row).slice(0, 90);

    page.drawText(data, { x: 48, y, size: 8, font });
    page.drawText(temperatura, { x: 150, y, size: 8, font });
    page.drawText(resumo, { x: 275, y, size: 7, font });
    y -= 14;
  }

  return pdf.save();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}
