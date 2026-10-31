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
const productLibraryKey = 'cash-product-library-v1';
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
const productDestinations = [
  { id: 'instagram', name: 'Instagram', group: 'Redes sociais' },
  { id: 'facebook', name: 'Facebook', group: 'Redes sociais' },
  { id: 'tiktok', name: 'TikTok', group: 'Redes sociais' },
  { id: 'youtube', name: 'YouTube', group: 'Redes sociais' },
  { id: 'kiwify', name: 'Kiwify', group: 'Plataformas de venda' },
  { id: 'cakto', name: 'Cakto', group: 'Plataformas de venda' },
  { id: 'hotmart', name: 'Hotmart', group: 'Plataformas de venda' },
];

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(scopedStorageKey(key)) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

const accountDataKeys = [campaignsKey, productKey, generatedProductKey, productLibraryKey, affiliateIdeasKey, affiliateProductsKey, promotionPlansKey, adBudgetsKey, moneyEntriesKey];
let activeAccount = null;
let activeAccountId = null;
let accountProfile = { name: '', avatar: null };
let profileAvatarDraft;
let profile = {};
let campaigns = [];
let salesNotifications = [];
let giftMailbox = [];
let giftPurchases = [];
let sentGiftPurchases = [];
let selectedGiftPlanId = null;
let affiliateBatches = [];
let affiliateProducts = [];
let promotionPlans = [];
let adBudgets = [];
let moneyEntries = [];
let platformSales = [];
let activeFinancePlatform = 'all';
let generatedProduct = null;
let productLibrary = [];
let liveBalance = null;
let liveBalanceProvider = null;
let configuredFinanceProviders = [];
let providerBalances = new Map();
let financeAuthenticated = false;
let appAuthenticated = false;
let accountConfigured = false;
let accountCreationMode = false;
let billingPlans = [];
let billingLoaded = false;
let billingState = {
  plan: { id: 'basic', name: 'Básico', monthlyCampaigns: 5, campaignsThisMonth: 0, featureLevel: 0, isOwner: false },
  subscription: null,
};

function scopedStorageKey(key) {
  return activeAccountId ? `${key}:account:${activeAccountId}` : key;
}

function billingMoney(cents) {
  return brlFormatter.format(cents / 100);
}

function updateMailboxBadge(selector, count) {
  const badge = document.querySelector(selector);
  const normalizedCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  badge.hidden = normalizedCount === 0;
  badge.textContent = normalizedCount > 99 ? '99+' : String(normalizedCount);
}

function mailboxDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR');
}

function addMailboxEmpty(list, message) {
  const empty = document.createElement('div');
  empty.className = 'mailbox-empty';
  empty.textContent = message;
  list.append(empty);
}

function renderSalesNotifications() {
  const list = document.querySelector('#sales-notification-list');
  const unreadCount = salesNotifications.filter((item) => !item.readAt).length;
  updateMailboxBadge('#sales-notification-count', unreadCount);
  document.querySelector('#mark-sales-read').hidden = unreadCount === 0;
  list.replaceChildren();
  if (!salesNotifications.length) {
    addMailboxEmpty(list, 'Nenhuma venda aprovada recebida ainda. Configure os webhooks Kiwify/Cakto para começar.');
    return;
  }
  salesNotifications.forEach((notification) => {
    const entry = document.createElement('article');
    entry.className = `mailbox-entry${notification.readAt ? '' : ' unread'}`;
    const heading = document.createElement('div');
    heading.className = 'mailbox-entry-heading';
    const name = document.createElement('strong');
    name.textContent = notification.productName;
    const time = document.createElement('time');
    time.dateTime = notification.occurredAt;
    time.textContent = mailboxDate(notification.occurredAt);
    heading.append(name, time);
    const meta = document.createElement('span');
    meta.className = 'mailbox-entry-meta';
    meta.textContent = `${notification.provider === 'kiwify' ? 'Kiwify' : 'Cakto'} · Venda ${notification.saleId}`;
    const value = document.createElement('p');
    value.className = 'mailbox-entry-value';
    value.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: notification.currency }).format(notification.amountCents / 100);
    entry.append(heading, meta, value);
    list.append(entry);
  });
}

function renderGiftMailbox() {
  const ownerMode = activeAccount?.role === 'owner';
  const ownerList = document.querySelector('#gift-sent-list');
  const recipientList = document.querySelector('#gift-recipient-list');
  const sentPurchasesList = document.querySelector('#gift-purchases-sent-list');
  [ownerList, recipientList, sentPurchasesList].forEach((list) => list.replaceChildren());
  if (ownerMode) {
    const waitingCount = giftMailbox.filter((gift) => !gift.redeemedAt).length
      + giftPurchases.filter((gift) => gift.status === 'approved' && !gift.redeemedAt).length;
    updateMailboxBadge('#gift-notification-count', waitingCount);
    if (!giftMailbox.length && !giftPurchases.length) {
      addMailboxEmpty(ownerList, 'Os presentes que você enviar para contas escolhidas aparecerão aqui.');
      return;
    }
    giftMailbox.forEach((gift) => {
      const entry = document.createElement('article');
      entry.className = `mailbox-entry${gift.redeemedAt ? '' : ' pending-gift'}`;
      const heading = document.createElement('div');
      heading.className = 'mailbox-entry-heading';
      const title = document.createElement('strong');
      title.textContent = gift.title;
      const status = document.createElement('span');
      status.className = 'mailbox-entry-meta';
      status.textContent = gift.redeemedAt ? 'Resgatado' : 'Aguardando resgate';
      heading.append(title, status);
      const recipient = document.createElement('p');
      recipient.textContent = `Para ${gift.recipientName} · ${gift.recipientEmail}`;
      const plan = document.createElement('span');
      plan.className = 'mailbox-entry-meta';
      plan.textContent = `${gift.planName} · ${gift.isPermanent ? 'Permanente' : `${gift.durationDays} dias`}`;
      entry.append(heading, recipient, plan);
      ownerList.append(entry);
    });
    giftPurchases.forEach((gift) => {
      const entry = document.createElement('article');
      entry.className = `mailbox-entry${gift.status === 'approved' && !gift.redeemedAt ? ' pending-gift' : ''}`;
      const heading = document.createElement('div');
      heading.className = 'mailbox-entry-heading';
      const title = document.createElement('strong');
      title.textContent = `${gift.planName} · Presente pago`;
      const status = document.createElement('span');
      status.className = 'mailbox-entry-meta';
      status.textContent = gift.redeemedAt
        ? 'Resgatado'
        : gift.status === 'approved' ? 'Pagamento aprovado · aguardando resgate' : gift.status === 'pending' ? 'Aguardando pagamento' : gift.status;
      heading.append(title, status);
      const recipient = document.createElement('p');
      recipient.textContent = `Para ${gift.recipientName}`;
      const value = document.createElement('span');
      value.className = 'mailbox-entry-value';
      value.textContent = billingMoney(gift.amountCents);
      entry.append(heading, recipient, value);
      ownerList.append(entry);
    });
    document.querySelector('#gift-send-status').textContent = waitingCount
      ? `${waitingCount} presente(s) aguardando resgate.`
      : 'Confira os presentes pagos e enviados para suas contas escolhidas.';
    return;
  }

  const pendingGifts = giftMailbox.filter((gift) => !gift.redeemedAt)
    .concat(giftPurchases.filter((gift) => !gift.redeemedAt && gift.status === 'approved'));
  updateMailboxBadge('#gift-notification-count', pendingGifts.length);
  if (!giftMailbox.length && !giftPurchases.length) {
    addMailboxEmpty(recipientList, 'Ainda não há presentes para esta conta.');
  }
  if (giftMailbox.length || giftPurchases.length) {
    giftMailbox.forEach((gift) => {
      const entry = document.createElement('article');
      entry.className = `mailbox-entry${gift.redeemedAt ? '' : ' pending-gift'}`;
      const heading = document.createElement('div');
      heading.className = 'mailbox-entry-heading';
      const title = document.createElement('strong');
      title.textContent = gift.title;
      const date = document.createElement('time');
      date.textContent = gift.redeemedAt ? `Resgatado ${mailboxDate(gift.redeemedAt)}` : 'Presente disponível';
      heading.append(title, date);
      const message = document.createElement('p');
      message.textContent = gift.message;
      const plan = document.createElement('span');
      plan.className = 'mailbox-entry-meta';
      plan.textContent = `${gift.planName} · ${gift.isPermanent ? 'Acesso permanente' : `${gift.durationDays} dias após o resgate`}`;
      entry.append(heading, message, plan);
      if (!gift.redeemedAt) {
        const button = document.createElement('button');
        button.className = 'save-transaction';
        button.type = 'button';
        button.textContent = 'Resgatar presente';
        button.addEventListener('click', () => claimGift(gift.id, button));
        entry.append(button);
      } else if (gift.accessUntil) {
        const expiresAt = document.createElement('span');
        expiresAt.className = 'mailbox-entry-meta';
        expiresAt.textContent = `Acesso válido até ${new Date(gift.accessUntil).toLocaleDateString('pt-BR')}`;
        entry.append(expiresAt);
      }
      recipientList.append(entry);
    });
    giftPurchases.forEach((gift) => {
      const entry = document.createElement('article');
      entry.className = `mailbox-entry${gift.redeemedAt ? '' : ' pending-gift'}`;
      const heading = document.createElement('div');
      heading.className = 'mailbox-entry-heading';
      const title = document.createElement('strong');
      title.textContent = `${gift.planName} para você`;
      const date = document.createElement('time');
      date.textContent = gift.redeemedAt ? `Resgatado ${mailboxDate(gift.redeemedAt)}` : 'Presente disponível';
      heading.append(title, date);
      const message = document.createElement('p');
      message.textContent = `Um plano ${gift.planName} foi comprado para ${gift.recipientName}. Abra este presente para ativar seu acesso por um mês.`;
      const value = document.createElement('span');
      value.className = 'mailbox-entry-meta';
      value.textContent = 'Pagamento confirmado · acesso começa ao resgatar';
      entry.append(heading, message, value);
      if (!gift.redeemedAt) {
        const button = document.createElement('button');
        button.className = 'save-transaction';
        button.type = 'button';
        button.textContent = 'Abrir e ativar presente';
        button.addEventListener('click', () => claimGift(`paid:${gift.id}`, button));
        entry.append(button);
      } else if (gift.accessUntil) {
        const expiresAt = document.createElement('span');
        expiresAt.className = 'mailbox-entry-meta';
        expiresAt.textContent = `Acesso válido até ${new Date(gift.accessUntil).toLocaleDateString('pt-BR')}`;
        entry.append(expiresAt);
      }
      recipientList.append(entry);
    });
  }
  if (activeAccount?.role !== 'owner') {
    if (!sentGiftPurchases.length) {
      addMailboxEmpty(sentPurchasesList, 'Você ainda não comprou presentes de plano.');
    } else {
      renderSentGiftPurchases(sentPurchasesList);
    }
  }
  document.querySelector('#gift-recipient-status').textContent = pendingGifts.length
    ? 'Abra um presente e confirme o resgate para ativar o plano. O acesso pago vale um mês a partir do resgate.'
    : 'Não há presentes aguardando para esta conta.';
  document.querySelector('#gift-send-status').textContent = giftMailbox.some((gift) => !gift.redeemedAt)
    ? 'Há presente(s) aguardando resgate.'
    : 'Confira o histórico dos presentes enviados.';
}

function renderSentGiftPurchases(list) {
  sentGiftPurchases.forEach((gift) => {
    const entry = document.createElement('article');
    entry.className = 'mailbox-entry';
    const heading = document.createElement('div');
    heading.className = 'mailbox-entry-heading';
    const title = document.createElement('strong');
    title.textContent = `${gift.planName} para ${gift.recipientName}`;
    const status = document.createElement('span');
    status.className = 'mailbox-entry-meta';
    status.textContent = gift.redeemedAt
      ? 'Presente resgatado'
      : gift.status === 'approved' ? 'Pago · aguardando ativação' : gift.status === 'pending' ? 'Aguardando pagamento' : gift.status;
    heading.append(title, status);
    const value = document.createElement('span');
    value.className = 'mailbox-entry-value';
    value.textContent = billingMoney(gift.amountCents);
    entry.append(heading, value);
    list.append(entry);
  });
}

function renderBillingPlans() {
  const grid = document.querySelector('#billing-plan-grid');
  if (!grid) return;
  grid.replaceChildren();
  const currentPlanId = billingState.plan.id;
  billingPlans.forEach((plan) => {
    const card = document.createElement('article');
    card.className = `billing-plan-card plan-${plan.id}${plan.id === currentPlanId ? ' current' : ''}${['premium', 'dev'].includes(plan.id) ? ' recommended' : ''}`;
    const label = document.createElement('div');
    label.className = 'billing-plan-kicker';
    label.textContent = plan.id === 'dev' ? 'EXCLUSIVO DO PROPRIETÁRIO' : plan.id === 'premium' ? 'EXPERIÊNCIA COMPLETA' : plan.id === 'pro' ? 'PARA CRESCER' : 'PLANO INICIAL';
    const title = document.createElement('h2');
    title.textContent = plan.name;
    const tierMark = document.createElement('span');
    tierMark.className = 'billing-plan-orbit';
    tierMark.setAttribute('aria-hidden', 'true');
    tierMark.textContent = plan.id === 'dev' ? '⌘' : plan.id === 'premium' ? '✦' : plan.id === 'pro' ? '↗' : '◌';
    title.prepend(tierMark);
    const description = document.createElement('p');
    description.className = 'billing-plan-description';
    description.textContent = plan.description;
    const price = document.createElement('div');
    price.className = 'billing-plan-price';
    price.textContent = plan.priceCents === 0 ? 'Grátis' : billingMoney(plan.priceCents);
    if (plan.priceCents > 0) {
      const interval = document.createElement('span');
      interval.textContent = '/ mês';
      price.append(interval);
    }
    const featureList = document.createElement('ul');
    plan.features.forEach((feature) => {
      const item = document.createElement('li');
      item.className = feature.included ? 'billing-feature included' : 'billing-feature excluded';
      const marker = document.createElement('span');
      marker.className = 'billing-feature-marker';
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = feature.included ? '✓' : '×';
      const name = document.createElement('span');
      name.textContent = feature.name;
      item.append(marker, name);
      featureList.append(item);
    });
    const action = document.createElement('button');
    action.type = 'button';
    action.className = ['premium', 'dev'].includes(plan.id) ? 'save-transaction' : 'billing-plan-action';
    action.dataset.billingPlan = plan.id;
    if (billingState.plan.isOwner) {
      action.textContent = plan.id === 'dev' ? 'Seu plano exclusivo' : 'Incluído no Dev';
      action.disabled = true;
    } else if (plan.id === currentPlanId && ['coupon', 'coupon_permanent', 'gift', 'gift_permanent', 'gift_paid'].includes(billingState.plan.accessSource)) {
      action.textContent = billingState.plan.accessSource === 'coupon_permanent'
        ? 'Premium permanente ativo'
        : billingState.plan.accessSource.startsWith('gift')
          ? 'Presente ativo'
          : 'Premium promocional ativo';
      action.disabled = true;
    } else if (plan.id === currentPlanId && billingState.subscription?.status === 'authorized') {
      action.textContent = 'Plano atual';
      action.disabled = true;
    } else if (plan.id === 'basic') {
      action.textContent = plan.id === currentPlanId ? 'Plano atual' : 'Plano gratuito';
      action.disabled = true;
    } else {
      action.textContent = plan.id === currentPlanId ? 'Aguardando confirmação' : 'Escolher plano';
      action.disabled = ['pending', 'paused', 'creating'].includes(billingState.subscription?.status)
        || billingState.subscription?.status === 'authorized';
    }
    card.append(label, title, description, price, featureList, action);
    if (plan.priceCents > 0) {
      const giftAction = document.createElement('button');
      giftAction.type = 'button';
      giftAction.className = 'billing-gift-action';
      giftAction.dataset.giftPlan = plan.id;
      giftAction.textContent = '🎁 Presentear alguém';
      card.append(giftAction);
    }
    grid.append(card);
  });
}

function renderBillingStatus() {
  const planTitle = document.querySelector('#billing-current-plan');
  if (!planTitle) return;
  const { plan, subscription } = billingState;
  const statusElement = document.querySelector('#billing-subscription-status');
  const usageElement = document.querySelector('#billing-usage');
  const nextPaymentElement = document.querySelector('#billing-next-payment');
  const resumeButton = document.querySelector('#billing-resume-checkout');
  const cancelButton = document.querySelector('#billing-cancel');
  planTitle.textContent = plan.name;
  resumeButton.hidden = !subscription?.initPoint || subscription.status !== 'pending';
  cancelButton.hidden = !['pending', 'authorized', 'paused'].includes(subscription?.status);
  resumeButton.onclick = () => window.location.assign(subscription.initPoint);
  if (plan.isOwner) {
    statusElement.textContent = 'A conta proprietária tem acesso completo sem cobrança.';
    usageElement.textContent = 'Campanhas sem limite mensal.';
  } else if (plan.accessSource === 'coupon_permanent') {
    statusElement.textContent = 'Premium ativado permanentemente por cupom. Não expira e não gera cobrança.';
    usageElement.textContent = 'Campanhas sem limite mensal.';
  } else if (plan.accessSource === 'coupon' && plan.accessUntil) {
    const expiresAt = new Date(plan.accessUntil);
    const expirationLabel = Number.isNaN(expiresAt.getTime()) ? '' : ` até ${expiresAt.toLocaleDateString('pt-BR')}`;
    statusElement.textContent = `Premium promocional ativo${expirationLabel}. Depois, o acesso volta ao Básico se não houver uma assinatura paga ativa.`;
    usageElement.textContent = 'Campanhas sem limite mensal durante o período promocional.';
  } else if (plan.accessSource === 'gift_permanent') {
    statusElement.textContent = `${plan.name} recebido como presente, ativado permanentemente e sem cobrança.`;
    usageElement.textContent = 'Campanhas sem limite mensal durante o acesso do presente.';
  } else if (plan.accessSource === 'gift' && plan.accessUntil) {
    const expiresAt = new Date(plan.accessUntil);
    const expirationLabel = Number.isNaN(expiresAt.getTime()) ? '' : ` até ${expiresAt.toLocaleDateString('pt-BR')}`;
    statusElement.textContent = `${plan.name} recebido como presente${expirationLabel}. Depois, o acesso volta ao Básico se não houver uma assinatura paga ativa.`;
    usageElement.textContent = 'Campanhas sem limite mensal durante o acesso do presente.';
  } else if (plan.accessSource === 'gift_paid' && plan.accessUntil) {
    const expiresAt = new Date(plan.accessUntil);
    const expirationLabel = Number.isNaN(expiresAt.getTime()) ? '' : ` até ${expiresAt.toLocaleDateString('pt-BR')}`;
    statusElement.textContent = `${plan.name} recebido como presente pago${expirationLabel}. Depois, o acesso volta ao Básico se não houver uma assinatura ativa.`;
    usageElement.textContent = 'Campanhas sem limite mensal durante o mês do presente.';
  } else {
    const statusMessages = {
      authorized: 'Assinatura ativa e confirmada pelo Mercado Pago.',
      pending: 'Pagamento pendente. O acesso será liberado após a confirmação.',
      paused: 'Assinatura pausada. Os recursos pagos estão bloqueados.',
      cancelled: 'Assinatura cancelada. Você está no plano gratuito.',
      expired: 'Assinatura expirada. Você está no plano gratuito.',
      rejected: 'Pagamento não aprovado. Você está no plano gratuito.',
      checkout_failed: 'Não foi possível iniciar o pagamento. Tente novamente.',
    };
    statusElement.textContent = subscription?.status === 'authorized'
      && ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(subscription.lastPaymentStatus)
      ? 'O último pagamento não foi aprovado. Os recursos pagos estão bloqueados; confira a assinatura no Mercado Pago.'
      : subscription
        ? statusMessages[subscription.status] || 'Plano gratuito ativo.'
        : 'Plano gratuito ativo. Escolha um plano pago quando quiser.';
    usageElement.textContent = Number.isInteger(plan.monthlyCampaigns)
      ? `${plan.campaignsThisMonth || 0} de ${plan.monthlyCampaigns} campanhas usadas neste mês.`
      : 'Campanhas sem limite mensal.';
  }
  const nextPayment = !['coupon', 'coupon_permanent'].includes(plan.accessSource) && subscription?.nextPaymentAt
    ? new Date(subscription.nextPaymentAt)
    : null;
  nextPaymentElement.textContent = nextPayment && !Number.isNaN(nextPayment.getTime())
    ? `Próxima cobrança prevista: ${nextPayment.toLocaleDateString('pt-BR')}.`
    : '';
  renderBillingPlans();
}

async function loadBillingPlans() {
  const accountId = activeAccountId;
  const response = await fetch('/api/billing/plans', { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result.plans)) throw new Error(result.error || 'Não foi possível carregar os planos.');
  if (accountId !== activeAccountId) return;
  billingPlans = result.plans;
  renderBillingPlans();
}

async function refreshBillingStatus() {
  const accountId = activeAccountId;
  const response = await fetch('/api/billing/status');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível consultar seu plano.');
  if (activeAccountId !== accountId) return;
  billingState = result;
  billingLoaded = true;
  renderBillingStatus();
}

function renderCoupons(coupons) {
  const list = document.querySelector('#coupon-list');
  list.replaceChildren();
  if (!coupons.length) {
    const empty = document.createElement('p');
    empty.className = 'generation-status';
    empty.textContent = 'Nenhum cupom criado ainda.';
    list.append(empty);
    return;
  }
  coupons.forEach((coupon) => {
    const exhausted = coupon.usedCount >= coupon.maxUses;
    const active = Boolean(coupon.active) && !exhausted;
    const item = document.createElement('article');
    item.className = 'coupon-list-item';
    const details = document.createElement('div');
    details.className = 'coupon-list-details';
    const code = document.createElement('code');
    code.textContent = coupon.code;
    const usage = document.createElement('span');
    usage.textContent = `${coupon.usedCount} de ${coupon.maxUses} utilizações`;
    const duration = document.createElement('span');
    duration.textContent = coupon.accessType === 'permanent' ? 'Premium permanente' : 'Premium por 1 mês';
    const state = document.createElement('span');
    state.className = `coupon-state${active ? ' active' : ''}`;
    state.textContent = exhausted ? 'Limite atingido' : active ? 'Ativo' : 'Desativado';
    details.append(code, duration, usage, state);
    const copy = document.createElement('button');
    copy.className = 'billing-plan-action';
    copy.type = 'button';
    copy.dataset.couponCopy = coupon.code;
    copy.textContent = 'Copiar código';
    const toggle = document.createElement('button');
    toggle.className = 'text-action';
    toggle.type = 'button';
    toggle.dataset.couponToggle = String(coupon.id);
    toggle.dataset.couponActive = String(active);
    toggle.textContent = active ? 'Desativar' : 'Ativar';
    toggle.disabled = exhausted;
    const actions = document.createElement('div');
    actions.className = 'coupon-list-actions';
    actions.append(copy, toggle);
    item.append(details, actions);
    list.append(item);
  });
}

async function loadCoupons() {
  const ownerId = activeAccount?.role === 'owner' ? activeAccountId : null;
  if (!ownerId) return;
  const response = await fetch('/api/admin/coupons', { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result.coupons)) {
    throw new Error(result.error || 'Não foi possível carregar os cupons.');
  }
  if (ownerId !== activeAccountId) return;
  renderCoupons(result.coupons);
}

async function beginPlanCheckout(planId) {
  const notice = document.querySelector('#billing-notice');
  notice.textContent = 'Preparando checkout seguro do Mercado Pago...';
  document.querySelectorAll('[data-billing-plan]').forEach((button) => { button.disabled = true; });
  try {
    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível iniciar o checkout.');
    window.location.assign(result.checkoutUrl);
  } catch (error) {
    notice.textContent = error.message || 'Falha ao iniciar o checkout.';
    renderBillingPlans();
  }
}

function openGiftCheckout(planId) {
  const plan = billingPlans.find((candidate) => candidate.id === planId && candidate.priceCents > 0);
  if (!plan) return;
  selectedGiftPlanId = plan.id;
  document.querySelector('#gift-checkout-title').textContent = `Presentear com plano ${plan.name}`;
  document.querySelector('#gift-checkout-plan-summary').textContent =
    `Pagamento único de ${billingMoney(plan.priceCents)}. A pessoa recebe ${plan.name} por um mês após abrir e ativar o presente.`;
  document.querySelector('#paid-gift-recipient-name').value = '';
  document.querySelector('#paid-gift-recipient-email').value = '';
  document.querySelector('#paid-gift-checkout-status').textContent =
    'O e-mail precisa pertencer a uma conta cadastrada. Após a confirmação, o presente aparece no correio do app; não enviamos e-mail automático.';
  document.querySelector('#gift-checkout-dialog').showModal();
}

async function beginGiftCheckout(event) {
  event.preventDefault();
  const button = document.querySelector('#pay-gift-button');
  const status = document.querySelector('#paid-gift-checkout-status');
  if (!selectedGiftPlanId) {
    status.textContent = 'Escolha um plano para presentear.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Preparando pagamento único no Mercado Pago...';
  try {
    const response = await fetch('/api/billing/gift-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        planId: selectedGiftPlanId,
        name: document.querySelector('#paid-gift-recipient-name').value,
        email: document.querySelector('#paid-gift-recipient-email').value,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível iniciar o pagamento do presente.');
    window.location.assign(result.checkoutUrl);
  } catch (error) {
    status.textContent = error.message || 'Falha ao iniciar o pagamento do presente.';
  } finally {
    button.disabled = false;
  }
}

async function cancelPlanSubscription() {
  if (!window.confirm('Deseja cancelar a assinatura? Os recursos pagos serão atualizados após a confirmação do Mercado Pago.')) return;
  const notice = document.querySelector('#billing-notice');
  const button = document.querySelector('#billing-cancel');
  button.disabled = true;
  notice.textContent = 'Solicitando cancelamento ao Mercado Pago...';
  try {
    const response = await fetch('/api/billing/cancel', { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível cancelar a assinatura.');
    await refreshBillingStatus();
    notice.textContent = result.status === 'cancelled'
      ? 'Assinatura cancelada no Mercado Pago.'
      : 'A solicitação foi enviada. O status será atualizado após a confirmação do Mercado Pago.';
  } catch (error) {
    notice.textContent = error.message || 'Falha ao cancelar a assinatura.';
  } finally {
    button.disabled = false;
  }
}

function writeLocal(key, value) {
  if (!activeAccountId) return;
  localStorage.setItem(scopedStorageKey(key), JSON.stringify(value));
}

async function refreshSalesNotifications() {
  if (activeAccount?.role !== 'owner') {
    salesNotifications = [];
    renderSalesNotifications();
    return;
  }
  const accountId = activeAccountId;
  const response = await fetch('/api/notifications/sales', { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result.notifications)) {
    throw new Error(result.error || 'Não foi possível carregar as notificações de vendas.');
  }
  if (accountId !== activeAccountId) return;
  salesNotifications = result.notifications;
  renderSalesNotifications();
  document.querySelector('#sales-mailbox-status').textContent = salesNotifications.length
    ? 'Notificações das vendas aprovadas recebidas pelos webhooks Kiwify/Cakto.'
    : 'Nenhuma venda aprovada recebida ainda. Configure os webhooks Kiwify/Cakto para começar.';
}

async function refreshGiftMailbox() {
  if (!activeAccountId) return 0;
  const accountId = activeAccountId;
  const response = await fetch('/api/gifts', { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result.gifts) || !Array.isArray(result.purchases) || !Array.isArray(result.sentPurchases)) {
    throw new Error(result.error || 'Não foi possível carregar o correio de presentes.');
  }
  if (accountId !== activeAccountId) return 0;
  giftMailbox = result.gifts;
  giftPurchases = result.owner ? result.sentPurchases : result.purchases;
  sentGiftPurchases = result.owner ? [] : result.sentPurchases;
  renderGiftMailbox();
  return giftMailbox.filter((gift) => !gift.redeemedAt).length
    + giftPurchases.filter((gift) => !gift.redeemedAt).length;
}

async function openSalesMailbox() {
  const status = document.querySelector('#sales-mailbox-status');
  status.textContent = 'Carregando notificações...';
  try {
    await refreshSalesNotifications();
  } catch (error) {
    status.textContent = error.message || 'Não foi possível carregar as notificações de vendas.';
  }
  if (!document.querySelector('#sales-mailbox-dialog').open) {
    document.querySelector('#sales-mailbox-dialog').showModal();
  }
}

async function openGiftMailbox() {
  const status = document.querySelector(activeAccount?.role === 'owner' ? '#gift-send-status' : '#gift-recipient-status');
  status.textContent = 'Carregando presentes...';
  try {
    await refreshGiftMailbox();
  } catch (error) {
    status.textContent = error.message || 'Não foi possível carregar o correio de presentes.';
  }
  if (!document.querySelector('#gift-mailbox-dialog').open) {
    document.querySelector('#gift-mailbox-dialog').showModal();
  }
}

async function claimGift(giftId, button) {
  const accountId = activeAccountId;
  button.disabled = true;
  try {
    const paidGift = typeof giftId === 'string' && giftId.startsWith('paid:');
    const claimPath = paidGift
      ? `/api/gifts/purchases/${encodeURIComponent(giftId.slice('paid:'.length))}/claim`
      : `/api/gifts/${encodeURIComponent(giftId)}/claim`;
    const response = await fetch(claimPath, { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível resgatar o presente.');
    await refreshBillingStatus();
    await refreshGiftMailbox();
    document.querySelector('#gift-recipient-status').textContent = result.permanent
      ? `${result.planName} ativado permanentemente.`
      : `${result.planName} ativado até ${new Date(result.accessUntil).toLocaleDateString('pt-BR')}.`;
  } catch (error) {
    if (accountId === activeAccountId) {
      document.querySelector('#gift-recipient-status').textContent = error.message || 'Não foi possível resgatar o presente.';
    }
  } finally {
    button.disabled = false;
  }
}

function loadAccountData(account) {
  activeAccount = account;
  activeAccountId = String(account.id);
  salesNotifications = [];
  giftMailbox = [];
  giftPurchases = [];
  sentGiftPurchases = [];
  renderSalesNotifications();
  renderGiftMailbox();
  accountProfile = { name: '', avatar: null };
  profileAvatarDraft = undefined;
  document.querySelector('#profile-email').value = account.email || '';
  renderAccountProfile();
  loadAccountProfile().catch((error) => {
    document.querySelector('#profile-save-status').textContent = error.message || 'Não foi possível carregar seu perfil.';
  });
  billingLoaded = false;
  billingState = account.role === 'owner'
    ? { plan: { id: 'dev', name: 'Dev', monthlyCampaigns: null, campaignsThisMonth: null, featureLevel: 3, isOwner: true }, subscription: null }
    : { plan: { id: 'basic', name: 'Básico', monthlyCampaigns: 5, campaignsThisMonth: 0, featureLevel: 0, isOwner: false }, subscription: null };
  billingPlans = [];
  activeFinancePlatform = 'all';
  liveBalance = null;
  liveBalanceProvider = null;
  configuredFinanceProviders = [];
  providerBalances.clear();
  if (account.role === 'owner') {
    accountDataKeys.forEach((key) => {
      const scopedKey = scopedStorageKey(key);
      const legacyValue = localStorage.getItem(key);
      if (localStorage.getItem(scopedKey) === null && legacyValue !== null) {
        localStorage.setItem(scopedKey, legacyValue);
      }
    });
  }
  profile = readLocal(productKey, {});
  campaigns = readLocal(campaignsKey, []);
  affiliateBatches = readLocal(affiliateIdeasKey, []);
  affiliateProducts = readLocal(affiliateProductsKey, []);
  promotionPlans = readLocal(promotionPlansKey, []);
  adBudgets = readLocal(adBudgetsKey, []);
  moneyEntries = readLocal(moneyEntriesKey, []);
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) profile = {};
  const savedGeneratedProduct = readLocal(generatedProductKey, null);
  const savedProductLibrary = readLocal(productLibraryKey, null);
  productLibrary = Array.isArray(savedProductLibrary)
    ? savedProductLibrary.filter((item) => item && typeof item === 'object' && typeof item.content === 'string')
    : [];
  generatedProduct = typeof savedGeneratedProduct === 'string'
    ? productLibrary.find((item) => item.id === savedGeneratedProduct) || null
    : savedGeneratedProduct;
  let productLibraryNeedsSave = !Array.isArray(savedProductLibrary) || productLibrary.length !== savedProductLibrary.length;
  let profileNeedsSave = false;
  if (generatedProduct && typeof generatedProduct === 'object' && typeof generatedProduct.content === 'string') {
    if (!generatedProduct.id) {
      generatedProduct = { ...generatedProduct, id: crypto.randomUUID(), createdAt: new Date().toISOString(), cover: null, destinations: [] };
      productLibraryNeedsSave = true;
    }
    if (!productLibrary.some((item) => item.id === generatedProduct.id)) {
      productLibrary.unshift(generatedProduct);
      productLibraryNeedsSave = true;
    }
  }
  if (typeof profile.name === 'string' && profile.name.trim()) {
    const matchedGenerated = generatedProduct && generatedProduct.name === profile.name ? generatedProduct : null;
    const productId = profile.id || matchedGenerated?.id || crypto.randomUUID();
    profileNeedsSave = profile.id !== productId;
    profile = { ...profile, id: productId };
    if (!productLibrary.some((item) => item.id === productId)) {
      productLibrary.unshift({
        ...profile,
        id: productId,
        content: matchedGenerated?.content || profile.description || '',
        format: matchedGenerated?.format || 'offer',
        cover: null,
        destinations: [],
        createdAt: matchedGenerated?.createdAt || new Date().toISOString(),
      });
      productLibraryNeedsSave = true;
    }
  }
  generatedProduct = generatedProduct
    ? productLibrary.find((item) => item.id === generatedProduct.id) || generatedProduct
    : null;
  if (productLibraryNeedsSave) {
    try {
      writeLocal(productLibraryKey, productLibrary);
      if (generatedProduct) writeLocal(generatedProductKey, generatedProduct.id);
      if (profileNeedsSave) writeLocal(productKey, profile);
    } catch (error) {
      document.querySelector('#product-generation-status').textContent = 'Os produtos foram carregados, mas não foi possível salvar a migração neste navegador.';
    }
  }
  if (!Array.isArray(campaigns)) campaigns = [];
  if (!Array.isArray(affiliateBatches)) affiliateBatches = [];
  if (!Array.isArray(affiliateProducts)) affiliateProducts = [];
  if (!Array.isArray(promotionPlans)) promotionPlans = [];
  if (!Array.isArray(adBudgets)) adBudgets = [];
  if (!Array.isArray(moneyEntries)) moneyEntries = [];
  moneyEntries = moneyEntries.filter((entry) => entry
    && ['sale', 'deposit', 'ad', 'fee', 'refund', 'withdrawal'].includes(entry.type)
    && Number.isFinite(entry.amount)
    && typeof entry.date === 'string');
  document.querySelectorAll('form').forEach((form) => form.reset());
  Object.entries(profile).forEach(([name, value]) => {
    const field = productForm.elements.namedItem(name);
    if (field && typeof value === 'string') field.value = value;
  });
  document.querySelectorAll('[data-owner-only]').forEach((element) => {
    element.hidden = account.role !== 'owner';
  });
  document.querySelectorAll('[data-member-only]').forEach((element) => {
    element.hidden = account.role === 'owner';
  });
  document.querySelector('#coupon-list').replaceChildren();
  document.querySelector('#coupon-admin-status').textContent = 'Cada conta pode resgatar o código uma vez. Compartilhe o código com as pessoas escolhidas.';
  document.querySelector('#coupon-redemption-status').textContent = 'Cada conta pode resgatar um mesmo código uma vez. A promoção não inicia uma cobrança.';
  if (account.role === 'owner') loadCoupons().catch((error) => {
    document.querySelector('#coupon-admin-status').textContent = error.message || 'Não foi possível carregar os cupons.';
  });
  financeAuthenticated = false;
  history.length = 0;
  messagesElement.replaceChildren();
  welcome.hidden = false;
  document.querySelector('#generation-output').hidden = true;
  renderAffiliateProducts();
  renderAffiliateIdeas();
  renderPromotionProducts();
  renderPromotionPlans();
  renderAdBudgets();
  renderGeneratedProduct(generatedProduct);
  renderProductLibrary();
  renderCampaigns();
  renderOverview();
  renderFinance();
  loadBillingPlans().catch((error) => {
    document.querySelector('#billing-notice').textContent = error.message || 'Não foi possível carregar os planos.';
  });
  refreshBillingStatus().catch((error) => {
    document.querySelector('#billing-subscription-status').textContent = error.message || 'Não foi possível consultar seu plano.';
  });
  const currentUrl = new URL(window.location.href);
  const giftCheckoutReturned = currentUrl.searchParams.get('gift') === 'return';
  if (currentUrl.searchParams.get('billing') === 'return') {
    document.querySelector('#billing-notice').textContent = 'Retorno do checkout recebido. Estamos aguardando a confirmação do Mercado Pago para liberar o plano.';
    currentUrl.searchParams.delete('billing');
  }
  if (giftCheckoutReturned) {
    document.querySelector('#billing-notice').textContent = 'Pagamento recebido. Estamos aguardando a confirmação do Mercado Pago; o presente aparecerá na caixa de presentes após a aprovação.';
    currentUrl.searchParams.delete('gift');
  }
  if (currentUrl.search !== new URL(window.location.href).search) {
    window.history.replaceState(null, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  }
  switchPage(giftCheckoutReturned ? 'plans' : 'dashboard');
  refreshSalesNotifications().catch((error) => {
    document.querySelector('#sales-mailbox-status').textContent = error.message || 'Não foi possível carregar as notificações de vendas.';
  });
  refreshGiftMailbox().then((pendingCount) => {
    if (activeAccountId === String(account.id) && account.role !== 'owner' && pendingCount > 0) {
      document.querySelector('#gift-mailbox-dialog').showModal();
    }
  }).catch((error) => {
    document.querySelector('#gift-recipient-status').textContent = error.message || 'Não foi possível carregar o correio de presentes.';
  });
}

function clearAccountData() {
  activeAccount = null;
  activeAccountId = null;
  accountProfile = { name: '', avatar: null };
  profileAvatarDraft = undefined;
  document.querySelector('#profile-email').value = '';
  document.querySelector('#profile-display-name').value = '';
  document.querySelector('#profile-avatar-file').value = '';
  document.querySelector('#profile-save-status').textContent = 'Entre na sua conta para editar seu perfil.';
  renderAccountProfile();
  profile = {};
  campaigns = [];
  affiliateBatches = [];
  affiliateProducts = [];
  promotionPlans = [];
  adBudgets = [];
  moneyEntries = [];
  platformSales = [];
  salesNotifications = [];
  giftMailbox = [];
  activeFinancePlatform = 'all';
  generatedProduct = null;
  productLibrary = [];
  renderProductLibrary();
  billingLoaded = false;
  billingState = {
    plan: { id: 'basic', name: 'Básico', monthlyCampaigns: 5, campaignsThisMonth: 0, featureLevel: 0, isOwner: false },
    subscription: null,
  };
  billingPlans = [];
  renderBillingPlans();
  history.length = 0;
  messagesElement.replaceChildren();
  welcome.hidden = false;
  document.querySelector('#generation-output').hidden = true;
  document.querySelectorAll('form').forEach((form) => form.reset());
  document.querySelectorAll('[data-owner-only]').forEach((element) => { element.hidden = true; });
  document.querySelectorAll('[data-member-only]').forEach((element) => { element.hidden = true; });
  document.querySelector('#coupon-list').replaceChildren();
  document.querySelectorAll('.mailbox-dialog').forEach((dialog) => {
    if (dialog.open) dialog.close();
  });
  giftMailbox = [];
  giftPurchases = [];
  sentGiftPurchases = [];
  document.querySelector('#gift-sent-list').replaceChildren();
  renderSalesNotifications();
  renderGiftMailbox();
}

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
  accountCreationMode = enabled;
  document.querySelector('#login-title').innerHTML = accountCreationMode
    ? 'Crie sua<br><span>conta no Dinvaro IA.</span>'
    : 'Entre no<br><span>seu espaço.</span>';
  document.querySelector('#login-description').textContent = accountCreationMode
    ? 'Crie sua conta para acessar seu espaço privado no Dinvaro IA.'
    : 'Use seu e-mail e senha para acessar o Dinvaro IA.';
  document.querySelector('#signup-confirmation').hidden = !accountCreationMode;
  appLoginPasswordConfirm.required = accountCreationMode;
  appLoginPassword.autocomplete = accountCreationMode ? 'new-password' : 'current-password';
  document.querySelector('#app-login-submit').innerHTML = accountCreationMode
    ? 'Criar conta e entrar <span aria-hidden="true">→</span>'
    : 'Entrar no Dinvaro IA <span aria-hidden="true">→</span>';
  loginModeToggle.hidden = false;
  loginModeToggle.textContent = accountCreationMode ? 'Já tenho uma conta' : 'Criar conta';
}

loginModeToggle.addEventListener('click', () => setAccountCreationMode(!accountCreationMode));

async function checkAppSession() {
  try {
    const response = await fetch('/api/finance/session');
    const result = await response.json();
    accountConfigured = result.configured === true;
    if (result.authenticated && result.account) loadAccountData(result.account);
    else clearAccountData();
    setAccountCreationMode(!accountConfigured);
    setAppAuthentication(response.ok && result.authenticated === true);
    if (!result.authenticated && result.configured === false) {
      document.querySelector('#app-login-status').textContent = 'Esta instalação ainda não tem conta. Crie a primeira conta para começar.';
    }
  } catch {
    setAppAuthentication(false);
    document.querySelector('#app-login-status').textContent = 'Servidor indisponível. Recarregue o Dinvaro IA para tentar novamente.';
  }
}

async function logoutCash() {
  try {
    await fetch('/api/finance/session', { method: 'DELETE' });
  } finally {
    financeAuthenticated = false;
    liveBalance = null;
    liveBalanceProvider = null;
    configuredFinanceProviders = [];
    providerBalances.clear();
    clearAccountData();
    setAppAuthentication(false);
    document.querySelector('#app-login-status').textContent = 'Você saiu do Dinvaro IA.';
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
    loadAccountData(result);
    setAccountCreationMode(false);
    appLoginEmail.value = result.email || appLoginEmail.value;
    appLoginPassword.value = '';
    appLoginPasswordConfirm.value = '';
    setAppAuthentication(true);
    status.textContent = result.role === 'owner' ? 'Acesso de proprietária autorizado.' : 'Acesso autorizado.';
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

function updateAvatarElement(element, name, avatar) {
  element.replaceChildren();
  if (avatar) {
    const image = document.createElement('img');
    image.src = avatar;
    image.alt = '';
    element.append(image);
  } else {
    element.textContent = [...(name || 'U')][0].toLocaleUpperCase('pt-BR');
  }
}

function renderAccountProfile() {
  const name = accountProfile.name || activeAccount?.email?.split('@')[0] || 'Usuário';
  const avatar = profileAvatarDraft === undefined ? accountProfile.avatar : profileAvatarDraft;
  updateAvatarElement(document.querySelector('#profile-avatar-preview'), name, avatar);
  updateAvatarElement(document.querySelector('#sidebar-avatar'), name, accountProfile.avatar);
  document.querySelector('#sidebar-account-name').textContent = accountProfile.name || name;
  if (accountProfile.name && document.querySelector('#profile-display-name') !== document.activeElement) {
    document.querySelector('#profile-display-name').value = accountProfile.name;
  }
}

async function readProfileResponse(response) {
  let result;
  try {
    result = JSON.parse(await response.text());
  } catch {
    if (!response.ok) {
      throw new Error(`O servidor respondeu com erro ${response.status} sem JSON. Reinicie o servidor e atualize a página.`);
    }
    throw new Error('O servidor retornou uma resposta inválida. Atualize a página e tente novamente.');
  }
  if (!result || typeof result !== 'object') {
    throw new Error('O servidor retornou uma resposta inválida. Atualize a página e tente novamente.');
  }
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação do perfil.');
  return result;
}

async function loadAccountProfile() {
  const accountId = activeAccountId;
  const response = await fetch('/api/profile');
  const result = await readProfileResponse(response);
  if (accountId !== activeAccountId) return;
  accountProfile = result;
  profileAvatarDraft = undefined;
  renderAccountProfile();
  document.querySelector('#profile-save-status').textContent = 'Seu nome será único entre as contas Dinvaro IA.';
}

function compressProfileImage(file) {
  if (file.size > 8 * 1024 * 1024) return Promise.reject(new Error('Escolha uma imagem de até 8 MB.'));
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error('Escolha uma imagem JPEG, PNG ou WebP.'));
  }
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('A imagem não tem dimensões válidas.');
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Não foi possível preparar a imagem.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const compressedImage = canvas.toDataURL('image/jpeg', 0.82);
        if (compressedImage.length > 700_000) throw new Error('A imagem ficou muito grande. Escolha uma imagem mais simples.');
        resolve(compressedImage);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível abrir essa imagem.'));
    };
    image.src = objectUrl;
  });
}

document.querySelector('#profile-avatar-file').addEventListener('change', async (event) => {
  const file = event.currentTarget.files[0];
  if (!file) return;
  const status = document.querySelector('#profile-save-status');
  try {
    profileAvatarDraft = await compressProfileImage(file);
    renderAccountProfile();
    status.textContent = 'Foto pronta. Salve o perfil para confirmar a alteração.';
  } catch (error) {
    event.currentTarget.value = '';
    status.textContent = error.message || 'Não foi possível preparar a foto.';
  }
});

document.querySelector('#remove-profile-avatar').addEventListener('click', () => {
  profileAvatarDraft = null;
  document.querySelector('#profile-avatar-file').value = '';
  renderAccountProfile();
  document.querySelector('#profile-save-status').textContent = 'Foto removida da prévia. Salve o perfil para confirmar.';
});

document.querySelector('#account-profile-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.querySelector('#save-account-profile');
  const status = document.querySelector('#profile-save-status');
  button.disabled = true;
  status.textContent = 'Salvando seu perfil...';
  try {
    const payload = { name: document.querySelector('#profile-display-name').value };
    if (profileAvatarDraft !== undefined) payload.avatar = profileAvatarDraft;
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await readProfileResponse(response);
    accountProfile = result;
    profileAvatarDraft = undefined;
    document.querySelector('#profile-avatar-file').value = '';
    renderAccountProfile();
    status.textContent = 'Perfil salvo com sucesso.';
  } catch (error) {
    status.textContent = error.message || 'Não foi possível salvar seu perfil.';
  } finally {
    button.disabled = false;
  }
});

function switchPage(page) {
  const minimumFeatureByPage = { product: 1, 'my-products': 1, affiliates: 1, promotion: 2, integrations: 2, assistant: 2 };
  const requiredFeature = minimumFeatureByPage[page];
  if (requiredFeature !== undefined && !billingState.plan.isOwner
    && (!billingLoaded || billingState.plan.featureLevel < requiredFeature)) {
    page = 'plans';
    document.querySelector('#billing-notice').textContent = `Esse painel está disponível em um plano superior. Confira as opções para desbloqueá-lo.`;
  }
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
  const currentPageLabel = document.querySelector(`.mobile-nav-item[data-page="${page}"]`)?.textContent.trim();
  document.querySelectorAll('.menu-current').forEach((label) => {
    label.textContent = currentPageLabel || 'Painéis';
  });
  document.querySelectorAll('.mobile-panel-menu').forEach((menu) => { menu.open = false; });
  if (page === 'campaigns') renderCampaigns();
  if (page === 'my-products') renderProductLibrary();
  if (page === 'affiliates') {
    renderAffiliateProducts();
    renderAffiliateIdeas();
  }
  if (page === 'promotion') {
    renderPromotionProducts();
    renderPromotionPlans();
    renderAdBudgets();
  }
  if (page === 'dashboard') {
    renderOverview();
    if (financeAuthenticated) refreshProviderBalances().catch((error) => {
      document.querySelector('#overview-platform-balance-status').textContent = error.message || 'Não foi possível atualizar os saldos.';
    });
  }
  if (page === 'finance') {
    renderFinance();
    if (financeAuthenticated) refreshProviderBalances().catch((error) => {
      document.querySelector('#live-balance-status').textContent = error.message || 'Não foi possível atualizar os saldos.';
    });
    if (financeAuthenticated) refreshPlatformSales();
    else showFinanceSession().catch((error) => {
      document.querySelector('#finance-login-status').textContent = error.message || 'Não foi possível verificar a sessão.';
    });
  }
  if (page === 'integrations') renderIntegrations();
  if (page === 'plans') {
    renderBillingStatus();
    refreshBillingStatus().catch((error) => {
      document.querySelector('#billing-subscription-status').textContent = error.message || 'Não foi possível consultar seu plano.';
    });
    if (activeAccount?.role === 'owner') loadCoupons().catch((error) => {
      document.querySelector('#coupon-admin-status').textContent = error.message || 'Não foi possível carregar os cupons.';
    });
  }
}

document.querySelectorAll('[data-page]').forEach((button) => {
  button.addEventListener('click', () => switchPage(button.dataset.page));
});

document.querySelector('#close-gift-checkout').addEventListener('click', () => {
  document.querySelector('#gift-checkout-dialog').close();
  selectedGiftPlanId = null;
});

document.querySelector('#paid-gift-checkout-form').addEventListener('submit', beginGiftCheckout);

document.querySelector('#sales-mailbox-button').addEventListener('click', openSalesMailbox);
document.querySelector('#gift-mailbox-button').addEventListener('click', openGiftMailbox);
document.querySelector('#close-sales-mailbox').addEventListener('click', () => document.querySelector('#sales-mailbox-dialog').close());
document.querySelector('#close-gift-mailbox').addEventListener('click', () => document.querySelector('#gift-mailbox-dialog').close());

document.querySelector('#mark-sales-read').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await fetch('/api/notifications/sales', { method: 'PATCH' });
    const result = await response.json();
    if (!response.ok || result.read !== true) throw new Error(result.error || 'Não foi possível marcar as notificações como lidas.');
    const readAt = new Date().toISOString();
    salesNotifications = salesNotifications.map((item) => ({ ...item, readAt: item.readAt || readAt }));
    renderSalesNotifications();
  } catch (error) {
    document.querySelector('#sales-mailbox-status').textContent = error.message || 'Não foi possível marcar as notificações como lidas.';
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#gift-send-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.querySelector('#send-gift-button');
  const status = document.querySelector('#gift-send-status');
  const duration = document.querySelector('#gift-duration').value;
  button.disabled = true;
  status.textContent = 'Enviando presente...';
  try {
    const response = await fetch('/api/gifts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: document.querySelector('#gift-recipient-email').value,
        title: document.querySelector('#gift-title').value,
        message: document.querySelector('#gift-message').value,
        planId: document.querySelector('#gift-plan').value,
        isPermanent: duration === 'permanent',
        ...(duration === 'permanent' ? {} : { durationDays: Number(duration) }),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível enviar o presente.');
    if (!activeAccount || activeAccount.role !== 'owner') return;
    form.reset();
    await refreshGiftMailbox();
    status.textContent = `Presente ${result.gift.planName} enviado para ${result.gift.recipientEmail}.`;
  } catch (error) {
    status.textContent = error.message || 'Não foi possível enviar o presente.';
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#billing-plan-grid').addEventListener('click', (event) => {
  const giftButton = event.target.closest('[data-gift-plan]');
  if (giftButton) {
    openGiftCheckout(giftButton.dataset.giftPlan);
    return;
  }
  const button = event.target.closest('[data-billing-plan]');
  if (button && !button.disabled) beginPlanCheckout(button.dataset.billingPlan);
});
document.querySelector('#billing-cancel').addEventListener('click', cancelPlanSubscription);

document.querySelector('#coupon-redemption-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.querySelector('#redeem-coupon-button');
  const status = document.querySelector('#coupon-redemption-status');
  button.disabled = true;
  status.textContent = 'Validando o cupom...';
  try {
    const response = await fetch('/api/billing/redeem-coupon', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: document.querySelector('#coupon-redemption-code').value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível resgatar o cupom.');
    await refreshBillingStatus();
    document.querySelector('#coupon-redemption-code').value = '';
    if (result.permanent) {
      status.textContent = 'Cupom aplicado! Seu Premium foi ativado permanentemente, sem cobrança.';
    } else {
      const expiresAt = new Date(result.accessUntil);
      status.textContent = `Cupom aplicado! Seu Premium fica ativo até ${expiresAt.toLocaleDateString('pt-BR')}.`;
    }
  } catch (error) {
    status.textContent = error.message || 'Não foi possível resgatar o cupom.';
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#coupon-create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.querySelector('#create-coupon-button');
  const status = document.querySelector('#coupon-admin-status');
  button.disabled = true;
  status.textContent = 'Criando o cupom...';
  try {
    const response = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: document.querySelector('#coupon-custom-code').value,
        accessType: document.querySelector('#coupon-access-type').value,
        maxUses: Number(document.querySelector('#coupon-max-uses').value),
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.coupon) throw new Error(result.error || 'Não foi possível criar o cupom.');
    await loadCoupons();
    document.querySelector('#coupon-custom-code').value = '';
    const duration = result.coupon.accessType === 'permanent' ? 'Premium permanente' : 'Premium grátis por 1 mês';
    status.textContent = `Cupom ${result.coupon.code} criado para ${duration}. Compartilhe com até ${result.coupon.maxUses} pessoas.`;
  } catch (error) {
    status.textContent = error.message || 'Não foi possível criar o cupom.';
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#coupon-list').addEventListener('click', async (event) => {
  const copyButton = event.target.closest('[data-coupon-copy]');
  const toggleButton = event.target.closest('[data-coupon-toggle]');
  const status = document.querySelector('#coupon-admin-status');
  if (copyButton) {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.couponCopy);
      status.textContent = `Código ${copyButton.dataset.couponCopy} copiado.`;
    } catch (error) {
      status.textContent = 'Não foi possível copiar automaticamente. Selecione o código na lista e copie manualmente.';
    }
    return;
  }
  if (!toggleButton || toggleButton.disabled) return;
  toggleButton.disabled = true;
  try {
    const response = await fetch(`/api/admin/coupons/${toggleButton.dataset.couponToggle}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: toggleButton.dataset.couponActive !== 'true' }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar o cupom.');
    await loadCoupons();
    status.textContent = result.active ? 'Cupom ativado.' : 'Cupom desativado.';
  } catch (error) {
    status.textContent = error.message || 'Não foi possível atualizar o cupom.';
    toggleButton.disabled = false;
  }
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
      writeLocal(affiliateIdeasKey, affiliateBatches);
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
    const registerSaleIcon = document.createElement('span');
    registerSaleIcon.className = 'button-plus';
    registerSaleIcon.setAttribute('aria-hidden', 'true');
    registerSaleIcon.textContent = '+';
    registerSale.append(registerSaleIcon, document.createTextNode(' Registrar venda'));
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
      writeLocal(affiliateProductsKey, affiliateProducts);
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
  writeLocal(affiliateProductsKey, affiliateProducts);
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
  writeLocal(affiliateProductsKey, affiliateProducts);
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
      writeLocal(promotionPlansKey, promotionPlans);
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
      writeLocal(adBudgetsKey, adBudgets);
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
  writeLocal(adBudgetsKey, adBudgets);
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
    writeLocal(promotionPlansKey, promotionPlans);
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
  status.textContent = 'Dinvaro IA está analisando o nicho...';
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
    writeLocal(affiliateIdeasKey, affiliateBatches);
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
  const previousId = profile.id;
  profile = { ...Object.fromEntries(new FormData(productForm).entries()), ...(previousId ? { id: previousId } : {}) };
  try {
    profile.id = syncProductLibraryProfile(profile);
    writeLocal(productKey, profile);
  } catch (error) {
    document.querySelector('#product-status').textContent = 'Não foi possível salvar o produto neste navegador. Verifique o espaço disponível.';
    return profile;
  }
  document.querySelector('#product-status').textContent = 'Perfil salvo neste navegador.';
  renderOverview();
  return profile;
}

productForm.addEventListener('submit', (event) => saveProfile(event));

function persistProductLibrary(statusMessage = 'Produto salvo na biblioteca.') {
  try {
    writeLocal(productLibraryKey, productLibrary);
    if (generatedProduct) {
      const currentProduct = productLibrary.find((item) => item.id === generatedProduct.id);
      if (currentProduct) {
        generatedProduct = currentProduct;
        writeLocal(generatedProductKey, generatedProduct.id);
        renderGeneratedProduct(generatedProduct);
      }
    }
    renderProductLibrary();
    document.querySelector('#product-library-status').textContent = statusMessage;
    return true;
  } catch (error) {
    document.querySelector('#product-library-status').textContent = 'Não foi possível salvar a alteração neste navegador. Remova alguns dados locais e tente novamente.';
    return false;
  }
}

function syncProductLibraryProfile(savedProfile) {
  const matchedGenerated = generatedProduct?.name === savedProfile.name ? generatedProduct : null;
  const productId = savedProfile.id || matchedGenerated?.id || crypto.randomUUID();
  const existing = productLibrary.find((item) => item.id === productId);
  const item = {
    ...existing,
    ...savedProfile,
    id: productId,
    content: existing?.content || matchedGenerated?.content || savedProfile.description || '',
    format: existing?.format || matchedGenerated?.format || 'offer',
    cover: existing?.cover || null,
    destinations: existing?.destinations || [],
    createdAt: existing?.createdAt || matchedGenerated?.createdAt || new Date().toISOString(),
  };
  productLibrary = existing
    ? productLibrary.map((product) => product.id === productId ? item : product)
    : [item, ...productLibrary];
  if (!persistProductLibrary()) throw new Error('Falha ao salvar biblioteca');
  return productId;
}

function renderProductLibrary() {
  const grid = document.querySelector('#product-library-grid');
  if (!grid) return;
  grid.replaceChildren();
  const empty = document.querySelector('#empty-product-library');
  empty.hidden = productLibrary.length > 0;
  productLibrary.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'product-library-card';
    card.dataset.productId = product.id;

    const cover = document.createElement('div');
    cover.className = 'product-library-cover';
    if (typeof product.cover === 'string') {
      const image = document.createElement('img');
      image.src = product.cover;
      image.alt = `Capa de ${product.name || 'produto'}`;
      cover.append(image);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'product-cover-placeholder';
      placeholder.textContent = '◈';
      cover.append(placeholder);
    }
    const coverLabel = document.createElement('label');
    coverLabel.className = 'product-cover-control';
    coverLabel.textContent = product.cover ? 'Trocar capa' : 'Adicionar capa';
    const coverInput = document.createElement('input');
    coverInput.type = 'file';
    coverInput.accept = 'image/jpeg,image/png,image/webp';
    coverInput.dataset.productCover = product.id;
    coverLabel.append(coverInput);
    cover.append(coverLabel);

    const content = document.createElement('div');
    content.className = 'product-library-content';
    const heading = document.createElement('div');
    heading.className = 'product-library-heading';
    const title = document.createElement('h2');
    title.textContent = product.name || 'Produto sem nome';
    const created = document.createElement('span');
    const createdDate = Date.parse(product.createdAt || '');
    created.textContent = Number.isFinite(createdDate) ? new Date(createdDate).toLocaleDateString('pt-BR') : 'Produto salvo';
    heading.append(title, created);
    const format = document.createElement('span');
    format.className = 'product-library-format';
    format.textContent = product.format || 'Oferta';
    const description = document.createElement('p');
    description.className = 'product-library-description';
    description.textContent = product.description || product.audience || 'Conteúdo do produto disponível nos detalhes.';
    content.append(heading, format, description);
    if (product.suggestedPrice || product.price) {
      const price = document.createElement('p');
      price.className = 'product-library-price';
      price.textContent = product.price || `Preço sugerido: ${product.suggestedPrice}`;
      content.append(price);
    }

    const destinations = document.createElement('fieldset');
    destinations.className = 'product-destinations';
    const legend = document.createElement('legend');
    legend.textContent = 'Onde publicar';
    destinations.append(legend);
    for (const groupName of ['Redes sociais', 'Plataformas de venda']) {
      const group = document.createElement('div');
      group.className = 'product-destination-group';
      const groupTitle = document.createElement('span');
      groupTitle.className = 'product-destination-group-title';
      groupTitle.textContent = groupName;
      group.append(groupTitle);
      productDestinations.filter((destination) => destination.group === groupName).forEach((destination) => {
        const label = document.createElement('label');
        label.className = 'product-destination-option';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = destination.id;
        input.dataset.productDestination = product.id;
        input.checked = Array.isArray(product.destinations) && product.destinations.includes(destination.id);
        const name = document.createElement('span');
        name.textContent = destination.name;
        label.append(input, name);
        group.append(label);
      });
      destinations.append(group);
    }
    const publishingNotice = document.createElement('p');
    publishingNotice.className = 'product-publishing-notice';
    const selectedDestinations = Array.isArray(product.destinations) ? product.destinations : [];
    publishingNotice.textContent = selectedDestinations.length
      ? 'Destinos salvos. A publicação automática ficará disponível quando as integrações oficiais forem conectadas.'
      : 'Escolha um ou mais destinos. Nenhuma publicação será feita sem integração e autorização.';
    destinations.append(publishingNotice);

    const details = document.createElement('details');
    details.className = 'product-library-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Ver conteúdo do produto';
    const productText = document.createElement('pre');
    productText.textContent = product.content || product.description || 'Sem conteúdo detalhado salvo.';
    details.append(summary, productText);

    const actions = document.createElement('div');
    actions.className = 'product-library-actions';
    const integrationsButton = document.createElement('button');
    integrationsButton.type = 'button';
    integrationsButton.className = 'billing-plan-action';
    integrationsButton.dataset.page = 'integrations';
    integrationsButton.textContent = 'Configurar integrações';
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'text-action';
    copyButton.dataset.copyProduct = product.id;
    copyButton.textContent = 'Copiar conteúdo';
    actions.append(integrationsButton, copyButton);

    const status = document.createElement('p');
    status.className = 'generation-status product-library-card-status';
    status.dataset.productStatus = product.id;
    status.setAttribute('role', 'status');
    status.textContent = 'Alterações da capa e dos destinos são salvas neste navegador.';
    content.append(destinations, details, actions, status);
    card.append(cover, content);
    grid.append(card);
  });
}

document.querySelector('#product-library-grid').addEventListener('change', async (event) => {
  const coverInput = event.target.closest('[data-product-cover]');
  const destinationInput = event.target.closest('[data-product-destination]');
  if (coverInput) {
    const file = coverInput.files[0];
    if (!file) return;
    const productId = coverInput.dataset.productCover;
    const status = document.querySelector(`[data-product-status="${productId}"]`);
    try {
      const cover = await compressProfileImage(file);
      const product = productLibrary.find((item) => item.id === productId);
      if (!product) throw new Error('Não foi possível localizar o produto selecionado.');
      product.cover = cover;
      persistProductLibrary('Capa atualizada. A publicação nas plataformas ainda exige integração oficial.');
    } catch (error) {
      if (status) status.textContent = error.message || 'Não foi possível atualizar a capa.';
    } finally {
      coverInput.value = '';
    }
    return;
  }
  if (destinationInput) {
    const product = productLibrary.find((item) => item.id === destinationInput.dataset.productDestination);
    if (!product) return;
    const selected = new Set(Array.isArray(product.destinations) ? product.destinations : []);
    if (destinationInput.checked) selected.add(destinationInput.value);
    else selected.delete(destinationInput.value);
    product.destinations = [...selected];
    persistProductLibrary('Destinos atualizados. A publicação automática exige as integrações oficiais.');
  }
});

document.querySelector('#product-library-grid').addEventListener('click', async (event) => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) {
    switchPage(pageButton.dataset.page);
    return;
  }
  const copyButton = event.target.closest('[data-copy-product]');
  if (!copyButton) return;
  const product = productLibrary.find((item) => item.id === copyButton.dataset.copyProduct);
  if (!product) return;
  try {
    await navigator.clipboard.writeText(product.content || product.description || '');
    copyButton.textContent = 'Copiado';
    window.setTimeout(() => { copyButton.textContent = 'Copiar conteúdo'; }, 1400);
  } catch (error) {
    document.querySelector(`[data-product-status="${product.id}"]`).textContent = 'Não foi possível copiar o conteúdo neste navegador.';
  }
});

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
  status.textContent = 'Dinvaro IA está criando a estrutura e o conteúdo...';

  try {
    const response = await fetch('/api/product/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(productGenerationForm).entries())),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível gerar o produto.');

    generatedProduct = {
      ...result.product,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      cover: null,
      destinations: [],
      format: productGenerationForm.elements.format.value,
    };
    productLibrary = [generatedProduct, ...productLibrary];
    const savedToLibrary = persistProductLibrary('Produto criado e adicionado à sua biblioteca.');
    renderGeneratedProduct(generatedProduct);
    status.textContent = savedToLibrary
      ? 'Produto criado e adicionado a Meus produtos. Revise o conteúdo.'
      : 'Produto criado, mas não foi possível salvar a biblioteca neste navegador. Libere espaço e tente salvar novamente.';
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
  profile = { ...profile, id: generatedProduct.id };
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
  const aggregateBalance = getAggregateProviderBalance();
  document.querySelector('#metric-free-profit').textContent = brlFormatter.format(aggregateBalance?.availableCents ?? financials.available * 100);
  document.querySelector('#summary-profit-label').textContent = aggregateBalance
    ? (aggregateBalance.partial ? 'SUBTOTAL DAS PLATAFORMAS' : 'SALDO SOMADO NAS PLATAFORMAS')
    : 'LUCRO LIVRE ESTIMADO';
  renderOverviewProviderBalance(aggregateBalance);
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

function calculateFinance(platform = activeFinancePlatform) {
  const manualEntries = moneyEntries.filter((entry) => platform === 'all' || entry.platform === platform);
  const sumType = (type) => manualEntries
    .filter((entry) => entry.type === type && Number.isFinite(entry.amount))
    .reduce((total, entry) => total + entry.amount, 0);
  const platformSalesInBrl = platformSales.filter((sale) => sale.currency === 'BRL'
    && (platform === 'all' || sale.provider === platform));
  const automaticSales = platformSalesInBrl
    .filter((sale) => ['paid', 'refunded', 'chargedback'].includes(sale.status))
    .reduce((total, sale) => total + sale.amountCents / 100, 0);
  const automaticReversals = platformSalesInBrl
    .filter((sale) => sale.status === 'refunded' || sale.status === 'chargedback')
    .reduce((total, sale) => total + sale.amountCents / 100, 0);
  const sales = sumType('sale') + automaticSales;
  const deposits = sumType('deposit');
  const costs = sumType('ad') + sumType('fee') + sumType('refund') + automaticReversals;
  const withdrawals = sumType('withdrawal');
  const net = sales - costs;
  const loss = Math.max(0, costs - sales);
  return { sales, deposits, costs, withdrawals, net, loss, available: Math.max(0, net - withdrawals) };
}

function renderFinance() {
  const financials = calculateFinance();
  const aggregateBalance = getAggregateProviderBalance();
  const platform = integrations.find((item) => item.id === activeFinancePlatform);
  const platformName = platform?.name || 'Todas as plataformas';
  document.querySelectorAll('[data-finance-platform]').forEach((tab) => {
    const selected = tab.dataset.financePlatform === activeFinancePlatform;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.classList.toggle('active', selected);
  });
  const summaryPanel = document.querySelector('#finance-platform-panel');
  summaryPanel.setAttribute('aria-labelledby', `finance-platform-tab-${activeFinancePlatform}`);
  const platformContext = document.querySelector('#finance-platform-context');
  if (activeFinancePlatform === 'all') {
    platformContext.textContent = 'Visão consolidada. Vendas automáticas de Kiwify e Cakto; demais valores dependem de registros manuais.';
  } else if (['kiwify', 'cakto'].includes(activeFinancePlatform)) {
    platformContext.textContent = `Vendas recebidas por webhook da ${platformName} e lançamentos manuais atribuídos a esta plataforma. O saldo oficial fica nos cards acima.`;
  } else {
    platformContext.textContent = `Sem integração automática de vendas para ${platformName}. O lucro mostra somente movimentações manuais atribuídas a esta plataforma.`;
  }
  document.querySelector('#finance-profit-label').textContent = activeFinancePlatform === 'all'
    ? 'LUCRO LIVRE ESTIMADO'
    : `LUCRO ESTIMADO · ${platformName.toUpperCase()}`;
  document.querySelector('#finance-available').textContent = brlFormatter.format(financials.available);
  document.querySelector('#finance-sales').textContent = brlFormatter.format(financials.sales);
  document.querySelector('#finance-deposits').textContent = brlFormatter.format(financials.deposits);
  document.querySelector('#finance-costs').textContent = brlFormatter.format(financials.costs);
  document.querySelector('#finance-withdrawals').textContent = brlFormatter.format(financials.withdrawals);
  document.querySelector('#metric-free-profit').textContent = brlFormatter.format(aggregateBalance?.availableCents ?? financials.available * 100);
  document.querySelector('#metric-estimated-loss').textContent = brlFormatter.format(financials.loss);
  document.querySelector('#overview-loss-card').hidden = financials.loss <= 0;
  document.querySelector('#finance-loss').textContent = brlFormatter.format(financials.loss);
  document.querySelector('#finance-loss-card').hidden = financials.loss <= 0;
  document.querySelector('#summary-profit-label').textContent = aggregateBalance
    ? (aggregateBalance.partial ? 'SUBTOTAL DAS PLATAFORMAS' : 'SALDO SOMADO NAS PLATAFORMAS')
    : 'LUCRO LIVRE ESTIMADO';
  renderOverviewProviderBalance(aggregateBalance);

  const list = document.querySelector('#money-entry-list');
  list.replaceChildren();
  const labels = { sale: 'Venda aprovada', deposit: 'Depósito registrado', ad: 'Gasto com anúncios', fee: 'Taxa da plataforma', refund: 'Reembolso', withdrawal: 'Saque já realizado' };
  const providerNames = { kiwify: 'Kiwify', cakto: 'Cakto' };
  const movementRows = [
    ...moneyEntries
      .filter((entry) => activeFinancePlatform === 'all' || entry.platform === activeFinancePlatform)
      .map((entry) => ({
      id: entry.id,
      type: entry.type,
      amount: entry.amount,
      currency: 'BRL',
      date: entry.date,
      title: entry.note || labels[entry.type] || 'Movimentação',
      metadata: `${labels[entry.type] || 'Movimentação'} · ${entry.platform ? integrations.find((item) => item.id === entry.platform)?.name || entry.platform : 'Sem plataforma'} · ${entry.date || ''}`,
      manual: true,
    })),
    ...platformSales
      .filter((sale) => activeFinancePlatform === 'all' || sale.provider === activeFinancePlatform)
      .map((sale) => {
      const reversed = sale.status === 'refunded' || sale.status === 'chargedback';
      const providerName = providerNames[sale.provider] || sale.provider;
      const date = new Date(sale.occurredAt);
      const formattedDate = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
      const statusLabel = sale.status === 'paid' ? 'Venda aprovada' : sale.status === 'refunded' ? 'Reembolso' : 'Chargeback';
      return {
        id: `${sale.provider}:${sale.saleId}`,
        type: reversed ? 'refund' : 'sale',
        amount: sale.amountCents / 100,
        currency: sale.currency,
        date: sale.occurredAt,
        title: sale.productName || `Venda ${providerName}`,
        metadata: `${statusLabel} · ${providerName} · ${formattedDate}`,
        manual: false,
      };
    }),
  ];
  movementRows.sort((first, second) => String(second.date).localeCompare(String(first.date))).forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'money-entry-row';
    const detail = document.createElement('div');
    detail.className = 'money-entry-detail';
    const label = document.createElement('strong');
    label.textContent = entry.title;
    const metadata = document.createElement('span');
    metadata.textContent = entry.metadata;
    detail.append(label, metadata);
    const amount = document.createElement('strong');
    const positive = ['sale', 'deposit'].includes(entry.type);
    amount.className = `money-entry-amount ${positive ? 'positive' : ''}`;
    const formattedAmount = entry.currency === 'BRL'
      ? brlFormatter.format(entry.amount)
      : `${entry.currency} ${entry.amount.toFixed(2)}`;
    amount.textContent = `${positive ? '+' : '−'} ${formattedAmount}`;
    row.append(detail, amount);
    if (entry.manual) {
      const remove = document.createElement('button');
      remove.className = 'remove-transaction';
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remover ${labels[entry.type] || 'movimentação'}`);
      remove.addEventListener('click', () => {
        moneyEntries = moneyEntries.filter((item) => item.id !== entry.id);
        saveMoneyEntries();
      });
      row.append(remove);
    }
    list.append(row);
  });
  list.hidden = movementRows.length === 0;
  const emptyState = document.querySelector('#empty-money-entries');
  emptyState.hidden = movementRows.length > 0;
  emptyState.querySelector('span:not(.empty-mark)').textContent = activeFinancePlatform === 'all'
    ? 'As movimentações das plataformas aparecerão aqui.'
    : `Ainda não há movimentações atribuídas a ${platformName}.`;
  document.querySelector('#money-entry-count').textContent = `${movementRows.length} ${movementRows.length === 1 ? 'registro' : 'registros'}`;
}

document.querySelectorAll('[data-finance-platform]').forEach((tab) => {
  tab.addEventListener('click', () => {
    activeFinancePlatform = tab.dataset.financePlatform;
    renderFinance();
  });
  tab.addEventListener('keydown', (event) => {
    const tabs = [...document.querySelectorAll('[data-finance-platform]')];
    const currentIndex = tabs.indexOf(tab);
    const nextIndex = event.key === 'ArrowRight'
      ? (currentIndex + 1) % tabs.length
      : event.key === 'ArrowLeft'
        ? (currentIndex - 1 + tabs.length) % tabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End' ? tabs.length - 1 : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    activeFinancePlatform = tabs[nextIndex].dataset.financePlatform;
    renderFinance();
    tabs[nextIndex].focus();
  });
});

function centsToMoney(cents) {
  return brlFormatter.format(cents / 100);
}

function getAggregateProviderBalance() {
  const successfulBalances = configuredFinanceProviders
    .map((provider) => providerBalances.get(provider.id)?.balance)
    .filter(Boolean);
  if (!successfulBalances.length) return null;
  return {
    availableCents: successfulBalances.reduce((total, balance) => total + balance.availableCents, 0),
    configuredCount: configuredFinanceProviders.length,
    successfulCount: successfulBalances.length,
    partial: successfulBalances.length < configuredFinanceProviders.length,
  };
}

function renderOverviewProviderBalance(aggregateBalance) {
  const amount = document.querySelector('#overview-platform-balance');
  const label = document.querySelector('#overview-platform-balance-label');
  const status = document.querySelector('#overview-platform-balance-status');
  if (!amount || !label || !status) return;
  if (!financeAuthenticated) {
    amount.textContent = '--';
    label.textContent = 'SALDO NAS PLATAFORMAS';
    status.textContent = 'Acesse Ganhos para consultar as contas conectadas.';
    return;
  }
  if (!aggregateBalance) {
    amount.textContent = '--';
    label.textContent = 'SALDO NAS PLATAFORMAS';
    status.textContent = configuredFinanceProviders.length
      ? 'Atualize os saldos das plataformas para consultar o total.'
      : 'Configure Kiwify ou Cakto no servidor para consultar os saldos.';
    return;
  }
  amount.textContent = centsToMoney(aggregateBalance.availableCents);
  label.textContent = aggregateBalance.partial ? 'SUBTOTAL DISPONÍVEL · PARCIAL' : 'SALDO SOMADO NAS PLATAFORMAS';
  status.textContent = aggregateBalance.partial
    ? `${aggregateBalance.successfulCount} de ${aggregateBalance.configuredCount} contas consultadas. Confira os detalhes em Ganhos.`
    : `${aggregateBalance.successfulCount} ${aggregateBalance.successfulCount === 1 ? 'conta consultada' : 'contas consultadas'}. Valores permanecem em cada plataforma.`;
}

async function showFinanceSession() {
  const response = await fetch('/api/finance/session');
  const result = await response.json();
  const isOwner = result.account?.role === 'owner';
  financeAuthenticated = response.ok && result.authenticated === true && isOwner;
  document.querySelector('#finance-login-panel').hidden = !isOwner || financeAuthenticated;
  document.querySelector('#finance-connected-panel').hidden = !financeAuthenticated;
  if (!financeAuthenticated) return;

  const providersResponse = await fetch('/api/finance/providers');
  const providersResult = await providersResponse.json();
  if (!providersResponse.ok) throw new Error(providersResult.error || 'Não foi possível carregar as contas.');
  configuredFinanceProviders = providersResult.providers.filter((provider) => provider.configured);
  await refreshPlatformSales();
  if (!configuredFinanceProviders.length) {
    document.querySelector('#live-balance-status').textContent = 'Adicione as credenciais Kiwify ou Cakto no .env e reinicie o servidor.';
    document.querySelector('#live-aggregate-available').textContent = '--';
    renderProviderBalanceCards();
    renderOverviewProviderBalance(null);
    return;
  }
  await refreshProviderBalances();
}

async function refreshPlatformSales() {
  const status = document.querySelector('#platform-sales-status');
  status.textContent = 'Atualizando vendas automáticas...';
  try {
    const response = await fetch('/api/finance/sales');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível carregar as vendas das plataformas.');
    platformSales = Array.isArray(result.sales) ? result.sales : [];
    status.textContent = platformSales.length
      ? `${platformSales.length} venda(s) sincronizada(s) automaticamente; atualização a cada 30 segundos.`
      : 'Nenhuma venda recebida ainda. Configure os webhooks Kiwify/Cakto no servidor.';
    renderFinance();
  } catch (error) {
    status.textContent = error.message || 'Não foi possível carregar as vendas das plataformas.';
  }
}

window.setInterval(() => {
  const financePage = document.querySelector('[data-workspace-page="finance"]');
  if (financeAuthenticated && financePage && !financePage.hidden) refreshPlatformSales();
}, 30_000);

window.setInterval(() => {
  if (!appAuthenticated || !activeAccountId) return;
  refreshGiftMailbox().catch((error) => {
    if (document.querySelector('#gift-mailbox-dialog').open) {
      document.querySelector('#gift-recipient-status').textContent = error.message || 'Não foi possível atualizar o correio de presentes.';
    }
  });
  if (activeAccount?.role === 'owner') {
    refreshSalesNotifications().catch((error) => {
      if (document.querySelector('#sales-mailbox-dialog').open) {
        document.querySelector('#sales-mailbox-status').textContent = error.message || 'Não foi possível atualizar as notificações de vendas.';
      }
    });
  }
}, 30_000);

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

function renderProviderBalanceCards() {
  const list = document.querySelector('#provider-balance-list');
  list.replaceChildren();
  configuredFinanceProviders.forEach((provider) => {
    const result = providerBalances.get(provider.id);
    const card = document.createElement('article');
    card.className = `provider-balance-card provider-${provider.id}`;
    const heading = document.createElement('div');
    heading.className = 'provider-balance-heading';
    const identity = document.createElement('div');
    identity.className = 'provider-balance-identity';
    const mark = document.createElement('span');
    mark.className = 'provider-brand-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = provider.id === 'kiwify' ? 'K' : 'c';
    const name = document.createElement('strong');
    name.textContent = provider.name;
    identity.append(mark, name);
    const badge = document.createElement('span');
    badge.className = `provider-balance-badge${result?.error ? ' is-error' : ''}`;
    badge.textContent = result?.error ? 'Indisponível' : result ? 'Conectada' : 'Consultando';
    heading.append(identity, badge);
    card.append(heading);
    if (!result) {
      const state = document.createElement('p');
      state.className = 'generation-status';
      state.textContent = 'Saldo ainda não consultado.';
      card.append(state);
    } else if (result.error) {
      const state = document.createElement('p');
      state.className = 'generation-status provider-balance-error';
      state.textContent = `Falha ao consultar: ${result.error}`;
      card.append(state);
    } else {
      const values = document.createElement('div');
      values.className = 'provider-balance-values';
      const available = document.createElement('div');
      available.className = 'provider-balance-available';
      const availableSummary = document.createElement('div');
      const availableLabel = document.createElement('span');
      availableLabel.textContent = 'Disponível para saque';
      const availableValue = document.createElement('strong');
      availableValue.textContent = centsToMoney(result.balance.availableCents);
      availableSummary.append(availableLabel, availableValue);
      const updatedAt = document.createElement('span');
      updatedAt.className = 'provider-balance-updated';
      const observedAt = Date.parse(result.balance.observedAt);
      updatedAt.textContent = Number.isFinite(observedAt)
        ? `Atualizado às ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(observedAt)}`
        : 'Saldo consultado agora';
      available.append(availableSummary, updatedAt);
      const pending = document.createElement('div');
      const pendingLabel = document.createElement('span');
      pendingLabel.textContent = 'Em processamento';
      const pendingValue = document.createElement('strong');
      pendingValue.textContent = result.balance.pendingCents === null
        ? 'Não informado'
        : centsToMoney(result.balance.pendingCents);
      pending.append(pendingLabel, pendingValue);
      values.append(available, pending);
      [
        ['Reservado', result.balance.reservedCents],
        ['Bloqueado para reembolsos', result.balance.refundBlockedCents],
      ].forEach(([label, amount]) => {
        if (amount === null) return;
        const row = document.createElement('div');
        const rowLabel = document.createElement('span');
        rowLabel.textContent = label;
        const rowValue = document.createElement('strong');
        rowValue.textContent = centsToMoney(amount);
        row.append(rowLabel, rowValue);
        values.append(row);
      });
      card.append(values);

      const canWithdraw = result.balance.availableCents > 0
        && (provider.id !== 'cakto' || result.balance.availableCents >= 1_000);
      const withdraw = document.createElement('button');
      withdraw.className = 'save-transaction provider-withdraw-button';
      withdraw.type = 'button';
      withdraw.textContent = provider.id === 'cakto' && !canWithdraw
        ? 'Mínimo para saque: R$ 10,00'
        : `Solicitar saque pela ${provider.name}`;
      withdraw.disabled = !canWithdraw;
      withdraw.addEventListener('click', () => openSecureWithdrawal(provider.id));
      card.append(withdraw);
    }
    list.append(card);
  });
}

async function refreshProviderBalances() {
  if (!financeAuthenticated) return;
  const button = document.querySelector('#refresh-provider-balance');
  const status = document.querySelector('#live-balance-status');
  button.disabled = true;
  status.textContent = 'Consultando saldos oficiais das contas conectadas...';
  liveBalance = null;
  liveBalanceProvider = null;
  try {
    const results = await Promise.all(configuredFinanceProviders.map(async (provider) => {
      try {
        const response = await fetch(`/api/finance/balance?provider=${encodeURIComponent(provider.id)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Não foi possível consultar ${provider.name}.`);
        return [provider.id, { balance: result }];
      } catch (error) {
        return [provider.id, { error: error.message || `Não foi possível consultar ${provider.name}.` }];
      }
    }));
    providerBalances = new Map(results);
    renderProviderBalanceCards();
    const aggregateBalance = getAggregateProviderBalance();
    document.querySelector('#live-aggregate-available').textContent = aggregateBalance
      ? centsToMoney(aggregateBalance.availableCents)
      : '--';
    document.querySelector('#live-aggregate-label').textContent = aggregateBalance?.partial
      ? 'Subtotal confirmado · consulta parcial'
      : 'Soma disponível';
    const successfulCount = aggregateBalance?.successfulCount || 0;
    if (successfulCount === 0) {
      status.textContent = 'Não foi possível consultar nenhuma conta. Confira a configuração e tente novamente.';
    } else if (aggregateBalance.partial) {
      status.textContent = `Subtotal parcial: ${successfulCount} de ${configuredFinanceProviders.length} contas consultadas. Confira o erro indicado em cada plataforma.`;
    } else {
      const updatedAt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
        .format(new Date());
      status.textContent = `${successfulCount} ${successfulCount === 1 ? 'conta consultada' : 'contas consultadas'} às ${updatedAt}.`;
    }
    renderOverviewProviderBalance(aggregateBalance);
  } catch (error) {
    status.textContent = error.message || 'Não foi possível atualizar os saldos das plataformas.';
    throw error;
  } finally {
    button.disabled = false;
    renderFinance();
  }
}

function openSecureWithdrawal(provider) {
  const result = providerBalances.get(provider);
  if (!result?.balance || result.balance.availableCents <= 0) return;
  liveBalance = result.balance;
  liveBalanceProvider = provider;
  const providerName = configuredFinanceProviders.find((item) => item.id === provider)?.name || provider;
  document.querySelector('#secure-withdrawal-title').textContent = `Saque pela ${providerName}`;
  document.querySelector('#secure-withdrawal-summary').textContent = `Saldo disponível consultado agora: ${centsToMoney(liveBalance.availableCents)}. A plataforma valida o valor novamente antes de aceitar o pedido.`;
  document.querySelector('#secure-withdrawal-pix-notice').textContent = `Antes de sacar, confira se sua chave Pix está cadastrada na conta da ${providerName}. O Dinvaro IA não recebe nem salva sua chave; a plataforma usa os dados de recebimento registrados na própria conta.`;
  const pixLink = document.querySelector('#secure-withdrawal-pix-link');
  pixLink.href = provider === 'kiwify' ? 'https://kiwify.com.br/' : 'https://cakto.com.br/';
  pixLink.textContent = `Abrir painel da ${providerName} ↗`;
  const amount = document.querySelector('#secure-withdrawal-amount');
  amount.value = (liveBalance.availableCents / 100).toFixed(2);
  amount.max = (liveBalance.availableCents / 100).toFixed(2);
  amount.min = provider === 'cakto' ? '10.00' : '0.01';
  document.querySelector('#payout-method-pix').checked = true;
  document.querySelector('#secure-withdrawal-pix-confirmed').value = '';
  document.querySelector('#secure-withdrawal-confirm').checked = false;
  document.querySelector('#secure-withdrawal-status').textContent = provider === 'cakto'
    ? 'A Cakto envia o pedido para análise e usa a chave Pix já cadastrada na sua conta.'
    : 'A Kiwify valida o saldo e usa os dados de recebimento cadastrados na sua conta.';
  secureWithdrawalDialog.showModal();
}

document.querySelector('#refresh-provider-balance').addEventListener('click', () => {
  refreshProviderBalances().catch((error) => {
    document.querySelector('#live-balance-status').textContent = error.message || 'Não foi possível atualizar os saldos.';
  });
});

document.querySelector('#close-secure-withdrawal').addEventListener('click', () => secureWithdrawalDialog.close());
secureWithdrawalDialog.addEventListener('click', (event) => {
  if (event.target === secureWithdrawalDialog) secureWithdrawalDialog.close();
});

secureWithdrawalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pixRegistered = document.querySelector('#secure-withdrawal-pix-confirmed').value === 'yes';
  const status = document.querySelector('#secure-withdrawal-status');
  const payoutMethod = secureWithdrawalForm.elements.payoutMethod.value;
  if (payoutMethod !== 'pix') {
    status.textContent = 'Selecione Pix como forma de recebimento.';
    return;
  }
  if (!pixRegistered) {
    status.textContent = 'Cadastre e confirme sua chave Pix diretamente no painel da plataforma. O Dinvaro IA não salva a chave.';
    return;
  }
  if (!liveBalance || !document.querySelector('#secure-withdrawal-confirm').checked) return;
  const provider = liveBalanceProvider;
  if (!provider) return;
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
  submitButton.disabled = true;
  status.textContent = 'Atualizando o saldo e enviando o pedido confirmado...';
  try {
    const response = await fetch('/api/finance/withdrawal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider,
        amountCents,
        idempotencyKey,
        payoutMethod,
        confirm: document.querySelector('#secure-withdrawal-confirm').checked,
        pixConfirmed: pixRegistered,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'A plataforma não aceitou o pedido.');
    sessionStorage.removeItem(idempotencyStorageKey);
    status.textContent = provider === 'cakto'
      ? `Pedido ${result.requestId} enviado; status inicial: ${result.status}. O saldo é atualizado abaixo.`
      : `Pedido ${result.requestId} enviado à Kiwify. Confirme o status no painel da plataforma.`;
    document.querySelector('#secure-withdrawal-confirm').checked = false;
    await refreshProviderBalances();
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
  writeLocal(moneyEntriesKey, moneyEntries);
  renderFinance();
}

function openMoneyEntryDialog(type = 'sale') {
  moneyEntryForm.reset();
  moneyEntryForm.elements.type.value = type;
  moneyEntryForm.elements.platform.value = activeFinancePlatform === 'all' ? '' : activeFinancePlatform;
  const now = new Date();
  moneyEntryForm.elements.date.value = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  moneyEntryDialog.showModal();
  moneyEntryForm.elements.amount.focus();
}

document.querySelector('#open-money-entry').addEventListener('click', openMoneyEntryDialog);
document.querySelector('#open-deposit').addEventListener('click', () => openMoneyEntryDialog('deposit'));
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
    platform: String(data.get('platform')),
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
      writeLocal(campaignsKey, campaigns);
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
  status.textContent = 'Dinvaro IA está preparando as peças...';

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
    writeLocal(campaignsKey, campaigns);
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
  const isFinancePageVisible = !document.querySelector('[data-workspace-page="finance"]').hidden;
  const isDashboardVisible = !document.querySelector('[data-workspace-page="dashboard"]').hidden;
  if (financeAuthenticated && (isFinancePageVisible || isDashboardVisible)) {
    refreshProviderBalances().catch((error) => {
      document.querySelector('#live-balance-status').textContent = error.message || 'Não foi possível atualizar os saldos.';
    });
  }
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
    name.textContent = 'Dinvaro IA';
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
  message.setAttribute('aria-label', 'Dinvaro IA está pensando');
  message.innerHTML = '<div class="message-avatar" aria-hidden="true">D</div><div class="message-body"><div class="message-name">Dinvaro IA</div><div class="typing" aria-hidden="true"><span></span><span></span><span></span></div></div>';
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
      body: JSON.stringify({ messages: history, product: profile }),
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
    document.querySelector('#connection-status').textContent = ready ? 'Motor local ativo' : 'Motor indisponível';
    document.querySelector('#connection-caption').textContent = ready ? 'Sem API externa' : 'Verifique o servidor';
    document.querySelector('.status-dot').classList.toggle('ready', ready);
  })
  .catch(() => {
    document.querySelector('#connection-status').textContent = 'Servidor indisponível';
    document.querySelector('#connection-caption').textContent = 'Tente recarregar a página';
  });

function initializeMascot() {
  const stage = document.querySelector('#mascot-stage');
  const firstMascot = document.querySelector('#app-mascot');
  const secondMascot = document.querySelector('#app-mascot-partner');
  const dashboardPage = document.querySelector('[data-workspace-page="dashboard"]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dialogue = document.querySelector('#mascot-dialog');
  const dialogueTitle = document.querySelector('#mascot-dialog-title');
  const dialogueLog = document.querySelector('#mascot-dialog-log');
  const dialogueChoices = document.querySelector('#mascot-dialog-choices');
  const closeDialogue = document.querySelector('#close-mascot-dialog');
  const profileCard = document.querySelector('#mascot-profile');
  const profileInitial = document.querySelector('#mascot-profile-initial');
  const profileRole = document.querySelector('#mascot-profile-role');
  const profileBio = document.querySelector('#mascot-profile-bio');
  const profileTags = document.querySelector('#mascot-profile-tags');
  const chatForm = document.querySelector('#mascot-chat-form');
  const chatInput = document.querySelector('#mascot-chat-input');
  const dialogueSteps = [
    {
      start: {
        question: 'Oi! Eu sou o Din. Posso ajudar você a deixar sua oferta mais clara e transformar isso numa campanha. Por onde começamos?',
        choices: [
          { label: 'Montar uma campanha', response: 'Vamos nessa. Você já cadastrou o produto que quer divulgar?', next: 'campaign' },
          { label: 'Revisar minha oferta', response: 'Claro. O que você quer explicar melhor para quem pode comprar?', next: 'product' },
          { label: 'Criar um produto', response: 'Posso ajudar a estruturar a ideia. Que tipo de produto você está imaginando?', page: 'product', pageLabel: 'Abrir Produto' },
        ],
      },
      campaign: {
        question: 'Você já cadastrou o produto no Dinvaro?',
        choices: [
          { label: 'Sim, já cadastrei', response: 'Ótimo. Use as informações reais da oferta como base e revise cada detalhe antes de publicar.', page: 'create', pageLabel: 'Abrir Criar campanha' },
          { label: 'Ainda não', response: 'Tranquilo. Vamos organizar primeiro o que você oferece, para quem e qual benefício entrega.', page: 'product', pageLabel: 'Abrir Produto' },
        ],
      },
      product: {
        question: 'Qual parte da oferta está mais difícil de explicar?',
        choices: [
          { label: 'O que a pessoa recebe', response: 'Tente descrever o conteúdo, formato ou acesso incluído. Detalhes concretos ajudam a criar uma expectativa justa.', page: 'product', pageLabel: 'Abrir Produto' },
          { label: 'O principal benefício', response: 'Explique o que o produto ajuda a pessoa a aprender ou fazer, sem prometer resultados que dependem de outros fatores.', page: 'product', pageLabel: 'Abrir Produto' },
        ],
      },
    },
    {
      start: {
        question: 'Oi! Eu sou a Var. Gosto de entender com quem você quer conversar e encontrar formas responsáveis de divulgar. O que está pensando?',
        choices: [
          { label: 'Entender meu público', response: 'Vamos começar por quem sente o problema que sua oferta ajuda a resolver. O que você já sabe sobre essas pessoas?', next: 'audience' },
          { label: 'Planejar conteúdo', response: 'Boa! Conteúdo útil costuma partir de uma dúvida real. Qual canal você quer usar?', next: 'content' },
          { label: 'Planejar anúncios', response: 'Podemos pensar nisso com cuidado. Você já definiu um limite de investimento confortável?', next: 'ads' },
        ],
      },
      audience: {
        question: 'O que você já percebeu sobre as pessoas que poderiam se interessar?',
        choices: [
          { label: 'Sei qual problema elas têm', response: 'Isso já é um ótimo começo. Escreva esse problema com as palavras que elas usam e teste se a sua mensagem fica fácil de reconhecer.', page: 'create', pageLabel: 'Criar mensagem para o público' },
          { label: 'Ainda estou descobrindo', response: 'Tudo bem. Converse com algumas pessoas desse perfil e anote dúvidas recorrentes antes de investir em divulgação. Você pode registrar o público que está investigando no perfil do produto.', page: 'product', pageLabel: 'Definir público no perfil' },
        ],
      },
      content: {
        question: 'Que tipo de conteúdo combina mais com o que você quer compartilhar?',
        choices: [
          { label: 'Uma dica prática', response: 'Legal. Escolha uma dúvida específica e responda com algo que a pessoa consiga aplicar. Depois, convide-a a conhecer sua oferta sem pressão.', page: 'create', pageLabel: 'Planejar conteúdo' },
          { label: 'Apresentar o produto', response: 'Mostre para quem ele foi pensado, o que inclui e onde encontrar informações completas. Seja transparente sobre preço e condições.', page: 'create', pageLabel: 'Criar campanha' },
        ],
      },
      ads: {
        question: 'Você já tem um valor máximo que se sente confortável em gastar?',
        choices: [
          { label: 'Sim, já defini um limite', response: 'Ótimo. Acompanhe os gastos e os resultados com frequência, e não aumente o orçamento só por expectativa. Anúncios não garantem retorno.', page: 'promotion', pageLabel: 'Abrir Impulsionar' },
          { label: 'Ainda não', response: 'Vale definir esse limite antes de começar e considerar que pode não haver vendas. Posso te levar ao painel de planejamento.', page: 'promotion', pageLabel: 'Planejar Impulsionamento' },
        ],
      },
    },
  ];
  const automaticLines = [
    [
      'Oi! Já cadastrou seu produto? Posso te ajudar a preparar uma campanha.',
      'Uma boa campanha começa com uma ideia clara. O que você quer divulgar?',
      'Quer organizar seu próximo passo? Toque em mim para ver algumas opções.',
    ],
    [
      'Ei! Quem você quer alcançar com sua oferta?',
      'Já pensou em qual dúvida do seu público seu conteúdo pode responder?',
      'Vai investir em anúncios? Defina um limite que faça sentido para você.',
    ],
  ];
  if (!stage || !firstMascot || !secondMascot || !dialogue) return;

  const characters = [firstMascot, secondMascot].map((element) => ({
    element,
    bubble: element.querySelector('.mascot-bubble'),
    position: 0,
    velocity: 0,
  }));

  let bounds = { minimum: 266, maximum: Math.max(266, window.innerWidth - 42) };
  let previousFrame = 0;
  let jokeSpeaker = 0;
  const previousLines = [-1, -1];
  let nextJokeAt = Date.now() + 2_500;

  function addDialogueLine(text, role) {
    const line = document.createElement('p');
    line.className = `mascot-dialog-line${role === 'user' ? ' user' : role === 'typing' ? ' typing' : ''}`;
    line.textContent = text;
    dialogueLog.append(line);
    dialogueLog.scrollTop = dialogueLog.scrollHeight;
  }

  function showNavigationChoice(page, label) {
    const navigateButton = document.createElement('button');
    navigateButton.className = 'mascot-dialog-choice navigation';
    navigateButton.type = 'button';
    navigateButton.textContent = label;
    navigateButton.addEventListener('click', () => {
      dialogue.close();
      switchPage(page);
    });
    dialogueChoices.append(navigateButton);
  }

  let activeCharacterIndex = 0;

  function showDialogueStep(stepName) {
    const step = dialogueSteps[activeCharacterIndex][stepName];
    addDialogueLine(step.question, 'npc');
    dialogueChoices.replaceChildren();
    step.choices.forEach((choice) => {
      const button = document.createElement('button');
      button.className = 'mascot-dialog-choice';
      button.type = 'button';
      button.textContent = choice.label;
      button.addEventListener('click', () => {
        addDialogueLine(choice.label, 'user');
        addDialogueLine(choice.response, 'npc');
        dialogueChoices.replaceChildren();
        if (choice.next) {
          showDialogueStep(choice.next);
          return;
        }
        showNavigationChoice(choice.page, choice.pageLabel);
        const restartButton = document.createElement('button');
        restartButton.className = 'mascot-dialog-choice';
        restartButton.type = 'button';
        restartButton.textContent = 'Fazer outra pergunta';
        restartButton.addEventListener('click', () => {
          dialogueLog.replaceChildren();
          dialogueChoices.replaceChildren();
          showDialogueStep('start');
        });
        dialogueChoices.append(restartButton);
      });
      dialogueChoices.append(button);
    });
  }

  function createFreeTextReply(message, characterIndex) {
    const normalized = message.toLocaleLowerCase('pt-BR');
    const productName = typeof profile.name === 'string' && profile.name.trim()
      ? ` para ${profile.name.trim()}`
      : '';
    const isVar = characterIndex === 1;
    if (/\b(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem)\b/.test(normalized)) {
      return {
        text: isVar
          ? 'Oi! Tudo certo por aqui. E com você? Me conta o que está planejando.'
          : 'Oi! Que bom falar com você. Me conta um pouco do que está trabalhando.',
      };
    }
    if (/\b(anúncio pago|anuncio pago|impulsion|tráfego|trafego|orçamento|orcamento|investir|ads)\b/.test(normalized)) {
      return {
        text: isVar
          ? 'Entendi. Como seu guia de divulgação, eu começaria definindo um limite de gastos e uma forma de acompanhar os resultados. Não há garantia de retorno.'
          : 'Essa parte é mais a especialidade da Var, que ajuda com público e anúncios. O importante é definir um limite de gastos antes de começar.',
        page: 'promotion',
        label: 'Abrir Impulsionar',
      };
    }
    if (/\b(campanha|post|publica|conteúdo|conteudo|instagram|redes sociais)\b/.test(normalized)) {
      return {
        text: isVar
          ? 'Vamos pensar em quem vai receber essa mensagem e que dúvida útil você pode responder. Esse é o meu foco: público e divulgação.'
          : `Vamos montar uma mensagem coerente${productName}, começando pelo que a oferta realmente entrega. Se quiser trabalhar o público e a divulgação, a Var pode ajudar também.`,
        page: 'create',
        label: 'Abrir Criar campanha',
      };
    }
    if (/\b(público|publico|cliente|clientes|audiência|audiencia|alcance|seguidores|divulgação|divulgacao)\b/.test(normalized)) {
      return {
        text: isVar
          ? 'Esse é justamente meu foco. Tente descrever quem enfrenta o problema, o que essa pessoa costuma perguntar e onde busca informação.'
          : 'Essa parte é mais a especialidade da Var. Ela pode ajudar você a pensar no público e em formas responsáveis de chegar até ele.',
        page: isVar ? 'create' : 'product',
        label: isVar ? 'Planejar uma mensagem' : 'Abrir perfil e definir público',
      };
    }
    if (/\b(produto|oferta|curso|ebook|e-book|benefício|beneficio|preço|preco|valor)\b/.test(normalized)) {
      return {
        text: isVar
          ? 'Para divulgar bem, ajuda conhecer a oferta: para quem foi pensada e o que inclui. O Din é nosso especialista em organizar o produto.'
          : `Vamos deixar isso concreto${productName}: descreva para quem é, o que inclui e qual benefício real oferece, sem promessas garantidas.`,
        page: 'product',
        label: 'Abrir perfil do produto',
      };
    }
    if (/\b(dinheiro|venda|vender|ganho|ganhar|renda|lucro|saque|saldo)\b/.test(normalized)) {
      return {
        text: 'Posso ajudar a organizar suas anotações e seu planejamento, mas não consigo garantir vendas ou renda. O resultado depende da oferta, do público e de muitos outros fatores.',
        page: 'finance',
        label: 'Abrir Ganhos',
      };
    }
    if (/\b(ajuda|como faço|como faco|não sei|nao sei|dúvida|duvida|ideia|começar|comecar)\b/.test(normalized)) {
      return {
        text: isVar
          ? 'Sem pressa. Posso ajudar você a entender seu público, preparar conteúdo ou planejar anúncios. Qual desses assuntos está mais perto do que precisa?'
          : 'Tudo bem, vamos por partes. Posso ajudar a organizar sua oferta ou preparar uma campanha. Qual dessas duas coisas está mais urgente?',
      };
    }
    return {
      text: isVar
        ? 'Entendi. Para eu te orientar dentro do que conheço melhor, me conta: você quer entender melhor seu público, preparar conteúdo ou planejar anúncios?'
        : 'Entendi. Para eu te ajudar com produto e campanhas, me conta: você quer organizar a oferta, explicar melhor o benefício ou preparar uma mensagem?',
    };
  }

  function sendFreeTextMessage(message, characterIndex) {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;
    addDialogueLine(cleanMessage, 'user');
    chatInput.value = '';
    chatInput.disabled = true;
    dialogueChoices.replaceChildren();
    const reply = createFreeTextReply(cleanMessage, characterIndex);
    addDialogueLine('Estou pensando...', 'typing');
    window.setTimeout(() => {
      dialogueLog.querySelector('.mascot-dialog-line.typing')?.remove();
      addDialogueLine(reply.text, 'npc');
      if (reply.page && reply.label) showNavigationChoice(reply.page, reply.label);
      chatInput.disabled = false;
      chatInput.focus();
    }, 420);
  }

  function openDialogue(characterIndex) {
    const isVar = characterIndex === 1;
    activeCharacterIndex = characterIndex;
    dialogueTitle.textContent = isVar ? 'Var' : 'Din';
    profileCard.classList.toggle('var-active', isVar);
    profileInitial.textContent = isVar ? 'V' : 'D';
    profileRole.textContent = isVar ? 'Seu guia de público e divulgação' : 'Seu guia de campanhas e ofertas';
    profileBio.textContent = isVar
      ? 'Curioso e observador, ajudo você a pensar no público e em uma divulgação responsável. Pode falar sem formalidade.'
      : 'Prático e parceiro, gosto de transformar ideias em próximos passos simples para sua oferta e suas campanhas.';
    profileTags.replaceChildren();
    (isVar ? ['Público', 'Divulgação'] : ['Campanhas', 'Conteúdo']).forEach((tag) => {
      const item = document.createElement('span');
      item.textContent = tag;
      profileTags.append(item);
    });
    dialogueLog.replaceChildren();
    dialogueChoices.replaceChildren();
    showDialogueStep('start');
    dialogue.showModal();
  }

  characters.forEach((character, index) => {
    character.element.addEventListener('click', () => openDialogue(index));
  });
  closeDialogue.addEventListener('click', () => dialogue.close());
  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    sendFreeTextMessage(chatInput.value, profileCard.classList.contains('var-active') ? 1 : 0);
  });

  function updateBounds() {
    bounds.minimum = window.innerWidth > 760 ? 266 : 6;
    bounds.maximum = Math.max(bounds.minimum + 64, window.innerWidth - 48);
    if (!previousFrame) {
      const distance = bounds.maximum - bounds.minimum;
      characters[0].position = bounds.minimum + distance * 0.25;
      characters[1].position = bounds.minimum + distance * 0.75;
      characters[0].velocity = 34;
      characters[1].velocity = -34;
    }
    characters.forEach((character) => {
      character.position = Math.min(bounds.maximum, Math.max(bounds.minimum, character.position));
      character.element.style.left = `${character.position}px`;
    });
  }

  updateBounds();

  function canWalk() {
    const activeField = document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
    return appAuthenticated
      && !appContent.hidden
      && !document.querySelector('#workspace-view').hidden
      && !dashboardPage.hidden
      && !document.querySelector('dialog[open]')
      && !activeField
      && document.visibilityState === 'visible';
  }

  function updateVisibility() {
    stage.hidden = !canWalk();
    if (stage.hidden) {
      characters.forEach(({ bubble }) => bubble.classList.remove('visible'));
    }
  }

  function showJoke() {
    const speakerIndex = jokeSpeaker;
    const speaker = characters[speakerIndex];
    const lines = automaticLines[speakerIndex];
    let index = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && index === previousLines[speakerIndex]) index = (index + 1) % lines.length;
    previousLines[speakerIndex] = index;
    speaker.bubble.classList.toggle('edge-start', speaker.position < bounds.minimum + 112);
    speaker.bubble.classList.toggle('edge-end', speaker.position > bounds.maximum - 112);
    speaker.bubble.textContent = lines[index];
    speaker.bubble.classList.add('visible');
    window.setTimeout(() => speaker.bubble.classList.remove('visible'), 8_000);
    jokeSpeaker = (jokeSpeaker + 1) % characters.length;
    nextJokeAt = Date.now() + 20_000 + Math.random() * 8_000;
  }

  function walk(timestamp) {
    updateVisibility();
    if (stage.hidden) {
      previousFrame = 0;
      window.setTimeout(() => window.requestAnimationFrame(walk), 1_200);
      return;
    }

    if (reducedMotion.matches) {
      previousFrame = 0;
      if (Date.now() >= nextJokeAt) showJoke();
      window.setTimeout(() => window.requestAnimationFrame(walk), 1_200);
      return;
    }

    if (!previousFrame) previousFrame = timestamp;
    const delta = Math.min((timestamp - previousFrame) / 1_000, 0.05);
    previousFrame = timestamp;

    characters.forEach((character) => {
      character.position += character.velocity * delta;
      if (character.position <= bounds.minimum || character.position >= bounds.maximum) {
        character.position = Math.min(bounds.maximum, Math.max(bounds.minimum, character.position));
        character.velocity *= -1;
      }
      character.element.dataset.direction = character.velocity > 0 ? 'right' : 'left';
      character.element.style.left = `${character.position}px`;
    });

    if (Date.now() >= nextJokeAt) showJoke();

    window.requestAnimationFrame(walk);
  }

  document.addEventListener('focusin', updateVisibility);
  document.addEventListener('focusout', () => window.setTimeout(updateVisibility, 0));
  document.addEventListener('visibilitychange', updateVisibility);
  reducedMotion.addEventListener('change', updateVisibility);
  window.addEventListener('resize', updateBounds);
  window.requestAnimationFrame(walk);
}

initializeMascot();