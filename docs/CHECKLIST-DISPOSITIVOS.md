# Checklist de testes em dispositivos reais

Os testes automáticos rodam em Chromium emulado. Antes de uma versão grande, confira manualmente o que eles não cobrem. Anote o aparelho, o sistema e o navegador de cada teste.

## Aparelhos sugeridos

- iPhone com Safari (instalado como PWA e aberto no navegador)
- Android com Chrome (instalado como PWA e aberto no navegador)
- Desktop com Chrome e com Firefox

## Layout e toque

- [ ] Cabeçalho, cartões e simulação sem rolagem horizontal (portrait e paisagem)
- [ ] Menus **Exportar**, **Importar** e **Mais** abrem como folha na parte de baixo e fecham ao tocar fora
- [ ] O botão flutuante **+** não cobre botões, aparece só fora do formulário e leva até a data
- [ ] Barra do navegador (iOS/Android) e *notch* não cortam o botão flutuante nem os avisos
- [ ] Calendário legível em 320 px; tocar em um dia abre o registro ou preenche a data
- [ ] Diálogos (apagar tudo, Forponto, backups, foto) cabem na tela e a página não rola por trás
- [ ] Teclado do celular: horários aceitam `830`, `8` e `08:30`; campos não ficam escondidos pelo teclado

## Instalação e offline (PWA)

- [ ] **Instalar app** aparece (Android) ou as instruções aparecem (iPhone)
- [ ] Depois de instalado, abre em tela cheia com o ícone correto
- [ ] Modo avião: o app abre com **Modo offline** e mostra os registros
- [ ] Modo avião: salvar um registro mostra "salvo neste dispositivo" e o aviso de pendência
- [ ] Ao reconectar, o aviso some e o registro aparece no outro aparelho
- [ ] Após uma atualização, aparece **Atualizar agora** e a nova versão carrega

## Fotos e arquivos

- [ ] Câmera interna pede permissão, captura e anexa a Entrada/Saída
- [ ] Download de CSV, XLSX, PDF e backup funciona (no iPhone, confira em Arquivos)
- [ ] XLSX abre no Excel/Planilhas com as datas formatadas
- [ ] PDF tem duas páginas (registros e calendário com gráfico)
- [ ] Importar Forponto (XLSX e PDF) e importar backup JSON funcionam

## Leitor de tela (NVDA, VoiceOver ou TalkBack)

- [ ] Menus: o botão anuncia se está aberto ou fechado; as opções são lidas e Esc fecha
- [ ] Calendário: cada dia é lido como `19 +1:10, 19/10/2026, Trabalho, saldo +1h 10min`; as setas movem entre os dias
- [ ] Cartões de resumo, previsão e pendências são lidos na ordem correta
- [ ] Mensagens (toasts, aviso offline, erros) são anunciadas sem roubar o foco
- [ ] Diálogos prendem o foco e devolvem o foco ao botão que os abriu
- [ ] Tela de entrada: rótulos, erros e botão **Mostrar** da senha são lidos corretamente

## Temas e preferências

- [ ] Sem preferência salva, o tema acompanha o sistema (claro/escuro)
- [ ] Alternar o tema persiste após recarregar
- [ ] Contraste confortável em ambos os temas sob luz forte (celular na rua)
- [ ] Com "reduzir movimento" ativado no sistema, não há animações

## Antes de publicar

- [ ] `npm run check` passou
- [ ] Migrações pendentes aplicadas (veja [Configuração do Supabase](CONFIGURACAO-SUPABASE.md))
- [ ] Backup JSON do ambiente de produção exportado
