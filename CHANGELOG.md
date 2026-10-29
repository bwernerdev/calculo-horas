# Histórico de mudanças

## 1.2.0

**Novidades**
- Calendário do ciclo (16 a 15) com cada dia colorido pelo tipo, saldo por dia, dias úteis sem registro e navegação por setas; gráfico de saldo diário e evolução por ciclo.
- Cartões com variação em relação ao ciclo anterior, meta cumprida e previsão de quanto trabalhar por dia útil para zerar o ciclo.
- Botões **Entrada agora** e **Saída agora**; excluir registro mostra **Desfazer** por 6 segundos.
- Intervalo padrão configurável e meta por dia da semana.
- Exportação em XLSX; o PDF ganhou uma página com o calendário e o gráfico.
- Uso offline: cópia local dos registros, fila de alterações e sincronização ao reconectar.
- Backups automáticos diários (sem fotos) na conta, com até 7 cópias.
- Tema acompanha o sistema quando não há preferência salva; login com painel de marca e esqueleto de carregamento.
- Interface renovada: menus Exportar/Importar/Mais, ícones SVG, fonte Inter embutida, tipos de dia coloridos, formulário recolhível e botão flutuante no celular.

**Banco de dados (migrações opcionais)**
- `20261029000000_auto_backup_snapshots`: tabela `backup_snapshots` (backups automáticos).
- `20261029000100_user_preferences`: coluna `settings.preferences` (intervalo padrão e metas por dia).
- Sem elas o aplicativo continua funcionando e avisa quando o recurso não está disponível.

**Qualidade e segurança**
- CSP sem `unsafe-inline` em estilos; pdf.js carregado sob demanda; configuração de produção em um único arquivo.
- ESLint, Prettier (CSS), typecheck por JSDoc, testes de acessibilidade (axe), testes de banco (pgTAP) e comparação visual opcional.
- Dependabot e `npm audit` no CI.

## 1.1.0

Versão anterior ao redesenho (registros, ciclos 16 a 15, importação Forponto, backup JSON, PWA).
