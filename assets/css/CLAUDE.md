# assets/css
`style.css` único, organizado por seções com comentários (`/* Tokens de tema */`, `/* Base */`, ..., `/* Responsivo, impressão e preferências do usuário */`); todos os `@media`/`@supports` ficam no final. Formatado com Prettier (`npx prettier --write assets/css/style.css`).
- Tema por `[data-theme]` em `<html>` (`js/theme-init.js`: preferência salva > tema do sistema).
- Cores, raios e altura (`--app-height`) vêm de tokens em `:root`/`[data-theme="dark"]`; não use hex fixo para marca/perigo.
- Sem estilos inline (CSP). Foco: regra global `:where(...):focus-visible`. Hover só em `@media (hover: hover)`. Alvos de toque 44px em `(pointer: coarse)`.
- Fonte Inter local (`assets/fonts`), ícones em sprite SVG no `index.html` (`<svg class="icon"><use href="#i-nome"/></svg>`), sem emojis. Tipos de dia têm tokens `--type-*` (tags, calendário, legenda).
- Fonte mínima 0.75rem (testado em `tests/css.test.js`). Diálogos: altura máxima e `overscroll-behavior` na regra base.
