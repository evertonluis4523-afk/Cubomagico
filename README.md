# Cubo 3D — Resolvedor 3×3

Aplicativo estático em HTML, CSS e JavaScript para:

- copiar as 54 cores de um cubo mágico 3×3;
- validar se a posição informada pode existir em um cubo real;
- calcular uma solução pelo algoritmo de duas fases de Kociemba;
- reproduzir cada movimento no cubo 3D;
- avançar, voltar, pausar e alterar a velocidade da animação;
- aprender o método iniciante pela aba **Tutorial**.

O cálculo ocorre inteiramente no navegador. Não há servidor, banco de dados, login ou coleta de cores.

## Publicar no GitHub Pages

1. Crie um repositório novo no GitHub.
2. Envie **todos os arquivos e pastas deste pacote** para a raiz do repositório.
3. No GitHub, abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch `main`, pasta `/ (root)`, e clique em **Save**.
6. Aguarde o link público aparecer na própria tela do Pages.

Não altere a estrutura das pastas `vendor/three` e `vendor/cubejs`.

## Abrir no computador

O `index.html` pode ser aberto diretamente. Para usar o resolvedor sem restrições do navegador, é melhor iniciar um servidor local dentro da pasta:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Orientação usada para digitar as cores

- `U`: amarelo, em cima;
- `R`: vermelho, à direita;
- `F`: azul, à frente;
- `D`: branco, embaixo;
- `L`: laranja, à esquerda;
- `B`: verde, atrás.

Os centros são fixos. Para copiar o cubo real, mantenha o centro amarelo em cima, o azul à frente e o vermelho à direita.

## Instalar como aplicativo

O site tem manifesto e ícones próprios (`manifest.webmanifest`, `favicon.ico` e a pasta `icons/`):

- **PC (Chrome):** menu ⋮ → *Transmitir, salvar e compartilhar* → *Instalar página como app* (ou *Criar atalho*). No Edge: menu … → *Aplicativos* → *Instalar este site como um aplicativo*. O atalho na área de trabalho usa o ícone do cubo.
- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.
- **Android (Chrome):** menu ⋮ → *Adicionar à tela inicial*.

Os ícones precisam do site publicado (GitHub Pages ou `http://localhost`); abrindo o `index.html` direto do disco o navegador não oferece a instalação.

## Estrutura

```text
index.html                 Estrutura da página e conteúdo do tutorial
styles.css                 Visual (temas claro e escuro, layout responsivo)
app.js                     Editor, validação, solução, controles e leitura por foto
cube3d.js                  Renderização e animações do cubo 3D
sw.js                      Guarda o app para funcionar sem internet
manifest.webmanifest       Nome, cores e ícones para instalar como app
favicon.ico, icons/        Ícone do cubo (aba, atalho no PC e tela inicial)
vendor/three/              Motor gráfico 3D (Three.js)
vendor/cubejs/             Modelo e resolvedor do cubo (roda em segundo plano)
THIRD_PARTY_LICENSES.md    Créditos das bibliotecas
CHANGELOG.md               Histórico de mudanças
.nojekyll                  Mantém os arquivos intactos no GitHub Pages
```

Não há etapa de build: edite os arquivos e publique. Com internet, o app sempre busca a
versão nova. Se criar, renomear ou apagar um arquivo usado pela página, atualize a lista
`PRECACHE` e a versão (`cubo-3d-vN`) no `sw.js`, para o modo offline continuar completo.

## Enviar mudanças pelo site do GitHub

Em **Add file → Upload files**, antes de clicar em *Commit changes*, troque o texto
"Add files via upload" por uma frase que diga o que mudou, por exemplo
"Corrige cor laranja no 3D". Depois, anote a mudança no `CHANGELOG.md`.

## Controles da solução

- Toque (ou clique) no cubo para avançar; no terço esquerdo, volta. Arrastar continua girando a câmera.
- No computador: setas ← → avançam e voltam, espaço reproduz ou pausa.
- As cores e o movimento atual ficam salvos no navegador: ao reabrir, o app continua de onde parou.

## Compatibilidade

Funciona nos navegadores atuais com WebGL habilitado. O layout se adapta a computador e celular.
