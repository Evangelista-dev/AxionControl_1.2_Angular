import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Axiom Control <onboarding@resend.dev>';
const DESTINO_FIXO = 'afonso.oliveira2301@gmail.com';

type OcorrenciaPayload = {
  descricao?: string;
  tanques?: string[];
  created_at?: string;
};

type ResumoPayload = {
  oeeMedio?: number;
  totalAlertas?: number;
  temperaturaMedia?: number;
  nivelMedio?: number;
};

type RelatorioPayload = {
  email?: string;
  dados?: Record<string, unknown>[];
  ocorrencias?: OcorrenciaPayload[];
  resumo?: ResumoPayload;
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
    const ocorrencias = Array.isArray(payload.ocorrencias) ? payload.ocorrencias : [];
    const resumo = payload.resumo ?? {};
    const destino = payload.email?.trim() || DESTINO_FIXO;
    const pdfBytes = await gerarPdfSemanal(dados, ocorrencias, resumo);
    const pdfBase64 = bytesToBase64(pdfBytes);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [destino],
        subject: 'Relatorio Semanal - Axiom Control',
        html: `
          <h2>Relatorio Semanal - Axiom Control</h2>
          <p>Segue em anexo o PDF semanal com producao, resumo operacional e ocorrencias relatadas.</p>
          <p>Destino: ${destino}</p>
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

    return json({ ok: true, email: destino });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, 500);
  }
});

async function gerarPdfSemanal(
  dados: Record<string, unknown>[],
  ocorrencias: OcorrenciaPayload[],
  resumo: ResumoPayload
) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = page.getSize().height - 56;

  page.drawText('Axiom Control', { x: 48, y, size: 20, font: bold, color: rgb(0.05, 0.08, 0.14) });
  y -= 28;
  page.drawText('Relatorio semanal de producao diaria', { x: 48, y, size: 12, font });
  y -= 22;
  page.drawText(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { x: 48, y, size: 9, font });
  y -= 28;

  page.drawText('Resumo da Semana', { x: 48, y, size: 13, font: bold });
  y -= 18;
  page.drawText(`Eficiencia Media (OEE): ${formatarNumero(resumo.oeeMedio)}%`, { x: 48, y, size: 10, font });
  y -= 14;
  page.drawText(`Total de Alertas: ${formatarNumero(resumo.totalAlertas)}`, { x: 48, y, size: 10, font });
  y -= 14;
  page.drawText(`Temperatura Media: ${formatarNumero(resumo.temperaturaMedia)} C`, { x: 48, y, size: 10, font });
  y -= 14;
  page.drawText(`Nivel Medio: ${formatarNumero(resumo.nivelMedio)}%`, { x: 48, y, size: 10, font });
  y -= 24;

  page.drawText('Ocorrencias Relatadas', { x: 48, y, size: 13, font: bold });
  y -= 18;

  if (!ocorrencias.length) {
    page.drawText('Nenhuma ocorrencia registrada pelo operador neste periodo.', { x: 48, y, size: 10, font });
    y -= 20;
  } else {
    for (const item of ocorrencias.slice(0, 8)) {
      if (y < 120) {
        page = pdf.addPage([595.28, 841.89]);
        y = page.getSize().height - 56;
      }

      const data = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : 'Data nao informada';
      const tanques = Array.isArray(item.tanques) && item.tanques.length ? item.tanques.join(', ') : 'N/A';
      const descricao = String(item.descricao ?? 'Sem descricao').slice(0, 120);

      page.drawText(`[${data}]`, { x: 48, y, size: 8, font: bold });
      y -= 12;
      page.drawText(`Tanques: ${tanques}`, { x: 48, y, size: 8, font });
      y -= 12;
      page.drawText(descricao, { x: 48, y, size: 9, font, maxWidth: 500 });
      y -= 28;
    }
  }

  y -= 10;

  if (y < 180) {
    page = pdf.addPage([595.28, 841.89]);
    y = page.getSize().height - 56;
  }

  page.drawText('Producao Diaria (ultimos registos)', { x: 48, y, size: 13, font: bold });
  y -= 18;

  if (!dados.length) {
    page.drawText('Nenhum dado semanal recebido no payload.', { x: 48, y, size: 11, font });
    return pdf.save();
  }

  page.drawText('Data', { x: 48, y, size: 9, font: bold });
  page.drawText('T1', { x: 120, y, size: 9, font: bold });
  page.drawText('T2', { x: 160, y, size: 9, font: bold });
  page.drawText('T3', { x: 200, y, size: 9, font: bold });
  page.drawText('Nivel', { x: 240, y, size: 9, font: bold });
  page.drawText('Alertas', { x: 290, y, size: 9, font: bold });
  y -= 14;

  for (const row of dados.slice(0, 28)) {
    if (y < 60) {
      break;
    }

    page.drawText(String(row.data_registro ?? '-'), { x: 48, y, size: 8, font });
    page.drawText(String(row.temperatura_t1 ?? '-'), { x: 120, y, size: 8, font });
    page.drawText(String(row.temperatura_t2 ?? '-'), { x: 160, y, size: 8, font });
    page.drawText(String(row.temperatura_t3 ?? '-'), { x: 200, y, size: 8, font });
    page.drawText(String(row.nivel ?? '-'), { x: 240, y, size: 8, font });
    page.drawText(String(row.alertas ?? '-'), { x: 290, y, size: 8, font });
    y -= 12;
  }

  return pdf.save();
}

function formatarNumero(valor: unknown): string {
  if (valor === undefined || valor === null || Number.isNaN(Number(valor))) {
    return '0';
  }
  return String(valor);
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
