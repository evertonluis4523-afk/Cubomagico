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
index.html                 Aplicativo completo (CSS, 3D e resolvedor embutidos)
manifest.webmanifest       Nome, cores e ícones para instalar como app
favicon.ico, icons/        Ícone do cubo (aba, atalho no PC e tela inicial)
THIRD_PARTY_LICENSES.md    Créditos das bibliotecas
```

Os arquivos `app.js`, `styles.css`, `cube3d.js` etc. na raiz são cópias antigas das partes embutidas no `index.html` e **não são carregados** pela página.

## Compatibilidade

Funciona nos navegadores atuais com WebGL habilitado. O layout se adapta a computador e celular.
