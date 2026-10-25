# Urna da Live (TikTok)

🌹 Rosa vermelha = voto no **13** · Rosa branca = voto no **22**

A tela digita o número na urna, faz o bipe de confirmação, mostra o nome e a foto de quem mandou
o presente, soma o placar e mostra quem mais votou de cada lado.

## O que você precisa

- Um **computador** (Windows ou Mac). Pelo celular não dá para colocar essa tela na live.
- **TikTok LIVE Studio** (programa oficial do TikTok para PC) **ou** OBS.
- **Node.js** instalado: baixe a versão "LTS" em https://nodejs.org e instale (é só avançar).

## Passo a passo

1. Descompacte a pasta `urna-tiktok-live` no computador.
2. Abra o arquivo `config.json` no Bloco de Notas e troque `SEU_USUARIO_AQUI` pelo seu usuário
   do TikTok, **sem o @**. Salve.
3. Abra a pasta, clique na barra de endereço, digite `cmd` e aperte Enter (no Mac: Terminal → `cd` até a pasta).
4. Só na primeira vez, digite: `npm install`
5. Para ligar a urna, digite: `npm start` (deixe essa janela aberta durante a live).
6. No **TikTok LIVE Studio**: Adicionar fonte → **Link / Navegador (Browser)** → coloque
   `http://localhost:3000` → largura **1080**, altura **1920**. No OBS é a mesma coisa: Fonte → Navegador.
7. Comece a live. Quando aparecer "✅ Conectado" na janela preta, já está contando.

> Se você abrir a live **depois** de ligar a urna, tudo bem: ela fica tentando conectar sozinha.

## Colocar o debate embaixo

A parte de baixo da tela fica **vazia e transparente**: é ali que o debate aparece.
(Para ver onde fica esse espaço, abra `http://localhost:3000/?fundo=1`; ele aparece com uma borda tracejada.)
Os nomes de quem votou aparecem por cima do debate, como na live do exemplo.

**Jeito 1: captura de janela (funciona com qualquer canal)**
1. Abra o debate no navegador (YouTube da emissora, Globoplay etc.) e deixe o vídeo em tela cheia
   ou com a janela grande.
2. No LIVE Studio/OBS: Adicionar fonte → **Captura de janela** → escolha a janela do navegador.
3. Arraste e redimensione o vídeo para a **parte de baixo** da tela.
4. Na lista de fontes, deixe a **urna (Navegador) em cima** e o debate **embaixo**. Assim a urna
   fica por cima e o vídeo aparece no espaço vazio.
5. Para o som do debate ir para a live, a captura do áudio do computador (Áudio da área de
   trabalho) precisa estar ligada.

**Jeito 2: link do YouTube dentro da própria urna**
No `config.json`, coloque o link da transmissão do debate no YouTube:
`"videoDebate": "https://www.youtube.com/watch?v=XXXXXXXXXXX"` e reinicie (`npm start`).
O vídeo já aparece no espaço de baixo. Alguns canais não deixam o vídeo ser exibido fora do
YouTube; se aparecer erro, use o Jeito 1.

**Debate antigo (gravado)**
- Se o debate está no **YouTube**: use o Jeito 2 com o link do vídeo. Ele repete sozinho quando acaba.
- Se você tem o **arquivo de vídeo** no computador (`.mp4`): coloque o arquivo dentro da pasta
  `public` e escreva só o nome dele no `config.json`, por exemplo `"videoDebate": "debate.mp4"`.
  Ele toca embaixo da urna e repete sem parar.
- Também dá para fazer pelo LIVE Studio/OBS: Adicionar fonte → **Arquivo de mídia / Vídeo**,
  marque "Repetir" e posicione embaixo, com a urna em cima na lista de fontes.
- Coloque na tela ou no título que é **reprise**, para ninguém achar que é ao vivo.

> Atenção: retransmitir o sinal de uma TV pode fazer o TikTok derrubar a live por direitos autorais.

## Testar antes de entrar ao vivo

Com a urna ligada, abra no navegador:

- Ver a tela com fundo: `http://localhost:3000/?fundo=1`
- Simular voto 13: `http://localhost:3000/teste?voto=13&nome=Maria&qtd=5`
- Simular voto 22: `http://localhost:3000/teste?voto=22&nome=João&qtd=10`
- **Zerar o placar** (antes de começar de verdade): `http://localhost:3000/zerar`

O placar fica salvo no arquivo `votos.json`; se o programa fechar, ele volta de onde parou.

## Se a rosa branca não contar

O nome do presente pode mudar de país para país. Toda vez que alguém manda um presente, a janela
preta mostra algo assim:

```
🎁 Fulano enviou "White Rose" (id 1234) x1
```

Copie esse número do `id` e coloque em `presentesIds` do 22 no `config.json`, por exemplo
`"presentesIds": [1234]`. Feche (Ctrl+C) e rode `npm start` de novo. Dá para trocar os nomes dos
candidatos no mesmo arquivo.
