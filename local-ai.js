const stopWords = new Set(['com', 'como', 'para', 'pela', 'pelo', 'mais', 'sobre', 'entre', 'esse', 'essa', 'este', 'esta', 'produto', 'digital', 'quero', 'meu', 'minha', 'uma', 'uns', 'umas', 'dos', 'das', 'que', 'por', 'sem', 'seu', 'sua', 'nos', 'nas', 'aos', 'aquelas', 'aqueles']);

function clean(value, limit = 300) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function normalize(value) {
  return clean(value, 4_000).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function words(value) {
  return normalize(value).match(/[a-z0-9]+/g) || [];
}

function topicLabel(value) {
  const phrase = clean(value, 100).replace(/[.!?]+$/, '');
  return phrase ? phrase[0].toLocaleUpperCase('pt-BR') + phrase.slice(1) : 'seu tema';
}

function makeChatAnswer(messages, product = {}) {
  const latest = [...messages].reverse().find((message) => message.role === 'user');
  const question = clean(latest?.content, 4_000);
  const normalized = normalize(question);
  const productName = clean(product.name, 100) || 'seu produto';
  const audience = clean(product.audience, 250) || 'o público que você quer atender';
  const benefit = clean(product.benefit, 300) || 'o benefício que o produto realmente entrega';

  if (/proposta de valor|posicionamento|diferencial/.test(normalized)) {
    return `Vamos formular isso sem inventar promessas.\n\nPara ${productName}, a base é: “Para ${audience}, ${productName} ajuda a ${benefit}.”\n\nPara deixar a proposta específica, responda: qual situação leva essa pessoa a procurar uma solução? O que ela recebe no produto? Que parte do benefício é possível demonstrar com o conteúdo ou processo?`;
  }
  if (/anuncio|anuncios|criativo|publicidade|meta ads|google ads/.test(normalized)) {
    return `Três caminhos de anúncio para ${productName}, sem afirmar resultados não comprovados:\n\n1. Situação: descreva um problema real de ${audience} e convide a conhecer uma forma de trabalhá-lo.\n2. Bastidores: mostre uma parte do material e explique para quem ela foi criada.\n3. Pergunta: “Como você organiza [tarefa relacionada ao tema] hoje?” Apresente o produto como uma opção, não como garantia.\n\nAntes de publicar, confirme que cada afirmação aparece no conteúdo do produto e que o anúncio segue as regras do canal.`;
  }
  if (/email|e-mail|lancamento|sequencia/.test(normalized)) {
    return `Uma sequência enxuta para apresentar ${productName}:\n\n1. Contexto: compartilhe uma orientação útil sobre o problema, sem vender ainda.\n2. Aplicação: ensine um passo simples e explique seus limites.\n3. Oferta: descreva o que o produto inclui, para quem serve e o link.\n4. Dúvidas: responda perguntas reais usando apenas informações confirmadas.\n\nEnvie somente para contatos com consentimento e inclua uma forma clara de descadastro em todas as mensagens.`;
  }
  if (/preco|precificar|valor/.test(normalized)) {
    return `Não tenho dados de mercado suficientes para afirmar um preço ideal para ${productName}. Para definir uma hipótese, liste o custo de produção e suporte, compare ofertas realmente equivalentes, converse com pessoas do público e teste a disposição de compra sem prometer resultados. Registre a hipótese e revise com vendas e reembolsos reais.`;
  }
  if (/publico|audiencia|cliente|persona/.test(normalized)) {
    return `Para tornar “${audience}” mais útil, descreva uma situação observável em vez de criar uma persona fictícia:\n\n- O que essa pessoa está tentando fazer?\n- Em que etapa ou contexto encontra dificuldade?\n- O que já tentou e por que não resolveu?\n- Que conteúdo do produto ajuda, e para quem ele não é adequado?\n\nUse conversas e dúvidas reais para validar as respostas.`;
  }
  if (/ideia|ideias|estrategia|plano|campanha|conteudo/.test(normalized)) {
    return `Posso ajudar com uma próxima ação para ${productName}. Comece por uma peça útil para ${audience}: explique um problema específico, mostre um passo aplicável e encerre apresentando o produto como próximo recurso. O benefício informado é “${benefit}”; mantenha a comunicação dentro do que você consegue comprovar.\n\nQual canal e objetivo você quer priorizar?`;
  }
  return `Sou o motor local do Dinvaro IA, especializado em marketing de produtos digitais. Consigo ajudar com posicionamento, anúncios, e-mails, preço como hipótese e planejamento de conteúdo.\n\nPara uma resposta mais direcionada, diga o produto, o público, o canal e o objetivo. Não uso um modelo externo nesta instalação e não invento provas, resultados ou características.`;
}

function makeCampaign(product, campaign) {
  const productName = clean(product.name, 100);
  const description = clean(product.description, 1_200);
  const audience = clean(product.audience, 250);
  const benefit = clean(product.benefit, 300);
  const price = clean(product.price, 80);
  const link = clean(product.url, 300) || '[INSERIR LINK DA OFERTA]';
  const channel = clean(campaign.channel, 100) || 'canal escolhido';
  const objective = clean(campaign.objective, 100) || 'apresentar o produto';
  const angle = clean(campaign.angle, 500);
  const hook = angle || `Uma forma prática de trabalhar ${description.toLocaleLowerCase('pt-BR')}`;
  const audienceLine = audience ? `Conteúdo pensado para ${audience}.` : '';
  const priceLine = price ? `Valor informado: ${price}.` : '';
  const offer = [description, `O produto ajuda a ${benefit}.`, audienceLine, priceLine].filter(Boolean).join(' ');
  const formats = normalize(campaign.format);

  if (/email/.test(normalize(channel)) || /email/.test(formats)) {
    return `ASSUNTO: Um próximo passo sobre ${productName}\n\nOlá!\n\n${hook}.\n\n${offer}\n\nConheça os detalhes: ${link}\n\nVeja se o conteúdo faz sentido para o seu momento. Esta mensagem deve ser enviada apenas a uma lista com consentimento. Para não receber novos e-mails, use o link de descadastro da plataforma.`;
  }
  if (/pagina de vendas|landing page/.test(formats) || /landing page/.test(normalize(channel))) {
    return `TÍTULO\n${productName}: um recurso para ${audience}\n\nCONTEXTO\n${hook}.\n\nO QUE É\n${description}\n\nPARA QUEM\n${audience}\n\nO QUE VOCÊ ENCONTRA\n${benefit}. Confira a descrição completa do conteúdo antes de decidir.\n\nPRÓXIMO PASSO\nVeja os detalhes e as condições da oferta: ${link}\n\n${objective}. Revise se todas as informações, preço e condições estão atualizados antes de publicar.`;
  }
  if (/anuncios pagos/.test(formats) || /ads/.test(normalize(channel))) {
    return `ANÚNCIO 1 · PROBLEMA\n${audienceLine} ${hook}. Conheça ${productName}, um produto que aborda esse tema: ${link}\n\nANÚNCIO 2 · CONTEÚDO\nO que você encontra em ${productName}: ${description} Saiba mais antes de decidir: ${link}\n\nANÚNCIO 3 · CONVITE\nSe você procura conteúdo sobre ${benefit}, veja a proposta de ${productName}. Consulte os detalhes e as condições: ${link}\n\nRevise a política do canal e confirme as afirmações antes de veicular. Não há promessa de resultado.`;
  }
  return `ABERTURA\n${hook}.\n\nCONTEXTO\n${audienceLine} ${description}\n\nAPRESENTAÇÃO\n${productName} aborda esse tema e ajuda a ${benefit}. ${priceLine}\n\nCHAMADA\nVeja o conteúdo e as condições da oferta: ${link}\n\nÂNGULO\n${angle || objective}\n\nRASCUNHO PARA ${channel.toLocaleUpperCase('pt-BR')}\nUse uma pergunta, demonstração ou dica relacionada ao tema. Apresente apenas informações confirmadas sobre o produto e convide a pessoa a consultar a oferta. Se compartilhar sua experiência pessoal, descreva somente o que realmente vivenciou.`;
}

function makeProduct({ idea, audience, format }) {
  const topic = topicLabel(idea);
  const target = clean(audience, 250) || 'pessoas interessadas em ' + topic.toLocaleLowerCase('pt-BR');
  const name = `Plano prático: ${topic}`.slice(0, 100);
  const benefit = `organizar os próximos passos relacionados a ${topic.toLocaleLowerCase('pt-BR')}`;
  const description = `Material editável para ${target}, estruturado para estudar e aplicar ideias sobre ${topic.toLocaleLowerCase('pt-BR')}. Revise o conteúdo e acrescente referências específicas antes de comercializar.`;
  const steps = [
    ['Mapeie o ponto de partida', 'Descreva uma situação real ligada ao tema. O que a pessoa já sabe? O que precisa descobrir? Registre as dúvidas sem presumir que todas as pessoas enfrentam o mesmo cenário.'],
    ['Escolha um objetivo pequeno', 'Defina uma ação observável que caiba no contexto do público. Liste os recursos necessários e o que pode impedir a aplicação.'],
    ['Planeje uma tentativa', 'Divida a ação em etapas curtas. Para cada etapa, anote instrução, exemplo a validar e um sinal simples de conclusão.'],
    ['Revise e adapte', 'Compare o plano com a realidade, registre o que funcionou e o que precisa de pesquisa. Não trate um exemplo como resultado garantido.'],
  ];
  const formats = {
    ebook: {
      label: 'E-book',
      content: `# ${name}\n\n## Para quem é\n${target}. Use este material como uma base de trabalho e confirme informações técnicas antes de aplicar.\n\n## Introdução\nEste e-book organiza um caminho inicial para estudar ${topic.toLocaleLowerCase('pt-BR')}. Ele não substitui orientação profissional quando o tema exigir conhecimento especializado.\n\n${steps.map(([title, detail], index) => `## Capítulo ${index + 1}: ${title}\n\n${detail}\n\n**Exercício:** escreva um exemplo do seu contexto, liste uma dúvida para validar e escolha uma próxima ação.\n\n**Anotações:** [espaço para observações e fontes consultadas]`).join('\n\n')}\n\n## Revisão final\n- As orientações estão apoiadas em fontes confiáveis?\n- Os exemplos estão identificados como exemplos?\n- O conteúdo deixa claros seus limites?\n- O leitor sabe qual é o próximo passo?`,
    },
    'mini-course': {
      label: 'Mini-curso',
      content: `# ${name}\n\n## Público e objetivo\nPara ${target}. Objetivo de aprendizagem: organizar uma tentativa inicial relacionada a ${topic.toLocaleLowerCase('pt-BR')}.\n\n${steps.map(([title, detail], index) => `## Módulo ${index + 1}: ${title}\n\n**Roteiro da aula**\n1. Apresente a situação e pergunte como ela aparece no dia a dia.\n2. Explique: ${detail}\n3. Demonstre com um caso fictício, identificado como exemplo.\n4. Peça que a pessoa adapte o exercício ao próprio contexto.\n\n**Atividade:** registre a resposta e o que ainda precisa ser confirmado.\n\n**Critério de conclusão:** a pessoa consegue explicar a própria próxima ação e os limites do plano.`).join('\n\n')}\n\n## Encerramento\nPeça uma reflexão sobre o que foi aplicado, o que depende de validação e qual será o próximo teste.`,
    },
    workbook: {
      label: 'Workbook',
      content: `# ${name}\n\nCaderno prático para ${target}. Preencha com situações reais; não há respostas únicas.\n\n${steps.map(([title, detail], index) => `## Atividade ${index + 1}: ${title}\n\n${detail}\n\n**Meu contexto:** __________________________________\n\n**O que já sei:** __________________________________\n\n**O que preciso validar:** __________________________\n\n**Próxima ação:** __________________________________\n\n**Como vou revisar:** ______________________________`).join('\n\n')}\n\n## Revisão\nQue parte foi útil? O que mudou após a tentativa? Que informação precisa de uma fonte ou especialista?`,
    },
    'template-pack': {
      label: 'Kit de templates',
      content: `# ${name}\n\nModelos editáveis para ${target}. Substitua os campos entre colchetes e adapte cada modelo antes de usar.\n\n${[
        ['Briefing', 'Situação: [descreva o contexto]\nPúblico: [quem será atendido]\nObjetivo: [ação observável]\nLimites: [o que não está incluído]'],
        ['Plano de ação', 'Ação: [próximo passo]\nResponsável: [pessoa]\nRecursos: [o que será necessário]\nPrazo: [data realista]\nCritério de revisão: [como avaliar]'],
        ['Registro de dúvidas', 'Dúvida: [pergunta]\nO que já foi consultado: [fonte]\nO que falta confirmar: [lacuna]\nPróxima verificação: [ação]'],
        ['Roteiro de conteúdo', 'Abertura: [situação do público]\nDica: [orientação verificável]\nExemplo: [caso identificado como exemplo]\nConvite: [próxima ação sem pressão]'],
        ['Revisão', 'O que foi feito: [registro]\nO que aconteceu: [fato observado]\nO que aprendi: [reflexão]\nO que vou ajustar: [próxima tentativa]'],
      ].map(([title, body], index) => `## Template ${index + 1}: ${title}\n\n${body}`).join('\n\n')}\n\n## Instruções\nNão publique exemplos como depoimentos nem preencha lacunas com resultados inventados.`,
    },
    guide: {
      label: 'Guia passo a passo',
      content: `# ${name}\n\nGuia inicial para ${target}. O caminho abaixo precisa ser adaptado às condições reais do tema.\n\n${steps.map(([title, detail], index) => `## Etapa ${index + 1}: ${title}\n\n${detail}\n\n**Faça:** [ação concreta]\n**Você vai precisar de:** [recursos]\n**Confira:** [sinal observável]\n**Se não funcionar:** registre o obstáculo e ajuste o plano, sem presumir uma causa.`).join('\n\n')}\n\n## Checklist final\n- O plano cabe nos recursos disponíveis?\n- As informações específicas foram verificadas?\n- Os limites e riscos estão claros?\n- A próxima ação está definida?`,
    },
  };
  const selected = formats[format];
  if (!selected) throw new Error('Escolha um formato de produto válido.');
  return { name, description, audience: target, benefit, suggestedPrice: '', content: `${selected.label}\n\n${selected.content}` };
}

function makeAffiliateSuggestions({ niche, audience, platform, context }) {
  const topic = topicLabel(niche);
  const target = clean(audience, 250) || `pessoas interessadas em ${topic.toLocaleLowerCase('pt-BR')}`;
  const contextLine = clean(context, 400);
  const formats = [
    ['Guia introdutório', 'material educativo', 'organizar informações básicas e próximos passos', 'Mostre uma dúvida comum e ensine uma forma de investigá-la antes de apresentar o guia.'],
    ['Kit de templates', 'modelos editáveis', 'reduzir o trabalho de começar do zero em uma tarefa relacionada ao tema', 'Demonstre como adaptar um modelo a uma situação fictícia, deixando claro que é um exemplo.'],
    ['Curso de fundamentos', 'curso online', 'estudar conceitos e acompanhar uma sequência de aulas', 'Compartilhe uma pergunta de aprendizagem e indique quais tópicos vale conferir na grade do curso.'],
    ['Workbook de planejamento', 'caderno de atividades', 'transformar uma intenção em etapas que possam ser revisadas', 'Publique uma atividade curta e explique para que perfil ela pode ser útil.'],
    ['Ferramenta de apoio', 'software ou ferramenta digital', 'apoiar uma etapa operacional ligada ao tema', 'Explique a tarefa que a ferramenta pode apoiar e incentive a conferir recursos, preço e limitações.'],
  ];
  const validationChecks = [
    `A oferta existe atualmente na ${clean(platform, 80) || 'plataforma'} e corresponde a esta descrição?`,
    'Qual é a comissão vigente, quais são as regras de atribuição e quando ocorre o pagamento?',
    'Há avaliações verificáveis, política de reembolso e autorização para divulgar nos canais escolhidos?',
  ];
  return {
    suggestions: formats.map(([label, type, problem, angle]) => ({
      productIdea: `${label} sobre ${topic.toLocaleLowerCase('pt-BR')}`,
      productType: type,
      audience: target,
      problem: `${problem}${contextLine ? ` Considerando: ${contextLine}` : ''}.`,
      promotionAngle: angle,
      validationChecks,
    })),
  };
}

function makeAffiliatePromotion({ product, duration, channels, frequency, goal }) {
  const productName = clean(product.name, 120);
  const link = clean(product.link, 1_000);
  const commission = Number.isFinite(product.commission) ? ` Comissão cadastrada: ${product.commission}%; confirme o valor vigente.` : '';
  const days = Number.parseInt(clean(duration, 20).match(/\d+/)?.[0] || '7', 10);
  const postsPerWeek = frequency === '1 publicação por dia' ? 7 : Number.parseInt(frequency, 10);
  const entryCount = Math.min(20, Math.ceil(days * postsPerWeek / 7));
  const channelList = clean(channels, 100).split(/,? e |, /).map((value) => value.trim()).filter(Boolean);
  const ideas = [
    ['Dica educativa', `Compartilhe uma orientação útil relacionada a ${productName}. Identifique limites e não apresente o produto como garantia.`],
    ['Pergunta ao público', `Pergunte como as pessoas lidam com uma tarefa relacionada a ${productName}. Não atribua resultados ao produto sem evidência.`],
    ['O que verificar', `Explique quais detalhes uma pessoa deve conferir antes de escolher uma solução para o tema de ${productName}.`],
    ['Bastidores', `Mostre como você avalia se uma oferta sobre ${productName} combina com as necessidades do seu público. Não diga que testou se não testou.`],
    ['Dúvida frequente', `Responda uma pergunta real sobre o assunto de ${productName} e deixe claro quando a informação precisa ser confirmada.`],
  ];
  const schedule = Array.from({ length: entryCount }, (_, index) => {
    const [contentType, copy] = ideas[index % ideas.length];
    const channel = channelList[index % channelList.length] || 'Canal escolhido';
    return {
      day: `Dia ${Math.min(days, Math.floor(index * days / entryCount) + 1)}`,
      channel,
      contentType,
      copy: `${copy}\n\n#publi #afiliado${commission}`,
      cta: `Confira os detalhes e condições: ${link}`,
    };
  });
  const strategy = `Calendário de ${days} dias com ${entryCount} conteúdos para ${channels}. Alterne orientação, pergunta e apresentação da oferta. Identifique claramente o vínculo de afiliado em cada publicação, confira as regras do canal e valide preço, comissão, disponibilidade e alegações antes de publicar.${clean(goal, 300) ? ` Objetivo informado: ${clean(goal, 300)}.` : ''}`;
  return { strategy, schedule };
}

module.exports = {
  makeAffiliatePromotion,
  makeAffiliateSuggestions,
  makeCampaign,
  makeChatAnswer,
  makeProduct,
};