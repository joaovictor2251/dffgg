const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const localAi = require('./local-ai');

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
const databasePath = process.env.CASH_DATABASE_PATH || path.join(__dirname, 'data', 'cash.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
const accountDatabase = new DatabaseSync(databasePath);
accountDatabase.exec('CREATE TABLE IF NOT EXISTS owner_accounts (id INTEGER PRIMARY KEY CHECK (id = 1), email TEXT NOT NULL UNIQUE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)');
accountDatabase.exec("CREATE TABLE IF NOT EXISTS app_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('owner', 'member')), created_at TEXT NOT NULL)");
accountDatabase.exec(`INSERT OR IGNORE INTO app_accounts (id, email, password_salt, password_hash, role, created_at)
  SELECT id, email, password_salt, password_hash, 'owner', created_at FROM owner_accounts WHERE id = 1`);
accountDatabase.exec(`CREATE TABLE IF NOT EXISTS app_profiles (
  account_id INTEGER PRIMARY KEY REFERENCES app_accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  avatar_mime TEXT,
  avatar_data BLOB,
  updated_at TEXT NOT NULL
)`);
const ensureAccountProfile = accountDatabase.prepare(`INSERT OR IGNORE INTO app_profiles
  (account_id, display_name, username_key, updated_at) VALUES (?, ?, ?, ?)`);
const profileTimestamp = new Date().toISOString();
accountDatabase.prepare('SELECT id FROM app_accounts').all().forEach(({ id }) => {
  ensureAccountProfile.run(id, `Usuário ${id}`, `usuario-${id}`, profileTimestamp);
});
accountDatabase.exec(`CREATE TABLE IF NOT EXISTS platform_sales (
  provider TEXT NOT NULL CHECK (provider IN ('kiwify', 'cakto')),
  sale_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'refunded', 'chargedback')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  product_name TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  event_at_ms INTEGER NOT NULL,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (provider, sale_id)
)`);
accountDatabase.exec(`CREATE TABLE IF NOT EXISTS platform_sale_events (
  provider TEXT NOT NULL CHECK (provider IN ('kiwify', 'cakto')),
  event_key TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (provider, event_key)
)`);
accountDatabase.exec(`CREATE TABLE IF NOT EXISTS app_sale_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_account_id INTEGER NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('kiwify', 'cakto')),
  sale_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  UNIQUE (provider, sale_id)
)`);
accountDatabase.exec(`CREATE TABLE IF NOT EXISTS app_gifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_account_id INTEGER NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES app_accounts(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('pro', 'premium')),
  duration_days INTEGER CHECK (duration_days BETWEEN 1 AND 365),
  is_permanent INTEGER NOT NULL DEFAULT 0 CHECK (is_permanent IN (0, 1)),
  created_at TEXT NOT NULL,
  redeemed_at TEXT,
  access_until TEXT,
  CHECK ((is_permanent = 1 AND duration_days IS NULL) OR (is_permanent = 0 AND duration_days IS NOT NULL))
)`);
accountDatabase.exec('CREATE INDEX IF NOT EXISTS app_gifts_recipient ON app_gifts (recipient_account_id, redeemed_at)');
accountDatabase.exec(`CREATE TABLE IF NOT EXISTS app_gift_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkout_reference TEXT NOT NULL UNIQUE,
  payer_account_id INTEGER NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  recipient_account_id INTEGER NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('pro', 'premium')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  preference_id TEXT UNIQUE,
  checkout_url TEXT,
  payment_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('creating', 'pending', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back', 'failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  redeemed_at TEXT,
  access_until TEXT
)`);
accountDatabase.exec('CREATE INDEX IF NOT EXISTS app_gift_purchases_recipient ON app_gift_purchases (recipient_account_id, status, redeemed_at)');
accountDatabase.exec(`CREATE TABLE IF NOT EXISTS app_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES app_accounts(id),
  plan_id TEXT NOT NULL,
  checkout_reference TEXT NOT NULL UNIQUE,
  provider_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL,
  init_point TEXT,
  next_payment_at TEXT,
  last_payment_status TEXT,
  last_payment_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);
accountDatabase.exec(`CREATE TABLE IF NOT EXISTS app_coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  max_redemptions INTEGER NOT NULL CHECK (max_redemptions BETWEEN 1 AND 500),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  access_type TEXT NOT NULL DEFAULT 'monthly' CHECK (access_type IN ('monthly', 'permanent')),
  created_by INTEGER NOT NULL REFERENCES app_accounts(id),
  created_at TEXT NOT NULL
)`);
accountDatabase.exec(`CREATE TABLE IF NOT EXISTS app_coupon_redemptions (
  coupon_id INTEGER NOT NULL REFERENCES app_coupons(id),
  account_id INTEGER NOT NULL REFERENCES app_accounts(id),
  redeemed_at TEXT NOT NULL,
  access_until TEXT NOT NULL,
  is_permanent INTEGER NOT NULL DEFAULT 0 CHECK (is_permanent IN (0, 1)),
  PRIMARY KEY (coupon_id, account_id)
)`);
const couponColumns = new Set(accountDatabase.prepare('PRAGMA table_info(app_coupons)').all().map((column) => column.name));
if (!couponColumns.has('access_type')) accountDatabase.exec("ALTER TABLE app_coupons ADD COLUMN access_type TEXT NOT NULL DEFAULT 'monthly' CHECK (access_type IN ('monthly', 'permanent'))");
const couponRedemptionColumns = new Set(accountDatabase.prepare('PRAGMA table_info(app_coupon_redemptions)').all().map((column) => column.name));
if (!couponRedemptionColumns.has('is_permanent')) accountDatabase.exec('ALTER TABLE app_coupon_redemptions ADD COLUMN is_permanent INTEGER NOT NULL DEFAULT 0 CHECK (is_permanent IN (0, 1))');
const subscriptionColumns = new Set(accountDatabase.prepare('PRAGMA table_info(app_subscriptions)').all().map((column) => column.name));
if (!subscriptionColumns.has('last_payment_status')) accountDatabase.exec('ALTER TABLE app_subscriptions ADD COLUMN last_payment_status TEXT');
if (!subscriptionColumns.has('last_payment_at')) accountDatabase.exec('ALTER TABLE app_subscriptions ADD COLUMN last_payment_at TEXT');
accountDatabase.exec(`CREATE UNIQUE INDEX IF NOT EXISTS one_open_subscription_per_account
  ON app_subscriptions (account_id)
  WHERE status IN ('creating', 'pending', 'authorized', 'paused')`);
accountDatabase.exec(`CREATE TABLE IF NOT EXISTS app_monthly_usage (
  account_id INTEGER NOT NULL REFERENCES app_accounts(id),
  month TEXT NOT NULL,
  operation_count INTEGER NOT NULL DEFAULT 0,
  campaign_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, month)
)`);
const usageColumns = new Set(accountDatabase.prepare('PRAGMA table_info(app_monthly_usage)').all().map((column) => column.name));
if (!usageColumns.has('campaign_count')) accountDatabase.exec('ALTER TABLE app_monthly_usage ADD COLUMN campaign_count INTEGER NOT NULL DEFAULT 0');
accountDatabase.prepare("UPDATE app_subscriptions SET status = 'checkout_failed', updated_at = ? WHERE status = 'creating'")
  .run(new Date().toISOString());
accountDatabase.exec('CREATE INDEX IF NOT EXISTS platform_sales_occurred_at ON platform_sales (occurred_at DESC)');
const billingPlans = [
  {
    id: 'basic',
    name: 'Básico',
    priceCents: 0,
    minimumFeature: 0,
    monthlyCampaigns: 5,
    description: 'Para começar a utilizar a plataforma.',
    features: [
      { name: 'Visão geral', included: true },
      { name: 'Ganhos', included: true },
      { name: 'Campanhas', included: true },
      { name: 'Criar campanhas · 5 por mês', included: true },
      { name: 'Produtos', included: false },
      { name: 'Afiliados', included: false },
      { name: 'Impulsionar', included: false },
      { name: 'Integrações', included: false },
      { name: 'Assistente IA', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceCents: 2_990,
    minimumFeature: 1,
    monthlyCampaigns: null,
    description: 'Crie campanhas, produtos e divulgue como afiliado.',
    features: [
      { name: 'Visão geral', included: true },
      { name: 'Ganhos', included: true },
      { name: 'Campanhas', included: true },
      { name: 'Criar campanhas', included: true },
      { name: 'Produtos', included: true },
      { name: 'Afiliados', included: true },
      { name: 'Impulsionar', included: false },
      { name: 'Integrações', included: false },
      { name: 'Assistente IA', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    priceCents: 5_990,
    minimumFeature: 2,
    monthlyCampaigns: null,
    description: 'Acesse todas as ferramentas do Dinvaro IA.',
    features: [
      { name: 'Visão geral', included: true },
      { name: 'Ganhos', included: true },
      { name: 'Campanhas', included: true },
      { name: 'Criar campanhas', included: true },
      { name: 'Produtos', included: true },
      { name: 'Afiliados', included: true },
      { name: 'Impulsionar', included: true },
      { name: 'Integrações', included: true },
      { name: 'Assistente IA', included: true },
    ],
  },
];
const developerPlan = {
  id: 'dev',
  name: 'Dev',
  priceCents: 0,
  minimumFeature: 3,
  monthlyCampaigns: null,
  description: 'Plano exclusivo da conta proprietária, com acesso completo e sem cobrança.',
  features: [
    ...billingPlans.find((plan) => plan.id === 'premium').features,
    { name: 'Exclusivo da conta proprietária', included: true },
  ],
};
const planOrder = Object.fromEntries(billingPlans.map((plan) => [plan.id, plan.minimumFeature]));
try {
  fs.chmodSync(databasePath, 0o600);
} catch {
}
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
};
const financeSessions = new Map();
const providerTokens = new Map();
const failedLoginAttempts = new Map();
const accountRegistrationAttempts = new Map();
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

function readJson(request, maximumCharacters = 20_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > maximumCharacters) {
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

function readRawBody(request, maximumBytes = 100_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    request.on('data', (chunk) => {
      length += chunk.length;
      if (length > maximumBytes) {
        reject(new Error('Corpo da requisição muito grande'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
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
  const session = getAccountSession(request);
  return session?.role === 'owner';
}

function getAccountSession(request) {
  const sessionId = financeSessionId(request);
  const session = sessionId && financeSessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    financeSessions.delete(sessionId);
    return null;
  }
  return session;
}

function hasAppSession(request) {
  return Boolean(getAccountSession(request));
}

function ownerAccountExists() {
  return Boolean(accountDatabase.prepare("SELECT 1 AS found FROM app_accounts WHERE role = 'owner' LIMIT 1").get());
}

function createAccountSession(request, response, account) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  financeSessions.set(sessionId, {
    userId: account.id,
    email: account.email,
    role: account.role,
    expiresAt: Date.now() + financeSessionLifetime,
  });
  const secure = request.socket.encrypted || request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  response.setHeader('set-cookie', `${financeSessionCookie}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${financeSessionLifetime / 1000}${secure}`);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function isLoginRateLimited(request) {
  const key = request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const attempts = (failedLoginAttempts.get(key) || []).filter((timestamp) => now - timestamp < 15 * 60 * 1000);
  if (attempts.length >= 10) {
    failedLoginAttempts.set(key, attempts);
    return true;
  }
  attempts.push(now);
  failedLoginAttempts.set(key, attempts);
  return false;
}

function isRegistrationRateLimited(request) {
  const key = request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const attempts = (accountRegistrationAttempts.get(key) || []).filter((timestamp) => now - timestamp < 15 * 60 * 1000);
  if (attempts.length >= 5) {
    accountRegistrationAttempts.set(key, attempts);
    return true;
  }
  attempts.push(now);
  accountRegistrationAttempts.set(key, attempts);
  return false;
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
  const session = getAccountSession(request);
  if (!session) {
    sendJson(response, 401, { error: 'Faça login no Dinvaro IA novamente.' });
    return false;
  }
  if (session.role !== 'owner') {
    sendJson(response, 403, { error: 'A área financeira está disponível somente para a conta proprietária.' });
    return false;
  }
  return true;
}

function requireAppSession(request, response) {
  if (!hasAppSession(request)) {
    sendJson(response, 401, { error: 'Faça login no Dinvaro IA novamente.' });
    return false;
  }
  return true;
}

function requireOwnerAccount(request, response) {
  const session = getAccountSession(request);
  if (!session) {
    sendJson(response, 401, { error: 'Faça login no Dinvaro IA novamente.' });
    return null;
  }
  if (session.role !== 'owner') {
    sendJson(response, 403, { error: 'O gerenciamento de cupons está disponível somente para a conta proprietária.' });
    return null;
  }
  return session;
}

function getAccountPlan(accountId) {
  const account = accountDatabase.prepare('SELECT role FROM app_accounts WHERE id = ?').get(accountId);
  if (account?.role === 'owner') return { id: developerPlan.id, name: developerPlan.name, monthlyCampaigns: null, featureLevel: developerPlan.minimumFeature, subscription: null, isOwner: true };
  const subscription = accountDatabase.prepare(`SELECT id, plan_id AS planId, status, init_point AS initPoint,
      next_payment_at AS nextPaymentAt, last_payment_status AS lastPaymentStatus,
      last_payment_at AS lastPaymentAt, created_at AS createdAt
    FROM app_subscriptions WHERE account_id = ? ORDER BY id DESC LIMIT 1`).get(accountId);
  const rejectedPayments = new Set(['rejected', 'cancelled', 'refunded', 'charged_back']);
  const activeSubscription = subscription?.status === 'authorized'
    && !rejectedPayments.has(subscription.lastPaymentStatus) ? subscription : null;
  if (!activeSubscription) {
    const couponAccess = accountDatabase.prepare(`SELECT access_until AS accessUntil, is_permanent AS isPermanent
      FROM app_coupon_redemptions WHERE account_id = ? AND (is_permanent = 1 OR access_until > ?)
      ORDER BY is_permanent DESC, access_until DESC LIMIT 1`).get(accountId, new Date().toISOString());
    if (couponAccess) {
      const plan = billingPlans.find((candidate) => candidate.id === 'premium');
      return {
        id: plan.id,
        name: plan.name,
        monthlyCampaigns: plan.monthlyCampaigns,
        featureLevel: plan.minimumFeature,
        subscription: subscription || null,
        isOwner: false,
        accessSource: couponAccess.isPermanent ? 'coupon_permanent' : 'coupon',
        accessUntil: couponAccess.isPermanent ? null : couponAccess.accessUntil,
      };
    }
    const giftAccess = accountDatabase.prepare(`SELECT planId, accessUntil, isPermanent, accessSource FROM (
      SELECT plan_id AS planId, access_until AS accessUntil, is_permanent AS isPermanent, 'gift' AS accessSource
      FROM app_gifts WHERE recipient_account_id = ? AND redeemed_at IS NOT NULL
        AND (is_permanent = 1 OR access_until > ?)
      UNION ALL
      SELECT plan_id AS planId, access_until AS accessUntil, 0 AS isPermanent, 'gift_paid' AS accessSource
      FROM app_gift_purchases WHERE recipient_account_id = ? AND status = 'approved'
        AND redeemed_at IS NOT NULL AND access_until > ?
    ) ORDER BY CASE planId WHEN 'premium' THEN 2 ELSE 1 END DESC, isPermanent DESC, accessUntil DESC LIMIT 1`)
      .get(accountId, new Date().toISOString(), accountId, new Date().toISOString());
    if (giftAccess) {
      const plan = billingPlans.find((candidate) => candidate.id === giftAccess.planId);
      return {
        id: plan.id,
        name: plan.name,
        monthlyCampaigns: plan.monthlyCampaigns,
        featureLevel: plan.minimumFeature,
        subscription: subscription || null,
        isOwner: false,
        accessSource: giftAccess.accessSource === 'gift_paid'
          ? 'gift_paid'
          : giftAccess.isPermanent ? 'gift_permanent' : 'gift',
        accessUntil: giftAccess.isPermanent ? null : giftAccess.accessUntil,
      };
    }
  }
  const plan = billingPlans.find((candidate) => candidate.id === activeSubscription?.planId) || billingPlans[0];
  return {
    id: plan.id,
    name: plan.name,
    monthlyCampaigns: plan.monthlyCampaigns,
    featureLevel: plan.minimumFeature,
    subscription: subscription || null,
    isOwner: false,
    accessSource: activeSubscription ? 'subscription' : null,
    accessUntil: null,
  };
}

function getMonthlyCampaignCount(accountId) {
  const month = new Date().toISOString().slice(0, 7);
  return Number(accountDatabase.prepare('SELECT campaign_count AS count FROM app_monthly_usage WHERE account_id = ? AND month = ?').get(accountId, month)?.count || 0);
}

function recordMonthlyCampaign(accountId) {
  const month = new Date().toISOString().slice(0, 7);
  accountDatabase.prepare(`INSERT INTO app_monthly_usage (account_id, month, campaign_count) VALUES (?, ?, 1)
    ON CONFLICT(account_id, month) DO UPDATE SET campaign_count = campaign_count + 1`).run(accountId, month);
}

function requireMinimumPlan(request, response, minimumPlanId) {
  const session = getAccountSession(request);
  if (!session) {
    sendJson(response, 401, { error: 'Faça login no Dinvaro IA novamente.' });
    return false;
  }
  const minimumLevel = planOrder[minimumPlanId];
  const plan = getAccountPlan(session.userId);
  if (plan.featureLevel < minimumLevel) {
    sendJson(response, 403, {
      error: `Este recurso está disponível a partir do plano ${billingPlans.find((candidate) => candidate.id === minimumPlanId)?.name || minimumPlanId}.`,
      code: 'PLAN_REQUIRED',
      minimumPlan: minimumPlanId,
    });
    return false;
  }
  return true;
}

function safePublicAppUrl() {
  let appUrl;
  try {
    appUrl = new URL(process.env.PUBLIC_APP_URL || '');
  } catch {
    throw new Error('Configure PUBLIC_APP_URL com o endereço HTTPS público do Dinvaro IA.');
  }
  if (appUrl.protocol !== 'https:' || appUrl.username || appUrl.password || appUrl.search || appUrl.hash || !['', '/'].includes(appUrl.pathname)) {
    throw new Error('PUBLIC_APP_URL precisa ser a origem HTTPS estável do app, sem caminho ou parâmetros.');
  }
  return appUrl.origin;
}

async function mercadoPagoRequest(apiPath, options = {}) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error('Configure MERCADOPAGO_ACCESS_TOKEN no servidor.');
  const response = await fetch(`https://api.mercadopago.com${apiPath}`, {
    method: options.method || 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...(options.idempotencyKey ? { 'x-idempotency-key': options.idempotencyKey } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`Mercado Pago respondeu com status ${response.status} na API de assinaturas.`);
    throw new Error('O Mercado Pago não conseguiu processar a assinatura. Tente novamente.');
  }
  return result;
}

function normalizedSubscriptionStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'authorized') return 'authorized';
  if (value === 'pending') return 'pending';
  if (value === 'paused') return 'paused';
  if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
  if (value === 'expired') return 'expired';
  if (value === 'rejected') return 'rejected';
  return 'pending';
}

function validMercadoPagoSignature(signatureHeader, requestId, dataId, secret) {
  if (typeof signatureHeader !== 'string' || typeof dataId !== 'string'
    || !/^[a-zA-Z0-9._-]{1,120}$/.test(dataId) || !secret) return false;
  const normalizedRequestId = typeof requestId === 'string' ? requestId.trim() : '';
  if (normalizedRequestId.length > 200) return false;
  const signatureParts = Object.fromEntries(signatureHeader.split(',').map((part) => {
    const [key, ...valueParts] = part.trim().split('=');
    return [key.toLowerCase(), valueParts.join('=')];
  }));
  const timestamp = signatureParts.ts;
  const receivedHash = signatureParts.v1;
  if (!/^\d+$/.test(timestamp || '') || !/^[a-f0-9]{64}$/i.test(receivedHash || '')) return false;
  const manifestParts = [`id:${dataId}`];
  if (normalizedRequestId) manifestParts.push(`request-id:${normalizedRequestId}`);
  manifestParts.push(`ts:${timestamp}`);
  const manifest = `${manifestParts.join(';')};`;
  const expectedHash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return safeStringEqual(receivedHash.toLowerCase(), expectedHash);
}

function handleBillingPlans(request, response) {
  const session = getAccountSession(request);
  const plans = session?.role === 'owner' ? [...billingPlans, developerPlan] : billingPlans;
  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
  });
  response.end(JSON.stringify({
    plans: plans.map(({ id, name, priceCents, monthlyCampaigns, description, features }) => ({
      id, name, priceCents, monthlyCampaigns, description, features,
    })),
  }));
}

function handleBillingStatus(request, response) {
  if (!requireAppSession(request, response)) return;
  const session = getAccountSession(request);
  const plan = getAccountPlan(session.userId);
  sendJson(response, 200, {
    plan: {
      id: plan.id,
      name: plan.name,
      monthlyCampaigns: plan.monthlyCampaigns,
      featureLevel: plan.featureLevel,
      isOwner: plan.isOwner,
      campaignsThisMonth: plan.isOwner ? null : getMonthlyCampaignCount(session.userId),
      accessSource: plan.accessSource || null,
      accessUntil: plan.accessUntil || null,
    },
    subscription: plan.subscription,
  });
}

function handleSalesNotifications(request, response) {
  if (!requireFinanceSession(request, response)) return;
  if (request.method === 'GET') {
    const notifications = accountDatabase.prepare(`SELECT id, provider, sale_id AS saleId, product_name AS productName,
        amount_cents AS amountCents, currency, occurred_at AS occurredAt, created_at AS createdAt, read_at AS readAt
      FROM app_sale_notifications WHERE owner_account_id = ? ORDER BY id DESC LIMIT 100`).all(getAccountSession(request).userId);
    const unreadCount = Number(accountDatabase.prepare(`SELECT COUNT(*) AS count FROM app_sale_notifications
      WHERE owner_account_id = ? AND read_at IS NULL`).get(getAccountSession(request).userId).count);
    sendJson(response, 200, { notifications, unreadCount });
    return;
  }
  if (request.method !== 'PATCH') {
    sendJson(response, 405, { error: 'Método não permitido.' });
    return;
  }
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  accountDatabase.prepare(`UPDATE app_sale_notifications SET read_at = ?
    WHERE owner_account_id = ? AND read_at IS NULL`).run(new Date().toISOString(), getAccountSession(request).userId);
  sendJson(response, 200, { read: true });
}

function handleGifts(request, response) {
  const session = getAccountSession(request);
  if (!session) {
    sendJson(response, 401, { error: 'Faça login no Dinvaro IA novamente.' });
    return;
  }
  if (request.method === 'GET') {
    const gifts = session.role === 'owner'
      ? accountDatabase.prepare(`SELECT g.id, g.title, g.message, g.plan_id AS planId,
          g.duration_days AS durationDays, g.is_permanent AS isPermanent, g.created_at AS createdAt,
          g.redeemed_at AS redeemedAt, g.access_until AS accessUntil, a.email AS recipientEmail,
          COALESCE(p.display_name, a.email) AS recipientName
        FROM app_gifts g
        JOIN app_accounts a ON a.id = g.recipient_account_id
        LEFT JOIN app_profiles p ON p.account_id = a.id
        WHERE g.created_by = ? ORDER BY g.id DESC LIMIT 100`).all(session.userId)
      : accountDatabase.prepare(`SELECT id, title, message, plan_id AS planId,
          duration_days AS durationDays, is_permanent AS isPermanent, created_at AS createdAt,
          redeemed_at AS redeemedAt, access_until AS accessUntil
        FROM app_gifts WHERE recipient_account_id = ? ORDER BY redeemed_at IS NULL DESC, id DESC LIMIT 100`)
        .all(session.userId);
    const purchases = session.role === 'owner' ? [] : accountDatabase.prepare(`SELECT id, recipient_name AS recipientName, plan_id AS planId,
          amount_cents AS amountCents, status, created_at AS createdAt, paid_at AS paidAt,
          redeemed_at AS redeemedAt, access_until AS accessUntil
        FROM app_gift_purchases WHERE recipient_account_id = ? AND status = 'approved'
        ORDER BY redeemed_at IS NULL DESC, id DESC LIMIT 100`).all(session.userId);
    const sentPurchases = accountDatabase.prepare(`SELECT id, recipient_name AS recipientName,
        plan_id AS planId, amount_cents AS amountCents, status, created_at AS createdAt,
        paid_at AS paidAt, redeemed_at AS redeemedAt, access_until AS accessUntil
      FROM app_gift_purchases WHERE payer_account_id = ? ORDER BY id DESC LIMIT 100`).all(session.userId);
    sendJson(response, 200, {
      gifts: gifts.map((gift) => ({
        ...gift,
        isPermanent: Boolean(gift.isPermanent),
        planName: billingPlans.find((plan) => plan.id === gift.planId)?.name || gift.planId,
      })),
      purchases: purchases.map((purchase) => ({
        ...purchase,
        kind: 'purchase',
        isPermanent: false,
        durationDays: null,
        planName: billingPlans.find((plan) => plan.id === purchase.planId)?.name || purchase.planId,
      })),
      sentPurchases: sentPurchases.map((purchase) => ({
        ...purchase,
        isPermanent: false,
        durationDays: null,
        planName: billingPlans.find((plan) => plan.id === purchase.planId)?.name || purchase.planId,
      })),
      owner: session.role === 'owner',
    });
    return;
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Método não permitido.' });
    return;
  }
  if (session.role !== 'owner') {
    sendJson(response, 403, { error: 'Somente a conta proprietária pode enviar presentes.' });
    return;
  }
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }

  readJson(request).then((body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(response, 400, { error: 'Dados do presente inválidos.' });
      return;
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const plan = billingPlans.find((candidate) => ['pro', 'premium'].includes(candidate.id) && candidate.id === body.planId);
    const isPermanent = body.isPermanent === true;
    const durationDays = body.durationDays;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
      || title.length < 3 || title.length > 60 || message.length < 3 || message.length > 500
      || !plan || (!isPermanent && (!Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 365))) {
      sendJson(response, 400, { error: 'Confira e-mail, mensagem, plano e duração do presente.' });
      return;
    }
    const recipient = accountDatabase.prepare("SELECT id FROM app_accounts WHERE email = ? AND role = 'member'").get(email);
    if (!recipient) {
      sendJson(response, 404, { error: 'Não encontrei uma conta de usuário com esse e-mail.' });
      return;
    }
    const createdAt = new Date().toISOString();
    const result = accountDatabase.prepare(`INSERT INTO app_gifts
      (recipient_account_id, created_by, title, message, plan_id, duration_days, is_permanent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(recipient.id, session.userId, title, message, plan.id, isPermanent ? null : durationDays, isPermanent ? 1 : 0, createdAt);
    sendJson(response, 201, {
      gift: {
        id: Number(result.lastInsertRowid),
        title,
        message,
        planId: plan.id,
        planName: plan.name,
        durationDays: isPermanent ? null : durationDays,
        isPermanent,
        createdAt,
        redeemedAt: null,
        accessUntil: null,
        recipientEmail: email,
      },
    });
  }).catch((error) => {
    if (error.message === 'JSON inválido') {
      sendJson(response, 400, { error: 'O conteúdo enviado não é válido.' });
      return;
    }
    console.error(`Falha ao enviar presente da conta proprietária: ${error.message}`);
    sendJson(response, 500, { error: 'Não foi possível enviar o presente agora.' });
  });
}

async function handleGiftClaim(request, response, giftId) {
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  if (!requireAppSession(request, response)) return;
  const session = getAccountSession(request);
  if (session.role === 'owner') {
    sendJson(response, 400, { error: 'A conta proprietária já tem acesso completo.' });
    return;
  }

  let transactionOpen = false;
  try {
    accountDatabase.exec('BEGIN IMMEDIATE');
    transactionOpen = true;
    const gift = accountDatabase.prepare(`SELECT id, plan_id AS planId, duration_days AS durationDays,
        is_permanent AS isPermanent, redeemed_at AS redeemedAt
      FROM app_gifts WHERE id = ? AND recipient_account_id = ?`)
      .get(giftId, session.userId);
    if (!gift) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 404, { error: 'Presente não encontrado para esta conta.' });
      return;
    }
    if (gift.redeemedAt) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Este presente já foi resgatado.' });
      return;
    }
    const activeSubscription = accountDatabase.prepare(`SELECT 1 AS found FROM app_subscriptions
      WHERE account_id = ? AND status IN ('creating', 'pending', 'authorized', 'paused') LIMIT 1`)
      .get(session.userId);
    if (activeSubscription) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Cancele ou conclua sua assinatura atual antes de resgatar o presente.' });
      return;
    }
    const currentPlan = getAccountPlan(session.userId);
    const giftPlan = billingPlans.find((plan) => plan.id === gift.planId);
    if (['coupon', 'coupon_permanent', 'gift', 'gift_permanent'].includes(currentPlan.accessSource)
      && currentPlan.featureLevel >= giftPlan.minimumFeature) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Sua conta já tem um plano promocional igual ou superior ativo.' });
      return;
    }
    const now = new Date();
    const accessUntil = gift.isPermanent ? null : new Date(now.getTime() + gift.durationDays * 86_400_000).toISOString();
    accountDatabase.prepare(`UPDATE app_gifts SET redeemed_at = ?, access_until = ?
      WHERE id = ? AND recipient_account_id = ? AND redeemed_at IS NULL`)
      .run(now.toISOString(), accessUntil, giftId, session.userId);
    accountDatabase.exec('COMMIT');
    transactionOpen = false;
    sendJson(response, 200, {
      redeemed: true,
      planId: gift.planId,
      planName: giftPlan.name,
      accessUntil,
      permanent: Boolean(gift.isPermanent),
    });
  } catch (error) {
    if (transactionOpen) accountDatabase.exec('ROLLBACK');
    console.error(`Falha ao resgatar presente ${giftId} da conta ${session.userId}: ${error.message}`);
    sendJson(response, 500, { error: 'Não foi possível resgatar o presente agora.' });
  }
}

async function handlePaidGiftClaim(request, response, giftId) {
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  if (!requireAppSession(request, response)) return;
  const session = getAccountSession(request);
  if (session.role === 'owner') {
    sendJson(response, 400, { error: 'A conta proprietária já tem acesso completo.' });
    return;
  }

  let transactionOpen = false;
  try {
    accountDatabase.exec('BEGIN IMMEDIATE');
    transactionOpen = true;
    const gift = accountDatabase.prepare(`SELECT id, plan_id AS planId, status, redeemed_at AS redeemedAt
      FROM app_gift_purchases WHERE id = ? AND recipient_account_id = ?`)
      .get(giftId, session.userId);
    if (!gift || gift.status !== 'approved') {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 404, { error: 'Presente pago não encontrado para esta conta.' });
      return;
    }
    if (gift.redeemedAt) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Este presente já foi resgatado.' });
      return;
    }
    const activeSubscription = accountDatabase.prepare(`SELECT 1 AS found FROM app_subscriptions
      WHERE account_id = ? AND status IN ('creating', 'pending', 'authorized', 'paused') LIMIT 1`)
      .get(session.userId);
    if (activeSubscription) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Cancele ou conclua sua assinatura atual antes de resgatar o presente.' });
      return;
    }
    const currentPlan = getAccountPlan(session.userId);
    const giftPlan = billingPlans.find((plan) => plan.id === gift.planId);
    if (['coupon', 'coupon_permanent', 'gift', 'gift_permanent', 'gift_paid'].includes(currentPlan.accessSource)
      && currentPlan.featureLevel >= giftPlan.minimumFeature) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Sua conta já tem um plano promocional igual ou superior ativo.' });
      return;
    }
    const now = new Date();
    const accessUntil = addOneUtcMonth(now).toISOString();
    const update = accountDatabase.prepare(`UPDATE app_gift_purchases SET redeemed_at = ?, access_until = ?
      WHERE id = ? AND recipient_account_id = ? AND status = 'approved' AND redeemed_at IS NULL`)
      .run(now.toISOString(), accessUntil, giftId, session.userId);
    if (update.changes !== 1) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Este presente já foi resgatado.' });
      return;
    }
    accountDatabase.exec('COMMIT');
    transactionOpen = false;
    sendJson(response, 200, {
      redeemed: true,
      planId: gift.planId,
      planName: giftPlan.name,
      accessUntil,
      permanent: false,
    });
  } catch (error) {
    if (transactionOpen) accountDatabase.exec('ROLLBACK');
    console.error(`Falha ao resgatar presente pago ${giftId} da conta ${session.userId}: ${error.message}`);
    sendJson(response, 500, { error: 'Não foi possível resgatar o presente agora.' });
  }
}

function handleAdminCoupons(request, response) {
  const session = requireOwnerAccount(request, response);
  if (!session) return;
  if (request.method === 'GET') {
    const coupons = accountDatabase.prepare(`SELECT id, code, access_type AS accessType, max_redemptions AS maxUses,
        used_count AS usedCount, active, created_at AS createdAt
      FROM app_coupons ORDER BY id DESC`).all();
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
    });
    response.end(JSON.stringify({ coupons }));
    return;
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Método não permitido.' });
    return;
  }
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  readJson(request).then((body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || !Number.isSafeInteger(body.maxUses) || body.maxUses < 1 || body.maxUses > 500) {
      sendJson(response, 400, { error: 'Defina um limite de 1 a 500 utilizações para o cupom.' });
      return;
    }
    const accessType = body.accessType === undefined ? 'monthly' : body.accessType;
    if (!['monthly', 'permanent'].includes(accessType)) {
      sendJson(response, 400, { error: 'Escolha um período válido para o cupom.' });
      return;
    }
    const requestedCode = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (requestedCode && !/^[A-Z0-9@][A-Z0-9@-]{2,31}$/.test(requestedCode)) {
      sendJson(response, 400, { error: 'Use de 3 a 32 letras, números, arroba ou hífens no código do cupom.' });
      return;
    }
    const code = requestedCode || `DINVARO-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const coupon = accountDatabase.prepare(`INSERT INTO app_coupons
      (code, max_redemptions, access_type, created_by, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(code, body.maxUses, accessType, session.userId, new Date().toISOString());
    const created = accountDatabase.prepare(`SELECT id, code, access_type AS accessType, max_redemptions AS maxUses,
        used_count AS usedCount, active, created_at AS createdAt
      FROM app_coupons WHERE id = ?`).get(Number(coupon.lastInsertRowid));
    sendJson(response, 201, { coupon: created });
  }).catch((error) => {
    if (error.message === 'JSON inválido') {
      sendJson(response, 400, { error: 'O conteúdo enviado não é válido.' });
      return;
    }
    if (String(error.message).includes('UNIQUE constraint failed: app_coupons.code')) {
      sendJson(response, 409, { error: 'Já existe um cupom com esse código.' });
      return;
    }
    console.error(`Falha ao criar cupom da conta proprietária: ${error.message}`);
    sendJson(response, 500, { error: 'Não foi possível criar o cupom agora.' });
  });
}

function handleAdminCouponUpdate(request, response, couponId) {
  const session = requireOwnerAccount(request, response);
  if (!session) return;
  if (request.method !== 'PATCH') {
    sendJson(response, 405, { error: 'Método não permitido.' });
    return;
  }
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  readJson(request).then((body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.active !== 'boolean') {
      sendJson(response, 400, { error: 'Informe se o cupom deve ficar ativo.' });
      return;
    }
    const coupon = accountDatabase.prepare('SELECT max_redemptions AS maxUses, used_count AS usedCount FROM app_coupons WHERE id = ?')
      .get(couponId);
    if (!coupon) {
      sendJson(response, 404, { error: 'Cupom não encontrado.' });
      return;
    }
    if (body.active && coupon.usedCount >= coupon.maxUses) {
      sendJson(response, 409, { error: 'O limite de utilizações deste cupom já foi atingido.' });
      return;
    }
    accountDatabase.prepare('UPDATE app_coupons SET active = ? WHERE id = ?').run(body.active ? 1 : 0, couponId);
    sendJson(response, 200, { active: body.active });
  }).catch((error) => {
    if (error.message === 'JSON inválido') {
      sendJson(response, 400, { error: 'O conteúdo enviado não é válido.' });
      return;
    }
    console.error(`Falha ao atualizar cupom ${couponId}: ${error.message}`);
    sendJson(response, 500, { error: 'Não foi possível atualizar o cupom agora.' });
  });
}

function addOneUtcMonth(date) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

async function handleCouponRedemption(request, response) {
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  if (!requireAppSession(request, response)) return;
  const session = getAccountSession(request);
  if (session.role === 'owner') {
    sendJson(response, 400, { error: 'A conta proprietária já tem acesso completo.' });
    return;
  }
  let transactionOpen = false;
  try {
    const body = await readJson(request);
    const code = body && typeof body === 'object' && !Array.isArray(body) && typeof body.code === 'string'
      ? body.code.trim().toUpperCase()
      : '';
    if (!/^[A-Z0-9@-]{8,32}$/.test(code)) {
      sendJson(response, 400, { error: 'Informe um código de cupom válido.' });
      return;
    }

    accountDatabase.exec('BEGIN IMMEDIATE');
    transactionOpen = true;
    const coupon = accountDatabase.prepare(`SELECT id, access_type AS accessType, max_redemptions AS maxUses, used_count AS usedCount, active
      FROM app_coupons WHERE code = ?`).get(code);
    if (!coupon || !coupon.active) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 404, { error: 'Cupom inválido ou inativo.' });
      return;
    }
    if (coupon.usedCount >= coupon.maxUses) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Este cupom já atingiu o limite de utilizações.' });
      return;
    }
    const priorRedemption = accountDatabase.prepare('SELECT 1 AS found FROM app_coupon_redemptions WHERE coupon_id = ? AND account_id = ?')
      .get(coupon.id, session.userId);
    if (priorRedemption) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Sua conta já utilizou este cupom.' });
      return;
    }
    const activeSubscription = accountDatabase.prepare(`SELECT 1 AS found FROM app_subscriptions
      WHERE account_id = ? AND status IN ('creating', 'pending', 'authorized', 'paused') LIMIT 1`)
      .get(session.userId);
    if (activeSubscription) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Cancele ou conclua sua assinatura atual antes de resgatar um cupom.' });
      return;
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const activeCouponAccess = coupon.accessType !== 'permanent'
      && accountDatabase.prepare(`SELECT 1 AS found FROM app_coupon_redemptions
        WHERE account_id = ? AND (is_permanent = 1 OR access_until > ?) LIMIT 1`).get(session.userId, nowIso);
    if (activeCouponAccess) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Sua conta já tem um mês Premium promocional ativo.' });
      return;
    }
    const isPermanent = coupon.accessType === 'permanent';
    const accessUntil = isPermanent ? '9999-12-31T23:59:59.999Z' : addOneUtcMonth(now).toISOString();
    const updatedCoupon = accountDatabase.prepare(`UPDATE app_coupons SET used_count = used_count + 1
      WHERE id = ? AND active = 1 AND used_count < max_redemptions`).run(coupon.id);
    if (updatedCoupon.changes !== 1) {
      accountDatabase.exec('ROLLBACK');
      transactionOpen = false;
      sendJson(response, 409, { error: 'Este cupom não está mais disponível.' });
      return;
    }
    accountDatabase.prepare(`INSERT INTO app_coupon_redemptions
      (coupon_id, account_id, redeemed_at, access_until, is_permanent) VALUES (?, ?, ?, ?, ?)`)
      .run(coupon.id, session.userId, nowIso, accessUntil, isPermanent ? 1 : 0);
    accountDatabase.exec('COMMIT');
    transactionOpen = false;
    sendJson(response, 200, { plan: 'premium', permanent: isPermanent, accessUntil: isPermanent ? null : accessUntil });
  } catch (error) {
    if (transactionOpen) accountDatabase.exec('ROLLBACK');
    if (error.message === 'JSON inválido') {
      sendJson(response, 400, { error: 'O conteúdo enviado não é válido.' });
      return;
    }
    if (error.message === 'Corpo da requisição muito grande') {
      sendJson(response, 413, { error: 'A solicitação é muito grande.' });
      return;
    }
    console.error(`Falha ao resgatar cupom para a conta ${session.userId}: ${error.message}`);
    sendJson(response, 500, { error: 'Não foi possível resgatar o cupom agora.' });
  }
}

async function handleBillingCheckout(request, response) {
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  if (!requireAppSession(request, response)) return;

  const session = getAccountSession(request);
  if (session.role === 'owner') {
    sendJson(response, 400, { error: 'A conta proprietária não precisa de uma assinatura paga.' });
    return;
  }

  let reservationId = null;
  try {
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(response, 400, { error: 'Dados do plano inválidos.' });
      return;
    }
    const plan = billingPlans.find((candidate) => candidate.id === body.planId && candidate.priceCents > 0);
    if (!plan) {
      sendJson(response, 400, { error: 'Selecione um plano pago válido.' });
      return;
    }
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      sendJson(response, 503, { error: 'A cobrança ainda não está configurada. O administrador precisa adicionar as credenciais do Mercado Pago no servidor.' });
      return;
    }
    let appUrl;
    try {
      appUrl = safePublicAppUrl();
    } catch (error) {
      sendJson(response, 503, { error: error.message });
      return;
    }

    const existing = accountDatabase.prepare(`SELECT plan_id AS planId, status, init_point AS initPoint
      FROM app_subscriptions WHERE account_id = ? AND status IN ('creating', 'pending', 'authorized', 'paused')`)
      .get(session.userId);
    if (existing) {
      if (existing.status === 'pending' && existing.initPoint && existing.planId === plan.id) {
        sendJson(response, 200, { checkoutUrl: existing.initPoint, resumed: true });
        return;
      }
      sendJson(response, 409, {
        error: existing.status === 'authorized'
          ? 'Cancele sua assinatura atual antes de escolher outro plano.'
          : 'Já existe uma assinatura em andamento. Conclua ou cancele essa assinatura antes de iniciar outra.',
      });
      return;
    }

    const checkoutReference = `${session.userId}-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    const reservation = accountDatabase.prepare(`INSERT INTO app_subscriptions
      (account_id, plan_id, checkout_reference, status, created_at, updated_at)
      VALUES (?, ?, ?, 'creating', ?, ?)`).run(session.userId, plan.id, checkoutReference, timestamp, timestamp);
    reservationId = Number(reservation.lastInsertRowid);

    const providerSubscription = await mercadoPagoRequest('/preapproval', {
      method: 'POST',
      idempotencyKey: crypto.randomUUID(),
      body: {
        reason: `Dinvaro IA - Plano ${plan.name}`,
        external_reference: checkoutReference,
        payer_email: session.email,
        status: 'pending',
        back_url: `${appUrl}/?billing=return`,
        notification_url: `${appUrl}/webhooks/mercadopago`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.priceCents / 100,
          currency_id: 'BRL',
        },
      },
    });
    const checkoutUrl = typeof providerSubscription.init_point === 'string' ? new URL(providerSubscription.init_point) : null;
    const returnedAmount = Number(providerSubscription.auto_recurring?.transaction_amount);
    if (!providerSubscription.id || !/^[a-zA-Z0-9._-]{1,120}$/.test(String(providerSubscription.id))
      || providerSubscription.external_reference !== checkoutReference
      || providerSubscription.auto_recurring?.currency_id !== 'BRL'
      || !Number.isFinite(returnedAmount) || Math.round(returnedAmount * 100) !== plan.priceCents
      || !checkoutUrl || checkoutUrl.protocol !== 'https:'
      || !(checkoutUrl.hostname === 'mercadopago.com.br' || checkoutUrl.hostname.endsWith('.mercadopago.com.br'))) {
      throw new Error('O Mercado Pago não retornou um endereço de checkout válido.');
    }
    const status = normalizedSubscriptionStatus(providerSubscription.status);
    accountDatabase.prepare(`UPDATE app_subscriptions SET provider_subscription_id = ?, status = ?, init_point = ?,
      next_payment_at = ?, updated_at = ? WHERE id = ?`)
      .run(String(providerSubscription.id), status, checkoutUrl.toString(),
        providerSubscription.next_payment_date || null, new Date().toISOString(), reservationId);
    sendJson(response, 200, { checkoutUrl: checkoutUrl.toString(), resumed: false });
  } catch (error) {
    if (reservationId !== null) {
      accountDatabase.prepare("UPDATE app_subscriptions SET status = 'checkout_failed', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), reservationId);
    }
    console.error(`Falha ao criar checkout do Mercado Pago: ${error.message}`);
    sendJson(response, 502, { error: error.message || 'Não foi possível iniciar o pagamento.' });
  }
}

async function handleGiftCheckout(request, response) {
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  if (!requireAppSession(request, response)) return;
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    sendJson(response, 503, { error: 'A cobrança ainda não está configurada no servidor.' });
    return;
  }
  let appUrl;
  try {
    appUrl = safePublicAppUrl();
  } catch (error) {
    sendJson(response, 503, { error: error.message });
    return;
  }

  const session = getAccountSession(request);
  let purchaseId = null;
  try {
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(response, 400, { error: 'Dados do presente inválidos.' });
      return;
    }
    const plan = billingPlans.find((candidate) => ['pro', 'premium'].includes(candidate.id) && candidate.id === body.planId);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const recipientName = typeof body.name === 'string' ? body.name.normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
    if (!plan || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
      || recipientName.length < 2 || recipientName.length > 80
      || /[\u0000-\u001f\u007f]/.test(recipientName)) {
      sendJson(response, 400, { error: 'Informe o plano, o nome e um e-mail válido para o destinatário.' });
      return;
    }
    const recipient = accountDatabase.prepare(`SELECT id FROM app_accounts
      WHERE email = ? AND role = 'member'`).get(email);
    if (!recipient) {
      sendJson(response, 404, { error: 'O destinatário precisa ter uma conta cadastrada no Dinvaro IA com esse e-mail.' });
      return;
    }
    if (recipient.id === session.userId) {
      sendJson(response, 400, { error: 'Escolha o e-mail de outra conta para enviar um presente.' });
      return;
    }

    const checkoutReference = `gift-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    const reservation = accountDatabase.prepare(`INSERT INTO app_gift_purchases
      (checkout_reference, payer_account_id, recipient_account_id, recipient_name, plan_id, amount_cents, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'creating', ?, ?)`)
      .run(checkoutReference, session.userId, recipient.id, recipientName, plan.id, plan.priceCents, timestamp, timestamp);
    purchaseId = Number(reservation.lastInsertRowid);

    const preference = await mercadoPagoRequest('/checkout/preferences', {
      method: 'POST',
      idempotencyKey: crypto.randomUUID(),
      body: {
        items: [{
          id: `dinvaro-gift-${plan.id}`,
          title: `Presente Dinvaro IA - Plano ${plan.name} por 1 mês`,
          description: `Plano ${plan.name} por um mês para ${recipientName}. O destinatário ativa o acesso ao resgatar o presente.`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: plan.priceCents / 100,
        }],
        payer: { email: session.email },
        external_reference: checkoutReference,
        metadata: { gift_purchase_id: purchaseId, plan_id: plan.id },
        notification_url: `${appUrl}/webhooks/mercadopago`,
        back_urls: {
          success: `${appUrl}/?gift=return`,
          pending: `${appUrl}/?gift=return`,
          failure: `${appUrl}/?gift=return`,
        },
        auto_return: 'approved',
        statement_descriptor: 'DINVARO IA',
      },
    });
    const checkoutUrl = typeof preference.init_point === 'string' ? new URL(preference.init_point) : null;
    const validCheckoutHost = checkoutUrl
      && checkoutUrl.protocol === 'https:'
      && !checkoutUrl.username
      && !checkoutUrl.password
      && (checkoutUrl.hostname === 'mercadopago.com.br'
        || checkoutUrl.hostname.endsWith('.mercadopago.com.br')
        || checkoutUrl.hostname === 'mercadopago.com'
        || checkoutUrl.hostname.endsWith('.mercadopago.com'));
    if (!preference.id || !/^[a-zA-Z0-9._-]{1,120}$/.test(String(preference.id))
      || preference.external_reference !== checkoutReference || !validCheckoutHost) {
      throw new Error('O Mercado Pago não retornou um endereço de pagamento válido.');
    }
    accountDatabase.prepare(`UPDATE app_gift_purchases SET preference_id = ?, checkout_url = ?,
      status = 'pending', updated_at = ? WHERE id = ?`)
      .run(String(preference.id), checkoutUrl.toString(), new Date().toISOString(), purchaseId);
    sendJson(response, 200, { checkoutUrl: checkoutUrl.toString(), purchaseId });
  } catch (error) {
    if (purchaseId !== null) {
      accountDatabase.prepare(`UPDATE app_gift_purchases SET status = 'failed', updated_at = ?
        WHERE id = ? AND status = 'creating'`)
        .run(new Date().toISOString(), purchaseId);
    }
    if (error.message === 'JSON inválido') {
      sendJson(response, 400, { error: 'O conteúdo enviado não é válido.' });
      return;
    }
    if (error.message === 'Corpo da requisição muito grande') {
      sendJson(response, 413, { error: 'A solicitação é muito grande.' });
      return;
    }
    console.error(`Falha ao criar checkout do presente ${purchaseId || ''}: ${error.message}`);
    sendJson(response, 502, { error: error.message || 'Não foi possível iniciar o pagamento do presente.' });
  }
}

async function handleBillingCancellation(request, response) {
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  if (!requireAppSession(request, response)) return;
  const session = getAccountSession(request);
  if (session.role === 'owner') {
    sendJson(response, 400, { error: 'A conta proprietária não possui assinatura para cancelar.' });
    return;
  }
  const subscription = accountDatabase.prepare(`SELECT id, provider_subscription_id AS providerId
    FROM app_subscriptions WHERE account_id = ? AND status IN ('pending', 'authorized', 'paused') ORDER BY id DESC LIMIT 1`)
    .get(session.userId);
  if (!subscription?.providerId) {
    sendJson(response, 404, { error: 'Não há assinatura ativa ou pendente para cancelar.' });
    return;
  }
  try {
    const result = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(subscription.providerId)}`, {
      method: 'PUT',
      body: { status: 'cancelled' },
    });
    const status = normalizedSubscriptionStatus(result.status || 'cancelled');
    accountDatabase.prepare('UPDATE app_subscriptions SET status = ?, next_payment_at = ?, updated_at = ? WHERE id = ?')
      .run(status, result.next_payment_date || null, new Date().toISOString(), subscription.id);
    sendJson(response, 200, { status });
  } catch (error) {
    console.error(`Falha ao cancelar assinatura do Mercado Pago: ${error.message}`);
    sendJson(response, 502, { error: error.message || 'Não foi possível cancelar a assinatura.' });
  }
}

function saveMercadoPagoSubscription(providerSubscription, dataId) {
  if (String(providerSubscription.id || '') !== dataId || typeof providerSubscription.external_reference !== 'string') {
    return null;
  }
  const reservation = accountDatabase.prepare(`SELECT id, plan_id AS planId FROM app_subscriptions
    WHERE checkout_reference = ? OR provider_subscription_id = ? LIMIT 1`)
    .get(providerSubscription.external_reference, dataId);
  const plan = reservation && billingPlans.find((candidate) => candidate.id === reservation.planId);
  const amount = Number(providerSubscription.auto_recurring?.transaction_amount);
  if (!reservation || !plan || providerSubscription.auto_recurring?.currency_id !== 'BRL'
    || !Number.isFinite(amount) || Math.round(amount * 100) !== plan.priceCents) return null;

  const status = normalizedSubscriptionStatus(providerSubscription.status);
  accountDatabase.prepare(`UPDATE app_subscriptions SET provider_subscription_id = ?, status = ?,
    init_point = COALESCE(init_point, ?), next_payment_at = ?, updated_at = ? WHERE id = ?`)
    .run(dataId, status, providerSubscription.init_point || null,
      providerSubscription.next_payment_date || null, new Date().toISOString(), reservation.id);
  return { reservation, plan, status };
}

async function saveMercadoPagoGiftPayment(dataId) {
  const payment = await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(dataId)}`);
  if (String(payment.id || '') !== dataId || typeof payment.external_reference !== 'string'
    || !/^[a-zA-Z0-9._-]{1,120}$/.test(String(payment.preference_id || ''))) return null;
  const purchase = accountDatabase.prepare(`SELECT id, plan_id AS planId, amount_cents AS amountCents,
      preference_id AS preferenceId, status
    FROM app_gift_purchases WHERE checkout_reference = ?`).get(payment.external_reference);
  if (!purchase || purchase.preferenceId !== String(payment.preference_id)
    || (payment.metadata?.gift_purchase_id !== undefined
      && String(payment.metadata.gift_purchase_id) !== String(purchase.id))
    || (payment.metadata?.plan_id !== undefined && payment.metadata.plan_id !== purchase.planId)
    || payment.currency_id !== 'BRL'
    || !Number.isFinite(Number(payment.transaction_amount))
    || Math.round(Number(payment.transaction_amount) * 100) !== purchase.amountCents) return null;

  const paymentStatus = String(payment.status || '').toLowerCase();
  const statusByPayment = {
    approved: 'approved',
    rejected: 'rejected',
    cancelled: 'cancelled',
    refunded: 'refunded',
    charged_back: 'charged_back',
    pending: 'pending',
    in_process: 'pending',
    in_mediation: 'pending',
  };
  const status = statusByPayment[paymentStatus];
  if (!status) return null;
  const paymentDate = new Date(payment.date_approved || payment.date_last_updated || payment.date_created || Date.now());
  const now = new Date().toISOString();
  const paidAt = status === 'approved' && !Number.isNaN(paymentDate.getTime()) ? paymentDate.toISOString() : null;
  accountDatabase.prepare(`UPDATE app_gift_purchases SET payment_id = ?, status = ?,
      paid_at = CASE WHEN ? = 'approved' THEN COALESCE(paid_at, ?) ELSE paid_at END,
      updated_at = ?
    WHERE id = ?`)
    .run(dataId, status, status, paidAt, now, purchase.id);
  return { purchaseId: purchase.id, status };
}

async function handleMercadoPagoWebhook(request, response, requestUrl) {
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.MERCADOPAGO_ACCESS_TOKEN) {
    sendJson(response, 503, { error: 'Webhook do Mercado Pago ainda não está configurado.' });
    return;
  }
  const dataId = requestUrl.searchParams.get('data.id');
  if (!validMercadoPagoSignature(request.headers['x-signature'], request.headers['x-request-id'], dataId, webhookSecret)) {
    sendJson(response, 401, { error: 'Assinatura do webhook do Mercado Pago inválida.' });
    return;
  }
  let payload;
  try {
    payload = await readJson(request);
  } catch {
    sendJson(response, 400, { error: 'JSON inválido.' });
    return;
  }
  const notificationType = payload?.type || payload?.topic;
  if (!['subscription_preapproval', 'subscription_authorized_payment', 'payment'].includes(notificationType)) {
    sendJson(response, 200, { received: true, ignored: true });
    return;
  }
  try {
    if (notificationType === 'payment') {
      const saved = await saveMercadoPagoGiftPayment(dataId);
      if (!saved) {
        console.error('Pagamento do Mercado Pago não corresponde a um presente reservado, valor ou checkout.');
        sendJson(response, 422, { error: 'Pagamento retornado pelo Mercado Pago inválido para presente.' });
        return;
      }
      sendJson(response, 200, { received: true, status: saved.status });
      return;
    }

    if (notificationType === 'subscription_preapproval') {
      const providerSubscription = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(dataId)}`);
      const saved = saveMercadoPagoSubscription(providerSubscription, dataId);
      if (!saved) {
        console.error('Webhook do Mercado Pago não corresponde a uma assinatura e valor reservados localmente.');
        sendJson(response, 422, { error: 'Assinatura retornada pelo Mercado Pago inválida.' });
        return;
      }
      sendJson(response, 200, { received: true, status: saved.status });
      return;
    }

    const payment = await mercadoPagoRequest(`/authorized_payments/${encodeURIComponent(dataId)}`);
    const preapprovalId = String(payment.preapproval_id || '');
    if (String(payment.id || '') !== dataId || !/^[a-zA-Z0-9._-]{1,120}$/.test(preapprovalId)) {
      sendJson(response, 422, { error: 'Pagamento de assinatura retornado pelo Mercado Pago inválido.' });
      return;
    }
    const providerSubscription = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(preapprovalId)}`);
    const saved = saveMercadoPagoSubscription(providerSubscription, preapprovalId);
    if (!saved) {
      console.error('Pagamento de assinatura do Mercado Pago sem uma assinatura local correspondente.');
      sendJson(response, 500, { error: 'Não foi possível associar o pagamento à assinatura.' });
      return;
    }
    const paymentStatus = String(payment.status || '').toLowerCase();
    const paymentAmount = Number(payment.transaction_amount);
    if (payment.currency_id !== 'BRL' || !Number.isFinite(paymentAmount)
      || Math.round(paymentAmount * 100) !== saved.plan.priceCents) {
      sendJson(response, 422, { error: 'Valor do pagamento de assinatura incompatível com o plano.' });
      return;
    }
    if (['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'].includes(paymentStatus)) {
      const paymentDate = new Date(payment.date_last_updated || payment.date_created || Date.now());
      const paymentAt = Number.isNaN(paymentDate.getTime()) ? new Date().toISOString() : paymentDate.toISOString();
      accountDatabase.prepare(`UPDATE app_subscriptions SET last_payment_status = ?, last_payment_at = ?,
        updated_at = ? WHERE id = ? AND (last_payment_at IS NULL OR last_payment_at <= ?)`)
        .run(paymentStatus, paymentAt, new Date().toISOString(), saved.reservation.id, paymentAt);
    }
    sendJson(response, 200, { received: true, status: saved.status, paymentStatus });
  } catch (error) {
    console.error(`Falha ao confirmar webhook do Mercado Pago: ${error.message}`);
    sendJson(response, 502, { error: 'Não foi possível confirmar a assinatura no Mercado Pago.' });
  }
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

function safeStringEqual(first, second) {
  if (typeof first !== 'string' || typeof second !== 'string') return false;
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function platformSaleStatus(eventName, status) {
  const normalizedEvent = String(eventName || '').toLowerCase();
  const normalizedStatus = String(status || '').toLowerCase();
  if (['order_refunded', 'refund', 'refunded'].includes(normalizedEvent) || ['refunded', 'refund'].includes(normalizedStatus)) return 'refunded';
  if (['chargeback', 'order_chargeback', 'chargedback'].includes(normalizedEvent) || ['chargeback', 'chargedback'].includes(normalizedStatus)) return 'chargedback';
  if (['order_approved', 'purchase_approved', 'paid', 'approved'].includes(normalizedEvent) || ['paid', 'approved'].includes(normalizedStatus)) return 'paid';
  return null;
}

function persistPlatformSales(sales) {
  const insertEvent = accountDatabase.prepare('INSERT OR IGNORE INTO platform_sale_events (provider, event_key, received_at) VALUES (?, ?, ?)');
  const insertSaleNotification = accountDatabase.prepare(`INSERT OR IGNORE INTO app_sale_notifications
    (owner_account_id, provider, sale_id, product_name, amount_cents, currency, occurred_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const upsertSale = accountDatabase.prepare(`INSERT INTO platform_sales
    (provider, sale_id, status, amount_cents, currency, product_name, occurred_at, event_at_ms, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider, sale_id) DO UPDATE SET
      status = excluded.status,
      amount_cents = excluded.amount_cents,
      currency = excluded.currency,
      product_name = excluded.product_name,
      occurred_at = excluded.occurred_at,
      event_at_ms = excluded.event_at_ms,
      recorded_at = excluded.recorded_at
    WHERE excluded.event_at_ms >= platform_sales.event_at_ms`);
  const now = new Date().toISOString();
  accountDatabase.exec('BEGIN IMMEDIATE');
  try {
    for (const sale of sales) {
      if (!sale.saleId || !sale.eventKey || !sale.status || !Number.isSafeInteger(sale.amountCents) || sale.amountCents <= 0) continue;
      const eventResult = insertEvent.run(sale.provider, sale.eventKey, now);
      if (eventResult.changes === 0) continue;
      const savedSale = upsertSale.run(
        sale.provider,
        sale.saleId,
        sale.status,
        sale.amountCents,
        sale.currency,
        sale.productName,
        sale.occurredAt,
        sale.eventAtMs,
        now,
      );
      if (sale.status === 'paid' && savedSale.changes > 0) {
        const owner = accountDatabase.prepare("SELECT id FROM app_accounts WHERE role = 'owner' LIMIT 1").get();
        if (owner) {
          insertSaleNotification.run(
            owner.id,
            sale.provider,
            sale.saleId,
            sale.productName,
            sale.amountCents,
            sale.currency,
            sale.occurredAt,
            now,
          );
        }
      }
    }
    accountDatabase.exec('COMMIT');
  } catch (error) {
    accountDatabase.exec('ROLLBACK');
    throw error;
  }
}

async function getKiwifySale(orderId) {
  const config = financeProviderConfig('kiwify');
  if (!config) throw new Error('Configure as credenciais de vendas da Kiwify no .env.');
  const token = await providerToken('kiwify');
  const response = await fetch(`https://public-api.kiwify.com/v1/sales/${encodeURIComponent(orderId)}`, {
    headers: { authorization: `Bearer ${token}`, 'x-kiwify-account-id': config.accountId },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Consulta da venda Kiwify falhou (${response.status}).`);
  return response.json();
}

async function handleKiwifyWebhook(request, response, requestUrl) {
  const webhookToken = process.env.KIWIFY_WEBHOOK_TOKEN;
  if (!webhookToken) {
    sendJson(response, 503, { error: 'Webhook Kiwify não configurado no servidor.' });
    return;
  }
  const rawBody = await readRawBody(request);
  const providedSignature = requestUrl.searchParams.get('signature') || '';
  const expectedSignature = crypto.createHmac('sha1', webhookToken).update(rawBody).digest('hex');
  if (!/^[a-f\d]{40}$/i.test(providedSignature) || !safeStringEqual(providedSignature.toLowerCase(), expectedSignature)) {
    sendJson(response, 401, { error: 'Assinatura Kiwify inválida.' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    sendJson(response, 400, { error: 'JSON inválido.' });
    return;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    sendJson(response, 400, { error: 'Formato de webhook inválido.' });
    return;
  }
  const eventName = String(payload.webhook_event_type || payload.event || '').toLowerCase();
  const status = platformSaleStatus(eventName, payload.order_status);
  const orderId = String(payload.order_id || payload.data?.order_id || payload.data?.id || '');
  if (!status) {
    sendJson(response, 200, { received: true, ignored: true });
    return;
  }
  if (!orderId) {
    sendJson(response, 400, { error: 'Evento Kiwify sem order_id.' });
    return;
  }

  const sale = await getKiwifySale(orderId);
  const amountCents = Number.isSafeInteger(sale.payment?.charge_amount)
    ? sale.payment.charge_amount
    : Number.isSafeInteger(sale.net_amount) ? sale.net_amount : null;
  const currency = String(sale.payment?.charge_currency || sale.currency || '').toUpperCase();
  if (!amountCents || !/^[A-Z]{3}$/.test(currency)) throw new Error('A Kiwify retornou valor ou moeda inválidos para a venda.');
  const isReversal = status !== 'paid';
  const occurredAt = String(sale.refunded_at || (isReversal ? sale.updated_at : null) || (isReversal ? new Date().toISOString() : sale.approved_date || sale.created_at) || new Date().toISOString());
  const parsedDate = Date.parse(occurredAt);
  persistPlatformSales([{
    provider: 'kiwify',
    saleId: orderId,
    eventKey: `${orderId}:${eventName}`,
    status: platformSaleStatus(eventName, sale.status) || status,
    amountCents,
    currency,
    productName: String(sale.product?.name || 'Produto Kiwify').slice(0, 200),
    occurredAt: Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : new Date().toISOString(),
    eventAtMs: Number.isFinite(parsedDate) ? parsedDate : Date.now(),
  }]);
  sendJson(response, 200, { received: true });
}

function normalizeCaktoSale(item, eventName) {
  const saleId = String(item.id || item.order_id || '');
  const status = platformSaleStatus(eventName, item.status);
  const amountCents = decimalToCents(item.amount);
  const currency = String(item.currency || '').toUpperCase();
  if (!saleId || !status || amountCents === null || amountCents <= 0 || !/^[A-Z]{3}$/.test(currency)) return null;
  const dateValue = status === 'refunded'
    ? item.refundedAt || item.refunded_at || item.updatedAt || item.updated_at || new Date().toISOString()
    : status === 'chargedback'
      ? item.chargedbackAt || item.chargedback_at || item.updatedAt || item.updated_at || new Date().toISOString()
      : item.paidAt || item.paid_at || item.createdAt || item.created_at;
  const parsedDate = Date.parse(dateValue || '');
  return {
    provider: 'cakto',
    saleId,
    eventKey: `${saleId}:${eventName}`,
    status,
    amountCents,
    currency,
    productName: String(item.product?.name || item.product_name || 'Produto Cakto').slice(0, 200),
    occurredAt: Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : new Date().toISOString(),
    eventAtMs: Number.isFinite(parsedDate) ? parsedDate : Date.now(),
  };
}

async function handleCaktoWebhook(request, response) {
  const webhookSecret = process.env.CAKTO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    sendJson(response, 503, { error: 'Webhook Cakto não configurado no servidor.' });
    return;
  }
  const rawBody = await readRawBody(request);
  const timestamp = request.headers['x-cakto-timestamp'];
  const signature = request.headers['x-cakto-signature'] || '';
  const timestampMs = Number(timestamp) * 1000;
  if (typeof timestamp !== 'string' || !/^\d+$/.test(timestamp) || !Number.isFinite(timestampMs)
      || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    sendJson(response, 401, { error: 'Timestamp Cakto inválido ou expirado.' });
    return;
  }
  const expectedSignature = `v1=${crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.`).update(rawBody).digest('hex')}`;
  if (!safeStringEqual(signature, expectedSignature)) {
    sendJson(response, 401, { error: 'Assinatura Cakto inválida.' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    sendJson(response, 400, { error: 'JSON inválido.' });
    return;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    sendJson(response, 400, { error: 'Formato de webhook inválido.' });
    return;
  }
  if (!safeStringEqual(String(payload.secret || ''), webhookSecret)) {
    sendJson(response, 401, { error: 'Segredo Cakto inválido.' });
    return;
  }

  const eventName = String(payload.event || '').toLowerCase();
  if (!platformSaleStatus(eventName)) {
    sendJson(response, 200, { received: true, ignored: true });
    return;
  }
  const items = Array.isArray(payload.data) ? payload.data : [payload.data];
  const sales = items.map((item) => item && typeof item === 'object' && !Array.isArray(item)
    ? normalizeCaktoSale(item, eventName)
    : null);
  if (!sales.length || sales.some((sale) => !sale)) {
    sendJson(response, 422, { error: 'Dados da venda Cakto incompletos ou inválidos.' });
    return;
  }
  persistPlatformSales(sales);
  sendJson(response, 200, { received: true, sales: sales.length });
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
    const session = getAccountSession(request);
    sendJson(response, 200, {
      authenticated: Boolean(session),
      configured: ownerAccountExists(),
      account: session ? { id: session.userId, email: session.email, role: session.role } : null,
    });
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Método não permitido.' });
    return;
  }

  if (isLoginRateLimited(request)) {
    sendJson(response, 429, { error: 'Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.' });
    return;
  }

  try {
    const body = await readJson(request);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const account = accountDatabase.prepare('SELECT id, email, password_salt, password_hash, role FROM app_accounts WHERE email = ?').get(email);
    const passwordHash = account && password ? hashPassword(password, account.password_salt) : '';
    if (!account || !safeSecretEqual(passwordHash, account.password_hash)) {
      sendJson(response, 401, { error: 'E-mail ou senha incorretos.' });
      return;
    }
    createAccountSession(request, response, account);
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ id: account.id, email: account.email, role: account.role }));
  } catch {
    sendJson(response, 400, { error: 'Não foi possível validar o acesso.' });
  }
}

async function handleAccountRegistration(request, response) {
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Método não permitido.' });
    return;
  }
  if (isRegistrationRateLimited(request)) {
    sendJson(response, 429, { error: 'Muitas tentativas de cadastro. Aguarde 15 minutos e tente novamente.' });
    return;
  }
  let transactionOpen = false;
  try {
    const body = await readJson(request);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const passwordConfirm = typeof body.passwordConfirm === 'string' ? body.passwordConfirm : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      sendJson(response, 400, { error: 'Informe um endereço de e-mail válido.' });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      sendJson(response, 400, { error: 'Use uma senha com pelo menos 6 caracteres.' });
      return;
    }
    if (password !== passwordConfirm) {
      sendJson(response, 400, { error: 'As senhas não conferem.' });
      return;
    }

    accountDatabase.exec('BEGIN IMMEDIATE');
    transactionOpen = true;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const role = ownerAccountExists() ? 'member' : 'owner';
    const result = accountDatabase.prepare('INSERT INTO app_accounts (email, password_salt, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(email, salt, passwordHash, role, new Date().toISOString());
    const accountId = Number(result.lastInsertRowid);
    ensureAccountProfile.run(accountId, `Usuário ${accountId}`, `usuario-${accountId}`, new Date().toISOString());
    accountDatabase.exec('COMMIT');
    transactionOpen = false;

    const account = { id: accountId, email, role };
    createAccountSession(request, response, account);
    response.writeHead(201, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(account));
  } catch (error) {
    if (transactionOpen) accountDatabase.exec('ROLLBACK');
    if (String(error.message).includes('UNIQUE constraint failed')) {
      sendJson(response, 409, { error: 'Já existe uma conta com este e-mail.' });
      return;
    }
    sendJson(response, 400, { error: 'Não foi possível criar a conta.' });
  }
}

function normalizeProfileName(value) {
  if (typeof value !== 'string') return null;
  const displayName = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (displayName.length < 2 || displayName.length > 32
    || !/^[\p{L}\p{N}][\p{L}\p{N} ._'’-]{1,31}$/u.test(displayName)) return null;
  return { displayName, usernameKey: displayName.normalize('NFKC').toLocaleLowerCase('pt-BR') };
}

function decodeProfileAvatar(value) {
  if (value === null) return { mime: null, data: null };
  if (typeof value !== 'string' || value.length > 700_000) return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const data = Buffer.from(match[2], 'base64');
  if (data.length === 0 || data.length > 512 * 1024 || data.toString('base64') !== match[2]) return null;
  const mime = match[1];
  const validSignature = mime === 'image/png'
    ? data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === 'image/jpeg'
      ? data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
      : data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
  return validSignature ? { mime, data } : null;
}

async function handleAppProfile(request, response) {
  if (!requestHasValidOrigin(request)) {
    sendJson(response, 403, { error: 'Origem da solicitação não autorizada.' });
    return;
  }
  const session = getAccountSession(request);
  if (!session) {
    sendJson(response, 401, { error: 'Faça login no Dinvaro IA novamente.' });
    return;
  }
  if (request.method === 'GET') {
    const profileData = accountDatabase.prepare('SELECT display_name, avatar_mime, avatar_data FROM app_profiles WHERE account_id = ?')
      .get(session.userId);
    if (!profileData) {
      sendJson(response, 500, { error: 'Não foi possível carregar o perfil.' });
      return;
    }
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
    });
    response.end(JSON.stringify({
      name: profileData.display_name,
      avatar: profileData.avatar_data
        ? `data:${profileData.avatar_mime};base64,${Buffer.from(profileData.avatar_data).toString('base64')}`
        : null,
    }));
    return;
  }
  if (request.method !== 'PUT') {
    sendJson(response, 405, { error: 'Método não permitido.' });
    return;
  }

  try {
    const body = await readJson(request, 720_000);
    const normalizedName = normalizeProfileName(body.name);
    if (!normalizedName) {
      sendJson(response, 400, { error: 'Use um nome de 2 a 32 caracteres, começando por letra ou número.' });
      return;
    }
    const avatar = Object.hasOwn(body, 'avatar') ? decodeProfileAvatar(body.avatar) : undefined;
    if (avatar === null) {
      sendJson(response, 400, { error: 'A foto deve ser JPEG, PNG ou WebP e ter até 512 KB.' });
      return;
    }

    if (avatar === undefined) {
      accountDatabase.prepare('UPDATE app_profiles SET display_name = ?, username_key = ?, updated_at = ? WHERE account_id = ?')
        .run(normalizedName.displayName, normalizedName.usernameKey, new Date().toISOString(), session.userId);
    } else {
      accountDatabase.prepare(`UPDATE app_profiles
        SET display_name = ?, username_key = ?, avatar_mime = ?, avatar_data = ?, updated_at = ?
        WHERE account_id = ?`)
        .run(normalizedName.displayName, normalizedName.usernameKey, avatar.mime, avatar.data, new Date().toISOString(), session.userId);
    }
    const savedProfile = accountDatabase.prepare('SELECT avatar_mime, avatar_data FROM app_profiles WHERE account_id = ?').get(session.userId);
    sendJson(response, 200, {
      name: normalizedName.displayName,
      avatar: savedProfile.avatar_data
        ? `data:${savedProfile.avatar_mime};base64,${Buffer.from(savedProfile.avatar_data).toString('base64')}`
        : null,
    });
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed: app_profiles.username_key')) {
      sendJson(response, 409, { error: 'Esse nome já está em uso. Escolha outro.' });
      return;
    }
    if (String(error.message).includes('Corpo da requisição muito grande')) {
      sendJson(response, 413, { error: 'A imagem é muito grande. Escolha uma foto menor.' });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: 'O conteúdo enviado não é válido.' });
      return;
    }
    console.error(`Falha ao salvar perfil da conta ${session.userId}: ${error.message}`);
    sendJson(response, 500, { error: 'Não foi possível salvar o perfil agora.' });
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

function handleFinanceSales(request, response) {
  if (!requireFinanceSession(request, response)) return;
  const sales = accountDatabase.prepare(`SELECT provider, sale_id AS saleId, status, amount_cents AS amountCents,
      currency, product_name AS productName, occurred_at AS occurredAt
    FROM platform_sales ORDER BY occurred_at DESC, provider ASC`)
    .all();
  sendJson(response, 200, { sales });
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
    if (body.pixConfirmed !== true) {
      sendJson(response, 400, { error: 'Confirme que a chave Pix está cadastrada na conta da plataforma.' });
      return;
    }
    if (body.payoutMethod !== 'pix') {
      sendJson(response, 400, { error: 'Selecione Pix como forma de recebimento.' });
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
            content: 'Você é Dinvaro IA, uma estrategista de marketing para produtos digitais, em português do Brasil. Ajude com posicionamento, ofertas e conteúdo claro e útil. Nunca invente características do produto, depoimentos, resultados, garantias, descontos ou escassez. Prefira alegações verificáveis, respeite consentimento e descadastro em e-mails e não afirme que publicou ou vendeu algo. Quando faltarem informações, pergunte.',
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
            content: 'Você é Dinvaro IA, uma estrategista sênior de marketing para produtos digitais no Brasil. Crie materiais práticos em português brasileiro, estruturados com títulos e prontos para revisão humana. Use apenas fatos informados. Nunca invente depoimentos, números, garantias, credenciais, descontos ou urgência. Se o briefing não sustentar uma alegação, omita-a. Respeite as regras do canal; para e-mails, inclua assunto, conteúdo útil e orientação de descadastro para uma lista com consentimento. Não publique, envie mensagens ou alegue resultados: entregue apenas um rascunho.',
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

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function handleLocalAiRequest(request, response, createResult, options = {}) {
  try {
    const body = await readJson(request);
    const session = getAccountSession(request);
    if (!session) {
      sendJson(response, 401, { error: 'Faça login no Dinvaro IA novamente.' });
      return;
    }
    let plan = null;
    if (session.role !== 'owner') {
      plan = getAccountPlan(session.userId);
    }
    if (options.campaignCreation && plan) {
      const campaignCount = getMonthlyCampaignCount(session.userId);
      if (plan.monthlyCampaigns !== null && campaignCount >= plan.monthlyCampaigns) {
        sendJson(response, 429, {
          error: `Você atingiu o limite de ${plan.monthlyCampaigns} campanhas deste mês no plano ${plan.name}.`,
          code: 'PLAN_CAMPAIGN_LIMIT',
          campaignsThisMonth: campaignCount,
          limit: plan.monthlyCampaigns,
        });
        return;
      }
    }
    const result = createResult(body);
    if (options.campaignCreation && session.role !== 'owner') {
      recordMonthlyCampaign(session.userId);
    }
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: error.statusCode ? error.message : 'Não foi possível processar a solicitação.' });
  }
}

function handleLocalChat(request, response) {
  return handleLocalAiRequest(request, response, (body) => {
    const messages = Array.isArray(body.messages)
      ? body.messages.filter((message) => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string').slice(-12)
      : [];
    if (!messages.length || messages[messages.length - 1].role !== 'user') throw badRequest('Envie uma mensagem para começar.');
    const product = body.product && typeof body.product === 'object' ? body.product : {};
    return { answer: localAi.makeChatAnswer(messages, product) };
  });
}

function handleLocalCampaign(request, response) {
  return handleLocalAiRequest(request, response, (body) => {
    const product = body.product && typeof body.product === 'object' ? body.product : {};
    const campaign = body.campaign && typeof body.campaign === 'object' ? body.campaign : {};
    if (['name', 'description', 'audience', 'benefit'].some((field) => typeof product[field] !== 'string' || !product[field].trim())) {
      throw badRequest('Preencha nome, descrição, público e benefício do produto.');
    }
    if (typeof campaign.name !== 'string' || !campaign.name.trim()) throw badRequest('Dê um nome para esta campanha.');
    return { content: localAi.makeCampaign(product, campaign) };
  }, { campaignCreation: true });
}

function handleLocalProduct(request, response) {
  return handleLocalAiRequest(request, response, (body) => {
    const idea = typeof body.idea === 'string' ? body.idea.trim().slice(0, 700) : '';
    const audience = typeof body.audience === 'string' ? body.audience.trim().slice(0, 250) : '';
    if (idea.length < 12) throw badRequest('Descreva a ideia com um pouco mais de detalhe.');
    try {
      return { product: localAi.makeProduct({ idea, audience, format: body.format }) };
    } catch (error) {
      throw badRequest(error.message);
    }
  });
}

function handleLocalAffiliateSuggestions(request, response) {
  return handleLocalAiRequest(request, response, (body) => {
    const niche = typeof body.niche === 'string' ? body.niche.trim().slice(0, 300) : '';
    if (niche.length < 3) throw badRequest('Informe um nicho ou tema com pelo menos 3 caracteres.');
    return localAi.makeAffiliateSuggestions({
      niche,
      audience: body.audience,
      platform: body.platform,
      context: body.context,
    });
  });
}

function handleLocalAffiliatePromotion(request, response) {
  return handleLocalAiRequest(request, response, (body) => {
    const product = body.product && typeof body.product === 'object' ? body.product : {};
    const durationDays = Number.parseInt(String(body.duration || '').match(/\d+/)?.[0] || '', 10);
    const channelOptions = new Set(['Instagram e TikTok', 'Instagram e Facebook', 'TikTok e YouTube Shorts', 'Instagram, TikTok e e-mail']);
    const frequencyOptions = new Set(['3 publicações por semana', '5 publicações por semana', '1 publicação por dia']);
    const name = typeof product.name === 'string' ? product.name.trim().slice(0, 120) : '';
    const platform = typeof product.platform === 'string' ? product.platform.trim().slice(0, 80) : '';
    const link = typeof product.link === 'string' ? product.link.trim().slice(0, 1_000) : '';
    if (!name || !platform || !link || ![7, 14, 30].includes(durationDays) || !channelOptions.has(body.channels) || !frequencyOptions.has(body.frequency)) {
      throw badRequest('Produto, link, duração, canais ou frequência inválidos.');
    }
    let parsedLink;
    try {
      parsedLink = new URL(link);
    } catch {
      throw badRequest('O link de afiliado não é válido.');
    }
    if (parsedLink.protocol !== 'https:') throw badRequest('O link de afiliado precisa usar HTTPS.');
    const safeProduct = {
      ...product,
      commission: Number.isFinite(product.commission) ? Math.min(100, Math.max(0, product.commission)) : null,
    };
    return localAi.makeAffiliatePromotion({ ...body, product: safeProduct, duration: `${durationDays} dias` });
  });
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/webhooks/kiwify' && request.method === 'POST') {
    handleKiwifyWebhook(request, response, requestUrl).catch((error) => {
      console.error(`Falha ao processar webhook Kiwify: ${error.message}`);
      if (!response.headersSent) sendJson(response, 500, { error: 'Não foi possível registrar a venda Kiwify.' });
    });
    return;
  }

  if (requestUrl.pathname === '/webhooks/cakto' && request.method === 'POST') {
    handleCaktoWebhook(request, response).catch((error) => {
      console.error(`Falha ao processar webhook Cakto: ${error.message}`);
      if (!response.headersSent) sendJson(response, 500, { error: 'Não foi possível registrar a venda Cakto.' });
    });
    return;
  }

  if (requestUrl.pathname === '/webhooks/mercadopago' && request.method === 'POST') {
    handleMercadoPagoWebhook(request, response, requestUrl);
    return;
  }

  if (requestUrl.pathname === '/api/billing/plans' && request.method === 'GET') {
    handleBillingPlans(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/billing/status' && request.method === 'GET') {
    handleBillingStatus(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/notifications/sales') {
    handleSalesNotifications(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/gifts') {
    handleGifts(request, response);
    return;
  }

  const giftClaimMatch = requestUrl.pathname.match(/^\/api\/gifts\/(\d{1,15})\/claim$/);
  if (giftClaimMatch && request.method === 'POST') {
    const giftId = Number(giftClaimMatch[1]);
    if (!Number.isSafeInteger(giftId) || giftId < 1) {
      sendJson(response, 400, { error: 'Identificador de presente inválido.' });
      return;
    }
    handleGiftClaim(request, response, giftId);
    return;
  }

  const paidGiftClaimMatch = requestUrl.pathname.match(/^\/api\/gifts\/purchases\/(\d{1,15})\/claim$/);
  if (paidGiftClaimMatch && request.method === 'POST') {
    const giftId = Number(paidGiftClaimMatch[1]);
    if (!Number.isSafeInteger(giftId) || giftId < 1) {
      sendJson(response, 400, { error: 'Identificador de presente inválido.' });
      return;
    }
    handlePaidGiftClaim(request, response, giftId);
    return;
  }

  if (requestUrl.pathname === '/api/billing/redeem-coupon' && request.method === 'POST') {
    handleCouponRedemption(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/admin/coupons') {
    handleAdminCoupons(request, response);
    return;
  }

  const adminCouponMatch = requestUrl.pathname.match(/^\/api\/admin\/coupons\/(\d{1,15})$/);
  if (adminCouponMatch) {
    const couponId = Number(adminCouponMatch[1]);
    if (!Number.isSafeInteger(couponId) || couponId < 1) {
      sendJson(response, 400, { error: 'Identificador de cupom inválido.' });
      return;
    }
    handleAdminCouponUpdate(request, response, couponId);
    return;
  }

  if (requestUrl.pathname === '/api/billing/checkout' && request.method === 'POST') {
    handleBillingCheckout(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/billing/gift-checkout' && request.method === 'POST') {
    handleGiftCheckout(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/billing/cancel' && request.method === 'POST') {
    handleBillingCancellation(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/chat' && request.method === 'POST') {
    if (!requireMinimumPlan(request, response, 'premium')) return;
    handleLocalChat(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/generate' && request.method === 'POST') {
    if (!requireAppSession(request, response)) return;
    handleLocalCampaign(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/product/generate' && request.method === 'POST') {
    if (!requireMinimumPlan(request, response, 'pro')) return;
    handleLocalProduct(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/affiliates/suggest' && request.method === 'POST') {
    if (!requireMinimumPlan(request, response, 'pro')) return;
    handleLocalAffiliateSuggestions(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/affiliates/promotion' && request.method === 'POST') {
    if (!requireMinimumPlan(request, response, 'premium')) return;
    handleLocalAffiliatePromotion(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/finance/session') {
    handleFinanceSession(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/register') {
    handleAccountRegistration(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/profile') {
    handleAppProfile(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/finance/providers' && request.method === 'GET') {
    if (!requireFinanceSession(request, response)) return;
    sendJson(response, 200, { providers: financeProviders() });
    return;
  }

  if (requestUrl.pathname === '/api/finance/sales' && request.method === 'GET') {
    handleFinanceSales(request, response);
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
    sendJson(response, 200, { ready: true, provider: 'Dinvaro IA local' });
    return;
  }

  const fileName = requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname.slice(1);
  if (!['index.html', 'styles.css', 'app.js', 'marketing.js', 'banner.png', 'billing-banner.png', 'logo.png', 'earnings-banner.png', 'campaigns-banner.png', 'product-banner.png', 'create-campaign-banner.png', 'promotion-banner.png', 'integrations-banner.png'].includes(fileName) || request.method !== 'GET') {
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
    response.writeHead(200, {
      'content-type': contentTypes[path.extname(filePath)],
      'cache-control': 'no-store',
    });
    response.end(contents);
  });
});

server.listen(port, () => {
  console.log(`Dinvaro IA disponível em http://localhost:${port}`);
  console.log('Motor de marketing local ativo; nenhuma API de IA externa é usada.');
});