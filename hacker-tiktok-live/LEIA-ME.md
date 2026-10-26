# Rastreador da Live (TEUZS GAMES)

Quem manda **🌹 rosa** é "localizado": o terminal hacker digita, o mapa de satélite dá zoom do Brasil até
uma **cidade sorteada**, a mira trava e aparece **"🎯 ALVO LOCALIZADO — @fulano — 📍 Cidade - UF"**.
Depois do zoom, abre o **scanner térmico**: uma casinha 3D em linhas verdes (desenho, cada @ tem a sua)
é escaneada de baixo para cima e aparece a silhueta vermelha de "calor" com **"🏠 ALVO DENTRO DE CASA ✔"**.
Nunca é foto de casa real — de propósito, para não expor a casa de ninguém.

No canto, uma "webcam" mostra um cara de capuz com máscara estilo V de Vingança digitando.

> É tudo **sorteado**. Não existe localização real. A tela mostra "localização sorteada · é só brincadeira":
> **deixe esse aviso**, senão alguém pode se assustar e denunciar a live.

## Como usar

1. Precisa do **Node.js** (https://nodejs.org, versão LTS) e de **internet** (o mapa de satélite vem da internet).
2. Na pasta `hacker-tiktok-live`, digite `cmd` na barra de endereço e aperte Enter.
3. Só na primeira vez: `npm install`
4. Para ligar: `npm start` (deixe a janela preta aberta).
5. No **TikTok LIVE Studio**: Adicionar fonte → **Navegador / Link** → `http://localhost:3002` → **1080 × 1920**.

Usa a porta **3002**, então dá para ter os 3 jogos instalados (urna 3000, aura 3001, rastreador 3002).

## Testar sem live

- **Jeito fácil:** abra `http://localhost:3002` no navegador e aperte a tecla **T** (cada T = uma rosa de uma pessoa diferente).

- Simular rosa pelo link: `http://localhost:3002/teste?nome=Maria&arroba=maria123`
- Zerar os alvos: `http://localhost:3002/zerar`

## Webcam com você de máscara (fica muito melhor)

O jogo já vem com um desenho do cara de máscara. Para usar um vídeo de verdade:
- Grave um vídeo seu (ou de alguém) de capuz e máscara, digitando no escuro (uns 10–20 segundos, ele repete).
- Salve como **`webcam.mp4`** dentro da pasta **`public`**. Ele entra no lugar do desenho sozinho.

Ou use sua webcam ao vivo: no LIVE Studio, adicione a **câmera** como fonte e posicione em cima do quadro
da webcam (canto de cima, à direita).

## Configurar (`config.json`)

| Campo | O que faz |
|---|---|
| `usuarioTikTok` | Seu @ do TikTok (sem o @) |
| `marca` / `contato` | Nome em cima e WhatsApp no rodapé |
| `presentesQueLocalizam` | Ids dos presentes que localizam (5655 = rosa) |
| `qualquerPresenteLocaliza` | `true` = qualquer presente localiza |
| `segundosNaTela` | Quanto tempo o resultado fica na tela |
| `volume` | Volume dos bipes (0 = sem som). Também dá com `?volume=10` no endereço |

A mesma pessoa cai sempre na mesma cidade durante a live.
