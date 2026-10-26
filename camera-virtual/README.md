# 📷 Câmera Virtual

Programa que cria uma **webcam virtual** a partir de fotos e vídeos escolhidos por você.
Depois de iniciar, é só selecionar essa câmera no Zoom, Google Meet, Teams, Discord, OBS etc.

## Funcionalidades

- Escolha **fotos** (jpg, png, webp, bmp...) e **vídeos** (mp4, mov, avi, mkv, webm, gif...), um a um ou uma pasta inteira
- Playlist com ordem ajustável. Duplo clique em um item para exibi-lo na hora.
- Botões **Anterior / Próximo** durante a transmissão
- Tempo de exibição de cada foto configurável. Vídeos tocam até o fim, na velocidade original.
- Repetir a playlist ou parar no último item
- Enquadramento **Preencher** (corta as bordas) ou **Caber inteiro** (faixas pretas)
- Resolução (até 1920x1080), FPS e opção de espelhar
- Pré-visualização do que está sendo transmitido

## Instalação

1. Instale o **Python 3.9+** (no Windows, marque "Add Python to PATH").
2. Instale o driver da câmera virtual:
   - **Windows / macOS:** instale o [OBS Studio](https://obsproject.com). Ele fornece a câmera
     "OBS Virtual Camera". No macOS, abra o OBS uma vez e clique em "Iniciar câmera virtual"
     para registrar a extensão.
   - **Linux:**
     ```bash
     sudo apt install v4l2loopback-dkms python3-tk
     sudo modprobe v4l2loopback devices=1 exclusive_caps=1 card_label="CameraVirtual"
     ```
3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

## Como usar

```bash
python camera_virtual.py
```

1. Clique em **+ Arquivos** ou **+ Pasta** e escolha suas fotos ou vídeos.
2. Ajuste as opções e clique em **▶ Iniciar câmera**.
3. No app de videochamada, escolha a câmera **OBS Virtual Camera** (Windows/macOS) ou
   **CameraVirtual** (Linux).

Também dá para passar arquivos direto na linha de comando:
`python camera_virtual.py foto1.jpg video.mp4`

> Se o OBS estiver aberto com a câmera virtual dele ligada, desligue-a antes. Só um
> programa por vez pode usar a câmera.

> O áudio dos vídeos não é transmitido, só a imagem.
