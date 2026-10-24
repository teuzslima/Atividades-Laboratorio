# 💬 Analisador de Conversas do WhatsApp

Página única (`index.html`) que lê uma conversa exportada do WhatsApp e mostra estatísticas divertidas.
Tudo roda **no navegador** — nenhuma mensagem é enviada para servidor nenhum.

## Como usar

1. Exporte a conversa no WhatsApp, escolhendo **Sem mídia**:
   - **Android:** conversa → ⋮ → Mais → Exportar conversa → gera um `.txt`
   - **iPhone:** conversa → nome do contato → Exportar conversa → gera um `.zip` (não precisa descompactar)
2. Abra o `index.html` no navegador (dois cliques no arquivo).
3. Arraste o arquivo para a página ou clique para escolher.

Não tem uma conversa à mão? Clique em **“Ver com uma conversa de exemplo”**.

## O que ele mostra

- **Quem manda mais mensagens**: mensagens, palavras, tamanho médio, tempo típico de resposta e uma ficha completa
  por pessoa (mídias, áudios, figurinhas, emojis, links, perguntas, mensagens apagadas/editadas…)
- **❤️ Cantinho do amor**: total de “te amo”, quem manda mais, o **primeiro “te amo”** da conversa,
  o mês mais apaixonado e um gráfico dos “te amo” ao longo do tempo
- **🏆 Prêmios**: Tagarela, Rei/Rainha do textão, Responde na velocidade da luz, Visualiza e some, Puxa-assunto,
  Metralhadora, Corujão, Madrugador(a), Podcaster, Risada fácil, Boca suja, Sempre com fome e outros
- **🎯 Contadores**: saudades, apelidos carinhosos, beijos, risadas (kkk/haha/rs), bom dia, boa noite,
  desculpas, agradecimentos, palavrões, comida e sono
- **⏰ Quando vocês conversam**: horário e dia favoritos, dia e mês mais agitados, maior sequência de dias
  seguidos conversando, maior silêncio, gráficos por hora / dia da semana / mês e mapa de calor
- **🔤 Palavras** (nuvem + ranking geral e por pessoa) e **😍 emojis** favoritos
- **🔎 Busca**: “quantas vezes falamos *pizza*?” — por pessoa, ao longo do tempo, a primeira vez e as mais recentes
- **📖 Momentos**: como a conversa começou, o maior textão e uma lembrança aleatória
- **📋 Copiar resumo** para colar e mandar para a pessoa

Funciona com conversas individuais e grupos, nos formatos de data do Brasil (dd/mm/aaaa),
dos EUA (mm/dd/aa com AM/PM) e do iPhone (`[data, hora]`).
