const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function loadEnvironmentFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const entries = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const entry of entries) {
    const line = entry.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;

    let value = match[2].trim();
    const quoted = value.match(/^(["'])(.*)\1$/);
    if (quoted) value = quoted[2];
    else value = value.replace(/\s+#.*$/, '').trim();
    process.env[match[1]] = value;
  }
}

loadEnvironmentFile(path.join(__dirname, '.env'));

const port = Number(process.env.PORT) || 3000;
const publicDirectory = path.join(__dirname, 'public');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};
const financeSessions = new Map();
const providerTokens = new Map();
const financeSessionCookie = 'cash_finance_session';
const financeSessionLifetime = 12 * 60 * 60 * 1000;

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function getAiConfig() {
  const provider = (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();
  if (provider === 'openai') {
    return {
      name: 'OpenAI',
      key: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    };
  }
  if (provider === 'gemini') {
    return {
      name: 'Gemini',
      key: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    };
  }
  return { name: provider, key: '', model: '', baseUrl: '' };
}

async function sendAiProviderError(aiResponse, response, fallback, providerName) {
  const result = await aiResponse.json().catch(() => ({}));
  const details = result.error || {};
  const code = String(details.code || details.type || '').toLowerCase();
  const description = String(details.message || '').toLowerCase();
  console.error(`Provedor de IA respondeu com status ${aiResponse.status}${code ? ` (${code})` : ''}`);

  if (aiResponse.status === 429) {
    const detail = providerName === 'Gemini'
      ? 'A cota gratuita do Gemini ou o limite de requisições foi atingido. Aguarde a renovação da cota e tente novamente.'
      : `O limite de uso de ${providerName} foi atingido. Confira a cota da conta e tente novamente mais tarde.`;
    sendJson(response, 502, { error: detail });
    return;
  }
  if (aiResponse.status === 401) {
    const keyName = providerName === 'Gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    sendJson(response, 502, { error: `${providerName} recusou a chave. Revise ${keyName} no .env e reinicie o servidor.` });
    return;
  }
  if (aiResponse.status === 403) {
    sendJson(response, 502, { error: `${providerName} não autorizou o modelo. Confira a disponibilidade do modelo e as permissões da chave.` });
    return;
  }
  sendJson(response, 502, { error: fallback });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20_000) {
        reject(new Error('Corpo da requisição muito grande'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    request.on('error', reject);
  });
}

function safeSecretEqual(value, expected) {
  if (typeof value !== 'string' || typeof expected !== 'string' || !expected) return false;
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

function requestHasValidOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function financeSessionId(request) {
  const cookie = request.headers.cookie || '';
  const pair = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${financeSessionCookie}=`));
  return pair?.slice(financeSessionCookie.length + 1);
}

function hasFinanceSession(request) {
  const sessionId = financeSessionId(request);
  const expiresAt = sessionId && financeSessions.get(sessionId);
  if (!expiresAt) return false;
  if (expiresAt < Date.now()) {
    financeSessions.delete(sessionId);
    return false;
  }
  return true;
}

function financeProviderConfig(provider) {
  if (provider === 'kiwify') {
    const { KIWIFY_CLIENT_ID: clientId, KIWIFY_CLIENT_SECRET: clientSecret, KIWIFY_ACCOUNT_ID: accountId } = process.env;
    return clientId && clientSecret && accountId ? { clientId, clientSecret, accountId } : null;
  }
  if (provider === 'cakto') {
    const { CAKTO_CLIENT_ID: clientId, CAKTO_CLIENT_SECRET: clientSecret } = process.env;
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }
  return null;
}

function financeProviders() {
  return [
    { id: 'kiwify', name: 'Kiwify', configured: Boolean(financeProviderConfig('kiwify')) },
    { id: 'cakto', name: 'Cakto', configured: Boolean(financeProviderConfig('cakto')) },
  ];
}

function requireFinanceSession(request, response) {
  if (!hasFinanceSession(request)) {
    sendJson(response, 401, { error: 'Entre no painel financeiro novamente.' });
    return false;
  }
  return true;
}

async function providerToken(provider) {
  const config = financeProviderConfig(provider);
  if (!config) throw new Error('Credenciais da plataforma não configuradas.');
  const cached = providerTokens.get(provider);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

  const baseUrl = provider === 'kiwify' ? 'https://public-api.kiwify.com/v1' : 'https://api.cakto.com.br';
  const tokenUrl = provider === 'kiwify' ? `${baseUrl}/oauth/token` : `${baseUrl}/public_api/token/`;
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenResponse.ok) throw new Error(`Autenticação ${provider} recusada (${tokenResponse.status}).`);
  const tokenData = await tokenResponse.json();
  if (typeof tokenData.access_token !== 'string' || !tokenData.access_token) throw new Error(`Token ${provider} inválido.`);
  providerTokens.set(provider, {
    value: tokenData.access_token,
    expiresAt: Date.now() + Math.max(60, Number(tokenData.expires_in) || 300) * 1000,
  });
  return tokenData.access_token;
}

function decimalToCents(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const fraction = (match[3] || '').padEnd(2, '0');
  const cents = Number(match[2]) * 100 + Number(fraction || 0);
  return Number.isSafeInteger(cents) ? (match[1] ? -cents : cents) : null;
}

function centsToDecimal(cents) {
  return `${Math.trunc(cents / 100)}.${String(Math.abs(cents % 100)).padStart(2, '0')}`;
}

async function providerBalance(provider) {
  const config = financeProviderConfig(provider);
  if (!config) throw new Error(`Configure as credenciais de ${provider} no .env.`);
  const token = await providerToken(provider);
  const isKiwify = provider === 'kiwify';
  const url = isKiwify
    ? 'https://public-api.kiwify.com/v1/balance'
    : 'https://api.cakto.com.br/public_api/balance/';
  const headers = { authorization: `Bearer ${token}` };
  if (isKiwify) headers['x-kiwify-account-id'] = config.accountId;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Consulta de saldo ${provider} falhou (${response.status}).`);
  const balance = await response.json();
  const availableCents = isKiwify ? (Number.isSafeInteger(balance.available) ? balance.available : null) : decimalToCents(balance.available);
  if (availableCents === null) throw new Error(`A API ${provider} retornou um saldo inválido.`);
  const pendingCents = isKiwify
    ? (Number.isSafeInteger(balance.pending) ? balance.pending : null)
    : decimalToCents(balance.pending);
  const reservedCents = isKiwify ? null : decimalToCents(balance.reserved);
  const refundBlockedCents = isKiwify ? null : decimalToCents(balance.refundBlocked);
  return { provider, availableCents, pendingCents, reservedCents, refundBlockedCents, observedAt: new Date().toISOString() };
}

async function handleFinanceSession(request, response) {
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }

  if (request.method === 'DELETE') {
    const sessionId = financeSessionId(request);
    if (sessionId) financeSessions.delete(sessionId);
    response.writeHead(204, { 'set-cookie': `${financeSessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
    response.end();
    return;
  }

  if (request.method === 'GET') {
    sendJson(response, 200, { authenticated: hasFinanceSession(request) });
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Método não permitido.' });
    return;
  }

  if (!process.env.CASH_ACCESS_TOKEN) {
    sendJson(response, 503, { error: 'Configure CASH_ACCESS_TOKEN no .env para proteger o painel financeiro.' });
    return;
  }

  try {
    const body = await readJson(request);
    if (!safeSecretEqual(body.passphrase, process.env.CASH_ACCESS_TOKEN)) {
      sendJson(response, 401, { error: 'Senha do painel incorreta.' });
      return;
    }
    const sessionId = crypto.randomBytes(32).toString('hex');
    financeSessions.set(sessionId, Date.now() + financeSessionLifetime);
    const secure = request.socket.encrypted || request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': `${financeSessionCookie}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${financeSessionLifetime / 1000}${secure}`,
    });
    response.end(JSON.stringify({ providers: financeProviders() }));
  } catch {
    sendJson(response, 400, { error: 'Não foi possível validar o acesso.' });
  }
}

async function handleFinanceBalance(request, response) {
  if (!requireFinanceSession(request, response)) return;
  const provider = new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams.get('provider');
  try {
    sendJson(response, 200, await providerBalance(provider));
  } catch (error) {
    sendJson(response, 502, { error: error.message });
  }
}

async function handleFinanceWithdrawal(request, response) {
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  if (!requireFinanceSession(request, response)) return;

  try {
    const body = await readJson(request);
    const { provider, amountCents, idempotencyKey } = body;
    if (body.confirm !== true) {
      sendJson(response, 400, { error: 'Confirme explicitamente a solicitação de saque.' });
      return;
    }
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey || '')) {
      sendJson(response, 400, { error: 'Valor ou identificador da solicitação inválido.' });
      return;
    }
    const balance = await providerBalance(provider);
    if (amountCents > balance.availableCents) {
      sendJson(response, 400, { error: 'O valor excede o saldo disponível atualizado da plataforma.' });
      return;
    }
    if (provider === 'cakto' && amountCents < 1_000) {
      sendJson(response, 400, { error: 'O saque mínimo da Cakto é R$ 10,00.' });
      return;
    }

    const config = financeProviderConfig(provider);
    const token = await providerToken(provider);
    const isKiwify = provider === 'kiwify';
    const url = isKiwify
      ? 'https://public-api.kiwify.com/v1/payouts/'
      : 'https://api.cakto.com.br/public_api/withdrawals/';
    const headers = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      [isKiwify ? 'Idempotency-Key' : 'X-Idempotency-Key']: idempotencyKey,
    };
    if (isKiwify) headers['x-kiwify-account-id'] = config.accountId;
    const providerResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount: isKiwify ? amountCents : centsToDecimal(amountCents) }),
      signal: AbortSignal.timeout(20_000),
    });
    const result = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok) {
      sendJson(response, providerResponse.status === 429 ? 429 : 502, {
        error: providerResponse.status === 429
          ? 'Limite de solicitações de saque atingido. Tente novamente mais tarde.'
          : 'A plataforma recusou o saque. Confira o saldo e as regras da conta.',
      });
      return;
    }
    sendJson(response, 200, {
      provider,
      amountCents,
      requestId: typeof result.id === 'string' ? result.id : idempotencyKey,
      status: provider === 'cakto' ? (result.status || 'pending') : 'requested',
      amountReceivedCents: provider === 'cakto' ? decimalToCents(result.amountReceived) : null,
    });
  } catch (error) {
    console.error('Falha em operação financeira:', error.message);
    sendJson(response, 502, { error: error.message || 'Não foi possível concluir a operação financeira.' });
  }
}

async function handleChat(request, response) {
  const ai = getAiConfig();
  if (!ai.key) {
    const keyName = ai.name === 'Gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    sendJson(response, 503, { error: `Configure AI_PROVIDER=${ai.name.toLowerCase()} e ${keyName} no .env para ativar as respostas.` });
    return;
  }

  try {
    const body = await readJson(request);
    const history = Array.isArray(body.messages) ? body.messages : [];
    const messages = history
      .filter((message) => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
      .slice(-12)
      .map((message) => ({ role: message.role, content: message.content.slice(0, 4_000) }));

    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      sendJson(response, 400, { error: 'Envie uma mensagem para começar.' });
      return;
    }

    const aiResponse = await fetch(`${ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ai.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          {
            role: 'system',
            content: 'Você é Cash, uma estrategista de marketing para produtos digitais, em português do Brasil. Ajude com posicionamento, ofertas e conteúdo claro e útil. Nunca invente características do produto, depoimentos, resultados, garantias, descontos ou escassez. Prefira alegações verificáveis, respeite consentimento e descadastro em e-mails e não afirme que publicou ou vendeu algo. Quando faltarem informações, pergunte.',
          },
          ...messages,
        ],
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!aiResponse.ok) {
      await sendAiProviderError(aiResponse, response, 'Não consegui uma resposta agora. Tente novamente em instantes.', ai.name);
      return;
    }

    const result = await aiResponse.json();
    const answer = result.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) {
      sendJson(response, 502, { error: 'A resposta veio vazia. Tente novamente.' });
      return;
    }
    sendJson(response, 200, { answer });
  } catch (error) {
    console.error('Falha ao consultar o provedor de IA:', error.message);
    sendJson(response, 502, { error: 'Não consegui conectar à IA. Verifique a configuração e tente novamente.' });
  }
}

async function handleGenerate(request, response) {
  const ai = getAiConfig();
  if (!ai.key) {
    const keyName = ai.name === 'Gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    sendJson(response, 503, { error: `Configure ${keyName} no .env para ativar a geração com IA.` });
    return;
  }

  try {
    const body = await readJson(request);
    const product = body.product && typeof body.product === 'object' ? body.product : {};
    const campaign = body.campaign && typeof body.campaign === 'object' ? body.campaign : {};
    const requiredProductFields = ['name', 'description', 'audience', 'benefit'];
    const missingField = requiredProductFields.find((field) => typeof product[field] !== 'string' || !product[field].trim());

    if (missingField) {
      sendJson(response, 400, { error: 'Preencha nome, descrição, público e benefício do produto.' });
      return;
    }
    if (typeof campaign.name !== 'string' || !campaign.name.trim()) {
      sendJson(response, 400, { error: 'Dê um nome para esta campanha.' });
      return;
    }

    const safeProduct = Object.fromEntries(['name', 'description', 'audience', 'benefit', 'price', 'url', 'tone', 'salesPlatform'].map((field) => [
      field,
      typeof product[field] === 'string' ? product[field].trim().slice(0, field === 'description' ? 1_200 : 300) : '',
    ]));
    const safeCampaign = Object.fromEntries(['name', 'format', 'channel', 'checkout', 'objective', 'angle'].map((field) => [
      field,
      typeof campaign[field] === 'string' ? campaign[field].trim().slice(0, field === 'angle' ? 500 : 100) : '',
    ]));
    const aiResponse = await fetch(`${ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ai.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ai.model,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'Você é Cash, uma estrategista sênior de marketing para produtos digitais no Brasil. Crie materiais práticos em português brasileiro, estruturados com títulos e prontos para revisão humana. Use apenas fatos informados. Nunca invente depoimentos, números, garantias, credenciais, descontos ou urgência. Se o briefing não sustentar uma alegação, omita-a. Respeite as regras do canal; para e-mails, inclua assunto, conteúdo útil e orientação de descadastro para uma lista com consentimento. Não publique, envie mensagens ou alegue resultados: entregue apenas um rascunho.',
          },
          {
            role: 'user',
            content: `Crie o material solicitado usando este briefing.\n\nProduto:\n${JSON.stringify(safeProduct, null, 2)}\n\nCampanha:\n${JSON.stringify(safeCampaign, null, 2)}\n\nInclua chamadas para ação coerentes, sem pressão enganosa. Se o link da oferta não foi informado, use [INSERIR LINK DA OFERTA].`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!aiResponse.ok) {
      await sendAiProviderError(aiResponse, response, 'A IA não conseguiu gerar o material agora. Tente novamente.', ai.name);
      return;
    }

    const result = await aiResponse.json();
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      sendJson(response, 502, { error: 'A resposta veio vazia. Tente novamente.' });
      return;
    }
    sendJson(response, 200, { content });
  } catch (error) {
    console.error('Falha ao gerar campanha:', error.message);
    sendJson(response, 502, { error: 'Não consegui conectar à IA para gerar a campanha.' });
  }
}

async function handleProductGeneration(request, response) {
  const ai = getAiConfig();
  if (!ai.key) {
    const keyName = ai.name === 'Gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    sendJson(response, 503, { error: `Configure ${keyName} no .env para gerar o produto com IA.` });
    return;
  }

  try {
    const body = await readJson(request);
    const idea = typeof body.idea === 'string' ? body.idea.trim().slice(0, 700) : '';
    const audience = typeof body.audience === 'string' ? body.audience.trim().slice(0, 250) : '';
    const formats = {
      ebook: 'E-book: escreva título, subtítulo, sumário e capítulos completos com explicações e exemplos originais.',
      'mini-course': 'Mini-curso: escreva promessa responsável, módulos, roteiro completo de cada aula, exercícios e critérios de conclusão.',
      workbook: 'Workbook: crie uma sequência completa de atividades, instruções, exemplos preenchidos e páginas de reflexão.',
      'template-pack': 'Kit de templates: produza os modelos editáveis, instruções de uso, exemplos preenchidos e checklist de aplicação.',
      guide: 'Guia passo a passo: escreva etapas detalhadas, materiais necessários, exemplos, checklist e plano de execução.',
    };
    const format = typeof body.format === 'string' ? body.format : '';

    if (idea.length < 12) {
      sendJson(response, 400, { error: 'Descreva a ideia com um pouco mais de detalhe.' });
      return;
    }
    if (!formats[format]) {
      sendJson(response, 400, { error: 'Escolha um formato de produto válido.' });
      return;
    }

    const aiResponse = await fetch(`${ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ai.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ai.model,
        temperature: 0.7,
        max_tokens: 7000,
        messages: [
          {
            role: 'system',
            content: 'Você é uma equipe editorial especializada em produtos digitais originais em português do Brasil. Crie material substancial, utilizável e específico, não apenas um esboço. Não invente pesquisas, dados, credenciais, citações, legislação ou garantias de resultado. Quando o tema depender de informação técnica ou atual não fornecida, indique claramente que precisa de validação por especialista. Gere JSON válido, sem markdown fora do JSON, com estas chaves string: name (nome), description (descrição curta), audience (público), benefit (benefício plausível sem garantia), suggestedPrice (faixa apenas como hipótese de teste, nunca como preço definitivo) e content (produto completo com estrutura, conteúdo, exercícios e instruções conforme o formato). O produto deve ser original e a revisão humana é necessária antes da venda.',
          },
          {
            role: 'user',
            content: `Crie o produto no formato: ${formats[format]}\n\nIdeia e problema que deve resolver: ${idea}\nPúblico desejado: ${audience || 'proponha um público específico e explique a escolha dentro da descrição'}\n\nEntregue conteúdo pronto para edição, com exemplos próprios e instruções de aplicação. Evite preencher espaço com repetições. Responda somente com o JSON solicitado.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!aiResponse.ok) {
      await sendAiProviderError(aiResponse, response, 'A IA não conseguiu gerar o produto agora. Tente novamente.', ai.name);
      return;
    }

    const result = await aiResponse.json();
    const rawProduct = result.choices?.[0]?.message?.content;
    if (typeof rawProduct !== 'string') {
      sendJson(response, 502, { error: 'A resposta da IA veio vazia. Tente novamente.' });
      return;
    }

    const jsonStart = rawProduct.indexOf('{');
    const jsonEnd = rawProduct.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      sendJson(response, 502, { error: 'A IA não retornou um produto estruturado. Tente gerar novamente.' });
      return;
    }

    const generated = JSON.parse(rawProduct.slice(jsonStart, jsonEnd + 1));
    const requiredFields = ['name', 'description', 'audience', 'benefit', 'content'];
    if (requiredFields.some((field) => typeof generated[field] !== 'string' || !generated[field].trim())) {
      sendJson(response, 502, { error: 'Faltaram partes no produto gerado. Tente novamente.' });
      return;
    }

    sendJson(response, 200, {
      product: Object.fromEntries([...requiredFields, 'suggestedPrice'].map((field) => [
        field,
        typeof generated[field] === 'string' ? generated[field].trim().slice(0, field === 'content' ? 100_000 : 1_200) : '',
      ])),
    });
  } catch (error) {
    console.error('Falha ao gerar produto:', error.message);
    sendJson(response, 502, { error: 'Não consegui concluir o produto. Confira o provedor de IA e tente novamente.' });
  }
}

async function handleAffiliateSuggestions(request, response) {
  const ai = getAiConfig();
  if (!ai.key) {
    const keyName = ai.name === 'Gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    sendJson(response, 503, { error: `Configure ${keyName} no .env para sugerir produtos afiliados.` });
    return;
  }

  try {
    const body = await readJson(request);
    const niche = typeof body.niche === 'string' ? body.niche.trim().slice(0, 300) : '';
    const audience = typeof body.audience === 'string' ? body.audience.trim().slice(0, 250) : '';
    const platform = typeof body.platform === 'string' ? body.platform.trim().slice(0, 80) : 'qualquer plataforma';
    const context = typeof body.context === 'string' ? body.context.trim().slice(0, 400) : '';
    if (niche.length < 3) {
      sendJson(response, 400, { error: 'Informe um nicho ou tema com pelo menos 3 caracteres.' });
      return;
    }

    const aiResponse = await fetch(`${ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ai.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ai.model,
        temperature: 0.7,
        max_tokens: 3000,
        messages: [
          {
            role: 'system',
            content: 'Você é uma estrategista de marketing de afiliados no Brasil. Sugira cinco IDEIAS de tipos de produto digital a pesquisar, não alegue que encontrou ofertas reais. Nunca invente nomes de produtos existentes, links de afiliado, preços, comissões, conversões, avaliações, disponibilidade ou regras de uma plataforma. Cada ideia deve conter productIdea (descrição de uma oportunidade de produto, não marca inventada), productType, audience, problem, promotionAngle e validationChecks (três perguntas para validar oferta, comissão, reputação e regras na plataforma). Responda somente JSON válido: {"suggestions":[...]} em português brasileiro.',
          },
          {
            role: 'user',
            content: `Nicho: ${niche}\nPúblico que alcanço: ${audience || 'sugira um segmento específico'}\nPlataforma em que vou pesquisar: ${platform}\nContexto: ${context || 'nenhum'}\n\nGere cinco oportunidades distintas e práticas. Não afirme que alguma oferta existe no catálogo.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!aiResponse.ok) {
      await sendAiProviderError(aiResponse, response, 'A IA não conseguiu sugerir produtos agora. Tente novamente.', ai.name);
      return;
    }

    const result = await aiResponse.json();
    const raw = result.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') {
      sendJson(response, 502, { error: 'A resposta da IA veio vazia. Tente novamente.' });
      return;
    }
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      sendJson(response, 502, { error: 'A IA não retornou sugestões estruturadas. Tente novamente.' });
      return;
    }
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    const fields = ['productIdea', 'productType', 'audience', 'problem', 'promotionAngle'];
    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length < 3) {
      sendJson(response, 502, { error: 'A IA retornou poucas sugestões. Tente novamente.' });
      return;
    }
    const suggestions = parsed.suggestions.slice(0, 5).map((suggestion) => {
      if (fields.some((field) => typeof suggestion[field] !== 'string' || !suggestion[field].trim())) return null;
      return {
        ...Object.fromEntries(fields.map((field) => [field, suggestion[field].trim().slice(0, 700)])),
        validationChecks: Array.isArray(suggestion.validationChecks)
          ? suggestion.validationChecks.filter((item) => typeof item === 'string').slice(0, 4).map((item) => item.slice(0, 300))
          : [],
      };
    }).filter(Boolean);
    if (suggestions.length < 3) {
      sendJson(response, 502, { error: 'As sugestões vieram incompletas. Tente novamente.' });
      return;
    }
    sendJson(response, 200, { suggestions });
  } catch (error) {
    console.error('Falha ao sugerir produtos afiliados:', error.message);
    sendJson(response, 502, { error: 'Não consegui sugerir produtos afiliados agora.' });
  }
}

async function handleAffiliatePromotion(request, response) {
  const ai = getAiConfig();
  if (!ai.key) {
    const keyName = ai.name === 'Gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    sendJson(response, 503, { error: `Configure ${keyName} no .env para criar um plano de divulgação.` });
    return;
  }

  try {
    const body = await readJson(request);
    const product = body.product && typeof body.product === 'object' ? body.product : {};
    const durationDays = Number.parseInt(String(body.duration || '').match(/\d+/)?.[0] || '', 10);
    const channelOptions = new Set(['Instagram e TikTok', 'Instagram e Facebook', 'TikTok e YouTube Shorts', 'Instagram, TikTok e e-mail']);
    const frequencyOptions = new Set(['3 publicações por semana', '5 publicações por semana', '1 publicação por dia']);
    const name = typeof product.name === 'string' ? product.name.trim().slice(0, 120) : '';
    const platform = typeof product.platform === 'string' ? product.platform.trim().slice(0, 80) : '';
    const link = typeof product.link === 'string' ? product.link.trim().slice(0, 1000) : '';

    if (!name || !platform || !link || ![7, 14, 30].includes(durationDays) || !channelOptions.has(body.channels) || !frequencyOptions.has(body.frequency)) {
      sendJson(response, 400, { error: 'Produto, link, duração, canais ou frequência inválidos.' });
      return;
    }
    let parsedLink;
    try {
      parsedLink = new URL(link);
    } catch {
      sendJson(response, 400, { error: 'O link de afiliado não é válido.' });
      return;
    }
    if (parsedLink.protocol !== 'https:') {
      sendJson(response, 400, { error: 'O link de afiliado precisa usar HTTPS.' });
      return;
    }

    const postsPerWeek = body.frequency === '1 publicação por dia' ? 7 : Number.parseInt(body.frequency, 10);
    const entryCount = Math.min(20, Math.ceil(durationDays * postsPerWeek / 7));
    const safeProduct = {
      name,
      platform,
      link,
      commission: Number.isFinite(product.commission) ? Math.min(100, Math.max(0, product.commission)) : null,
    };
    const aiResponse = await fetch(`${ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ai.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ai.model,
        temperature: 0.6,
        max_tokens: 5000,
        messages: [
          {
            role: 'system',
            content: 'Você é estrategista de conteúdo para afiliados no Brasil. Gere um plano prático e ético. Não invente características, preços, comissão, resultados, avaliações ou disponibilidade; use somente os dados fornecidos. Inclua divulgação explícita de vínculo afiliado (#publi/#afiliado) em cada publicação e uma chamada para ação com o link fornecido. Não prometa renda nem resultados. Não publique, não programe posts, não gaste verba e não envie mensagens. Responda somente JSON válido no formato {"strategy":"...","schedule":[{"day":"Dia 1","channel":"...","contentType":"...","copy":"...","cta":"..."}]}. Entregue exatamente o número solicitado de itens, em português brasileiro.',
          },
          {
            role: 'user',
            content: `Crie ${entryCount} conteúdos para ${durationDays} dias, distribuídos em ${body.frequency}, para estes canais: ${body.channels}.\nProduto cadastrado como afiliado: ${JSON.stringify(safeProduct)}\nObjetivo/ângulo: ${typeof body.goal === 'string' ? body.goal.trim().slice(0, 300) : 'conteúdo útil e educativo'}\nUse o link exato ${link} nas CTAs. Não diga que verificou ou utilizou o produto.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!aiResponse.ok) {
      await sendAiProviderError(aiResponse, response, 'A IA não conseguiu montar o plano agora. Tente novamente.', ai.name);
      return;
    }
    const result = await aiResponse.json();
    const raw = result.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') {
      sendJson(response, 502, { error: 'A resposta do plano veio vazia. Tente novamente.' });
      return;
    }
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      sendJson(response, 502, { error: 'A IA não retornou um calendário estruturado. Tente novamente.' });
      return;
    }
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    if (typeof parsed.strategy !== 'string' || !Array.isArray(parsed.schedule)) {
      sendJson(response, 502, { error: 'O plano retornado está incompleto. Tente novamente.' });
      return;
    }
    const schedule = parsed.schedule.slice(0, entryCount).map((entry) => {
      const fields = ['day', 'channel', 'contentType', 'copy', 'cta'];
      if (fields.some((field) => typeof entry[field] !== 'string' || !entry[field].trim())) return null;
      return Object.fromEntries(fields.map((field) => [field, entry[field].trim().slice(0, field === 'copy' ? 1_500 : 300)]));
    }).filter(Boolean);
    if (!schedule.length) {
      sendJson(response, 502, { error: 'O plano retornou sem conteúdos válidos. Tente novamente.' });
      return;
    }
    sendJson(response, 200, { strategy: parsed.strategy.trim().slice(0, 1_500), schedule });
  } catch (error) {
    console.error('Falha ao criar plano de divulgação:', error.message);
    sendJson(response, 502, { error: 'Não consegui criar o plano de divulgação agora.' });
  }
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/api/chat' && request.method === 'POST') {
    handleChat(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/generate' && request.method === 'POST') {
    handleGenerate(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/product/generate' && request.method === 'POST') {
    handleProductGeneration(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/affiliates/suggest' && request.method === 'POST') {
    handleAffiliateSuggestions(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/affiliates/promotion' && request.method === 'POST') {
    handleAffiliatePromotion(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/finance/session') {
    handleFinanceSession(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/finance/providers' && request.method === 'GET') {
    if (!requireFinanceSession(request, response)) return;
    sendJson(response, 200, { providers: financeProviders() });
    return;
  }

  if (requestUrl.pathname === '/api/finance/balance' && request.method === 'GET') {
    handleFinanceBalance(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/finance/withdrawal' && request.method === 'POST') {
    handleFinanceWithdrawal(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/health' && request.method === 'GET') {
    const ai = getAiConfig();
    sendJson(response, 200, { ready: Boolean(ai.key), provider: ai.name });
    return;
  }

  const fileName = requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname.slice(1);
  if (!['index.html', 'styles.css', 'app.js', 'marketing.js'].includes(fileName) || request.method !== 'GET') {
    response.writeHead(404);
    response.end('Não encontrado');
    return;
  }

  const filePath = path.join(publicDirectory, fileName);
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404);
      response.end('Não encontrado');
      return;
    }
    response.writeHead(200, { 'content-type': contentTypes[path.extname(filePath)] });
    response.end(contents);
  });
});

server.listen(port, () => {
  console.log(`Cash disponível em http://localhost:${port}`);
  const ai = getAiConfig();
  if (!ai.key) {
    const keyName = ai.name === 'Gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    console.warn(`IA desativada. Preencha ${keyName} no arquivo .env e reinicie o servidor.`);
  }
});