const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('#message-input');
const messagesElement = document.querySelector('#messages');
const chatScroll = document.querySelector('#chat-scroll');
const sendButton = document.querySelector('#send-button');
const welcome = document.querySelector('#welcome');
const appContent = document.querySelector('#app-content');
const loginScreen = document.querySelector('#login-screen');
const appLoginForm = document.querySelector('#app-login-form');
const appLoginEmail = document.querySelector('#app-email');
const appLoginPassword = document.querySelector('#app-password');
const appLoginPasswordConfirm = document.querySelector('#app-password-confirm');
const loginModeToggle = document.querySelector('#login-mode-toggle');
const history = [];
const productForm = document.querySelector('#product-form');
const campaignForm = document.querySelector('#campaign-form');
const productGenerationForm = document.querySelector('#product-generation-form');
const affiliateSuggestionForm = document.querySelector('#affiliate-suggestion-form');
const campaignsKey = 'cash-campaigns-v1';
const productKey = 'cash-product-v1';
const generatedProductKey = 'cash-generated-product-v1';
const affiliateIdeasKey = 'cash-affiliate-ideas-v1';
const affiliateProductsKey = 'cash-affiliate-products-v1';
const promotionPlansKey = 'cash-promotion-plans-v1';
const adBudgetsKey = 'cash-ad-budgets-v1';
const moneyEntriesKey = 'cash-money-entries-v1';
const integrationDialog = document.querySelector('#integration-dialog');
const moneyEntryDialog = document.querySelector('#money-entry-dialog');
const moneyEntryForm = document.querySelector('#money-entry-form');
const withdrawalDialog = document.querySelector('#withdrawal-dialog');
const secureWithdrawalDialog = document.querySelector('#secure-withdrawal-dialog');
const secureWithdrawalForm = document.querySelector('#secure-withdrawal-form');
const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const integrations = [
  {
    id: 'instagram', name: 'Instagram', group: 'social', mode: 'OAuth · conta profissional',
    description: 'Prepare publicação e leitura de métricas para contas profissionais do Instagram.',
    requirements: ['Conta profissional vinculada a uma Página do Facebook', 'Aplicativo Meta com permissões aprovadas para Instagram', 'OAuth e tokens protegidos no servidor'],
    url: 'https://developers.facebook.com/docs/instagram-platform/',
  },
  {
    id: 'tiktok', name: 'TikTok', group: 'social', mode: 'OAuth · app aprovado',
    description: 'Conecte uma conta autorizada para fluxos de conteúdo compatíveis com as permissões aprovadas.',
    requirements: ['Aplicativo cadastrado no TikTok for Developers', 'Escopos de publicação aprovados pela plataforma', 'OAuth, revisão do app e tokens armazenados no servidor'],
    url: 'https://developers.tiktok.com/',
  },
  {
    id: 'facebook', name: 'Facebook Pages', group: 'social', mode: 'OAuth · Página',
    description: 'Conecte uma Página para preparar publicações e campanhas no ecossistema Meta.',
    requirements: ['Página do Facebook com acesso administrativo', 'Aplicativo Meta e permissões de publicação aprovadas', 'OAuth e tokens protegidos no servidor'],
    url: 'https://developers.facebook.com/docs/pages-api/',
  },
  {
    id: 'youtube', name: 'YouTube', group: 'social', mode: 'OAuth · canal',
    description: 'Associe um canal para planejar conteúdo e habilitar recursos da API do YouTube.',
    requirements: ['Projeto no Google Cloud com YouTube Data API', 'Tela de consentimento OAuth configurada', 'Canal autorizado e credenciais protegidas no servidor'],
    url: 'https://developers.google.com/youtube/v3',
  },
  {
    id: 'kiwify', name: 'Kiwify', group: 'sales', mode: 'Webhook · eventos de venda',
    description: 'Receba eventos do checkout para acompanhar pedidos e atribuição de campanhas.',
    requirements: ['Conta de vendedor e acesso às configurações de integração', 'Endpoint HTTPS de webhook implementado no servidor', 'Validação de assinatura e eventos conforme a documentação da Kiwify'],
    url: 'https://kiwify.com.br/',
  },
  {
    id: 'cakto', name: 'Cakto', group: 'sales', mode: 'Webhook · eventos de venda',
    description: 'Prepare a conexão de checkout para registrar eventos de pedido e conversão.',
    requirements: ['Conta de vendedor e acesso às integrações da Cakto', 'Endpoint HTTPS de webhook implementado no servidor', 'Validação de assinatura e eventos conforme a documentação da Cakto'],
    url: 'https://cakto.com.br/',
  },
  {
    id: 'hotmart', name: 'Hotmart', group: 'sales', mode: 'Webhook · eventos de venda',
    description: 'Inclua a Hotmart como destino de checkout e futura origem de eventos de conversão.',
    requirements: ['Conta de produtor e credenciais de integração', 'Endpoint HTTPS de webhook implementado no servidor', 'Validação de assinatura e eventos conforme a documentação da Hotmart'],
    url: 'https://developers.hotmart.com/',
  },
];

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

let profile = readLocal(productKey, {});
let campaigns = readLocal(campaignsKey, []);
let affiliateBatches = readLocal(affiliateIdeasKey, []);
let affiliateProducts = readLocal(affiliateProductsKey, []);
let promotionPlans = readLocal(promotionPlansKey, []);
let adBudgets = readLocal(adBudgetsKey, []);
let moneyEntries = readLocal(moneyEntriesKey, []);
let liveBalance = null;
let financeAuthenticated = false;
let appAuthenticated = false;
let accountConfigured = false;
let accountCreationMode = false;
if (!profile || typeof profile !== 'object' || Array.isArray(profile)) profile = {};
if (!Array.isArray(campaigns)) campaigns = [];
if (!Array.isArray(affiliateBatches)) affiliateBatches = [];
if (!Array.isArray(affiliateProducts)) affiliateProducts = [];
if (!Array.isArray(promotionPlans)) promotionPlans = [];
if (!Array.isArray(adBudgets)) adBudgets = [];
if (!Array.isArray(moneyEntries)) moneyEntries = [];
moneyEntries = moneyEntries.filter((entry) => entry
  && ['sale', 'ad', 'fee', 'refund', 'withdrawal'].includes(entry.type)
  && Number.isFinite(entry.amount)
  && typeof entry.date === 'string');

function setAppAuthentication(authenticated) {
  appAuthenticated = authenticated;
  appContent.hidden = !authenticated;
  loginScreen.hidden = authenticated;
  if (!authenticated) {
    appLoginPassword.value = '';
    window.setTimeout(() => appLoginPassword.focus(), 0);
  }
}

function setAccountCreationMode(enabled) {
  accountCreationMode = enabled && !accountConfigured;
  document.querySelector('#login-title').innerHTML = accountCreationMode
    ? 'Crie sua<br><span>conta proprietária.</span>'
    : 'Entre no<br><span>seu espaço.</span>';
  document.querySelector('#login-description').textContent = accountCreationMode
    ? 'Cadastre o e-mail e uma senha forte para proteger esta instalação do Cash.'
    : 'Use seu e-mail e senha para acessar o Cash.';
  document.querySelector('#signup-confirmation').hidden = !accountCreationMode;
  appLoginPasswordConfirm.required = accountCreationMode;
  appLoginPassword.autocomplete = accountCreationMode ? 'new-password' : 'current-password';
  document.querySelector('#app-login-submit').innerHTML = accountCreationMode
    ? 'Criar conta e entrar <span aria-hidden="true">→</span>'
    : 'Entrar no Cash <span aria-hidden="true">→</span>';
  loginModeToggle.hidden = accountConfigured;
  loginModeToggle.textContent = accountCreationMode ? 'Já tenho uma conta' : 'Criar conta proprietária';
}

loginModeToggle.addEventListener('click', () => setAccountCreationMode(!accountCreationMode));

async function checkAppSession() {
  try {
    const response = await fetch('/api/finance/session');
    const result = await response.json();
    accountConfigured = result.configured === true;
    setAccountCreationMode(!accountConfigured);
    setAppAuthentication(response.ok && result.authenticated === true);
    if (!result.authenticated && result.configured === false) {
      document.querySelector('#app-login-status').textContent = 'Esta instalação ainda não tem conta. Crie a conta proprietária para começar.';
    }
  } catch {
    setAppAuthentication(false);
    document.querySelector('#app-login-status').textContent = 'Servidor indisponível. Recarregue o Cash para tentar novamente.';
  }
}

async function logoutCash() {
  try {
    await fetch('/api/finance/session', { method: 'DELETE' });
  } finally {
    financeAuthenticated = false;
    liveBalance = null;
    setAppAuthentication(false);
    document.querySelector('#app-login-status').textContent = 'Você saiu do Cash.';
  }
}

appLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#app-login-status');
  const button = document.querySelector('#app-login-submit');
  button.disabled = true;
  status.textContent = 'Validando acesso...';
  try {
    const route = accountCreationMode ? '/api/auth/register' : '/api/finance/session';
    const payload = { email: appLoginEmail.value, password: appLoginPassword.value };
    if (accountCreationMode) payload.passwordConfirm = appLoginPasswordConfirm.value;
    const response = await fetch(route, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível entrar.');
    accountConfigured = true;
    setAccountCreationMode(false);
    appLoginEmail.value = result.email || appLoginEmail.value;
    appLoginPassword.value = '';
    appLoginPasswordConfirm.value = '';
    setAppAuthentication(true);
    status.textContent = 'Acesso autorizado.';
  } catch (error) {
    status.textContent = error.message || 'Falha ao validar acesso.';
  } finally {
    button.disabled = false;
    if (!appAuthenticated) appLoginPassword.focus();
  }
});

document.querySelectorAll('[data-app-logout]').forEach((button) => {
  button.addEventListener('click', logoutCash);
});

for (const [name, value] of Object.entries(profile)) {
  const field = productForm.elements.namedItem(name);
  if (field && typeof value === 'string') field.value = value;
}

function switchPage(page) {
  const isAssistant = page === 'assistant';
  document.querySelector('#workspace-view').hidden = isAssistant;
  document.querySelector('#assistant-view').hidden = !isAssistant;
  document.querySelector('#new-chat').hidden = !isAssistant;
  document.querySelectorAll('[data-workspace-page]').forEach((section) => {
    section.hidden = section.dataset.workspacePage !== page;
  });
  document.querySelectorAll('[data-page]').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === page);
  });
  if (page === 'campaigns') renderCampaigns();
  if (page === 'affiliates') {
    renderAffiliateProducts();
    renderAffiliateIdeas();
  }
  if (page === 'promotion') {
    renderPromotionProducts();
    renderPromotionPlans();
    renderAdBudgets();
  }
  if (page === 'dashboard') renderOverview();
  if (page === 'finance') {
    renderFinance();
    if (financeAuthenticated) refreshProviderBalance();
    else showFinanceSession().catch((error) => {
      document.querySelector('#finance-login-status').textContent = error.message || 'Não foi possível verificar a sessão.';
    });
  }
  if (page === 'integrations') renderIntegrations();
}

document.querySelectorAll('[data-page]').forEach((button) => {
  button.addEventListener('click', () => switchPage(button.dataset.page));
});

function renderAffiliateIdeas() {
  const container = document.querySelector('#affiliate-results');
  container.replaceChildren();
  affiliateBatches.forEach((batch) => {
    const section = document.createElement('section');
    section.className = 'affiliate-batch panel';
    const heading = document.createElement('div');
    heading.className = 'affiliate-batch-heading';
    const titleGroup = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = batch.niche;
    const meta = document.createElement('p');
    meta.textContent = `${batch.platform} · ${batch.createdAt}`;
    titleGroup.append(title, meta);
    const removeBatch = document.createElement('button');
    removeBatch.className = 'text-action danger-action';
    removeBatch.type = 'button';
    removeBatch.textContent = 'Excluir lista';
    removeBatch.addEventListener('click', () => {
      affiliateBatches = affiliateBatches.filter((item) => item.id !== batch.id);
      localStorage.setItem(affiliateIdeasKey, JSON.stringify(affiliateBatches));
      renderAffiliateIdeas();
    });
    heading.append(titleGroup, removeBatch);
    const grid = document.createElement('div');
    grid.className = 'affiliate-idea-grid';

    batch.suggestions.forEach((idea, index) => {
      const card = document.createElement('article');
      card.className = 'affiliate-idea-card';
      const badge = document.createElement('span');
      badge.className = 'draft-badge';
      badge.textContent = `IDEIA ${String(index + 1).padStart(2, '0')} · NÃO VERIFICADA`;
      const name = document.createElement('h3');
      name.textContent = idea.productIdea;
      const type = document.createElement('div');
      type.className = 'affiliate-idea-type';
      type.textContent = idea.productType;
      card.append(badge, name, type);
      for (const [label, value] of [['Público', idea.audience], ['Problema', idea.problem], ['Ângulo de conteúdo', idea.promotionAngle]]) {
        const detail = document.createElement('p');
        detail.className = 'affiliate-idea-detail';
        const strong = document.createElement('strong');
        strong.textContent = `${label}: `;
        detail.append(strong, document.createTextNode(value));
        card.append(detail);
      }
      const checks = document.createElement('ul');
      checks.className = 'affiliate-validation-list';
      idea.validationChecks.forEach((check) => {
        const item = document.createElement('li');
        item.textContent = check;
        checks.append(item);
      });
      card.append(checks);
      const createCampaign = document.createElement('button');
      createCampaign.className = 'text-action affiliate-campaign-action';
      createCampaign.type = 'button';
      createCampaign.textContent = 'Criar campanha com essa ideia →';
      createCampaign.addEventListener('click', () => {
        document.querySelector('#campaign-name').value = `${idea.productIdea} · afiliado`.slice(0, 80);
        document.querySelector('#campaign-angle').value = idea.promotionAngle;
        const checkout = document.querySelector('#campaign-checkout');
        if ([...checkout.options].some((option) => option.value === batch.platform)) checkout.value = batch.platform;
        switchPage('create');
      });
      card.append(createCampaign);
      grid.append(card);
    });

    section.append(heading, grid);
    container.append(section);
  });
  document.querySelector('#affiliate-empty').hidden = affiliateBatches.length > 0;
}

function renderAffiliateProducts() {
  const container = document.querySelector('#affiliate-product-list');
  container.replaceChildren();
  document.querySelector('#affiliate-product-count').textContent = affiliateProducts.length;
  document.querySelector('#affiliate-sales-count').textContent = affiliateProducts.reduce((total, product) => total + (Number.isSafeInteger(product.sales) ? product.sales : 0), 0);
  affiliateProducts.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'affiliate-saved-product';
    const details = document.createElement('div');
    details.className = 'affiliate-saved-details';
    const title = document.createElement('h3');
    title.textContent = product.name;
    const metadata = document.createElement('p');
    const commission = Number.isFinite(product.commission) ? ` · Comissão informada: ${product.commission}%` : '';
    metadata.textContent = `${product.platform}${commission}`;
    const link = document.createElement('a');
    link.href = product.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer sponsored';
    link.textContent = 'Abrir link de afiliado ↗';
    details.append(title, metadata, link);

    const sales = document.createElement('div');
    sales.className = 'affiliate-sales-counter';
    const count = document.createElement('strong');
    count.textContent = String(product.sales || 0);
    const label = document.createElement('span');
    label.textContent = 'vendas informadas';
    sales.append(count, label);

    const actions = document.createElement('div');
    actions.className = 'affiliate-product-actions';
    const registerSale = document.createElement('button');
    registerSale.className = 'text-action';
    registerSale.type = 'button';
    registerSale.textContent = '+ Registrar venda';
    registerSale.addEventListener('click', () => updateAffiliateSales(product.id, 1));
    const undoSale = document.createElement('button');
    undoSale.className = 'text-action';
    undoSale.type = 'button';
    undoSale.textContent = '− Corrigir contagem';
    undoSale.disabled = !product.sales;
    undoSale.addEventListener('click', () => updateAffiliateSales(product.id, -1));
    const startPromotion = document.createElement('button');
    startPromotion.className = 'text-action';
    startPromotion.type = 'button';
    startPromotion.textContent = 'Criar divulgação →';
    startPromotion.addEventListener('click', () => {
      renderPromotionProducts();
      document.querySelector('#promotion-product').value = product.id;
      switchPage('promotion');
    });
    const remove = document.createElement('button');
    remove.className = 'text-action danger-action';
    remove.type = 'button';
    remove.textContent = 'Remover';
    remove.addEventListener('click', () => {
      affiliateProducts = affiliateProducts.filter((item) => item.id !== product.id);
      localStorage.setItem(affiliateProductsKey, JSON.stringify(affiliateProducts));
      renderAffiliateProducts();
      renderPromotionProducts();
    });
    actions.append(registerSale, undoSale, startPromotion, remove);
    card.append(details, sales, actions);
    container.append(card);
  });
  document.querySelector('#empty-affiliate-products').hidden = affiliateProducts.length > 0;
}

function updateAffiliateSales(productId, delta) {
  affiliateProducts = affiliateProducts.map((product) => product.id === productId
    ? { ...product, sales: Math.max(0, (Number.isSafeInteger(product.sales) ? product.sales : 0) + delta) }
    : product);
  localStorage.setItem(affiliateProductsKey, JSON.stringify(affiliateProducts));
  renderAffiliateProducts();
}

document.querySelector('#affiliate-product-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const link = String(data.get('link')).trim();
  let parsedLink;
  try {
    parsedLink = new URL(link);
  } catch {
    document.querySelector('#affiliate-product-status').textContent = 'Informe um link válido da plataforma.';
    return;
  }
  if (parsedLink.protocol !== 'https:') {
    document.querySelector('#affiliate-product-status').textContent = 'Por segurança, use um link HTTPS.';
    return;
  }
  const commissionValue = String(data.get('commission')).trim();
  const commission = commissionValue ? Number(commissionValue) : null;
  if (commission !== null && (!Number.isFinite(commission) || commission < 0 || commission > 100)) {
    document.querySelector('#affiliate-product-status').textContent = 'A comissão precisa estar entre 0% e 100%.';
    return;
  }
  affiliateProducts.unshift({
    id: crypto.randomUUID(),
    name: String(data.get('name')).trim(),
    platform: String(data.get('platform')),
    link,
    commission,
    sales: 0,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(affiliateProductsKey, JSON.stringify(affiliateProducts));
  event.currentTarget.reset();
  document.querySelector('#affiliate-product-status').textContent = 'Oferta salva. Registre apenas vendas confirmadas na plataforma.';
  renderAffiliateProducts();
  renderPromotionProducts();
});

function renderPromotionProducts() {
  const select = document.querySelector('#promotion-product');
  const previous = select.value;
  select.replaceChildren();
  if (!affiliateProducts.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Cadastre um produto afiliado primeiro';
    select.append(option);
    document.querySelector('#generate-promotion').disabled = true;
    return;
  }
  affiliateProducts.forEach((product) => {
    const option = document.createElement('option');
    option.value = product.id;
    option.textContent = `${product.name} · ${product.platform}`;
    select.append(option);
  });
  if (affiliateProducts.some((product) => product.id === previous)) select.value = previous;
  document.querySelector('#generate-promotion').disabled = false;
}

function renderPromotionPlans() {
  const container = document.querySelector('#promotion-plan-list');
  container.replaceChildren();
  promotionPlans.forEach((plan) => {
    const section = document.createElement('section');
    section.className = 'promotion-plan panel';
    const heading = document.createElement('div');
    heading.className = 'affiliate-batch-heading';
    const titleGroup = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = plan.productName;
    const meta = document.createElement('p');
    meta.textContent = `${plan.duration} · ${plan.channels} · ${plan.createdAt}`;
    titleGroup.append(title, meta);
    const status = document.createElement('span');
    status.className = 'draft-badge';
    status.textContent = 'PLANO · RASCUNHO';
    heading.append(titleGroup, status);
    const strategy = document.createElement('p');
    strategy.className = 'promotion-strategy';
    strategy.textContent = plan.strategy;
    const schedule = document.createElement('div');
    schedule.className = 'promotion-schedule';
    plan.schedule.forEach((entry) => {
      const card = document.createElement('article');
      card.className = 'promotion-entry';
      const entryHeading = document.createElement('div');
      entryHeading.className = 'promotion-entry-heading';
      const day = document.createElement('strong');
      day.textContent = entry.day;
      const channel = document.createElement('span');
      channel.textContent = `${entry.channel} · ${entry.contentType}`;
      entryHeading.append(day, channel);
      const copy = document.createElement('p');
      copy.textContent = entry.copy;
      const disclosure = document.createElement('p');
      disclosure.className = 'promotion-disclosure';
      disclosure.textContent = `CTA: ${entry.cta} · Inclua #publi ou #afiliado.`;
      const copyButton = document.createElement('button');
      copyButton.className = 'text-action';
      copyButton.type = 'button';
      copyButton.textContent = 'Copiar texto';
      copyButton.addEventListener('click', async () => {
        await navigator.clipboard.writeText(`${entry.copy}\n\n${entry.cta}\n#publi #afiliado`);
        copyButton.textContent = 'Copiado';
        window.setTimeout(() => { copyButton.textContent = 'Copiar texto'; }, 1400);
      });
      card.append(entryHeading, copy, disclosure, copyButton);
      schedule.append(card);
    });
    const remove = document.createElement('button');
    remove.className = 'text-action danger-action';
    remove.type = 'button';
    remove.textContent = 'Excluir plano';
    remove.addEventListener('click', () => {
      promotionPlans = promotionPlans.filter((item) => item.id !== plan.id);
      localStorage.setItem(promotionPlansKey, JSON.stringify(promotionPlans));
      renderPromotionPlans();
    });
    section.append(heading, strategy, schedule, remove);
    container.append(section);
  });
  document.querySelector('#empty-promotion-plans').hidden = promotionPlans.length > 0;
}

const adBillingUrls = {
  'Meta Ads': 'https://business.facebook.com/billing_hub',
  'TikTok Ads': 'https://ads.tiktok.com/i18n/payment',
  'Google Ads': 'https://ads.google.com/aw/billing',
};

function renderAdBudgets() {
  const container = document.querySelector('#ad-budget-list');
  container.replaceChildren();
  const total = adBudgets.reduce((sum, budget) => sum + (Number.isFinite(budget.amount) ? budget.amount : 0), 0);
  document.querySelector('#planned-budget-total').textContent = brlFormatter.format(total);
  document.querySelector('#empty-ad-budgets').hidden = adBudgets.length > 0;
  adBudgets.forEach((budget) => {
    const row = document.createElement('article');
    row.className = 'ad-budget-row';
    const details = document.createElement('div');
    details.className = 'ad-budget-details';
    const title = document.createElement('strong');
    title.textContent = budget.campaign || 'Orçamento sem nome de campanha';
    const meta = document.createElement('span');
    meta.textContent = `${budget.platform} · ${budget.createdAt} · Planejado, ainda não pago`;
    details.append(title, meta);
    const amount = document.createElement('strong');
    amount.className = 'ad-budget-amount';
    amount.textContent = brlFormatter.format(budget.amount);
    const billing = document.createElement('a');
    billing.className = 'text-action';
    billing.href = adBillingUrls[budget.platform];
    billing.target = '_blank';
    billing.rel = 'noopener noreferrer';
    billing.textContent = 'Abrir cobrança ↗';
    const remove = document.createElement('button');
    remove.className = 'remove-transaction';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remover orçamento de ${budget.campaign || budget.platform}`);
    remove.addEventListener('click', () => {
      adBudgets = adBudgets.filter((item) => item.id !== budget.id);
      localStorage.setItem(adBudgetsKey, JSON.stringify(adBudgets));
      renderAdBudgets();
    });
    row.append(details, amount, billing, remove);
    container.append(row);
  });
}

document.querySelector('#ad-budget-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const amount = Number(data.get('amount'));
  if (!Number.isFinite(amount) || amount <= 0) return;
  adBudgets.unshift({
    id: crypto.randomUUID(),
    platform: String(data.get('platform')),
    amount,
    campaign: String(data.get('campaign')).trim(),
    createdAt: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date()),
  });
  localStorage.setItem(adBudgetsKey, JSON.stringify(adBudgets));
  event.currentTarget.reset();
  renderAdBudgets();
});

document.querySelector('#promotion-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const product = affiliateProducts.find((item) => item.id === data.productId);
  if (!product) {
    document.querySelector('#promotion-status').textContent = 'Cadastre ou selecione um produto afiliado.';
    return;
  }
  const button = document.querySelector('#generate-promotion');
  const status = document.querySelector('#promotion-status');
  button.disabled = true;
  status.textContent = 'Criando o calendário de divulgação...';
  try {
    const response = await fetch('/api/affiliates/promotion', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product, duration: data.duration, channels: data.channels, frequency: data.frequency, goal: data.goal }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível gerar o plano.');
    promotionPlans.unshift({
      id: crypto.randomUUID(),
      productName: product.name,
      duration: data.duration,
      channels: data.channels,
      createdAt: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
      strategy: result.strategy,
      schedule: result.schedule,
    });
    localStorage.setItem(promotionPlansKey, JSON.stringify(promotionPlans));
    renderPromotionPlans();
    status.textContent = 'Plano salvo. Revise e publique manualmente nos canais conectados.';
  } catch (error) {
    status.textContent = error.message || 'Falha ao criar o plano.';
  } finally {
    button.disabled = false;
    renderPromotionProducts();
  }
});

affiliateSuggestionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#affiliate-status');
  const submitButton = document.querySelector('#suggest-affiliate-products');
  submitButton.disabled = true;
  status.textContent = 'Cash está analisando o nicho...';
  try {
    const response = await fetch('/api/affiliates/suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(affiliateSuggestionForm).entries())),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível gerar sugestões.');
    affiliateBatches.unshift({
      id: crypto.randomUUID(),
      niche: affiliateSuggestionForm.elements.niche.value.trim(),
      platform: affiliateSuggestionForm.elements.platform.value,
      createdAt: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
      suggestions: result.suggestions,
    });
    localStorage.setItem(affiliateIdeasKey, JSON.stringify(affiliateBatches));
    renderAffiliateIdeas();
    status.textContent = 'Ideias salvas. Confirme a existência e as condições da oferta na plataforma.';
  } catch (error) {
    status.textContent = error.message || 'Falha ao gerar. Tente novamente.';
  } finally {
    submitButton.disabled = false;
  }
});

function renderIntegrations() {
  for (const [group, containerId] of [['social', 'social-integrations'], ['sales', 'sales-integrations']]) {
    const container = document.querySelector(`#${containerId}`);
    container.replaceChildren();
    integrations.filter((integration) => integration.group === group).forEach((integration) => {
      const card = document.createElement('article');
      card.className = 'integration-card';
      const heading = document.createElement('div');
      heading.className = 'integration-card-heading';
      const identity = document.createElement('div');
      identity.className = 'integration-identity';
      const icon = document.createElement('span');
      icon.className = `integration-icon ${integration.id}`;
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = integration.name.slice(0, 1);
      const name = document.createElement('h3');
      name.textContent = integration.name;
      identity.append(icon, name);
      const status = document.createElement('span');
      status.className = 'integration-status';
      status.textContent = 'NÃO CONECTADO';
      heading.append(identity, status);
      const mode = document.createElement('div');
      mode.className = 'integration-mode';
      mode.textContent = integration.mode;
      const description = document.createElement('p');
      description.className = 'integration-description';
      description.textContent = integration.description;
      const connect = document.createElement('button');
      connect.className = 'integration-connect';
      connect.type = 'button';
      connect.textContent = 'Configurar conexão';
      connect.addEventListener('click', () => showIntegrationDetails(integration));
      card.append(heading, mode, description, connect);
      container.append(card);
    });
  }
}

function showIntegrationDetails(integration) {
  document.querySelector('#integration-dialog-title').textContent = `Conectar ${integration.name}`;
  document.querySelector('#integration-dialog-description').textContent = integration.description;
  const requirements = document.querySelector('#integration-requirements');
  requirements.replaceChildren();
  integration.requirements.forEach((requirement) => {
    const item = document.createElement('div');
    item.className = 'requirement-item';
    const marker = document.createElement('span');
    marker.textContent = '›';
    marker.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = requirement;
    item.append(marker, text);
    requirements.append(item);
  });
  const link = document.querySelector('#integration-doc-link');
  link.href = integration.url;
  integrationDialog.showModal();
}

document.querySelector('#close-integration-dialog').addEventListener('click', () => integrationDialog.close());
integrationDialog.addEventListener('click', (event) => {
  if (event.target === integrationDialog) integrationDialog.close();
});

function saveProfile(event) {
  if (event) event.preventDefault();
  profile = Object.fromEntries(new FormData(productForm).entries());
  localStorage.setItem(productKey, JSON.stringify(profile));
  document.querySelector('#product-status').textContent = 'Perfil salvo neste navegador.';
  renderOverview();
  return profile;
}

productForm.addEventListener('submit', (event) => saveProfile(event));

let generatedProduct = readLocal(generatedProductKey, null);

function renderGeneratedProduct(product) {
  const panel = document.querySelector('#generated-product-panel');
  if (!product || typeof product.content !== 'string') {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  document.querySelector('#generated-product-name').textContent = product.name || 'Produto gerado';
  document.querySelector('#generated-product-price').textContent = product.suggestedPrice
    ? `Faixa de preço sugerida pela IA: ${product.suggestedPrice} · valide com pesquisa de mercado.`
    : 'Preço não definido';
  document.querySelector('#generated-product-content').textContent = product.content;
}

productGenerationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#product-generation-status');
  const submitButton = document.querySelector('#generate-product');
  submitButton.disabled = true;
  status.textContent = 'Cash está criando a estrutura e o conteúdo...';

  try {
    const response = await fetch('/api/product/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(productGenerationForm).entries())),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível gerar o produto.');

    generatedProduct = { ...result.product, format: productGenerationForm.elements.format.value };
    localStorage.setItem(generatedProductKey, JSON.stringify(generatedProduct));
    renderGeneratedProduct(generatedProduct);
    status.textContent = 'Produto criado e salvo neste navegador. Revise o conteúdo.';
  } catch (error) {
    status.textContent = error.message || 'Falha ao gerar. Tente novamente.';
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#copy-product').addEventListener('click', async (event) => {
  await navigator.clipboard.writeText(document.querySelector('#generated-product-content').textContent);
  event.currentTarget.textContent = 'Copiado';
  window.setTimeout(() => { event.currentTarget.textContent = 'Copiar conteúdo'; }, 1400);
});

document.querySelector('#use-generated-product').addEventListener('click', () => {
  if (!generatedProduct) return;
  for (const [field, value] of Object.entries({
    name: generatedProduct.name,
    description: generatedProduct.description,
    audience: generatedProduct.audience,
    benefit: generatedProduct.benefit,
  })) {
    productForm.elements.namedItem(field).value = value || '';
  }
  productForm.elements.namedItem('price').value = '';
  saveProfile();
  document.querySelector('#product-status').textContent = 'Perfil preenchido. Defina preço e oferta depois de revisar o produto.';
  document.querySelector('#product-status').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function renderOverview() {
  const financials = calculateFinance();
  document.querySelector('#metric-free-profit').textContent = brlFormatter.format(liveBalance?.availableCents ?? financials.available * 100);
  document.querySelector('#summary-profit-label').textContent = liveBalance ? 'SALDO OFICIAL DISPONÍVEL' : 'LUCRO LIVRE ESTIMADO';
  document.querySelector('#metric-campaigns').textContent = campaigns.length;
  document.querySelector('#metric-drafts').textContent = campaigns.length;
  document.querySelector('#metric-product').textContent = profile.name || 'Não configurado';
  document.querySelector('#metric-product-detail').textContent = profile.audience ? `Público: ${profile.audience}` : 'Adicione os dados do produto';
  document.querySelector('#product-brief-text').textContent = profile.name
    ? `${profile.name} · ${profile.audience || 'Público ainda não informado'}`
    : 'Configure seu produto para gerar uma campanha mais relevante.';
  const recent = document.querySelector('#recent-campaigns');
  renderCampaignList(recent, campaigns.slice(0, 3));
  document.querySelector('#empty-campaigns').hidden = campaigns.length > 0;
}

function calculateFinance() {
  const sumType = (type) => moneyEntries
    .filter((entry) => entry.type === type && Number.isFinite(entry.amount))
    .reduce((total, entry) => total + entry.amount, 0);
  const sales = sumType('sale');
  const costs = sumType('ad') + sumType('fee') + sumType('refund');
  const withdrawals = sumType('withdrawal');
  const net = sales - costs;
  return { sales, costs, withdrawals, net, available: Math.max(0, net - withdrawals) };
}

function renderFinance() {
  const financials = calculateFinance();
  document.querySelector('#finance-available').textContent = brlFormatter.format(financials.available);
  document.querySelector('#finance-sales').textContent = brlFormatter.format(financials.sales);
  document.querySelector('#finance-costs').textContent = brlFormatter.format(financials.costs);
  document.querySelector('#finance-withdrawals').textContent = brlFormatter.format(financials.withdrawals);
  document.querySelector('#metric-free-profit').textContent = brlFormatter.format(liveBalance?.availableCents ?? financials.available * 100);
  document.querySelector('#summary-profit-label').textContent = liveBalance ? 'SALDO OFICIAL DISPONÍVEL' : 'LUCRO LIVRE ESTIMADO';

  const list = document.querySelector('#money-entry-list');
  list.replaceChildren();
  const labels = { sale: 'Venda aprovada', ad: 'Gasto com anúncios', fee: 'Taxa da plataforma', refund: 'Reembolso', withdrawal: 'Saque já realizado' };
  [...moneyEntries].sort((first, second) => second.date.localeCompare(first.date)).forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'money-entry-row';
    const detail = document.createElement('div');
    detail.className = 'money-entry-detail';
    const label = document.createElement('strong');
    label.textContent = entry.note || labels[entry.type] || 'Movimentação';
    const metadata = document.createElement('span');
    metadata.textContent = `${labels[entry.type] || 'Movimentação'} · ${entry.date || ''}`;
    detail.append(label, metadata);
    const amount = document.createElement('strong');
    const positive = entry.type === 'sale';
    amount.className = `money-entry-amount ${positive ? 'positive' : ''}`;
    amount.textContent = `${positive ? '+' : '−'} ${brlFormatter.format(entry.amount)}`;
    const remove = document.createElement('button');
    remove.className = 'remove-transaction';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remover ${labels[entry.type] || 'movimentação'}`);
    remove.addEventListener('click', () => {
      moneyEntries = moneyEntries.filter((item) => item.id !== entry.id);
      saveMoneyEntries();
    });
    row.append(detail, amount, remove);
    list.append(row);
  });
  list.hidden = moneyEntries.length === 0;
  document.querySelector('#empty-money-entries').hidden = moneyEntries.length > 0;
  document.querySelector('#money-entry-count').textContent = `${moneyEntries.length} ${moneyEntries.length === 1 ? 'registro' : 'registros'}`;
}

function centsToMoney(cents) {
  return brlFormatter.format(cents / 100);
}

async function showFinanceSession() {
  const response = await fetch('/api/finance/session');
  const result = await response.json();
  financeAuthenticated = response.ok && result.authenticated === true;
  document.querySelector('#finance-login-panel').hidden = financeAuthenticated;
  document.querySelector('#finance-connected-panel').hidden = !financeAuthenticated;
  if (!financeAuthenticated) return;

  const providersResponse = await fetch('/api/finance/providers');
  const providersResult = await providersResponse.json();
  if (!providersResponse.ok) throw new Error(providersResult.error || 'Não foi possível carregar as contas.');
  const select = document.querySelector('#live-provider-select');
  const configured = providersResult.providers.filter((provider) => provider.configured);
  select.replaceChildren();
  providersResult.providers.forEach((provider) => {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.configured ? provider.name : `${provider.name} · configure no servidor`;
    option.disabled = !provider.configured;
    select.append(option);
  });
  if (!configured.length) {
    document.querySelector('#live-balance-status').textContent = 'Adicione as credenciais Kiwify ou Cakto no .env e reinicie o servidor.';
    document.querySelector('#open-secure-withdrawal').disabled = true;
    return;
  }
  select.value = configured[0].id;
  await refreshProviderBalance();
}

document.querySelector('#finance-login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#finance-login-status');
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  status.textContent = 'Validando acesso...';
  try {
    const response = await fetch('/api/finance/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passphrase: document.querySelector('#finance-passphrase').value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível entrar.');
    document.querySelector('#finance-passphrase').value = '';
    await showFinanceSession();
    document.querySelector('#finance-login-status').textContent = 'Painel financeiro conectado.';
  } catch (error) {
    status.textContent = error.message || 'Falha ao validar acesso.';
  } finally {
    submitButton.disabled = false;
  }
});

async function refreshProviderBalance() {
  if (!financeAuthenticated) return;
  const provider = document.querySelector('#live-provider-select').value;
  if (!provider) return;
  const button = document.querySelector('#refresh-provider-balance');
  const status = document.querySelector('#live-balance-status');
  const withdrawButton = document.querySelector('#open-secure-withdrawal');
  button.disabled = true;
  withdrawButton.disabled = true;
  status.textContent = 'Consultando saldo oficial...';
  try {
    const response = await fetch(`/api/finance/balance?provider=${encodeURIComponent(provider)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível consultar o saldo.');
    liveBalance = result;
    const name = provider === 'kiwify' ? 'Kiwify' : 'Cakto';
    document.querySelector('#live-provider-name').textContent = name;
    document.querySelector('#live-available').textContent = centsToMoney(result.availableCents);
    document.querySelector('#live-pending').textContent = result.pendingCents === null ? 'Não informado' : centsToMoney(result.pendingCents);
    const updatedAt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(result.observedAt));
    status.textContent = `Saldo atualizado às ${updatedAt}.`;
    const minimumMet = provider !== 'cakto' || result.availableCents >= 1_000;
    withdrawButton.disabled = result.availableCents <= 0 || !minimumMet;
    withdrawButton.textContent = minimumMet ? 'Solicitar saque no Cash' : 'Mínimo para saque: R$ 10,00';
    document.querySelector('#finance-available').textContent = centsToMoney(result.availableCents);
    document.querySelector('#metric-free-profit').textContent = centsToMoney(result.availableCents);
    document.querySelector('#summary-profit-label').textContent = 'SALDO OFICIAL DISPONÍVEL';
  } catch (error) {
    liveBalance = null;
    document.querySelector('#live-available').textContent = '--';
    document.querySelector('#live-pending').textContent = '--';
    status.textContent = error.message || 'Não foi possível consultar o saldo.';
    document.querySelector('#summary-profit-label').textContent = 'LUCRO LIVRE ESTIMADO';
  } finally {
    button.disabled = false;
    renderFinance();
    withdrawButton.disabled = !liveBalance || liveBalance.availableCents <= 0 || (provider === 'cakto' && liveBalance.availableCents < 1_000);
  }
}

document.querySelector('#live-provider-select').addEventListener('change', () => {
  liveBalance = null;
  document.querySelector('#open-secure-withdrawal').disabled = true;
  refreshProviderBalance();
});
document.querySelector('#refresh-provider-balance').addEventListener('click', refreshProviderBalance);

document.querySelector('#open-secure-withdrawal').addEventListener('click', () => {
  if (!liveBalance || liveBalance.availableCents <= 0) return;
  const provider = document.querySelector('#live-provider-select').value;
  document.querySelector('#secure-withdrawal-title').textContent = `Saque pela ${provider === 'kiwify' ? 'Kiwify' : 'Cakto'}`;
  document.querySelector('#secure-withdrawal-summary').textContent = `Saldo disponível consultado agora: ${centsToMoney(liveBalance.availableCents)}. A plataforma valida o valor novamente antes de aceitar o pedido.`;
  const amount = document.querySelector('#secure-withdrawal-amount');
  amount.value = (liveBalance.availableCents / 100).toFixed(2);
  amount.max = (liveBalance.availableCents / 100).toFixed(2);
  amount.min = provider === 'cakto' ? '10.00' : '0.01';
  document.querySelector('#secure-withdrawal-confirm').checked = false;
  document.querySelector('#secure-withdrawal-status').textContent = provider === 'cakto'
    ? 'A Cakto envia o pedido para análise e usa a chave Pix já cadastrada na sua conta.'
    : 'A Kiwify valida o saldo e aplica as regras financeiras da sua conta.';
  secureWithdrawalDialog.showModal();
});

document.querySelector('#close-secure-withdrawal').addEventListener('click', () => secureWithdrawalDialog.close());
secureWithdrawalDialog.addEventListener('click', (event) => {
  if (event.target === secureWithdrawalDialog) secureWithdrawalDialog.close();
});

secureWithdrawalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!liveBalance || !document.querySelector('#secure-withdrawal-confirm').checked) return;
  const provider = document.querySelector('#live-provider-select').value;
  const amountCents = Math.round(Number(secureWithdrawalForm.elements.amount.value) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > liveBalance.availableCents) {
    document.querySelector('#secure-withdrawal-status').textContent = 'O valor precisa estar dentro do saldo disponível atualizado.';
    return;
  }
  if (provider === 'cakto' && amountCents < 1_000) {
    document.querySelector('#secure-withdrawal-status').textContent = 'O saque mínimo da Cakto é R$ 10,00.';
    return;
  }

  const idempotencyStorageKey = `cash-withdrawal:${provider}:${amountCents}`;
  let idempotencyKey = sessionStorage.getItem(idempotencyStorageKey);
  if (!idempotencyKey) {
    idempotencyKey = crypto.randomUUID();
    sessionStorage.setItem(idempotencyStorageKey, idempotencyKey);
  }

  const submitButton = document.querySelector('#submit-secure-withdrawal');
  const status = document.querySelector('#secure-withdrawal-status');
  submitButton.disabled = true;
  status.textContent = 'Atualizando o saldo e enviando o pedido confirmado...';
  try {
    const response = await fetch('/api/finance/withdrawal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider, amountCents, idempotencyKey, confirm: true }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'A plataforma não aceitou o pedido.');
    sessionStorage.removeItem(idempotencyStorageKey);
    status.textContent = provider === 'cakto'
      ? `Pedido ${result.requestId} enviado; status inicial: ${result.status}. O saldo é atualizado abaixo.`
      : `Pedido ${result.requestId} enviado à Kiwify. Confirme o status no painel da plataforma.`;
    document.querySelector('#secure-withdrawal-confirm').checked = false;
    await refreshProviderBalance();
  } catch (error) {
    status.textContent = `${error.message || 'Falha no saque.'} Uma nova tentativa com o mesmo valor reutiliza o identificador para evitar duplicidade.`;
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#finance-logout').addEventListener('click', async () => {
  await logoutCash();
});

function saveMoneyEntries() {
  localStorage.setItem(moneyEntriesKey, JSON.stringify(moneyEntries));
  renderFinance();
}

function openMoneyEntryDialog() {
  moneyEntryForm.reset();
  const now = new Date();
  moneyEntryForm.elements.date.value = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  moneyEntryDialog.showModal();
  moneyEntryForm.elements.amount.focus();
}

document.querySelector('#open-money-entry').addEventListener('click', openMoneyEntryDialog);
document.querySelector('#open-money-entry-mobile').addEventListener('click', openMoneyEntryDialog);
document.querySelector('#first-money-entry').addEventListener('click', openMoneyEntryDialog);
document.querySelector('#close-money-entry').addEventListener('click', () => moneyEntryDialog.close());
moneyEntryDialog.addEventListener('click', (event) => {
  if (event.target === moneyEntryDialog) moneyEntryDialog.close();
});

moneyEntryForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(moneyEntryForm);
  moneyEntries.unshift({
    id: crypto.randomUUID(),
    type: String(data.get('type')),
    amount: Number(data.get('amount')),
    date: String(data.get('date')),
    note: String(data.get('note')).trim(),
  });
  saveMoneyEntries();
  moneyEntryDialog.close();
});

const withdrawalLinks = {
  Kiwify: 'https://kiwify.com.br/',
  Cakto: 'https://cakto.com.br/',
  Hotmart: 'https://app.hotmart.com/',
};

function updateWithdrawalLink() {
  const platform = document.querySelector('#withdrawal-platform').value;
  const link = document.querySelector('#withdrawal-link');
  link.href = withdrawalLinks[platform];
  link.replaceChildren(document.createTextNode(`Abrir painel da ${platform}`));
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  link.append(arrow);
}

document.querySelector('#withdrawal-platform').addEventListener('change', updateWithdrawalLink);
document.querySelector('#open-withdrawal').addEventListener('click', () => {
  const salesPlatform = profile.salesPlatform;
  document.querySelector('#withdrawal-platform').value = withdrawalLinks[salesPlatform] ? salesPlatform : 'Kiwify';
  updateWithdrawalLink();
  withdrawalDialog.showModal();
});
document.querySelector('#close-withdrawal').addEventListener('click', () => withdrawalDialog.close());
withdrawalDialog.addEventListener('click', (event) => {
  if (event.target === withdrawalDialog) withdrawalDialog.close();
});

function renderCampaignList(container, items) {
  container.replaceChildren();
  container.hidden = items.length === 0;
  items.forEach((campaign) => {
    const article = document.createElement('article');
    article.className = 'campaign-card';
    const heading = document.createElement('div');
    heading.className = 'campaign-card-heading';
    const title = document.createElement('h3');
    title.textContent = campaign.name;
    const status = document.createElement('span');
    status.className = 'draft-badge';
    status.textContent = 'RASCUNHO';
    heading.append(title, status);
    const metadata = document.createElement('div');
    metadata.className = 'campaign-metadata';
    metadata.textContent = `${campaign.format} · ${campaign.channel} · ${campaign.checkout || 'link direto'} · ${campaign.createdAt}`;
    const details = document.createElement('details');
    details.className = 'campaign-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Abrir material gerado';
    const content = document.createElement('pre');
    content.className = 'campaign-output';
    content.textContent = campaign.content;
    details.append(summary, content);
    const actions = document.createElement('div');
    actions.className = 'campaign-actions';
    const copy = document.createElement('button');
    copy.className = 'text-action';
    copy.type = 'button';
    copy.textContent = 'Copiar';
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(campaign.content);
      copy.textContent = 'Copiado';
      window.setTimeout(() => { copy.textContent = 'Copiar'; }, 1400);
    });
    const remove = document.createElement('button');
    remove.className = 'text-action danger-action';
    remove.type = 'button';
    remove.textContent = 'Excluir rascunho';
    remove.addEventListener('click', () => {
      campaigns = campaigns.filter((item) => item.id !== campaign.id);
      localStorage.setItem(campaignsKey, JSON.stringify(campaigns));
      renderOverview();
      renderCampaigns();
    });
    actions.append(copy, remove);
    article.append(heading, metadata, details, actions);
    container.append(article);
  });
}

function renderCampaigns() {
  renderCampaignList(document.querySelector('#campaign-library'), campaigns);
  document.querySelector('#empty-library').hidden = campaigns.length > 0;
}

campaignForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#generation-status');
  const submitButton = document.querySelector('#generate-campaign');
  if (!profile.name || !profile.description || !profile.audience || !profile.benefit) {
    status.textContent = 'Complete o perfil do produto antes de gerar.';
    switchPage('product');
    document.querySelector('#product-status').textContent = 'Preencha os campos obrigatórios para continuar.';
    return;
  }

  const campaign = Object.fromEntries(new FormData(campaignForm).entries());
  submitButton.disabled = true;
  status.textContent = 'Cash está preparando as peças...';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product: profile, campaign }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível gerar a campanha.');

    const generated = {
      id: crypto.randomUUID(),
      name: campaign.name,
      format: campaign.format,
      channel: campaign.channel,
      checkout: campaign.checkout,
      content: result.content,
      createdAt: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()),
    };
    campaigns.unshift(generated);
    localStorage.setItem(campaignsKey, JSON.stringify(campaigns));
    document.querySelector('#output-title').textContent = campaign.name;
    document.querySelector('#output-content').textContent = result.content;
    document.querySelector('#generation-output').hidden = false;
    status.textContent = 'Rascunho criado. Revise antes de usar.';
    renderOverview();
  } catch (error) {
    status.textContent = error.message || 'Falha ao gerar. Tente novamente.';
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#copy-output').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  await navigator.clipboard.writeText(document.querySelector('#output-content').textContent);
  button.textContent = 'Copiado';
  window.setTimeout(() => { button.textContent = 'Copiar texto'; }, 1400);
});

document.querySelector('#new-chat').addEventListener('click', () => {
  resetChat();
  switchPage('assistant');
});
document.querySelector('#clear-chat').addEventListener('click', resetChat);
renderOverview();
renderFinance();
renderIntegrations();
renderAffiliateIdeas();
renderGeneratedProduct(generatedProduct);
renderAdBudgets();
checkAppSession();
window.setInterval(() => {
  if (financeAuthenticated && !document.querySelector('[data-workspace-page="finance"]').hidden) refreshProviderBalance();
}, 60_000);

function addMessage(role, content) {
  const message = document.createElement('article');
  message.className = `message ${role}`;

  if (role === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = 'C';
    message.append(avatar);
  }

  const body = document.createElement('div');
  body.className = 'message-body';
  if (role === 'assistant') {
    const name = document.createElement('div');
    name.className = 'message-name';
    name.textContent = 'Cash';
    body.append(name);
  }

  const text = document.createElement('div');
  text.className = 'message-text';
  text.textContent = content;
  body.append(text);
  message.append(body);
  messagesElement.append(message);
  chatScroll.scrollTop = chatScroll.scrollHeight;
  return message;
}

function showTyping() {
  const message = document.createElement('article');
  message.className = 'message assistant';
  message.setAttribute('aria-label', 'Cash está pensando');
  message.innerHTML = '<div class="message-avatar" aria-hidden="true">C</div><div class="message-body"><div class="message-name">Cash</div><div class="typing" aria-hidden="true"><span></span><span></span><span></span></div></div>';
  messagesElement.append(message);
  chatScroll.scrollTop = chatScroll.scrollHeight;
  return message;
}

async function sendMessage(content) {
  const cleanContent = content.trim();
  if (!cleanContent || sendButton.disabled) return;

  welcome.hidden = true;
  addMessage('user', cleanContent);
  history.push({ role: 'user', content: cleanContent });
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendButton.disabled = true;
  const typing = showTyping();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    const result = await response.json();
    typing.remove();
    if (!response.ok) throw new Error(result.error || 'Não foi possível enviar sua mensagem.');
    history.push({ role: 'assistant', content: result.answer });
    addMessage('assistant', result.answer);
  } catch (error) {
    typing.remove();
    addMessage('assistant', error.message || 'Não consegui conectar agora. Tente novamente.');
  } finally {
    sendButton.disabled = false;
    chatInput.focus();
  }
}

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage(chatInput.value);
});

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 130)}px`;
});

chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

document.querySelectorAll('.suggestion').forEach((button) => {
  button.addEventListener('click', () => sendMessage(button.dataset.prompt));
});

function resetChat() {
  history.length = 0;
  messagesElement.replaceChildren();
  welcome.hidden = false;
  chatInput.focus();
}

fetch('/api/health')
  .then((response) => response.json())
  .then(({ ready }) => {
    document.querySelector('#connection-status').textContent = ready ? 'IA conectada' : 'IA não configurada';
    document.querySelector('#connection-caption').textContent = ready ? 'Pronta para criar' : 'Configure a chave no servidor';
    document.querySelector('.status-dot').classList.toggle('ready', ready);
  })
  .catch(() => {
    document.querySelector('#connection-status').textContent = 'Servidor indisponível';
    document.querySelector('#connection-caption').textContent = 'Tente recarregar a página';
  });