# Meu Banco de Horas

Aplicação web para registrar jornadas de trabalho e acompanhar o banco de horas mensal.

## Funcionalidades

- Cálculo de saldo diário com meta configurável
- Sugestão de saída baseada no saldo mensal, limitada preventivamente a 9h45 trabalhadas por dia
- Somatório de horas positivas, negativas e saldo líquido
- Registro de folgas, feriados, férias e faltas
- Captura mobile de fotos de entrada e saída vinculadas ao registro
- Câmera interna sem salvar imagens na galeria do dispositivo
- Instalação como PWA no celular ou computador
- Funcionamento offline após o primeiro acesso
- Histórico mensal salvo no navegador
- Edição e exclusão de registros
- Exportação em CSV e PDF
- Backup e restauração em JSON
- Aviso de privacidade e armazenamento exclusivamente local
- Confirmações em modal e notificações não intrusivas
- Tema claro e escuro
- Layout responsivo

## Como usar

Abra o `index.html` no navegador ou acesse a versão publicada no GitHub Pages.

Os registros ficam armazenados localmente no navegador por meio de `localStorage`.

## Instalação

No Android ou em navegadores compatíveis, use o botão **Instalar app**. No iPhone, abra pelo Safari e escolha **Compartilhar > Adicionar à Tela de Início**.

## Testes

Com o Node.js instalado, execute:

```bash
npm test
```

Os testes cobrem jornada com virada de dia, intervalos, faltas, dias abonados, previsão de saída e somatória dos saldos.

## Tecnologias

HTML, CSS e JavaScript, sem dependências externas.
