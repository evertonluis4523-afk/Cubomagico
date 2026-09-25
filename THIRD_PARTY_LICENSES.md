# Bibliotecas de terceiros

Este projeto inclui cópias locais das bibliotecas abaixo para funcionar sem depender de uma CDN.

## Three.js 0.128.0

- Projeto: https://github.com/mrdoob/three.js
- Licença: MIT
- Onde está: embutido no `index.html` (`three.min.js` e `OrbitControls.js`)
- Texto integral da licença: `vendor/three/LICENSE`

## cube.js 1.3.2

- Projeto: https://github.com/ldez/cubejs
- Algoritmo de solução: duas fases de Herbert Kociemba
- Licença: MIT
- Onde está: embutido no `index.html` e em `vendor/cubejs/` (usado pelo worker que calcula a solução em segundo plano)
- Texto integral da licença: `vendor/cubejs/LICENSE`
