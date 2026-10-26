"""Câmera Virtual — transmite fotos e vídeos escolhidos como se fossem uma webcam.

Uso:
    python camera_virtual.py [arquivos...]

Depois de clicar em "Iniciar câmera", selecione a câmera virtual
(ex.: "OBS Virtual Camera" ou "CameraVirtual") no Zoom, Meet, Teams, Discord etc.
"""

import os
import sys
import threading
import time

import cv2
import numpy as np

EXTENSOES_IMAGEM = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}
EXTENSOES_VIDEO = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv", ".gif"}

RESOLUCOES = {
    "640x360": (640, 360),
    "640x480": (640, 480),
    "1280x720": (1280, 720),
    "1920x1080": (1920, 1080),
}


def eh_video(caminho):
    return os.path.splitext(caminho)[1].lower() in EXTENSOES_VIDEO


def eh_suportado(caminho):
    ext = os.path.splitext(caminho)[1].lower()
    return ext in EXTENSOES_IMAGEM or ext in EXTENSOES_VIDEO


def ler_imagem(caminho):
    # np.fromfile + imdecode funciona com acentos no caminho (cv2.imread não, no Windows)
    dados = np.fromfile(caminho, dtype=np.uint8)
    img = cv2.imdecode(dados, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError(f"Não foi possível abrir a imagem: {caminho}")
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:
        # Fundo preto para imagens com transparência
        alfa = img[:, :, 3:4].astype(np.float32) / 255.0
        img = (img[:, :, :3].astype(np.float32) * alfa).astype(np.uint8)
    return img


def ajustar(frame, largura, altura, modo):
    """Redimensiona o frame para o tamanho da câmera.

    modo "preencher": corta as bordas para ocupar a tela toda.
    modo "caber": mostra a imagem inteira, com faixas pretas.
    """
    h, w = frame.shape[:2]
    if modo == "preencher":
        escala = max(largura / w, altura / h)
    else:
        escala = min(largura / w, altura / h)
    novo_w, novo_h = max(1, round(w * escala)), max(1, round(h * escala))
    interp = cv2.INTER_AREA if escala < 1 else cv2.INTER_LINEAR
    redim = cv2.resize(frame, (novo_w, novo_h), interpolation=interp)

    saida = np.zeros((altura, largura, 3), dtype=np.uint8)
    # Posição do frame redimensionado dentro da saída (pode ser negativa ao cortar)
    x, y = (largura - novo_w) // 2, (altura - novo_h) // 2
    sx, sy = max(0, -x), max(0, -y)
    dx, dy = max(0, x), max(0, y)
    cw, ch = min(novo_w - sx, largura - dx), min(novo_h - sy, altura - dy)
    saida[dy:dy + ch, dx:dx + cw] = redim[sy:sy + ch, sx:sx + cw]
    return saida


class Midia:
    """Uma foto ou vídeo da playlist, já ajustado ao tamanho da câmera."""

    def __init__(self, caminho, largura, altura, modo):
        self.caminho = caminho
        self.largura, self.altura, self.modo = largura, altura, modo
        self.video = eh_video(caminho)
        self.tempo = 0.0
        if self.video:
            self.cap = cv2.VideoCapture(caminho)
            if not self.cap.isOpened():
                raise ValueError(f"Não foi possível abrir o vídeo: {caminho}")
            fps = self.cap.get(cv2.CAP_PROP_FPS)
            self.fps_video = fps if fps and fps > 0 else 30.0
            self.pos = 0
            self.ultimo = None
        else:
            self.frame = ajustar(ler_imagem(caminho), largura, altura, modo)

    def proximo_frame(self, dt):
        """Avança dt segundos e devolve o frame atual, ou None se o vídeo acabou."""
        self.tempo += dt
        if not self.video:
            return self.frame
        # Lê quantos frames forem necessários para acompanhar o tempo real,
        # assim o vídeo toca na velocidade certa mesmo com FPS diferente da câmera.
        alvo = int(self.tempo * self.fps_video)
        while self.pos <= alvo:
            ok, frame = self.cap.read()
            if not ok:
                return None
            self.pos += 1
            self.ultimo = frame
        return ajustar(self.ultimo, self.largura, self.altura, self.modo)

    def fechar(self):
        if self.video:
            self.cap.release()


class Transmissor:
    """Envia a playlist para a câmera virtual numa thread separada."""

    def __init__(self):
        self.playlist = []
        self.indice = 0
        self.duracao_foto = 5.0
        self.repetir = True
        self.espelhar = False
        self.frame_atual = None  # último frame enviado (BGR), para a pré-visualização
        self.status = "Parado"
        self.erro = None
        self._trava = threading.Lock()
        self._pular_para = None
        self._parar = threading.Event()
        self._thread = None

    @property
    def rodando(self):
        return self._thread is not None and self._thread.is_alive()

    def iniciar(self, largura, altura, fps, modo, backend=None):
        if self.rodando:
            return
        self.erro = None
        self._parar.clear()
        self._thread = threading.Thread(
            target=self._executar, args=(largura, altura, fps, modo, backend), daemon=True
        )
        self._thread.start()

    def parar(self):
        self._parar.set()
        if self._thread:
            self._thread.join(timeout=3)
        self._thread = None
        self.frame_atual = None

    def ir_para(self, indice):
        with self._trava:
            self._pular_para = indice

    def proximo(self):
        self.ir_para(self.indice + 1)

    def anterior(self):
        self.ir_para(self.indice - 1)

    def _abrir(self, indice, largura, altura, modo):
        """Abre a mídia no índice dado, pulando arquivos com erro."""
        with self._trava:
            itens = list(self.playlist)
        if not itens:
            return None
        for _ in range(len(itens)):
            indice %= len(itens)
            try:
                midia = Midia(itens[indice], largura, altura, modo)
                self.indice = indice
                self.status = f"Transmitindo: {os.path.basename(itens[indice])}"
                return midia
            except ValueError as e:
                self.erro = str(e)
                indice += 1
        return None

    def _executar(self, largura, altura, fps, modo, backend):
        import pyvirtualcam

        tela_vazia = np.zeros((altura, largura, 3), dtype=np.uint8)
        try:
            with pyvirtualcam.Camera(
                width=largura, height=altura, fps=fps,
                fmt=pyvirtualcam.PixelFormat.BGR, backend=backend,
            ) as cam:
                self.status = f"Câmera ativa: {cam.device}"
                dt = 1.0 / fps
                midia = self._abrir(self.indice, largura, altura, modo)
                congelado = None  # último frame quando a playlist termina sem repetir

                while not self._parar.is_set():
                    with self._trava:
                        pular, self._pular_para = self._pular_para, None
                        total = len(self.playlist)

                    if pular is not None or (midia is None and total):
                        if midia:
                            midia.fechar()
                        midia = self._abrir(pular if pular is not None else self.indice,
                                            largura, altura, modo)
                        congelado = None

                    frame = None
                    if congelado is not None:
                        frame = congelado
                    elif midia is not None:
                        frame = midia.proximo_frame(dt)
                        terminou = frame is None or (
                            not midia.video and total > 1 and midia.tempo >= self.duracao_foto
                        )
                        if terminou:
                            ultimo_da_lista = self.indice + 1 >= total
                            if ultimo_da_lista and not self.repetir:
                                congelado = frame if frame is not None else self.frame_atual
                                frame = congelado
                                self.status = "Playlist terminou (repetição desligada)"
                            else:
                                midia.fechar()
                                midia = self._abrir(self.indice + 1, largura, altura, modo)
                                if midia is not None:
                                    frame = midia.proximo_frame(0)

                    if frame is None:
                        frame = tela_vazia
                    if self.espelhar:
                        frame = cv2.flip(frame, 1)
                    cam.send(frame)
                    self.frame_atual = frame
                    cam.sleep_until_next_frame()

                if midia:
                    midia.fechar()
        except Exception as e:
            self.erro = (
                f"Não foi possível iniciar a câmera virtual: {e}\n\n"
                "Windows/Mac: instale o OBS Studio (ele fornece o driver da câmera).\n"
                "Linux: carregue o módulo v4l2loopback (veja o README)."
            )
        finally:
            self.status = "Parado"


def iniciar_interface(arquivos_iniciais):
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    transmissor = Transmissor()
    raiz = tk.Tk()
    raiz.title("Câmera Virtual")
    raiz.minsize(760, 480)

    # ---------- Playlist (esquerda) ----------
    esquerda = ttk.Frame(raiz, padding=8)
    esquerda.pack(side="left", fill="y")

    ttk.Label(esquerda, text="Fotos e vídeos").pack(anchor="w")
    lista = tk.Listbox(esquerda, width=36, height=18, activestyle="none")
    lista.pack(fill="y", expand=True, pady=4)

    def atualizar_lista():
        lista.delete(0, "end")
        for i, caminho in enumerate(transmissor.playlist):
            icone = "🎬" if eh_video(caminho) else "🖼"
            marcador = "▶ " if transmissor.rodando and i == transmissor.indice else "   "
            lista.insert("end", f"{marcador}{icone} {os.path.basename(caminho)}")

    def adicionar(caminhos):
        novos = [c for c in caminhos if eh_suportado(c)]
        with transmissor._trava:
            transmissor.playlist.extend(novos)
        atualizar_lista()

    def escolher_arquivos():
        imagens = " ".join(f"*{e}" for e in sorted(EXTENSOES_IMAGEM))
        videos = " ".join(f"*{e}" for e in sorted(EXTENSOES_VIDEO))
        caminhos = filedialog.askopenfilenames(
            title="Escolha fotos e vídeos",
            filetypes=[("Fotos e vídeos", f"{imagens} {videos}"),
                       ("Fotos", imagens), ("Vídeos", videos), ("Todos", "*.*")],
        )
        adicionar(caminhos)

    def escolher_pasta():
        pasta = filedialog.askdirectory(title="Escolha uma pasta")
        if pasta:
            adicionar(sorted(os.path.join(pasta, n) for n in os.listdir(pasta)))

    def selecionado():
        sel = lista.curselection()
        return sel[0] if sel else None

    def remover():
        i = selecionado()
        if i is None:
            return
        with transmissor._trava:
            transmissor.playlist.pop(i)
            if i < transmissor.indice:
                transmissor.indice -= 1
        if i == transmissor.indice and transmissor.rodando:
            transmissor.ir_para(i)
        atualizar_lista()

    def mover(delta):
        i = selecionado()
        if i is None or not 0 <= i + delta < len(transmissor.playlist):
            return
        with transmissor._trava:
            p = transmissor.playlist
            p[i], p[i + delta] = p[i + delta], p[i]
            if transmissor.indice in (i, i + delta):
                transmissor.indice = i + delta if transmissor.indice == i else i
        atualizar_lista()
        lista.selection_set(i + delta)

    def limpar():
        with transmissor._trava:
            transmissor.playlist.clear()
            transmissor.indice = 0
        transmissor.ir_para(0)
        atualizar_lista()

    lista.bind("<Double-Button-1>", lambda _e: (
        transmissor.ir_para(selecionado()) if selecionado() is not None else None))

    botoes = ttk.Frame(esquerda)
    botoes.pack(fill="x")
    ttk.Button(botoes, text="+ Arquivos", command=escolher_arquivos).grid(row=0, column=0, sticky="ew")
    ttk.Button(botoes, text="+ Pasta", command=escolher_pasta).grid(row=0, column=1, sticky="ew")
    ttk.Button(botoes, text="Remover", command=remover).grid(row=0, column=2, sticky="ew")
    ttk.Button(botoes, text="↑ Subir", command=lambda: mover(-1)).grid(row=1, column=0, sticky="ew")
    ttk.Button(botoes, text="↓ Descer", command=lambda: mover(1)).grid(row=1, column=1, sticky="ew")
    ttk.Button(botoes, text="Limpar", command=limpar).grid(row=1, column=2, sticky="ew")
    for c in range(3):
        botoes.columnconfigure(c, weight=1)
    ttk.Label(esquerda, text="Duplo clique em um item para exibi-lo agora.",
              foreground="gray").pack(anchor="w", pady=(6, 0))

    # ---------- Pré-visualização e controles (direita) ----------
    direita = ttk.Frame(raiz, padding=8)
    direita.pack(side="left", fill="both", expand=True)

    PREVIA_W, PREVIA_H = 480, 270
    previa = tk.Label(direita, background="black", width=PREVIA_W, height=PREVIA_H)
    previa.pack(pady=(0, 8))
    imagem_vazia = tk.PhotoImage(width=PREVIA_W, height=PREVIA_H)
    previa.configure(image=imagem_vazia)

    navegacao = ttk.Frame(direita)
    navegacao.pack(pady=(0, 8))
    ttk.Button(navegacao, text="⏮ Anterior", command=transmissor.anterior).pack(side="left", padx=4)
    botao_iniciar = ttk.Button(navegacao, text="▶ Iniciar câmera")
    botao_iniciar.pack(side="left", padx=4)
    ttk.Button(navegacao, text="Próximo ⏭", command=transmissor.proximo).pack(side="left", padx=4)

    opcoes = ttk.LabelFrame(direita, text="Opções", padding=8)
    opcoes.pack(fill="x")

    var_resolucao = tk.StringVar(value="1280x720")
    var_fps = tk.IntVar(value=30)
    var_modo = tk.StringVar(value="preencher")
    var_duracao = tk.DoubleVar(value=5.0)
    var_repetir = tk.BooleanVar(value=True)
    var_espelhar = tk.BooleanVar(value=False)

    ttk.Label(opcoes, text="Resolução:").grid(row=0, column=0, sticky="w")
    combo_res = ttk.Combobox(opcoes, textvariable=var_resolucao, values=list(RESOLUCOES),
                             state="readonly", width=11)
    combo_res.grid(row=0, column=1, sticky="w", padx=4)
    ttk.Label(opcoes, text="FPS:").grid(row=0, column=2, sticky="w")
    spin_fps = ttk.Spinbox(opcoes, from_=5, to=60, textvariable=var_fps, width=5)
    spin_fps.grid(row=0, column=3, sticky="w", padx=4)

    ttk.Label(opcoes, text="Enquadramento:").grid(row=1, column=0, sticky="w", pady=4)
    radio_preencher = ttk.Radiobutton(opcoes, text="Preencher (corta bordas)",
                                      variable=var_modo, value="preencher")
    radio_preencher.grid(row=1, column=1, columnspan=2, sticky="w")
    radio_caber = ttk.Radiobutton(opcoes, text="Caber inteiro",
                                  variable=var_modo, value="caber")
    radio_caber.grid(row=1, column=3, sticky="w")

    ttk.Label(opcoes, text="Tempo de cada foto (s):").grid(row=2, column=0, sticky="w")
    ttk.Spinbox(opcoes, from_=1, to=3600, increment=1, textvariable=var_duracao,
                width=6).grid(row=2, column=1, sticky="w", padx=4)
    ttk.Checkbutton(opcoes, text="Repetir playlist", variable=var_repetir).grid(
        row=2, column=2, columnspan=2, sticky="w")
    ttk.Checkbutton(opcoes, text="Espelhar imagem", variable=var_espelhar).grid(
        row=3, column=2, columnspan=2, sticky="w")

    # Opções que só podem mudar com a câmera parada
    opcoes_fixas = [combo_res, spin_fps, radio_preencher, radio_caber]

    var_status = tk.StringVar(value="Parado")
    ttk.Label(direita, textvariable=var_status, foreground="gray").pack(anchor="w", pady=(8, 0))

    def mostrar_parado():
        botao_iniciar.configure(text="▶ Iniciar câmera")
        for w in opcoes_fixas:
            w.configure(state="readonly" if w is combo_res else "normal")
        previa.configure(image=imagem_vazia)
        previa.image = imagem_vazia

    def alternar():
        if transmissor.rodando:
            transmissor.parar()
            mostrar_parado()
        else:
            if not transmissor.playlist:
                messagebox.showinfo("Câmera Virtual", "Adicione pelo menos uma foto ou vídeo.")
                return
            largura, altura = RESOLUCOES[var_resolucao.get()]
            try:
                fps = max(5, min(60, int(var_fps.get())))
            except (tk.TclError, ValueError):
                fps = 30
            sel = selecionado()
            transmissor.indice = sel if sel is not None else 0
            transmissor.iniciar(largura, altura, fps, var_modo.get())
            botao_iniciar.configure(text="■ Parar câmera")
            for w in opcoes_fixas:
                w.configure(state="disabled")

    botao_iniciar.configure(command=alternar)

    indice_mostrado = [None]

    def atualizar_tela():
        # Repassa as opções que podem mudar durante a transmissão
        try:
            transmissor.duracao_foto = max(1.0, float(var_duracao.get()))
        except (tk.TclError, ValueError):
            pass
        transmissor.repetir = var_repetir.get()
        transmissor.espelhar = var_espelhar.get()

        if transmissor.erro:
            erro, transmissor.erro = transmissor.erro, None
            messagebox.showerror("Câmera Virtual", erro)
        if not transmissor.rodando and botao_iniciar.cget("text") != "▶ Iniciar câmera":
            mostrar_parado()  # a thread parou sozinha (erro ao abrir a câmera)

        var_status.set(transmissor.status)
        frame = transmissor.frame_atual
        if frame is not None:
            pequeno = ajustar(frame, PREVIA_W, PREVIA_H, "caber")
            # PPM é lido nativamente pelo Tk, sem precisar do Pillow
            ok, ppm = cv2.imencode(".ppm", pequeno)
            if ok:
                foto = tk.PhotoImage(data=ppm.tobytes())
                previa.configure(image=foto)
                previa.image = foto  # mantém referência para não ser coletada

        estado = (transmissor.rodando, transmissor.indice, len(transmissor.playlist))
        if estado != indice_mostrado[0]:
            indice_mostrado[0] = estado
            sel = selecionado()
            atualizar_lista()
            if sel is not None and sel < lista.size():
                lista.selection_set(sel)
        raiz.after(66, atualizar_tela)

    def ao_fechar():
        transmissor.parar()
        raiz.destroy()

    raiz.protocol("WM_DELETE_WINDOW", ao_fechar)
    adicionar(arquivos_iniciais)
    atualizar_tela()
    raiz.mainloop()


if __name__ == "__main__":
    iniciar_interface(sys.argv[1:])
