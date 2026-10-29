# Cash

Central de marketing para produtos digitais, com geração de conteúdo por IA, cadastro de ofertas afiliadas, planejamento de divulgação e controle financeiro.

## Executar

Requer Node.js 18 ou superior.

1. Copie `.env.example` para `.env`.
2. Adicione uma chave Gemini do Google AI Studio em `GEMINI_API_KEY`.
3. Configure `CASH_ACCESS_TOKEN` e, se usar o painel financeiro, as credenciais de API das plataformas.
4. Execute:

```bash
node server.js
```

Abra <http://localhost:3000>. O modelo padrão é `gemini-3.5-flash-lite`, que tem cota gratuita sujeita aos limites do Google. `GEMINI_MODEL` pode ser alterado no `.env`.

## Recursos

- Criação de produtos digitais e campanhas com IA.
- Ideias de produtos afiliados, cadastro de ofertas e contagem manual de vendas.
- Planos de divulgação com textos copiáveis e orçamento de anúncios planejado.
- Consulta de saldo e solicitação de saque via API para Kiwify e Cakto, com confirmação explícita.

Sugestões afiliadas não são ofertas verificadas. Vendas registradas manualmente não são conciliadas com o checkout. O Cash não publica campanhas, compra mídia, recebe pagamentos ou transfere dinheiro automaticamente.

## Credenciais

Guarde chaves e tokens somente no `.env`. Esse arquivo é ignorado pelo Git. Nunca publique credenciais ou as envie pelo chat. Consulte `.env.example` para os nomes das variáveis suportadas.