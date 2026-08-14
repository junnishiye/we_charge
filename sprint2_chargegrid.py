#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ChargeGrid Intelligence - Sprint 2
Sistema Inteligente de Gerenciamento de Recarga

Objetivo do código:
- Gerenciar múltiplas sessões de recarga;
- Aplicar controle inteligente de potência por limite total do eletroposto;
- Usar tarifação dinâmica por horário, demanda e tipo de usuário;
- Simular integração com OCPP/MODBUS por mensagens estruturadas;
- Gerar relatórios e demonstrar múltiplos cenários em uma interface gráfica.

Como executar no Debian/Ubuntu:
    python3 sprint2_chargegrid.py

Se o Tkinter não estiver instalado:
    sudo apt update
    sudo apt install python3-tk
"""

from __future__ import annotations

import json
import math
import tkinter as tk
from dataclasses import dataclass, field
from datetime import datetime
from tkinter import filedialog, messagebox, ttk
from typing import Dict, List, Optional, Tuple


# ==============================
# MODELO DE DADOS
# ==============================

@dataclass
class ChargingSession:
    """Representa uma sessão de recarga dentro do eletroposto."""

    session_id: str
    vehicle: str
    connector_id: int
    user_type: str
    requested_kw: float
    planned_minutes: int
    start_time: datetime = field(default_factory=datetime.now)
    end_time: Optional[datetime] = None
    status: str = "Ativa"
    allocated_kw: float = 0.0
    elapsed_minutes: int = 0
    energy_kwh: float = 0.0
    current_tariff: float = 0.0
    total_cost: float = 0.0
    control_reason: str = "Aguardando controle"

    def is_active(self) -> bool:
        return self.status == "Ativa"


class ChargeGridCore:
    """Motor lógico do sistema. A interface chama esta classe para realizar as operações."""

    USER_PRIORITY: Dict[str, float] = {
        "Frota": 1.15,
        "Assinante": 1.08,
        "Comum": 1.00,
        "Visitante": 0.95,
    }

    USER_DISCOUNT: Dict[str, float] = {
        "Frota": -0.05,
        "Assinante": -0.10,
        "Comum": 0.00,
        "Visitante": 0.00,
    }

    def __init__(self) -> None:
        self.sessions: List[ChargingSession] = []
        self.logs: List[str] = []
        self.protocol_messages: List[str] = []
        self.next_id = 1

        # Valores editáveis pela interface.
        self.site_limit_kw = 60.0
        self.base_tariff = 0.805
        self.simulated_hour = datetime.now().hour
        self.minimum_useful_power_kw = 3.7

        self.log("Sistema inicializado. Limite padrão do eletroposto: 60 kW.")
        self.add_ocpp_boot_notification()

    # ---------- Utilidades ----------

    def log(self, message: str) -> None:
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.logs.append(f"[{timestamp}] {message}")

    def active_sessions(self) -> List[ChargingSession]:
        return [session for session in self.sessions if session.is_active()]

    def get_session(self, session_id: str) -> Optional[ChargingSession]:
        for session in self.sessions:
            if session.session_id == session_id:
                return session
        return None

    def total_requested_kw(self) -> float:
        return sum(session.requested_kw for session in self.active_sessions())

    def total_allocated_kw(self) -> float:
        return sum(session.allocated_kw for session in self.active_sessions())

    def demand_ratio(self) -> float:
        if self.site_limit_kw <= 0:
            return 0.0
        return self.total_requested_kw() / self.site_limit_kw

    def protocol_log(self, title: str, payload: Dict) -> None:
        text = f"{title}\n{json.dumps(payload, indent=2, ensure_ascii=False)}"
        self.protocol_messages.append(text)
        self.log(title)

    # ---------- OCPP/MODBUS simulados ----------

    def add_ocpp_boot_notification(self) -> None:
        payload = {
            "protocol": "OCPP-like",
            "messageType": "BootNotification",
            "chargePointVendor": "ChargeGrid Intelligence",
            "chargePointModel": "Sprint2-Simulator-Tkinter",
            "firmwareVersion": "2.0.0-sprint",
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "status": "Accepted",
        }
        self.protocol_log("[OCPP] BootNotification enviada ao sistema central", payload)

    def add_ocpp_start_transaction(self, session: ChargingSession) -> None:
        payload = {
            "protocol": "OCPP-like",
            "messageType": "StartTransaction",
            "transactionId": session.session_id,
            "connectorId": session.connector_id,
            "idTag": session.user_type,
            "meterStart_kWh": round(session.energy_kwh, 3),
            "timestamp": session.start_time.isoformat(timespec="seconds"),
        }
        self.protocol_log(f"[OCPP] StartTransaction - {session.session_id}", payload)

    def add_ocpp_meter_values(self, session: ChargingSession) -> None:
        payload = {
            "protocol": "OCPP-like",
            "messageType": "MeterValues",
            "transactionId": session.session_id,
            "connectorId": session.connector_id,
            "meterValue": [
                {
                    "timestamp": datetime.now().isoformat(timespec="seconds"),
                    "sampledValue": [
                        {
                            "measurand": "Energy.Active.Import.Register",
                            "value": round(session.energy_kwh, 3),
                            "unit": "kWh",
                        },
                        {
                            "measurand": "Power.Active.Import",
                            "value": round(session.allocated_kw, 2),
                            "unit": "kW",
                        },
                    ],
                }
            ],
        }
        self.protocol_log(f"[OCPP] MeterValues - {session.session_id}", payload)

    def add_ocpp_smart_charging_profile(self, session: ChargingSession) -> None:
        payload = {
            "protocol": "OCPP-like",
            "messageType": "SetChargingProfile",
            "transactionId": session.session_id,
            "connectorId": session.connector_id,
            "chargingProfile": {
                "chargingProfilePurpose": "TxProfile",
                "chargingProfileKind": "Absolute",
                "chargingSchedule": {
                    "chargingRateUnit": "W",
                    "chargingSchedulePeriod": [
                        {
                            "startPeriod": 0,
                            "limit": int(session.allocated_kw * 1000),
                        }
                    ],
                },
            },
        }
        self.protocol_log(f"[OCPP] Perfil de carga atualizado - {session.session_id}", payload)

    def add_ocpp_stop_transaction(self, session: ChargingSession) -> None:
        payload = {
            "protocol": "OCPP-like",
            "messageType": "StopTransaction",
            "transactionId": session.session_id,
            "connectorId": session.connector_id,
            "meterStop_kWh": round(session.energy_kwh, 3),
            "reason": "Local",
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "totalCost_BRL": round(session.total_cost, 2),
        }
        self.protocol_log(f"[OCPP] StopTransaction - {session.session_id}", payload)

    def add_modbus_read_registers(self, session: ChargingSession) -> None:
        # Simulação de registradores:
        # 30001 -> potência atual em décimos de kW
        # 30002 -> energia acumulada em centésimos de kWh
        # 30003 -> status do conector: 1 ativa, 0 finalizada
        payload = {
            "protocol": "MODBUS-like",
            "functionCode": "04 - Read Input Registers",
            "slaveId": session.connector_id,
            "registers": {
                "30001_power_deci_kW": int(session.allocated_kw * 10),
                "30002_energy_centi_kWh": int(session.energy_kwh * 100),
                "30003_connector_status": 1 if session.is_active() else 0,
            },
        }
        self.protocol_log(f"[MODBUS] Leitura de registradores - {session.session_id}", payload)

    def add_modbus_write_limit_register(self, session: ChargingSession) -> None:
        # Simulação de escrita em registrador de controle:
        # 40001 -> limite de potência em décimos de kW
        payload = {
            "protocol": "MODBUS-like",
            "functionCode": "06 - Write Single Register",
            "slaveId": session.connector_id,
            "register": "40001_power_limit_deci_kW",
            "value": int(session.allocated_kw * 10),
            "echoResponse": True,
        }
        self.protocol_log(f"[MODBUS] Escrita de limite de potência - {session.session_id}", payload)

    def simulate_protocol_exchange(self, selected_session_id: Optional[str] = None) -> None:
        sessions = self.active_sessions()
        if selected_session_id:
            selected = self.get_session(selected_session_id)
            sessions = [selected] if selected else []

        if not sessions:
            self.log("Nenhuma sessão ativa para simular OCPP/MODBUS.")
            return

        for session in sessions:
            self.add_ocpp_meter_values(session)
            self.add_ocpp_smart_charging_profile(session)
            self.add_modbus_read_registers(session)
            self.add_modbus_write_limit_register(session)

    # ---------- Regras principais ----------

    def start_session(
        self,
        vehicle: str,
        connector_id: int,
        user_type: str,
        requested_kw: float,
        planned_minutes: int,
    ) -> ChargingSession:
        if requested_kw <= 0:
            raise ValueError("A potência solicitada precisa ser maior que zero.")
        if planned_minutes <= 0:
            raise ValueError("O tempo planejado precisa ser maior que zero.")
        if connector_id <= 0:
            raise ValueError("O conector precisa ser um número positivo.")
        if user_type not in self.USER_PRIORITY:
            raise ValueError("Tipo de usuário inválido.")
        if any(s.is_active() and s.connector_id == connector_id for s in self.sessions):
            raise ValueError(f"O conector {connector_id} já está em uso por outra sessão ativa.")

        clean_vehicle = vehicle.strip() or f"Veículo {self.next_id:02d}"
        session = ChargingSession(
            session_id=f"S{self.next_id:03d}",
            vehicle=clean_vehicle,
            connector_id=connector_id,
            user_type=user_type,
            requested_kw=requested_kw,
            planned_minutes=planned_minutes,
        )
        self.next_id += 1
        self.sessions.append(session)
        self.log(
            f"Sessão {session.session_id} iniciada: {session.vehicle}, "
            f"{session.requested_kw:.1f} kW solicitados, usuário {session.user_type}."
        )
        self.recalculate_power_distribution()
        self.add_ocpp_start_transaction(session)
        return session

    def finish_session(self, session_id: str) -> None:
        session = self.get_session(session_id)
        if not session:
            raise ValueError("Sessão não encontrada.")
        if not session.is_active():
            raise ValueError("Esta sessão já está finalizada.")

        session.status = "Finalizada"
        session.end_time = datetime.now()
        session.allocated_kw = 0.0
        session.control_reason = "Sessão encerrada"
        self.add_ocpp_stop_transaction(session)
        self.log(
            f"Sessão {session.session_id} finalizada. Energia: {session.energy_kwh:.2f} kWh. "
            f"Custo: R$ {session.total_cost:.2f}."
        )
        self.recalculate_power_distribution()

    def recalculate_power_distribution(self) -> None:
        active = self.active_sessions()
        if not active:
            return

        total_requested = sum(session.requested_kw for session in active)

        # Caso 1: não passou do limite. Todo mundo recebe o que pediu.
        if total_requested <= self.site_limit_kw:
            for session in active:
                session.allocated_kw = round(session.requested_kw, 2)
                session.control_reason = "Demanda dentro do limite"
                session.current_tariff = self.calculate_tariff(session)
            self.log(
                f"Controle de potência: demanda dentro do limite "
                f"({total_requested:.1f}/{self.site_limit_kw:.1f} kW)."
            )
            return

        # Caso 2: passou do limite. Distribuição proporcional ponderada por prioridade.
        remaining_sessions = active[:]
        remaining_limit = self.site_limit_kw
        allocations: Dict[str, float] = {}

        while remaining_sessions and remaining_limit > 0:
            total_weight = sum(
                s.requested_kw * self.USER_PRIORITY[s.user_type]
                for s in remaining_sessions
            )
            if total_weight <= 0:
                break

            changed = False
            for session in remaining_sessions[:]:
                weight = session.requested_kw * self.USER_PRIORITY[session.user_type]
                proposed = remaining_limit * (weight / total_weight)

                # Se o cálculo passar do que a sessão pediu, trava no máximo pedido
                # e redistribui o restante para os outros conectores.
                if proposed >= session.requested_kw:
                    allocations[session.session_id] = session.requested_kw
                    remaining_limit -= session.requested_kw
                    remaining_sessions.remove(session)
                    changed = True

            if not changed:
                for session in remaining_sessions:
                    weight = session.requested_kw * self.USER_PRIORITY[session.user_type]
                    allocations[session.session_id] = remaining_limit * (weight / total_weight)
                break

        for session in active:
            allocated = allocations.get(session.session_id, 0.0)
            session.allocated_kw = round(max(0.0, allocated), 2)
            if session.allocated_kw < self.minimum_useful_power_kw:
                session.control_reason = "Limite crítico: potência abaixo do ideal"
            else:
                session.control_reason = "Carga reduzida por alta demanda"
            session.current_tariff = self.calculate_tariff(session)
            self.add_ocpp_smart_charging_profile(session)

        self.log(
            f"Controle inteligente aplicado: {total_requested:.1f} kW solicitados para "
            f"limite de {self.site_limit_kw:.1f} kW."
        )

    def calculate_tariff(self, session: ChargingSession) -> float:
        """Tarifa dinâmica por horário, demanda, tipo de usuário e potência."""
        tariff = self.base_tariff
        adjustments: List[Tuple[str, float]] = []

        # Horário de pico simulado: 18h até 21h59.
        if 18 <= self.simulated_hour <= 21:
            adjustments.append(("horário de pico", 0.20))

        # Demanda em relação ao limite total do eletroposto.
        ratio = self.demand_ratio()
        if ratio >= 1.00:
            adjustments.append(("demanda acima do limite", 0.15))
        elif ratio >= 0.80:
            adjustments.append(("demanda alta", 0.08))

        # Desconto por tipo de usuário.
        user_adjustment = self.USER_DISCOUNT.get(session.user_type, 0.0)
        if user_adjustment != 0:
            adjustments.append((f"usuário {session.user_type}", user_adjustment))

        # Adicional para recarga AC mais forte.
        if session.requested_kw > 11:
            adjustments.append(("recarga rápida AC", 0.10))

        for _reason, percentage in adjustments:
            tariff *= 1 + percentage

        return round(tariff, 3)

    def advance_time(self, minutes: int = 15) -> None:
        if minutes <= 0:
            raise ValueError("O avanço de tempo precisa ser positivo.")

        active = self.active_sessions()
        if not active:
            self.log("Nenhuma sessão ativa para avançar tempo.")
            return

        self.recalculate_power_distribution()

        finished_after_step: List[ChargingSession] = []
        for session in active:
            energy_increment = session.allocated_kw * (minutes / 60)
            session.energy_kwh += energy_increment
            session.total_cost += energy_increment * session.current_tariff
            session.elapsed_minutes += minutes
            self.add_ocpp_meter_values(session)
            self.add_modbus_read_registers(session)

            if session.elapsed_minutes >= session.planned_minutes:
                finished_after_step.append(session)

        for session in finished_after_step:
            session.status = "Finalizada"
            session.end_time = datetime.now()
            session.allocated_kw = 0.0
            session.control_reason = "Finalizada automaticamente pelo tempo planejado"
            self.add_ocpp_stop_transaction(session)

        self.recalculate_power_distribution()
        self.log(f"Tempo simulado avançado em {minutes} minutos.")

    def clear_finished(self) -> None:
        before = len(self.sessions)
        self.sessions = [session for session in self.sessions if session.is_active()]
        removed = before - len(self.sessions)
        self.log(f"Sessões finalizadas removidas da tabela: {removed}.")
        self.recalculate_power_distribution()

    def create_auto_scenario(self) -> None:
        """Cria múltiplas sessões para demonstrar todos os critérios da Sprint 2."""
        scenarios = [
            ("Veículo 01 - Funcionário", 1, "Comum", 22.0, 60),
            ("Veículo 02 - Assinante", 2, "Assinante", 22.0, 75),
            ("Veículo 03 - Frota", 3, "Frota", 11.0, 90),
            ("Veículo 04 - Visitante", 4, "Visitante", 7.4, 45),
        ]

        for vehicle, connector, user_type, requested_kw, planned_minutes in scenarios:
            if any(s.is_active() and s.connector_id == connector for s in self.sessions):
                continue
            self.start_session(vehicle, connector, user_type, requested_kw, planned_minutes)

        self.recalculate_power_distribution()
        self.simulate_protocol_exchange()
        self.log("Cenário automático criado com 4 veículos para demonstração da Sprint 2.")

    def generate_report(self) -> str:
        active = self.active_sessions()
        finished = [session for session in self.sessions if not session.is_active()]
        total_energy = sum(session.energy_kwh for session in self.sessions)
        total_cost = sum(session.total_cost for session in self.sessions)
        total_requested = self.total_requested_kw()
        total_allocated = self.total_allocated_kw()
        ratio = self.demand_ratio()

        lines = [
            "RELATÓRIO TÉCNICO - CHARGEGRID INTELLIGENCE SPRINT 2",
            "=" * 70,
            f"Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}",
            f"Limite configurado do eletroposto: {self.site_limit_kw:.1f} kW",
            f"Tarifa base configurada: R$ {self.base_tariff:.3f}/kWh",
            f"Horário simulado: {self.simulated_hour:02d}:00",
            "",
            "RESUMO OPERACIONAL",
            "-" * 70,
            f"Sessões totais: {len(self.sessions)}",
            f"Sessões ativas: {len(active)}",
            f"Sessões finalizadas: {len(finished)}",
            f"Potência solicitada ativa: {total_requested:.2f} kW",
            f"Potência liberada ativa: {total_allocated:.2f} kW",
            f"Taxa de demanda: {ratio * 100:.1f}% do limite",
            f"Energia total registrada: {total_energy:.2f} kWh",
            f"Receita simulada: R$ {total_cost:.2f}",
            "",
            "SESSÕES",
            "-" * 70,
        ]

        if not self.sessions:
            lines.append("Nenhuma sessão registrada.")
        else:
            for session in self.sessions:
                lines.extend(
                    [
                        f"ID: {session.session_id}",
                        f"Veículo: {session.vehicle}",
                        f"Conector: {session.connector_id}",
                        f"Tipo de usuário: {session.user_type}",
                        f"Status: {session.status}",
                        f"Potência solicitada: {session.requested_kw:.2f} kW",
                        f"Potência liberada: {session.allocated_kw:.2f} kW",
                        f"Energia acumulada: {session.energy_kwh:.2f} kWh",
                        f"Tarifa atual: R$ {session.current_tariff:.3f}/kWh",
                        f"Custo acumulado: R$ {session.total_cost:.2f}",
                        f"Tempo simulado: {session.elapsed_minutes}/{session.planned_minutes} min",
                        f"Controle aplicado: {session.control_reason}",
                        "",
                    ]
                )

        lines.extend(
            [
                "LÓGICA DE CONTROLE",
                "-" * 70,
                "1. O sistema soma a potência solicitada pelas sessões ativas.",
                "2. Se a soma não ultrapassa o limite, cada veículo recebe o valor solicitado.",
                "3. Se a soma ultrapassa o limite, a potência é redistribuída proporcionalmente.",
                "4. Usuários de frota e assinantes recebem leve prioridade na redistribuição.",
                "5. A tarifa varia por horário, demanda, potência solicitada e tipo de usuário.",
                "6. A comunicação externa é simulada com mensagens OCPP-like e MODBUS-like.",
            ]
        )

        return "\n".join(lines)


# ==============================
# INTERFACE GRÁFICA TKINTER
# ==============================

class ChargeGridApp(tk.Tk):
    """Interface gráfica principal."""

    def __init__(self) -> None:
        super().__init__()
        self.title("ChargeGrid Intelligence - Sprint 2")
        self.geometry("1280x780")
        self.minsize(1120, 680)

        self.core = ChargeGridCore()
        self.selected_session_id: Optional[str] = None

        self._configure_style()
        self._build_layout()
        self.refresh_all()

    def _configure_style(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("Title.TLabel", font=("Arial", 16, "bold"))
        style.configure("Subtitle.TLabel", font=("Arial", 11, "bold"))
        style.configure("Status.TLabel", font=("Arial", 10))
        style.configure("Treeview", rowheight=26)
        style.configure("Treeview.Heading", font=("Arial", 10, "bold"))

    def _build_layout(self) -> None:
        self.columnconfigure(0, weight=1)
        self.rowconfigure(2, weight=1)

        header = ttk.Frame(self, padding=(12, 10))
        header.grid(row=0, column=0, sticky="ew")
        header.columnconfigure(0, weight=1)

        ttk.Label(
            header,
            text="ChargeGrid Intelligence - Sistema Inteligente de Gerenciamento de Recarga",
            style="Title.TLabel",
        ).grid(row=0, column=0, sticky="w")
        ttk.Label(
            header,
            text="Sprint 2 • múltiplas sessões • controle de potência • tarifa dinâmica • OCPP/MODBUS simulado",
        ).grid(row=1, column=0, sticky="w", pady=(4, 0))

        self.summary_label = ttk.Label(header, text="", style="Status.TLabel")
        self.summary_label.grid(row=0, column=1, rowspan=2, sticky="e")

        config = ttk.LabelFrame(self, text="Configuração do eletroposto", padding=10)
        config.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 8))
        for col in range(10):
            config.columnconfigure(col, weight=0)
        config.columnconfigure(9, weight=1)

        ttk.Label(config, text="Limite total (kW):").grid(row=0, column=0, sticky="w")
        self.limit_var = tk.StringVar(value="60")
        ttk.Entry(config, textvariable=self.limit_var, width=10).grid(row=0, column=1, padx=(6, 16))

        ttk.Label(config, text="Tarifa base (R$/kWh):").grid(row=0, column=2, sticky="w")
        self.base_tariff_var = tk.StringVar(value="0.805")
        ttk.Entry(config, textvariable=self.base_tariff_var, width=10).grid(row=0, column=3, padx=(6, 16))

        ttk.Label(config, text="Horário simulado:").grid(row=0, column=4, sticky="w")
        self.hour_var = tk.StringVar(value=str(self.core.simulated_hour))
        ttk.Spinbox(config, from_=0, to=23, textvariable=self.hour_var, width=6).grid(row=0, column=5, padx=(6, 16))

        ttk.Button(config, text="Aplicar configuração", command=self.apply_config).grid(row=0, column=6, padx=(0, 10))
        ttk.Button(config, text="Cenário automático", command=self.create_auto_scenario).grid(row=0, column=7, padx=(0, 10))
        ttk.Button(config, text="Avançar 15 min", command=lambda: self.advance_time(15)).grid(row=0, column=8)

        content = ttk.PanedWindow(self, orient=tk.HORIZONTAL)
        content.grid(row=2, column=0, sticky="nsew", padx=12, pady=(0, 12))

        left = ttk.Frame(content, padding=(0, 0, 10, 0))
        right = ttk.Frame(content)
        content.add(left, weight=0)
        content.add(right, weight=1)

        self._build_form(left)
        self._build_table_and_tabs(right)

    def _build_form(self, parent: ttk.Frame) -> None:
        parent.columnconfigure(0, weight=1)

        form = ttk.LabelFrame(parent, text="Nova sessão", padding=10)
        form.grid(row=0, column=0, sticky="new")
        form.columnconfigure(1, weight=1)

        ttk.Label(form, text="Veículo/identificação:").grid(row=0, column=0, sticky="w", pady=4)
        self.vehicle_var = tk.StringVar()
        ttk.Entry(form, textvariable=self.vehicle_var, width=28).grid(row=0, column=1, sticky="ew", pady=4)

        ttk.Label(form, text="Conector:").grid(row=1, column=0, sticky="w", pady=4)
        self.connector_var = tk.StringVar(value="1")
        ttk.Combobox(form, textvariable=self.connector_var, values=["1", "2", "3", "4", "5", "6"], width=8).grid(
            row=1, column=1, sticky="w", pady=4
        )

        ttk.Label(form, text="Tipo de usuário:").grid(row=2, column=0, sticky="w", pady=4)
        self.user_type_var = tk.StringVar(value="Comum")
        ttk.Combobox(
            form,
            textvariable=self.user_type_var,
            values=["Comum", "Assinante", "Frota", "Visitante"],
            state="readonly",
            width=16,
        ).grid(row=2, column=1, sticky="w", pady=4)

        ttk.Label(form, text="Potência solicitada:").grid(row=3, column=0, sticky="w", pady=4)
        self.power_var = tk.StringVar(value="22")
        ttk.Combobox(
            form,
            textvariable=self.power_var,
            values=["7.4", "11", "22", "30", "50"],
            width=10,
        ).grid(row=3, column=1, sticky="w", pady=4)
        ttk.Label(form, text="kW").grid(row=3, column=1, sticky="w", padx=(92, 0))

        ttk.Label(form, text="Tempo planejado:").grid(row=4, column=0, sticky="w", pady=4)
        self.planned_var = tk.StringVar(value="60")
        ttk.Entry(form, textvariable=self.planned_var, width=10).grid(row=4, column=1, sticky="w", pady=4)
        ttk.Label(form, text="min").grid(row=4, column=1, sticky="w", padx=(92, 0))

        ttk.Button(form, text="Iniciar sessão", command=self.start_session).grid(row=5, column=0, columnspan=2, sticky="ew", pady=(10, 4))
        ttk.Button(form, text="Encerrar selecionada", command=self.finish_selected_session).grid(row=6, column=0, columnspan=2, sticky="ew", pady=4)
        ttk.Button(form, text="Simular OCPP/MODBUS", command=self.simulate_protocol).grid(row=7, column=0, columnspan=2, sticky="ew", pady=4)
        ttk.Button(form, text="Recalcular potência", command=self.recalculate_power).grid(row=8, column=0, columnspan=2, sticky="ew", pady=4)

        actions = ttk.LabelFrame(parent, text="Relatórios e limpeza", padding=10)
        actions.grid(row=1, column=0, sticky="new", pady=(10, 0))
        actions.columnconfigure(0, weight=1)

        ttk.Button(actions, text="Gerar relatório", command=self.update_report).grid(row=0, column=0, sticky="ew", pady=4)
        ttk.Button(actions, text="Exportar relatório .txt", command=self.export_report).grid(row=1, column=0, sticky="ew", pady=4)
        ttk.Button(actions, text="Remover finalizadas da tabela", command=self.clear_finished).grid(row=2, column=0, sticky="ew", pady=4)

        help_box = ttk.LabelFrame(parent, text="Como demonstrar no vídeo", padding=10)
        help_box.grid(row=2, column=0, sticky="new", pady=(10, 0))
        text = (
            "1. Clique em Cenário automático.\n"
            "2. Mostre as 4 sessões na tabela.\n"
            "3. Mostre a potência reduzida pelo limite.\n"
            "4. Avance 15 min para gerar energia/custo.\n"
            "5. Abra Logs/Protocolo e mostre OCPP/MODBUS.\n"
            "6. Gere o relatório final."
        )
        ttk.Label(help_box, text=text, justify="left").grid(row=0, column=0, sticky="w")

    def _build_table_and_tabs(self, parent: ttk.Frame) -> None:
        parent.rowconfigure(0, weight=2)
        parent.rowconfigure(1, weight=1)
        parent.columnconfigure(0, weight=1)

        table_frame = ttk.LabelFrame(parent, text="Sessões de recarga", padding=8)
        table_frame.grid(row=0, column=0, sticky="nsew")
        table_frame.rowconfigure(0, weight=1)
        table_frame.columnconfigure(0, weight=1)

        columns = (
            "id",
            "vehicle",
            "connector",
            "user",
            "status",
            "requested",
            "allocated",
            "energy",
            "tariff",
            "cost",
            "time",
            "control",
        )
        self.tree = ttk.Treeview(table_frame, columns=columns, show="headings", selectmode="browse")
        headings = {
            "id": "ID",
            "vehicle": "Veículo",
            "connector": "Conector",
            "user": "Usuário",
            "status": "Status",
            "requested": "Solicitado kW",
            "allocated": "Liberado kW",
            "energy": "Energia kWh",
            "tariff": "Tarifa R$/kWh",
            "cost": "Custo R$",
            "time": "Tempo",
            "control": "Controle",
        }
        widths = {
            "id": 60,
            "vehicle": 180,
            "connector": 75,
            "user": 90,
            "status": 85,
            "requested": 95,
            "allocated": 90,
            "energy": 95,
            "tariff": 100,
            "cost": 85,
            "time": 80,
            "control": 220,
        }
        for column in columns:
            self.tree.heading(column, text=headings[column])
            self.tree.column(column, width=widths[column], anchor="center")
        self.tree.column("vehicle", anchor="w")
        self.tree.column("control", anchor="w")

        scrollbar_y = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree.yview)
        scrollbar_x = ttk.Scrollbar(table_frame, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        self.tree.grid(row=0, column=0, sticky="nsew")
        scrollbar_y.grid(row=0, column=1, sticky="ns")
        scrollbar_x.grid(row=1, column=0, sticky="ew")
        self.tree.bind("<<TreeviewSelect>>", self.on_tree_select)

        self.tabs = ttk.Notebook(parent)
        self.tabs.grid(row=1, column=0, sticky="nsew", pady=(10, 0))

        self.log_text = self._create_text_tab("Logs do sistema")
        self.protocol_text = self._create_text_tab("Mensagens OCPP/MODBUS")
        self.report_text = self._create_text_tab("Relatório")

    def _create_text_tab(self, title: str) -> tk.Text:
        frame = ttk.Frame(self.tabs, padding=6)
        frame.rowconfigure(0, weight=1)
        frame.columnconfigure(0, weight=1)
        text = tk.Text(frame, wrap="word", height=10, font=("Consolas", 10))
        scroll = ttk.Scrollbar(frame, orient="vertical", command=text.yview)
        text.configure(yscrollcommand=scroll.set)
        text.grid(row=0, column=0, sticky="nsew")
        scroll.grid(row=0, column=1, sticky="ns")
        self.tabs.add(frame, text=title)
        return text

    # ---------- Métodos da interface ----------

    def apply_config(self) -> None:
        try:
            limit = self._parse_float(self.limit_var.get(), "limite total")
            tariff = self._parse_float(self.base_tariff_var.get(), "tarifa base")
            hour = int(self.hour_var.get())
            if limit <= 0:
                raise ValueError("O limite total precisa ser maior que zero.")
            if tariff <= 0:
                raise ValueError("A tarifa base precisa ser maior que zero.")
            if not 0 <= hour <= 23:
                raise ValueError("O horário precisa estar entre 0 e 23.")
        except ValueError as error:
            messagebox.showerror("Configuração inválida", str(error))
            return

        self.core.site_limit_kw = limit
        self.core.base_tariff = tariff
        self.core.simulated_hour = hour
        self.core.log(
            f"Configuração aplicada: limite {limit:.1f} kW, tarifa R$ {tariff:.3f}/kWh, horário {hour:02d}:00."
        )
        self.core.recalculate_power_distribution()
        self.refresh_all()

    def start_session(self) -> None:
        try:
            vehicle = self.vehicle_var.get()
            connector = int(self.connector_var.get())
            user_type = self.user_type_var.get()
            requested_kw = self._parse_float(self.power_var.get(), "potência solicitada")
            planned_minutes = int(self.planned_var.get())
            self.core.start_session(vehicle, connector, user_type, requested_kw, planned_minutes)
        except ValueError as error:
            messagebox.showerror("Não foi possível iniciar", str(error))
            return

        # Prepara o próximo conector automaticamente.
        next_connector = min(6, int(self.connector_var.get()) + 1)
        self.connector_var.set(str(next_connector))
        self.vehicle_var.set("")
        self.refresh_all()

    def finish_selected_session(self) -> None:
        if not self.selected_session_id:
            messagebox.showwarning("Seleção necessária", "Selecione uma sessão na tabela.")
            return
        try:
            self.core.finish_session(self.selected_session_id)
        except ValueError as error:
            messagebox.showerror("Não foi possível encerrar", str(error))
            return
        self.refresh_all()

    def simulate_protocol(self) -> None:
        self.core.simulate_protocol_exchange(self.selected_session_id)
        self.refresh_all()
        self.tabs.select(1)

    def recalculate_power(self) -> None:
        self.core.recalculate_power_distribution()
        self.refresh_all()

    def advance_time(self, minutes: int) -> None:
        try:
            self.core.advance_time(minutes)
        except ValueError as error:
            messagebox.showerror("Erro", str(error))
            return
        self.refresh_all()

    def create_auto_scenario(self) -> None:
        if self.core.sessions:
            answer = messagebox.askyesno(
                "Cenário automático",
                "Já existem sessões na tabela. Deseja adicionar o cenário automático mesmo assim?",
            )
            if not answer:
                return
        try:
            self.core.create_auto_scenario()
        except ValueError as error:
            messagebox.showerror("Erro no cenário", str(error))
            return
        self.refresh_all()

    def clear_finished(self) -> None:
        self.core.clear_finished()
        self.selected_session_id = None
        self.refresh_all()

    def update_report(self) -> None:
        report = self.core.generate_report()
        self._set_text(self.report_text, report)
        self.tabs.select(2)

    def export_report(self) -> None:
        report = self.core.generate_report()
        path = filedialog.asksaveasfilename(
            title="Salvar relatório técnico",
            defaultextension=".txt",
            filetypes=[("Arquivo de texto", "*.txt"), ("Todos os arquivos", "*.*")],
            initialfile="relatorio_chargegrid_sprint2.txt",
        )
        if not path:
            return
        with open(path, "w", encoding="utf-8") as file:
            file.write(report)
        self.core.log(f"Relatório exportado para: {path}")
        self.refresh_all()
        messagebox.showinfo("Relatório exportado", "Relatório salvo com sucesso.")

    def on_tree_select(self, _event: object) -> None:
        selection = self.tree.selection()
        if not selection:
            self.selected_session_id = None
            return
        values = self.tree.item(selection[0], "values")
        self.selected_session_id = values[0] if values else None

    def refresh_all(self) -> None:
        self.refresh_table()
        self.refresh_summary()
        self.refresh_logs()
        self.refresh_protocol_messages()
        self.update_report_text_silent()

    def refresh_table(self) -> None:
        self.tree.delete(*self.tree.get_children())
        for session in self.core.sessions:
            self.tree.insert(
                "",
                "end",
                values=(
                    session.session_id,
                    session.vehicle,
                    session.connector_id,
                    session.user_type,
                    session.status,
                    f"{session.requested_kw:.2f}",
                    f"{session.allocated_kw:.2f}",
                    f"{session.energy_kwh:.2f}",
                    f"{session.current_tariff:.3f}",
                    f"{session.total_cost:.2f}",
                    f"{session.elapsed_minutes}/{session.planned_minutes}",
                    session.control_reason,
                ),
            )

    def refresh_summary(self) -> None:
        active_count = len(self.core.active_sessions())
        requested = self.core.total_requested_kw()
        allocated = self.core.total_allocated_kw()
        limit = self.core.site_limit_kw
        ratio = (requested / limit * 100) if limit > 0 else 0
        self.summary_label.configure(
            text=(
                f"Ativas: {active_count} | Solicitado: {requested:.1f} kW | "
                f"Liberado: {allocated:.1f} kW | Uso do limite: {ratio:.1f}%"
            )
        )

    def refresh_logs(self) -> None:
        self._set_text(self.log_text, "\n".join(self.core.logs[-300:]))

    def refresh_protocol_messages(self) -> None:
        self._set_text(self.protocol_text, "\n\n".join(self.core.protocol_messages[-120:]))

    def update_report_text_silent(self) -> None:
        self._set_text(self.report_text, self.core.generate_report())

    @staticmethod
    def _set_text(widget: tk.Text, content: str) -> None:
        widget.configure(state="normal")
        widget.delete("1.0", tk.END)
        widget.insert("1.0", content)
        widget.configure(state="disabled")

    @staticmethod
    def _parse_float(value: str, field_name: str) -> float:
        clean = value.strip().replace(",", ".")
        if not clean:
            raise ValueError(f"O campo {field_name} não pode ficar vazio.")
        try:
            number = float(clean)
        except ValueError as exc:
            raise ValueError(f"O campo {field_name} precisa ser numérico.") from exc
        if math.isnan(number) or math.isinf(number):
            raise ValueError(f"O campo {field_name} precisa ser um número válido.")
        return number


def main() -> None:
    app = ChargeGridApp()
    app.mainloop()


if __name__ == "__main__":
    main()
