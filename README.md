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

## Contas

O cadastro é aberto para qualquer pessoa com acesso à instalação. A primeira conta recebe o papel de proprietária; as seguintes têm espaços de marketing separados no navegador e não acessam saldo ou saques das integrações. Os dados de marketing são armazenados localmente no navegador e não são sincronizados entre dispositivos.

Sugestões afiliadas não são ofertas verificadas. Vendas registradas manualmente não são conciliadas com o checkout. O Dinvaro IA não publica campanhas, compra mídia, recebe pagamentos ou transfere dinheiro automaticamente.

## Credenciais

Guarde credenciais das plataformas somente no `.env`. Esse arquivo é ignorado pelo Git. Nunca publique credenciais ou as envie pelo chat. Consulte `.env.example` para os nomes das variáveis suportadas.