# Avatar Dançante da Live (TEUZS GAMES)

Um boneco 3D estilo bloco dança no palco toda vez que alguém manda presente na sua live.
O nome de quem mandou aparece grande em cima, com confete, e o ranking mostra quem mais fez o boneco dançar.

- **Qualquer presente = Passinho do Jamal**
- Cada presente dá **4 segundos** de dança. Combo soma tempo (máximo 60s).

## Como usar (igual à urna)

1. Precisa do **Node.js** instalado (https://nodejs.org, versão LTS).
2. Abra a pasta `avatar-tiktok-live`, digite `cmd` na barra de endereço e aperte Enter.
3. Só na primeira vez: `npm install`
4. Para ligar: `npm start` (deixe a janela preta aberta).
5. No **TikTok LIVE Studio**: Adicionar fonte → **Navegador / Link** → `http://localhost:3001` → **1080 × 1920**.
6. Comece a live. Quando aparecer `✅ Conectado`, está valendo.

> Usa a porta **3001**, então dá para rodar junto com a urna (que usa a 3000).

## Testar sem live

- Fazer dançar: `http://localhost:3001/teste?nome=Maria&qtd=3`
- Testar outra dança: `http://localhost:3001/teste?nome=Maria&danca=giro` (danças: `jamal`, `giro`, `pulo`, `aura`)
- Zerar o ranking: `http://localhost:3001/zerar`

## Configurar (`config.json`)

| Campo | O que faz |
|---|---|
| `usuarioTikTok` | Seu @ do TikTok (sem o @) |
| `marca` / `contato` | Nome no canto de cima e WhatsApp no rodapé |
| `segundosPorPresente` | Quantos segundos cada presente faz dançar |
| `maxSegundos` | Limite de tempo acumulado |
| `volume` | Volume da batida (0 = sem som). Também dá com `?volume=10` no endereço |
| `dancas` | Qual dança cada presente faz, pelo id. Ex.: `{"8239": "giro", "padrao": "jamal"}` faz a rosa branca girar e o resto fazer o passinho |

O id de cada presente aparece na janela preta quando alguém manda (`🎁 Fulano enviou "Rose" (id 5655)`).

## Importante

- **Não coloque música famosa** na live: dá restrição por direitos autorais, igual ao debate. O jogo já tem uma batidinha própria.
- O boneco é um desenho próprio em estilo bloco, não é o Roblox de verdade.
