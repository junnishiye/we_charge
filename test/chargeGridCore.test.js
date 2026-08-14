import assert from "node:assert/strict";
import test from "node:test";
import { ChargeGridCore } from "../src/core/chargeGridCore.js";

function quietCore() {
  const core = new ChargeGridCore();
  core.logs = [];
  core.protocolMessages = [];
  return core;
}

test("libera a potência solicitada quando a demanda está dentro do limite", () => {
  const core = quietCore();
  const first = core.startSession({
    vehicle: "Veículo A",
    connectorId: 1,
    userType: "Comum",
    requestedKw: 22,
    plannedMinutes: 60,
  });
  const second = core.startSession({
    vehicle: "Veículo B",
    connectorId: 2,
    userType: "Assinante",
    requestedKw: 11,
    plannedMinutes: 60,
  });

  assert.equal(first.allocatedKw, 22);
  assert.equal(second.allocatedKw, 11);
  assert.equal(core.totalAllocatedKw(), 33);
});

test("balanceia a demanda sem ultrapassar o limite após arredondamento", () => {
  const core = quietCore();
  core.siteLimitKw = 20;
  for (let connectorId = 1; connectorId <= 3; connectorId += 1) {
    core.startSession({
      vehicle: `Veículo ${connectorId}`,
      connectorId,
      userType: "Comum",
      requestedKw: 11,
      plannedMinutes: 60,
    });
  }

  assert.ok(core.totalAllocatedKw() <= 20);
  assert.equal(core.activeSessions().every((session) => session.allocatedKw < session.requestedKw), true);
});

test("prioriza frota e assinante durante o balanceamento", () => {
  const core = quietCore();
  core.siteLimitKw = 20;
  const visitor = core.startSession({
    vehicle: "Visitante",
    connectorId: 1,
    userType: "Visitante",
    requestedKw: 20,
    plannedMinutes: 60,
  });
  const fleet = core.startSession({
    vehicle: "Frota",
    connectorId: 2,
    userType: "Frota",
    requestedKw: 20,
    plannedMinutes: 60,
  });

  assert.ok(fleet.allocatedKw > visitor.allocatedKw);
  assert.equal(core.totalAllocatedKw(), 20);
});

test("impede duas sessões ativas no mesmo conector", () => {
  const core = quietCore();
  const payload = {
    vehicle: "Veículo A",
    connectorId: 1,
    userType: "Comum",
    requestedKw: 11,
    plannedMinutes: 60,
  };
  core.startSession(payload);
  assert.throws(() => core.startSession({ ...payload, vehicle: "Veículo B" }), /já está em uso/);
});

test("limita o último avanço ao tempo restante da sessão", () => {
  const core = quietCore();
  const session = core.startSession({
    vehicle: "Veículo A",
    connectorId: 1,
    userType: "Comum",
    requestedKw: 22,
    plannedMinutes: 10,
  });
  core.advanceTime(15);

  assert.equal(session.elapsedMinutes, 10);
  assert.equal(session.energyKwh, 3.667);
  assert.equal(session.status, "Finalizada");
});

test("não gera telemetria para uma sessão finalizada selecionada", () => {
  const core = quietCore();
  const session = core.startSession({
    vehicle: "Veículo A",
    connectorId: 1,
    userType: "Comum",
    requestedKw: 11,
    plannedMinutes: 60,
  });
  core.finishSession(session.sessionId);
  const before = core.protocolMessages.length;
  const generated = core.simulateProtocolExchange(session.sessionId);

  assert.equal(generated, 0);
  assert.equal(core.protocolMessages.length, before);
});

test("cenário automático cria quatro sessões e aplica o limite de 60 kW", () => {
  const core = quietCore();
  const created = core.createAutoScenario();

  assert.equal(created, 4);
  assert.equal(core.activeSessions().length, 4);
  assert.equal(core.totalRequestedKw(), 62.4);
  assert.ok(core.totalAllocatedKw() <= 60);
  assert.deepEqual(
    core.activeSessions().map((session) => session.connectorId),
    [1, 2, 3, 4],
  );
});

test("relatório inclui indicadores e detalhes das sessões", () => {
  const core = quietCore();
  const session = core.startSession({
    vehicle: "Veículo de teste",
    connectorId: 1,
    userType: "Assinante",
    requestedKw: 22,
    plannedMinutes: 60,
  });
  core.advanceTime(15);
  const report = core.generateReport();

  assert.match(report, /RELATÓRIO OPERACIONAL/);
  assert.match(report, new RegExp(session.sessionId));
  assert.match(report, /Veículo de teste/);
  assert.match(report, /Energia registrada/);
});

test("meta por valor encerra exatamente no teto autorizado", () => {
  const core = quietCore();
  core.baseTariff = 1;
  core.simulatedHour = 12;
  core.siteLimitKw = 100;
  const session = core.startSession({
    vehicle: "Veículo com orçamento",
    connectorId: 1,
    userType: "Comum",
    requestedKw: 10,
    plannedMinutes: 30,
    targetMode: "money",
    targetAmountBrl: 5,
  });

  core.advanceTime(60);

  assert.equal(session.status, "Finalizada");
  assert.equal(session.completionReason, "money_target");
  assert.equal(session.energyKwh, 5);
  assert.equal(session.elapsedMinutes, 30);
  assert.equal(session.totalCost, 5);
  assert.ok(session.totalCostExact <= 5);
});

test("meta por tempo usa somente os minutos escolhidos", () => {
  const core = quietCore();
  core.baseTariff = 1;
  core.simulatedHour = 12;
  core.siteLimitKw = 100;
  const session = core.startSession({
    vehicle: "Veículo por tempo",
    connectorId: 1,
    userType: "Comum",
    requestedKw: 10,
    plannedMinutes: 30,
    targetMode: "time",
    targetMinutes: 30,
  });

  core.advanceTime(60);

  assert.equal(session.status, "Finalizada");
  assert.equal(session.completionReason, "time_target");
  assert.equal(session.energyKwh, 5);
  assert.equal(session.elapsedMinutes, 30);
  assert.equal(session.totalCost, 5);
});

test("meta por potência preserva a potência escolhida e respeita o teto financeiro", () => {
  const core = quietCore();
  core.baseTariff = 1;
  core.simulatedHour = 12;
  core.siteLimitKw = 100;
  const session = core.startSession({
    vehicle: "Veículo com controle de potência",
    connectorId: 1,
    userType: "Comum",
    requestedKw: 5,
    targetMode: "power",
    targetPowerKw: 5,
    targetAmountBrl: 5,
  });

  core.advanceTime(90);

  assert.equal(session.requestedKw, 5);
  assert.equal(session.status, "Finalizada");
  assert.equal(session.completionReason, "spending_cap");
  assert.equal(session.totalCost, 5);
});

test("meta por potência sem teto opcional segue até completar a bateria", () => {
  const core = quietCore();
  core.baseTariff = 1;
  core.simulatedHour = 12;
  core.siteLimitKw = 100;
  const session = core.startSession({
    vehicle: "Veículo sem teto adicional",
    connectorId: 1,
    connectorType: "Tipo 2",
    connectorMaxKw: 22,
    userType: "Comum",
    requestedKw: 5,
    targetMode: "power",
    targetPowerKw: 5,
    targetAmountBrl: null,
    batteryCapacityKwh: 10,
    initialSoc: 50,
    targetSoc: 100,
    vehicleMaxPowerKw: 7,
  });

  core.advanceTime(120);

  assert.equal(session.status, "Finalizada");
  assert.equal(session.completionReason, "battery_full");
  assert.equal(session.elapsedMinutes, 60);
  assert.equal(session.totalCost, 5);
});

test("meta por tempo também encerra no teto financeiro de segurança", () => {
  const core = quietCore();
  core.baseTariff = 1;
  core.simulatedHour = 12;
  core.siteLimitKw = 100;
  const session = core.startSession({
    vehicle: "Veículo por tempo com teto",
    connectorId: 1,
    userType: "Comum",
    requestedKw: 10,
    plannedMinutes: 120,
    targetMode: "time",
    targetMinutes: 120,
    targetAmountBrl: 5,
  });

  core.advanceTime(60);

  assert.equal(session.status, "Finalizada");
  assert.equal(session.completionReason, "spending_cap");
  assert.equal(session.elapsedMinutes, 30);
  assert.equal(session.totalCost, 5);
});

test("bateria cheia encerra antes do orçamento e nunca passa de 100%", () => {
  const core = quietCore();
  core.baseTariff = 1;
  core.simulatedHour = 12;
  core.siteLimitKw = 100;
  const session = core.startSession({
    vehicle: "Veículo identificado",
    connectorId: 1,
    connectorType: "CCS2",
    connectorMaxKw: 60,
    userType: "Comum",
    requestedKw: 20,
    plannedMinutes: 300,
    targetMode: "money",
    targetAmountBrl: 4.4,
    batteryCapacityKwh: 40,
    initialSoc: 90,
    targetSoc: 100,
    vehicleMaxPowerKw: 20,
  });

  core.advanceTime(15);

  assert.equal(session.status, "Finalizada");
  assert.equal(session.completionReason, "battery_full");
  assert.equal(session.energyKwh, 4);
  assert.equal(session.elapsedMinutes, 12);
  assert.equal(session.currentSoc, 100);
  assert.equal(session.totalCost, 4.4);
});

test("rejeita autorização acima do custo estimado para completar o veículo", () => {
  const core = quietCore();
  core.baseTariff = 1;
  core.simulatedHour = 12;
  core.siteLimitKw = 100;

  assert.throws(() => core.startSession({
    vehicle: "Veículo com limite financeiro",
    connectorId: 1,
    connectorType: "Tipo 2",
    connectorMaxKw: 22,
    userType: "Comum",
    requestedKw: 7,
    plannedMinutes: 60,
    targetMode: "money",
    targetAmountBrl: 100,
    batteryCapacityKwh: 40,
    initialSoc: 90,
    targetSoc: 100,
    vehicleMaxPowerKw: 7,
  }), /custo estimado do veículo/);
});

test("rejeita potência solicitada acima do limite físico do veículo", () => {
  const core = quietCore();

  assert.throws(() => core.startSession({
    vehicle: "Veículo limitado a 7 kW",
    connectorId: 1,
    connectorType: "Tipo 2",
    connectorMaxKw: 22,
    userType: "Comum",
    requestedKw: 22,
    plannedMinutes: 60,
    vehicleMaxPowerKw: 7,
  }), /limite do veículo/);
});

test("tarifa projetada detalha fatores multiplicativos", () => {
  const core = quietCore();
  core.baseTariff = 0.805;
  core.siteLimitKw = 60;
  core.simulatedHour = 20;

  const breakdown = core.calculateProjectedTariff({ userType: "Assinante", requestedKw: 50 });

  assert.equal(breakdown.finalTariff, 1.033);
  assert.deepEqual(
    breakdown.factors.map((factor) => [factor.id, factor.percent]),
    [["peak", 20], ["demand", 8], ["profile", -10], ["power", 10]],
  );
});

test("hidratação converte sessão antiga em meta por tempo", () => {
  const core = new ChargeGridCore({
    sessions: [{
      sessionId: "S001",
      vehicle: "Sessão antiga",
      connectorId: 1,
      userType: "Comum",
      requestedKw: 11,
      plannedMinutes: 45,
      status: "Ativa",
      allocatedKw: 11,
      elapsedMinutes: 0,
      energyKwh: 0,
      totalCost: 0,
    }],
    nextId: 2,
  });

  assert.equal(core.sessions[0].targetMode, "time");
  assert.equal(core.sessions[0].targetMinutes, 45);
  assert.equal(core.sessions[0].energyKwhExact, 0);
  assert.equal(core.sessions[0].totalCostExact, 0);
});
