import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type TelegramReportPayload = {
  periodo?: unknown;
  oeeMedio?: unknown;
  totalAlertas?: unknown;
  temperaturaMedia?: unknown;
  nivelMedio?: unknown;
};

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};

serve(async (request) => {
  // O preflight do navegador não pode depender de autenticação nem de secrets.
  if (request.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return respostaJson({ error: 'Método não permitido. Use POST.' }, 405);
  }

  try {
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

    if (!token || !chatId) {
      throw new ErroHttp(
        500,
        'Secrets do Telegram não configurados: TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID são obrigatórios.'
      );
    }

    const payload = await lerPayload(request);
    const mensagem = formatarMensagem(normalizarPayload(payload));
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensagem,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });

    const telegramBody = await lerRespostaTelegram(telegramResponse);
    if (!telegramResponse.ok || telegramBody.ok !== true) {
      const detalhe = telegramBody.description || `HTTP ${telegramResponse.status}`;
      throw new ErroHttp(502, `Telegram recusou o envio: ${detalhe}`);
    }

    return respostaJson({ ok: true, message: 'Relatório enviado ao Telegram.' });
  } catch (error) {
    const status = error instanceof ErroHttp ? error.status : 500;
    const mensagem = error instanceof Error ? error.message : 'Erro interno inesperado.';
    console.error('send-telegram-report:', mensagem);
    return respostaJson({ error: mensagem }, status);
  }
});

async function lerPayload(request: Request): Promise<TelegramReportPayload> {
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ErroHttp(400, 'Payload inválido. Envie um objeto JSON com os indicadores do relatório.');
    }
    return payload as TelegramReportPayload;
  } catch (error) {
    if (error instanceof ErroHttp) throw error;
    throw new ErroHttp(400, 'O corpo da requisição não contém um JSON válido.');
  }
}

async function lerRespostaTelegram(response: Response): Promise<TelegramApiResponse> {
  try {
    return await response.json() as TelegramApiResponse;
  } catch {
    return { ok: false, description: `Resposta inválida da API do Telegram (HTTP ${response.status}).` };
  }
}

function normalizarPayload(payload: TelegramReportPayload) {
  return {
    periodo: normalizarTexto(payload.periodo, 'Período operacional atual'),
    oeeMedio: normalizarNumero(payload.oeeMedio),
    totalAlertas: Math.max(0, Math.round(normalizarNumero(payload.totalAlertas))),
    temperaturaMedia: normalizarNumero(payload.temperaturaMedia),
    nivelMedio: normalizarNumero(payload.nivelMedio)
  };
}

function formatarMensagem(relatorio: ReturnType<typeof normalizarPayload>): string {
  const status = relatorio.totalAlertas > 0 ? 'ATENÇÃO OPERACIONAL' : 'OPERAÇÃO ESTÁVEL';
  const geradoEm = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo'
  }).format(new Date());

  return [
    '*AXION CONTROL | RELATÓRIO INDUSTRIAL*',
    '',
    `*Período:* ${relatorio.periodo}`,
    `*Status:* ${status}`,
    `*OEE médio:* ${relatorio.oeeMedio}%`,
    `*Total de alertas:* ${relatorio.totalAlertas}`,
    `*Temperatura média:* ${relatorio.temperaturaMedia} °C`,
    `*Nível médio do fluido:* ${relatorio.nivelMedio}%`,
    `*Gerado em:* ${geradoEm}`
  ].join('\n');
}

function normalizarNumero(valor: unknown): number {
  const numero = typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : 0;
  return Number.isFinite(numero) ? Math.round(numero * 10) / 10 : 0;
}

function normalizarTexto(valor: unknown, padrao: string): string {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  // Evita que valores vindos da interface alterem a marcação Markdown da mensagem.
  return (texto || padrao).replace(/[\\`*_\[\]]/g, '\\$&').slice(0, 120);
}

function respostaJson(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

class ErroHttp extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}
