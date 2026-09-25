# Histórico de mudanças

Os primeiros envios (20/09/2026) entraram pelo site do GitHub com a mensagem genérica
"Add files via upload". O resumo abaixo foi reconstruído a partir do conteúdo de cada um,
para que o histórico faça sentido sem precisar abrir os diffs.

## 25/09/2026

- Tema escuro removido (app só no claro; a câmera continua escura). Sem a sombra
  no chão do 3D, que virava uma mancha cinza no fundo claro. Aviso "Cubo resolvido"
  não cobre mais o cartão de conclusão no celular.
- Meia-volta ("F2") animada como dois giros de 90° com pausa, e o painel conta
  "giro 1 de 2 / 2 de 2". Antes parecia um movimento só.
- **`dc724e1`** Resolvedor em segundo plano (worker) corrigido; funciona sem internet;
  continua de onde parou ao reabrir; toque no cubo e setas do teclado avançam os movimentos.
- **`ad6edb8`** Tema claro com botão sol/lua (depois o escuro foi removido).
- **`2ac2976`** Enquadramento no celular corrigido (abas cobriam o cabeçalho); cubo não
  fica mais atrás do painel do movimento; ícone de cubo para atalho no PC e tela inicial.
- Código separado de novo em arquivos (`styles.css`, `app.js`, `cube3d.js`, `vendor/`),
  dicas visuais de toque no cubo e este histórico.

## 20/09/2026 (envios "Add files via upload")

| Commit | Hora | O que mudou |
| --- | --- | --- |
| `1e2864b` | 02:04 | Primeira versão: interface, editor de cores, cubo 3D, tutorial, README e licenças. |
| `1c78871` | 02:04 | Pacote `.zip` para GitHub Pages (removido depois). |
| `6299162` | 02:22 | Bibliotecas: Three.js, OrbitControls e cube.js (resolvedor Kociemba + worker). |
| `cc07a6b` | 02:24 | CSS e scripts embutidos no `index.html` para abrir sem servidor. |
| `03449df` | 02:35 | Celular: botão "Resolver" e controles da solução fixos no rodapé. |
| `88e7881` | 09:25 | Orientação trocada para amarelo em cima, azul de frente e vermelho à direita; ajustes no tutorial. |
| `670be51` | 20:56 | Laranja mais fiel e luz de preenchimento neutra no 3D. |
| `a6a65a3` | 21:12 | Leitura das cores por foto (primeira versão). |
| `fbc6d64` | 21:32 | Leitura por foto refeita: câmera ao vivo, guia de enquadramento e revisão das faces. |
| `c249b44` | 22:53 | Toque no 3D: bloqueio do zoom por toque duplo; iluminação mais clara. |
| `6bc95da` | 23:08 | Cores mais saturadas; peças e adesivos com cantos arredondados. |
| `88b6058` | 23:24 | Painel do movimento sobre o cubo (letra, seta de giro e graus). |
