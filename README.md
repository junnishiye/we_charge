# ChargeGrid Intelligence

Aplicação web responsiva para demonstrar o gerenciamento inteligente de recargas da Sprint 2. A interface anterior em Tkinter foi mantida apenas como referência; a experiência principal agora é web.

## Executar

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. A tela inicial sempre pede a escolha entre:

- **Aplicativo ChargeGrid:** painel operacional, sessões, eletroposto, protocolos e relatórios.
- **Estação de recarga:** fluxo touch de pagamento, conexão, carregamento e recibo.

Os dois ambientes compartilham o mesmo estado. Sessões e configurações ficam salvas no `localStorage`, mas a escolha do ambiente não é persistida.

## Validação

```bash
npm test
npm run build
```

## Funcionalidades preservadas

- Múltiplas sessões e exclusividade de conector.
- Balanceamento proporcional por limite e prioridade de perfil.
- Tarifação dinâmica por horário, demanda, perfil e potência.
- Avanço simulado do tempo, energia e custo acumulado.
- Cenário automático com quatro veículos.
- Mensagens OCPP-like e MODBUS-like estruturadas.
- Relatório técnico para download em TXT e JSON.

OCPP, MODBUS, pagamento e conexão física são simulações demonstrativas; não há comunicação com equipamento real ou processamento financeiro.

## Fluxo demonstrativo da estação

1. Selecione Tipo 2 ou CCS2 e execute a identificação simulada do veículo.
2. A demo reconhece um BYD Dolphin com bateria de 44,9 kWh e SOC inicial de 38%.
3. Escolha um limite por valor, tempo ou potência no teclado numérico. Nos modos por tempo e potência, você pode ativar opcionalmente um teto financeiro de segurança.
4. Autorize com cartão bancário ou identifique uma conta demonstrativa para usar o **Saldo ChargeGrid**.
5. O sistema impede valor, tempo ou potência acima do máximo calculado para o conjunto veículo + conector. A cobrança final considera apenas a energia consumida.
6. A recarga termina na primeira condição aplicável: limite escolhido, teto financeiro opcional, 100% da bateria ou encerramento manual.
7. A tela de recarga exibe as mensagens OCPP-like e MODBUS-like da sessão e permite atualizar a telemetria.

O Saldo ChargeGrid é uma carteira **digital** de créditos da conta no aplicativo, não um cartão físico. Na demo, use `bella@demo.com`, `joao@demo.com` ou `maria@demo.com`, todos com a senha `123456`. A conta identificada recebe o perfil Assinante; o desconto é consequência desse perfil, e não da forma de pagamento.

## Matemática da simulação

A tarifa começa em `R$ 0,805/kWh`. Os fatores são multiplicativos, nesta ordem:

- das 18h às 21h: `× 1,20`;
- demanda projetada a partir de 80% do limite: `× 1,08`;
- demanda projetada a partir de 100% do limite: `× 1,15` em vez de `× 1,08`;
- Assinante: `× 0,90`;
- Frota: `× 0,95`;
- potência solicitada acima de 11 kW: `× 1,10`.

Exemplo para Assinante, 50 kW, horário de pico e demanda projetada de 83,3%:

```text
0,805 × 1,20 × 1,08 × 0,90 × 1,10 = 1,033 R$/kWh
```

Energia e custo:

```text
energia (kWh) = potência liberada (kW) × tempo (h)
custo (R$) = energia entregue (kWh) × tarifa (R$/kWh)
```

Por isso, `22 kW` descreve potência/velocidade de recarga; `22 kWh` descreveria energia acumulada. Em condição ideal, 22 kW durante 30 minutos entregam 11 kWh. A potência efetiva é limitada pelo menor valor entre carregador, veículo e balanceamento do eletroposto.

No Tipo 2 (AC), a estação entrega corrente alternada e o carregador embarcado do veículo a converte em corrente contínua para a bateria. No CCS2 (DC), a conversão ocorre na estação e a corrente contínua é entregue à bateria. O perfil demonstrativo do Dolphin aceita até 7 kW em AC; por isso, os conectores Tipo 2 de 11 e 22 kW resultam na mesma estimativa: o limite é o carro, não a estação.

Os perfis Comum, Visitante, Assinante e Frota são regras comerciais da simulação. Não há mensalidades Free/Plus/Premium implementadas no motor atual, portanto a aplicação não simula cobrança mensal de plano.
