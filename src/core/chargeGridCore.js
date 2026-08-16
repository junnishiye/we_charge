const USER_PRIORITY = Object.freeze({
  Frota: 1.15,
  Assinante: 1.08,
  Comum: 1,
  Visitante: 0.95,
});

const USER_DISCOUNT = Object.freeze({
  Frota: -0.05,
  Assinante: -0.1,
  Comum: 0,
  Visitante: 0,
});

const ACTIVE_STATUS = "Ativa";

function nowIso() {
  return new Date().toISOString();
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class ChargeGridCore {
  constructor(data = null) {
    this.sessions = [];
    this.logs = [];
    this.protocolMessages = [];
    this.nextId = 1;
    this.siteLimitKw = 60;
    this.baseTariff = 0.805;
    this.simulatedHour = new Date().getHours();
    this.minimumUsefulPowerKw = 3.7;

    if (data) {
      this.hydrate(data);
      return;
    }

    this.log("Sistema inicializado. Limite padrão do eletroposto: 60 kW.");
    this.addOcppBootNotification();
  }

  hydrate(data) {
    this.sessions = Array.isArray(data.sessions)
      ? data.sessions.map((session) => {
          const plannedMinutes = Number(session.plannedMinutes) || 60;
          const targetMode = ["money", "time", "power"].includes(session.targetMode)
            ? session.targetMode
            : "time";
          const batteryCapacityKwh = optionalNumber(session.batteryCapacityKwh);
          const initialSoc = optionalNumber(session.initialSoc);
          return {
            ...session,
            plannedMinutes,
            targetMode,
            targetMinutes: targetMode === "time" ? optionalNumber(session.targetMinutes) ?? plannedMinutes : null,
            targetAmountBrl: optionalNumber(session.targetAmountBrl),
            targetPowerKw: targetMode === "power" ? optionalNumber(session.targetPowerKw) : null,
            batteryCapacityKwh,
            initialSoc,
            currentSoc: optionalNumber(session.currentSoc) ?? initialSoc,
            targetSoc: optionalNumber(session.targetSoc) ?? (batteryCapacityKwh ? 100 : null),
            chargingEfficiency: optionalNumber(session.chargingEfficiency) ?? 1,
            energyKwhExact: optionalNumber(session.energyKwhExact) ?? (Number(session.energyKwh) || 0),
            totalCostExact: optionalNumber(session.totalCostExact) ?? (Number(session.totalCost) || 0),
            completionReason: session.completionReason ?? null,
          };
        })
      : [];
    this.logs = Array.isArray(data.logs) ? [...data.logs] : [];
    this.protocolMessages = Array.isArray(data.protocolMessages)
      ? data.protocolMessages.map((message) => ({ ...message, payload: { ...message.payload } }))
      : [];
    this.nextId = Number(data.nextId) || 1;
    this.siteLimitKw = Number(data.siteLimitKw) || 60;
    this.baseTariff = Number(data.baseTariff) || 0.805;
    this.simulatedHour = Number.isInteger(Number(data.simulatedHour))
      ? Number(data.simulatedHour)
      : new Date().getHours();
    this.minimumUsefulPowerKw = Number(data.minimumUsefulPowerKw) || 3.7;
  }

  toJSON() {
    return {
      sessions: this.sessions,
      logs: this.logs.slice(-400),
      protocolMessages: this.protocolMessages.slice(-200),
      nextId: this.nextId,
      siteLimitKw: this.siteLimitKw,
      baseTariff: this.baseTariff,
      simulatedHour: this.simulatedHour,
      minimumUsefulPowerKw: this.minimumUsefulPowerKw,
    };
  }

  reset() {
    this.sessions = [];
    this.logs = [];
    this.protocolMessages = [];
    this.nextId = 1;
    this.log("Simulação reiniciada com sucesso.");
    this.addOcppBootNotification();
  }

  log(message) {
    const time = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
    this.logs.push({ time, message, id: `${Date.now()}-${this.logs.length}` });
  }

  activeSessions() {
    return this.sessions.filter((session) => session.status === ACTIVE_STATUS);
  }

  finishedSessions() {
    return this.sessions.filter((session) => session.status !== ACTIVE_STATUS);
  }

  getSession(sessionId) {
    return this.sessions.find((session) => session.sessionId === sessionId) ?? null;
  }

  totalRequestedKw() {
    return round(this.activeSessions().reduce((total, session) => total + session.requestedKw, 0));
  }

  totalAllocatedKw() {
    return round(this.activeSessions().reduce((total, session) => total + session.allocatedKw, 0));
  }

  totalEnergyKwh() {
    return round(this.sessions.reduce((total, session) => total + session.energyKwh, 0));
  }

  totalRevenue() {
    return round(this.sessions.reduce((total, session) => total + session.totalCost, 0));
  }

  demandRatio() {
    return this.siteLimitKw > 0 ? this.totalRequestedKw() / this.siteLimitKw : 0;
  }

  metrics() {
    return {
      activeCount: this.activeSessions().length,
      finishedCount: this.finishedSessions().length,
      requestedKw: this.totalRequestedKw(),
      allocatedKw: this.totalAllocatedKw(),
      energyKwh: this.totalEnergyKwh(),
      revenue: this.totalRevenue(),
      demandRatio: this.demandRatio(),
    };
  }

  protocolLog(title, protocol, type, payload, sessionId = null) {
    this.protocolMessages.push({
      id: `${Date.now()}-${this.protocolMessages.length}`,
      title,
      protocol,
      type,
      payload,
      sessionId,
      timestamp: nowIso(),
    });
    this.log(title);
  }

  addOcppBootNotification() {
    const payload = {
      protocol: "OCPP-like",
      messageType: "BootNotification",
      chargePointVendor: "wecharge",
      chargePointModel: "WC-Smart-Station",
      firmwareVersion: "3.0.0-web",
      timestamp: nowIso(),
      status: "Accepted",
    };
    this.protocolLog("BootNotification aceita pelo sistema central", "OCPP", "BootNotification", payload);
  }

  addOcppStartTransaction(session) {
    const payload = {
      protocol: "OCPP-like",
      messageType: "StartTransaction",
      transactionId: session.sessionId,
      connectorId: session.connectorId,
      idTag: session.userType,
      meterStart_kWh: round(session.energyKwh, 3),
      timestamp: session.startTime,
    };
    this.protocolLog(
      `StartTransaction · ${session.sessionId}`,
      "OCPP",
      "StartTransaction",
      payload,
      session.sessionId,
    );
  }

  addOcppMeterValues(session) {
    const sampledValue = [
      {
        measurand: "Energy.Active.Import.Register",
        value: round(session.energyKwh, 3),
        unit: "kWh",
      },
      {
        measurand: "Power.Active.Import",
        value: round(session.allocatedKw, 2),
        unit: "kW",
      },
    ];
    if (Number.isFinite(session.currentSoc)) {
      sampledValue.push({ measurand: "SoC", value: round(session.currentSoc, 1), unit: "Percent" });
    }
    const payload = {
      protocol: "OCPP-like",
      messageType: "MeterValues",
      transactionId: session.sessionId,
      connectorId: session.connectorId,
      meterValue: [
        {
          timestamp: nowIso(),
          sampledValue,
        },
      ],
    };
    this.protocolLog(`MeterValues · ${session.sessionId}`, "OCPP", "MeterValues", payload, session.sessionId);
  }

  addOcppSmartChargingProfile(session) {
    const payload = {
      protocol: "OCPP-like",
      messageType: "SetChargingProfile",
      transactionId: session.sessionId,
      connectorId: session.connectorId,
      chargingProfile: {
        chargingProfilePurpose: "TxProfile",
        chargingProfileKind: "Absolute",
        chargingSchedule: {
          chargingRateUnit: "W",
          chargingSchedulePeriod: [{ startPeriod: 0, limit: Math.round(session.allocatedKw * 1000) }],
        },
      },
    };
    this.protocolLog(
      `Perfil de carga atualizado · ${session.sessionId}`,
      "OCPP",
      "SetChargingProfile",
      payload,
      session.sessionId,
    );
  }

  addOcppVehicleIdentification(session) {
    if (!session.batteryCapacityKwh) return;
    const payload = {
      protocol: "OCPP-like",
      messageType: "DataTransfer",
      vendorId: "wecharge.Demo.VehicleIdentification",
      transactionId: session.sessionId,
      data: {
        model: session.vehicle,
        batteryCapacity_kWh: session.batteryCapacityKwh,
        stateOfCharge_percent: session.currentSoc,
        acceptedPower_kW: session.vehicleMaxPowerKw,
        simulated: true,
      },
    };
    this.protocolLog(
      `Veículo identificado · ${session.sessionId}`,
      "OCPP",
      "DataTransfer",
      payload,
      session.sessionId,
    );
  }

  addOcppStopTransaction(session) {
    const payload = {
      protocol: "OCPP-like",
      messageType: "StopTransaction",
      transactionId: session.sessionId,
      connectorId: session.connectorId,
      meterStop_kWh: round(session.energyKwh, 3),
      reason: "Local",
      timestamp: nowIso(),
      totalCost_BRL: round(session.totalCost),
    };
    this.protocolLog(
      `StopTransaction · ${session.sessionId}`,
      "OCPP",
      "StopTransaction",
      payload,
      session.sessionId,
    );
  }

  addModbusReadRegisters(session) {
    const payload = {
      protocol: "MODBUS-like",
      functionCode: "04 - Read Input Registers",
      slaveId: session.connectorId,
      registers: {
        "30001_power_deci_kW": Math.round(session.allocatedKw * 10),
        "30002_energy_centi_kWh": Math.round(session.energyKwh * 100),
        "30003_connector_status": session.status === ACTIVE_STATUS ? 1 : 0,
      },
    };
    this.protocolLog(
      `Leitura de registradores · ${session.sessionId}`,
      "MODBUS",
      "ReadInputRegisters",
      payload,
      session.sessionId,
    );
  }

  addModbusWriteLimit(session) {
    const payload = {
      protocol: "MODBUS-like",
      functionCode: "06 - Write Single Register",
      slaveId: session.connectorId,
      register: "40001_power_limit_deci_kW",
      value: Math.round(session.allocatedKw * 10),
      echoResponse: true,
    };
    this.protocolLog(
      `Limite de potência enviado · ${session.sessionId}`,
      "MODBUS",
      "WriteSingleRegister",
      payload,
      session.sessionId,
    );
  }

  simulateProtocolExchange(selectedSessionId = null) {
    let sessions = this.activeSessions();
    if (selectedSessionId) {
      const selected = this.getSession(selectedSessionId);
      sessions = selected?.status === ACTIVE_STATUS ? [selected] : [];
    }
    if (!sessions.length) {
      this.log("Nenhuma sessão ativa para simular OCPP/MODBUS.");
      return 0;
    }
    sessions.forEach((session) => {
      this.addOcppMeterValues(session);
      this.addOcppSmartChargingProfile(session);
      this.addModbusReadRegisters(session);
      this.addModbusWriteLimit(session);
    });
    return sessions.length;
  }

  startSession({
    vehicle,
    connectorId,
    connectorType = null,
    connectorMaxKw = null,
    userType,
    requestedKw,
    plannedMinutes,
    targetMode = "time",
    targetAmountBrl = null,
    targetMinutes = null,
    targetPowerKw = null,
    batteryCapacityKwh = null,
    initialSoc = null,
    targetSoc = 100,
    vehicleMaxPowerKw = null,
    chargingEfficiency = 1,
  }) {
    const connector = Number(connectorId);
    const requested = Number(requestedKw);
    const mode = ["money", "time", "power"].includes(targetMode) ? targetMode : "time";
    const targetTime = mode === "time" ? Number(targetMinutes ?? plannedMinutes) : null;
    const planned = Number(plannedMinutes ?? targetTime);
    const targetAmount = optionalNumber(targetAmountBrl);
    const targetPower = mode === "power" ? Number(targetPowerKw) : null;
    const connectorLimit = optionalNumber(connectorMaxKw);
    const vehicleLimit = optionalNumber(vehicleMaxPowerKw);
    const capacity = optionalNumber(batteryCapacityKwh);
    const startingSoc = optionalNumber(initialSoc);
    const desiredSoc = capacity ? Number(targetSoc) : null;
    const efficiency = Number(chargingEfficiency);

    if (!Number.isFinite(requested) || requested <= 0) {
      throw new Error("A potência solicitada precisa ser maior que zero.");
    }
    if (connectorLimit !== null && requested > connectorLimit) {
      throw new Error(`A potência solicitada não pode superar o conector (${connectorLimit} kW).`);
    }
    if (vehicleLimit !== null && requested > vehicleLimit) {
      throw new Error(`A potência solicitada não pode superar o limite do veículo (${vehicleLimit} kW).`);
    }
    if (mode !== "power" && (!Number.isFinite(planned) || planned <= 0)) {
      throw new Error("O tempo planejado precisa ser maior que zero.");
    }
    if (targetAmount !== null && targetAmount <= 0) {
      throw new Error("O valor máximo autorizado precisa ser maior que zero.");
    }
    if (mode === "money" && targetAmount === null) {
      throw new Error("Informe o valor máximo autorizado.");
    }
    if (mode === "time" && (!Number.isFinite(targetTime) || targetTime <= 0)) {
      throw new Error("O tempo escolhido precisa ser maior que zero.");
    }
    if (mode === "power" && (!Number.isFinite(targetPower) || targetPower <= 0 || targetPower > requested)) {
      throw new Error("O limite de potência precisa ser positivo e não pode superar a potência solicitada.");
    }
    if ((capacity === null) !== (startingSoc === null)) {
      throw new Error("Informe a capacidade da bateria e o estado de carga juntos.");
    }
    if (capacity !== null && capacity <= 0) {
      throw new Error("A capacidade da bateria precisa ser maior que zero.");
    }
    if (startingSoc !== null && (startingSoc < 0 || startingSoc > 100)) {
      throw new Error("O estado de carga precisa estar entre 0% e 100%.");
    }
    if (capacity !== null && (!Number.isFinite(desiredSoc) || desiredSoc <= startingSoc || desiredSoc > 100)) {
      throw new Error("O estado de carga alvo precisa ser maior que o atual e de no máximo 100%.");
    }
    if (!Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 1) {
      throw new Error("A eficiência de carga precisa estar entre 0 e 1.");
    }
    if (!Number.isInteger(connector) || connector <= 0) {
      throw new Error("O conector precisa ser um número inteiro positivo.");
    }
    if (!(userType in USER_PRIORITY)) {
      throw new Error("Tipo de usuário inválido.");
    }
    if (this.activeSessions().some((session) => session.connectorId === connector)) {
      throw new Error(`O conector ${connector} já está em uso por outra sessão ativa.`);
    }

    if (capacity !== null) {
      const energyToTargetKwh = capacity * ((desiredSoc - startingSoc) / 100) / efficiency;
      const estimatedTariff = this.calculateProjectedTariff({ userType, requestedKw: requested }).finalTariff;
      const maximumEstimatedCost = energyToTargetKwh * estimatedTariff;
      const maximumEstimatedMinutes = Math.ceil((energyToTargetKwh / requested) * 60);
      if (targetAmount !== null && targetAmount > maximumEstimatedCost + 0.005) {
        throw new Error(`O teto financeiro supera o custo estimado do veículo (R$ ${maximumEstimatedCost.toFixed(2)}).`);
      }
      if (mode === "time" && targetTime > maximumEstimatedMinutes) {
        throw new Error(`O tempo escolhido supera a estimativa até a carga alvo (${maximumEstimatedMinutes} min).`);
      }
    }

    const session = {
      sessionId: `S${String(this.nextId).padStart(3, "0")}`,
      vehicle: String(vehicle ?? "").trim() || `Veículo ${String(this.nextId).padStart(2, "0")}`,
      connectorId: connector,
      userType,
      requestedKw: requested,
      plannedMinutes: mode === "power" ? 24 * 60 : planned,
      targetMode: mode,
      targetAmountBrl: targetAmount,
      targetMinutes: targetTime,
      targetPowerKw: targetPower,
      connectorType,
      connectorMaxKw: connectorLimit,
      vehicleMaxPowerKw: vehicleLimit,
      batteryCapacityKwh: capacity,
      initialSoc: startingSoc,
      currentSoc: startingSoc,
      targetSoc: desiredSoc,
      chargingEfficiency: efficiency,
      startTime: nowIso(),
      endTime: null,
      status: ACTIVE_STATUS,
      allocatedKw: 0,
      elapsedMinutes: 0,
      energyKwh: 0,
      energyKwhExact: 0,
      currentTariff: 0,
      totalCost: 0,
      totalCostExact: 0,
      controlReason: "Aguardando controle",
      completionReason: null,
    };

    this.nextId += 1;
    this.sessions.push(session);
    this.addOcppStartTransaction(session);
    this.addOcppVehicleIdentification(session);
    this.log(
      `Sessão ${session.sessionId} iniciada no conector ${connector}: ${requested.toFixed(1)} kW solicitados.`,
    );
    this.recalculatePowerDistribution();
    return session;
  }

  finishSession(sessionId, reason = "Sessão encerrada pelo operador") {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Sessão não encontrada.");
    if (session.status !== ACTIVE_STATUS) throw new Error("Esta sessão já está finalizada.");

    session.status = "Finalizada";
    session.endTime = nowIso();
    session.allocatedKw = 0;
    session.controlReason = reason;
    session.completionReason = "manual";
    this.addOcppStopTransaction(session);
    this.log(
      `Sessão ${session.sessionId} finalizada: ${session.energyKwh.toFixed(2)} kWh e R$ ${session.totalCost.toFixed(2)}.`,
    );
    this.recalculatePowerDistribution();
    return session;
  }

  calculateTariffBreakdown(session, { demandRatio = this.demandRatio() } = {}) {
    let tariff = this.baseTariff;
    const factors = [];
    if (this.simulatedHour >= 18 && this.simulatedHour <= 21) {
      tariff *= 1.2;
      factors.push({ id: "peak", label: "Horário de pico", percent: 20, multiplier: 1.2 });
    }

    if (demandRatio >= 1) {
      tariff *= 1.15;
      factors.push({ id: "demand", label: "Demanda ≥ 100%", percent: 15, multiplier: 1.15 });
    } else if (demandRatio >= 0.8) {
      tariff *= 1.08;
      factors.push({ id: "demand", label: "Demanda ≥ 80%", percent: 8, multiplier: 1.08 });
    }

    const profileDiscount = USER_DISCOUNT[session.userType] ?? 0;
    if (profileDiscount) {
      tariff *= 1 + profileDiscount;
      factors.push({
        id: "profile",
        label: `Perfil ${session.userType}`,
        percent: profileDiscount * 100,
        multiplier: 1 + profileDiscount,
      });
    }
    if (session.requestedKw > 11) {
      tariff *= 1.1;
      factors.push({ id: "power", label: "Potência acima de 11 kW", percent: 10, multiplier: 1.1 });
    }
    return {
      baseTariff: this.baseTariff,
      demandRatio,
      factors,
      finalTariff: round(tariff, 3),
    };
  }

  calculateTariff(session) {
    return this.calculateTariffBreakdown(session).finalTariff;
  }

  calculateProjectedTariff(session) {
    const projectedDemand = this.siteLimitKw > 0
      ? (this.totalRequestedKw() + Number(session.requestedKw || 0)) / this.siteLimitKw
      : 0;
    return this.calculateTariffBreakdown(session, { demandRatio: projectedDemand });
  }

  recalculatePowerDistribution() {
    const active = this.activeSessions();
    if (!active.length) return;

    const totalRequested = active.reduce((total, session) => total + session.requestedKw, 0);
    if (totalRequested <= this.siteLimitKw) {
      active.forEach((session) => {
        session.allocatedKw = round(session.requestedKw);
        session.controlReason = "Demanda dentro do limite";
        session.currentTariff = this.calculateTariff(session);
      });
      this.log(`Potência nominal liberada: ${totalRequested.toFixed(1)} de ${this.siteLimitKw.toFixed(1)} kW.`);
      return;
    }

    const remainingSessions = [...active];
    let remainingLimit = this.siteLimitKw;
    const allocations = new Map();

    while (remainingSessions.length && remainingLimit > 0) {
      const totalWeight = remainingSessions.reduce(
        (total, session) => total + session.requestedKw * USER_PRIORITY[session.userType],
        0,
      );
      if (totalWeight <= 0) break;

      let cappedAny = false;
      for (let index = remainingSessions.length - 1; index >= 0; index -= 1) {
        const session = remainingSessions[index];
        const weight = session.requestedKw * USER_PRIORITY[session.userType];
        const proposed = remainingLimit * (weight / totalWeight);
        if (proposed >= session.requestedKw) {
          allocations.set(session.sessionId, session.requestedKw);
          remainingLimit -= session.requestedKw;
          remainingSessions.splice(index, 1);
          cappedAny = true;
        }
      }

      if (!cappedAny) {
        remainingSessions.forEach((session) => {
          const weight = session.requestedKw * USER_PRIORITY[session.userType];
          allocations.set(session.sessionId, remainingLimit * (weight / totalWeight));
        });
        break;
      }
    }

    active.forEach((session) => {
      session.allocatedKw = round(Math.max(0, allocations.get(session.sessionId) ?? 0));
    });

    // O arredondamento individual não pode fazer a soma exceder o limite físico.
    let roundedOverflow = round(
      active.reduce((total, session) => total + session.allocatedKw, 0) - this.siteLimitKw,
    );
    if (roundedOverflow > 0) {
      [...active]
        .sort((left, right) => USER_PRIORITY[left.userType] - USER_PRIORITY[right.userType])
        .forEach((session) => {
          if (roundedOverflow <= 0) return;
          const correction = Math.min(session.allocatedKw, roundedOverflow);
          session.allocatedKw = round(session.allocatedKw - correction);
          roundedOverflow = round(roundedOverflow - correction);
        });
    }

    active.forEach((session) => {
      session.controlReason =
        session.allocatedKw < this.minimumUsefulPowerKw
          ? "Limite crítico: potência abaixo do ideal"
          : "Potência reduzida por alta demanda";
      session.currentTariff = this.calculateTariff(session);
      this.addOcppSmartChargingProfile(session);
    });
    this.log(
      `Balanceamento inteligente aplicado: ${totalRequested.toFixed(1)} kW solicitados para ${this.siteLimitKw.toFixed(1)} kW disponíveis.`,
    );
  }

  updateConfiguration({ siteLimitKw, baseTariff, simulatedHour }) {
    const limit = Number(siteLimitKw);
    const tariff = Number(baseTariff);
    const hour = Number(simulatedHour);
    if (!Number.isFinite(limit) || limit <= 0) throw new Error("Informe um limite total maior que zero.");
    if (!Number.isFinite(tariff) || tariff <= 0) throw new Error("Informe uma tarifa base maior que zero.");
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("O horário deve estar entre 0 e 23.");

    this.siteLimitKw = limit;
    this.baseTariff = tariff;
    this.simulatedHour = hour;
    this.log(`Configuração aplicada: ${limit.toFixed(1)} kW · R$ ${tariff.toFixed(3)}/kWh · ${String(hour).padStart(2, "0")}:00.`);
    this.recalculatePowerDistribution();
  }

  advanceTime(minutes = 15) {
    const step = Number(minutes);
    if (!Number.isFinite(step) || step <= 0) throw new Error("O avanço de tempo precisa ser positivo.");
    const active = this.activeSessions();
    if (!active.length) {
      this.log("Nenhuma sessão ativa para avançar o tempo.");
      return [];
    }

    this.recalculatePowerDistribution();
    const finished = [];
    active.forEach((session) => {
      const power = Math.max(0, session.allocatedKw);
      let energyIncrement = power * (step / 60);

      if (session.targetMode === "time") {
        const targetMinutes = Number(session.targetMinutes ?? session.plannedMinutes);
        const remainingMinutes = Math.max(0, targetMinutes - session.elapsedMinutes);
        energyIncrement = Math.min(energyIncrement, power * (remainingMinutes / 60));
      }

      if (Number.isFinite(session.targetAmountBrl)) {
        const remainingBudget = Math.max(
          0,
          session.targetAmountBrl - (session.totalCostExact ?? session.totalCost),
        );
        const energyByBudget = session.currentTariff > 0 ? remainingBudget / session.currentTariff : 0;
        energyIncrement = Math.min(energyIncrement, energyByBudget);
      }

      if (Number.isFinite(session.batteryCapacityKwh) && Number.isFinite(session.currentSoc)) {
        const targetStoredEnergy = session.batteryCapacityKwh * ((session.targetSoc - session.initialSoc) / 100);
        const storedEnergySoFar = (session.energyKwhExact ?? session.energyKwh) * session.chargingEfficiency;
        const remainingStoredEnergy = Math.max(0, targetStoredEnergy - storedEnergySoFar);
        energyIncrement = Math.min(energyIncrement, remainingStoredEnergy / session.chargingEfficiency);
      }

      energyIncrement = Math.max(0, energyIncrement);
      const usableMinutes = power > 0 ? (energyIncrement / power) * 60 : 0;
      session.energyKwhExact = (session.energyKwhExact ?? session.energyKwh) + energyIncrement;
      session.energyKwh = round(session.energyKwhExact, 3);
      const costIncrement = energyIncrement * session.currentTariff;
      session.totalCostExact = (session.totalCostExact ?? session.totalCost) + costIncrement;
      if (Number.isFinite(session.targetAmountBrl)) {
        session.totalCostExact = Math.min(session.totalCostExact, session.targetAmountBrl);
      }
      session.totalCost = round(session.totalCostExact, 2);
      session.elapsedMinutes = round(session.elapsedMinutes + usableMinutes, 2);
      if (Number.isFinite(session.batteryCapacityKwh) && Number.isFinite(session.initialSoc)) {
        const storedEnergy = session.energyKwhExact * session.chargingEfficiency;
        session.currentSoc = round(
          Math.min(session.targetSoc, session.initialSoc + (storedEnergy / session.batteryCapacityKwh) * 100),
          1,
        );
      }
      this.addOcppMeterValues(session);
      this.addModbusReadRegisters(session);

      let completionReason = null;
      if (Number.isFinite(session.currentSoc) && session.currentSoc >= session.targetSoc - 0.05) {
        completionReason = "battery_full";
      } else if (
        Number.isFinite(session.targetAmountBrl) &&
        session.totalCostExact >= session.targetAmountBrl - 0.005
      ) {
        completionReason = session.targetMode === "money" ? "money_target" : "spending_cap";
      } else if (
        session.targetMode === "time" &&
        session.elapsedMinutes >= Number(session.targetMinutes ?? session.plannedMinutes) - 0.005
      ) {
        completionReason = "time_target";
      }
      if (completionReason) finished.push({ session, completionReason });
    });

    finished.forEach(({ session, completionReason }) => {
      session.status = "Finalizada";
      session.endTime = nowIso();
      session.allocatedKw = 0;
      session.completionReason = completionReason;
      session.controlReason = {
        battery_full: "Finalizada automaticamente: bateria atingiu a carga alvo",
        money_target: "Finalizada automaticamente pelo limite de valor autorizado",
        spending_cap: "Finalizada automaticamente pelo teto financeiro de segurança",
        time_target: "Finalizada automaticamente pelo tempo escolhido",
      }[completionReason];
      this.addOcppStopTransaction(session);
    });
    this.recalculatePowerDistribution();
    this.log(`Relógio da simulação avançado em ${step} minutos.`);
    return finished.map(({ session }) => session);
  }

  clearFinished() {
    const before = this.sessions.length;
    this.sessions = this.activeSessions();
    const removed = before - this.sessions.length;
    this.log(`${removed} sessão(ões) finalizada(s) removida(s) do histórico.`);
    this.recalculatePowerDistribution();
    return removed;
  }

  createAutoScenario() {
    const scenarios = [
      ["Renault Zoe · Equipe", 1, "Comum", 22, 60],
      ["Volvo EX30 · Assinante", 2, "Assinante", 22, 75],
      ["BYD Dolphin · Frota", 3, "Frota", 11, 90],
      ["GWM Ora 03 · Visitante", 4, "Visitante", 7.4, 45],
    ];

    let created = 0;
    scenarios.forEach(([vehicle, connectorId, userType, requestedKw, plannedMinutes]) => {
      if (this.activeSessions().some((session) => session.connectorId === connectorId)) return;
      this.startSession({ vehicle, connectorId, userType, requestedKw, plannedMinutes });
      created += 1;
    });
    this.recalculatePowerDistribution();
    this.simulateProtocolExchange();
    this.log(`Cenário de demonstração preparado com ${created} nova(s) sessão(ões).`);
    return created;
  }

  generateReport() {
    const metrics = this.metrics();
    const generatedAt = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date());
    const lines = [
      "RELATÓRIO OPERACIONAL · wecharge",
      "=".repeat(68),
      `Gerado em: ${generatedAt}`,
      `Limite do eletroposto: ${this.siteLimitKw.toFixed(1)} kW`,
      `Tarifa base: R$ ${this.baseTariff.toFixed(3)}/kWh`,
      `Horário simulado: ${String(this.simulatedHour).padStart(2, "0")}:00`,
      "",
      "RESUMO OPERACIONAL",
      "-".repeat(68),
      `Sessões totais: ${this.sessions.length}`,
      `Sessões ativas: ${metrics.activeCount}`,
      `Sessões finalizadas: ${metrics.finishedCount}`,
      `Potência solicitada: ${metrics.requestedKw.toFixed(2)} kW`,
      `Potência liberada: ${metrics.allocatedKw.toFixed(2)} kW`,
      `Demanda: ${(metrics.demandRatio * 100).toFixed(1)}% do limite`,
      `Energia registrada: ${metrics.energyKwh.toFixed(2)} kWh`,
      `Receita simulada: R$ ${metrics.revenue.toFixed(2)}`,
      "",
      "SESSÕES",
      "-".repeat(68),
    ];

    if (!this.sessions.length) lines.push("Nenhuma sessão registrada.");
    this.sessions.forEach((session) => {
      const optionalCapDescription = Number.isFinite(session.targetAmountBrl)
        ? ` · teto financeiro: R$ ${session.targetAmountBrl.toFixed(2)}`
        : " · sem teto financeiro adicional";
      const targetDescription = session.targetMode === "money"
        ? `Valor máximo: R$ ${Number(session.targetAmountBrl || 0).toFixed(2)}`
        : session.targetMode === "power"
          ? `Potência máxima: ${Number(session.targetPowerKw || session.requestedKw).toFixed(2)} kW${optionalCapDescription}`
          : `Tempo máximo: ${session.targetMinutes ?? session.plannedMinutes} min${optionalCapDescription}`;
      lines.push(
        `${session.sessionId} · ${session.vehicle}`,
        `Conector ${session.connectorId}${session.connectorType ? ` · ${session.connectorType}` : ""} · ${session.userType} · ${session.status}`,
        `Potência: ${session.requestedKw.toFixed(2)} → ${session.allocatedKw.toFixed(2)} kW`,
        `Energia: ${session.energyKwh.toFixed(2)} kWh · Custo: R$ ${session.totalCost.toFixed(2)}`,
        `Tempo decorrido: ${session.elapsedMinutes} min · ${targetDescription}`,
        ...(Number.isFinite(session.currentSoc)
          ? [`Bateria: ${session.initialSoc}% → ${session.currentSoc}% de ${session.batteryCapacityKwh.toFixed(1)} kWh`]
          : []),
        `Controle: ${session.controlReason}`,
        ...(session.completionReason ? [`Motivo de término: ${session.completionReason}`] : []),
        "",
      );
    });

    lines.push(
      "LÓGICA DE CONTROLE",
      "-".repeat(68),
      "1. A potência solicitada é comparada ao limite total configurado.",
      "2. Em sobrecarga, a energia é redistribuída por demanda e prioridade.",
      "3. Frota e assinantes recebem prioridade moderada no balanceamento.",
      "4. A tarifa considera horário, demanda, perfil e potência solicitada.",
      "5. A sessão encerra no primeiro limite atingido: tempo, valor ou carga alvo.",
      "6. OCPP e MODBUS são demonstrados como integrações simuladas.",
    );
    return lines.join("\n");
  }
}

export { USER_DISCOUNT, USER_PRIORITY };
