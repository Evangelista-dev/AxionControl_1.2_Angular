import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

//  Função principal
serve(async (req) => {
 
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

    if (!token || !chatId) {
      throw new Error('As chaves do Telegram não estão configuradas no Supabase.');
    }

  
    const body = await req.json();

   
    const status = body.totalAlertas > 0 ? 'ATENÇÃO OPERACIONAL' : 'OPERAÇÃO ESTÁVEL';
    const geradoEm = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo'
    }).format(new Date());

  
    const textoMensagem = [
      '*AXION CONTROL | RELATÓRIO INDUSTRIAL*',
      '',
      `*Período:* ${body.periodo || 'N/A'}`,
      `*Status:* ${status}`,
      `*OEE médio:* ${body.oeeMedio || 0}%`,
      `*Total de alertas:* ${body.totalAlertas || 0}`,
      `*Temperatura média:* ${body.temperaturaMedia || 0} °C`,
      `*Nível médio do fluido:* ${body.nivelMedio || 0}%`,
      `*Gerado em:* ${geradoEm}`
    ].join('\n');

    
    const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const telegramReq = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: textoMensagem,
        parse_mode: 'Markdown'
      })
    });

    const telegramRes = await telegramReq.json();

    if (!telegramRes.ok) {
      throw new Error(telegramRes.description);
    }

    
    return new Response(
      JSON.stringify({ message: 'Relatório enviado com sucesso!' }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
   
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});