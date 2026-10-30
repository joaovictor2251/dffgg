# Dinvaro IA

Central de marketing para produtos digitais, com um motor local especializado em conteúdo, cadastro de ofertas afiliadas, planejamento de divulgação e controle financeiro.

## Executar

Requer Node.js 18 ou superior.

1. Copie `.env.example` para `.env`.
2. Se usar o painel financeiro, configure as credenciais de API das plataformas.
3. Execute:

```bash
node server.js
```

Abra <http://localhost:3000>. O motor de marketing funciona sem chave de IA ou chamada a serviços externos. Ele combina regras, contexto informado e estruturas editáveis; não é um modelo de linguagem treinado e não aprende automaticamente com as conversas. Revise e valide os rascunhos antes de usar.

## Recursos

- Criação de estruturas de produtos digitais e campanhas com o motor local.
- Ideias de produtos afiliados, cadastro de ofertas e contagem manual de vendas.
- Planos de divulgação com textos copiáveis e orçamento de anúncios planejado.
- Consulta de saldo e solicitação de saque via API para Kiwify e Cakto, com confirmação explícita.
- Recebimento de vendas Kiwify/Cakto via webhooks assinados, com deduplicação e registro automático de aprovações, reembolsos e chargebacks.
- Caixa de notificações de vendas aprovadas para a conta proprietária e correio de presentes com planos enviados a contas escolhidas.
- Assinaturas mensais do Dinvaro IA via Mercado Pago, com confirmação por webhook e recursos limitados pelo plano.

## Planos do Dinvaro IA

| Recurso | Básico · Grátis | Pro · R$ 29,90/mês | Premium · R$ 59,90/mês |
| --- | :---: | :---: | :---: |
| Visão geral | ✅ | ✅ | ✅ |
| Ganhos | ✅ | ✅ | ✅ |
| Campanhas | ✅ | ✅ | ✅ |
| Criar campanhas | Até 5/mês | ✅ | ✅ |
| Produtos | ❌ | ✅ | ✅ |
| Afiliados | ❌ | ✅ | ✅ |
| Impulsionar | ❌ | ❌ | ✅ |
| Integrações | ❌ | ❌ | ✅ |
| Assistente IA | ❌ | ❌ | ✅ |

A conta proprietária tem acesso completo sem cobrança. Planos pagos só são liberados depois que o servidor consulta e confirma o estado da assinatura no Mercado Pago; voltar do checkout ou receber uma notificação sem assinatura válida não concede acesso. O servidor aplica o limite de cinco campanhas mensais do Básico e bloqueia no backend os recursos que não pertencem ao plano. Pro e Premium não têm um limite de criação de campanhas.

Além dos planos disponíveis para os usuários, a conta proprietária tem o plano **Dev**, exclusivo e sem cobrança, com todos os recursos e campanhas ilimitadas. O servidor só concede esse plano à conta com papel `owner`; ele não aparece para outras contas nem pode ser comprado.

Na área **Planos**, a proprietária pode gerar e desativar cupons compartilhados de Premium grátis por um mês ou permanentemente, definindo o limite de contas. Cada conta pode resgatar o mesmo código uma vez; os usos são contados de forma transacional. O acesso de cupons permanentes não expira; no fim de um cupom mensal, volta ao Básico se não houver uma assinatura paga ativa. O resgate não inicia uma cobrança, e contas com assinatura em andamento precisam concluí-la ou cancelá-la antes.

A conta proprietária também pode enviar presentes gratuitos pelo ícone **Presentes**, escolhendo uma conta cadastrada, uma mensagem, o plano Pro ou Premium e uma duração de 7, 30, 90 ou 365 dias, ou permanente. Nos cards Pro e Premium da área **Planos**, qualquer conta pode escolher **Presentear alguém**, informar nome e e-mail de outra conta e pagar o valor mensal como uma compra única, sem renovação. Depois da aprovação confirmada pelo webhook do Mercado Pago, o presente aparece no correio do destinatário dentro do app; o app não envia e-mail automático. A pessoa precisa entrar, abrir e resgatar o presente; o mês de acesso começa no resgate. Contas com assinatura ativa precisam concluí-la ou cancelá-la antes de ativar o presente.

Para habilitar cobranças reais:

1. Use uma hospedagem com URL pública HTTPS estável e armazenamento persistente para o arquivo SQLite. Uma hospedagem gratuita que apaga arquivos ao reiniciar não é segura para assinaturas e contas; Cloudflare Tunnel expõe um computador local, mas não é hospedagem persistente.
2. Copie `.env.example` para `.env` e configure `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` e `PUBLIC_APP_URL`. A URL pública deve ser somente a origem HTTPS do app, sem caminho ou parâmetros.
3. No painel de integrações do Mercado Pago, configure Webhooks para a URL `https://SEU_DOMINIO/webhooks/mercadopago` e habilite os tópicos `subscription_preapproval`, `subscription_authorized_payment` e `payment`. O tópico `payment` confirma as compras únicas dos presentes. Copie o segredo de assinatura gerado para `MERCADOPAGO_WEBHOOK_SECRET`.
4. Reinicie o servidor e valide primeiro em ambiente de teste do Mercado Pago. O token de produção só deve ser usado depois de confirmar checkout, notificação assinada, ativação, cancelamento e persistência após reinícios.

O checkout de assinatura envia a recorrência em BRL e usa a URL de retorno apenas para voltar ao app; o pagamento de um presente é uma cobrança única em BRL. A ativação da assinatura e a entrega do presente dependem de consultar a API oficial do Mercado Pago a partir de um webhook assinado, nunca apenas do retorno do checkout. Usuários podem cancelar uma assinatura no painel **Planos**. Mudanças de plano exigem cancelar a assinatura atual antes de iniciar outra. Nunca coloque tokens ou segredos no navegador, no Git ou em mensagens.

## Contas

O cadastro é aberto para qualquer pessoa com acesso à instalação. A primeira conta recebe o papel de proprietária; as seguintes têm espaços de marketing separados no navegador e não acessam saldo ou saques das integrações. Os dados de marketing são armazenados localmente no navegador e não são sincronizados entre dispositivos.

Cada conta pode editar o nome de exibição exclusivo e a foto em **Meu perfil**. Os nomes não diferenciam maiúsculas/minúsculas; fotos JPEG, PNG ou WebP são armazenadas no banco SQLite com limite de 512 KB.

Produtos gerados e perfis de oferta aparecem em **Meus produtos**, com capa editável e destinos selecionáveis (Instagram, Facebook, TikTok, YouTube, Kiwify, Cakto e Hotmart). A biblioteca, as capas e os destinos ficam no armazenamento local do navegador e não são sincronizados entre dispositivos. A seleção de destino ainda não publica automaticamente: redes sociais exigem apps OAuth aprovados, e as integrações atuais de Kiwify/Cakto recebem eventos de venda, não cadastram produtos. Cada API de publicação/cadastro precisa ser implementada e autorizada antes de enviar qualquer produto.

Sugestões afiliadas não são ofertas verificadas. Vendas registradas manualmente não são conciliadas com o checkout. O Dinvaro IA não publica campanhas, compra mídia, recebe pagamentos ou transfere dinheiro automaticamente.

No painel **Ganhos**, as abas filtram o lucro estimado por plataforma. Vendas dos webhooks aparecem na plataforma do checkout (Kiwify ou Cakto); atribuições a Instagram, TikTok, Facebook, YouTube e Hotmart dependem de lançamentos manuais, pois essas fontes não têm integração financeira implementada.

## Vendas automáticas

Os webhooks só funcionam quando o servidor está publicado em uma URL HTTPS acessível pela plataforma; `localhost` não pode receber eventos externos. Configure no `.env`:

- `KIWIFY_WEBHOOK_TOKEN`: token definido na configuração do webhook Kiwify. Cadastre `https://SEU_DOMINIO/webhooks/kiwify` e habilite eventos de aprovação, reembolso e chargeback. A consulta de detalhes da venda também exige credenciais Kiwify com acesso de leitura a vendas.
- `CAKTO_WEBHOOK_SECRET`: segredo fornecido ao criar o webhook Cakto. Cadastre `https://SEU_DOMINIO/webhooks/cakto` e habilite `purchase_approved`, `refund` e `chargeback`.

Reinicie o servidor depois de salvar os segredos. Os eventos recebidos a partir da configuração são validados e deduplicados no SQLite do servidor e as vendas aparecem em **Ganhos → Movimentações** para a conta proprietária. Uma venda aprovada também gera uma notificação na caixa **Vendas** da proprietária; o app atualiza a caixa enquanto a sessão estiver aberta. O app não importa vendas históricas anteriores à ativação. Reenvios de webhook não criam duplicatas. Aprovações, reembolsos e chargebacks são registrados; apenas valores em BRL são somados às estimativas financeiras. Configure webhooks separadamente em cada plataforma. Hotmart e redes sociais ainda não têm integração de vendas neste app.

## Credenciais

Guarde credenciais das plataformas somente no `.env`. Esse arquivo é ignorado pelo Git. Nunca publique credenciais ou as envie pelo chat. Consulte `.env.example` para os nomes das variáveis suportadas.