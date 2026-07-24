# Boiler-room thermostatic pump controller (module-level)

ESP32-C3 + ADS1115 (I²C ADC) + ZMCT103C current module + relay module.

**Scope of this fixture:** module wiring only. NTC front-ends (sensors,
terminal blocks, 100k dividers) and mains/load-side terminal blocks are
**collapsed** into sense nets `TPO` / `TPU` / `AMB` and dry-contact leaves
`PUMP_IN` / `PUMP_OUT`. See `docs/TODO.md` for the expanded channel ladder
(`table03+`).

Hand target art: `examples/art02.md`. Packing seed: `examples/layout02.yaml`.
Bootstrap goldens: regen after shared chrome (see `docs/STATUS.md`) — none
checked in until then.

Placeholders: `GPIO4` = ADS1115 ADDR strap driver; `GPIO3` = relay IN.
Adjust when hardware pin map is frozen.

| Signal     | ESP32-C3 | ADS1115 | ZMCT103C | RELAY |
|------------|----------|---------|----------|-------|
| I2C DATA   | GPIO8    | SDA     |          |       |
| I2C CLOCK  | GPIO9    | SCL     |          |       |
| I2C ADDR   | GPIO4    | ADDR    |          |       |
| °TPO       |          | AIN0    |          |       |
| °TPU       |          | AIN1    |          |       |
| °AMB       |          | AIN2    |          |       |
| CURRENT    |          | AIN3    | OUT      |       |
| RELAY_CMD  | GPIO3    |         |          | IN    |
| °PUMP_IN   |          |         |          | NO    |
| °PUMP_OUT  |          |         |          | COM   |
| °3.3V      | 3V3      | VDD     |          |       |
| °5V        |          |         | 5V       | 5V    |
| °GND       | GND      | GND     | GND      | GND   |

Abbreviations:
  ESP32-C3 ≝ "ESP32-C3 SuperMini (or board of record)"
  ADS1115  ≝ "ADS1115 4-ch I2C ADC breakout"
  ZMCT103C ≝ "ZMCT103C current-sensor module"
  RELAY    ≝ "1-ch relay module (IN active per module datasheet)"
  TPO      ≝ "NTC channel: pump outlet (front-end not expanded)"
  TPU      ≝ "NTC channel: pump / unit (front-end not expanded)"
  AMB      ≝ "NTC channel: ambient (front-end not expanded)"
  PUMP_IN  ≝ "Relay NO toward load/TB (mains path deferred)"
  PUMP_OUT ≝ "Relay COM toward load/TB (mains path deferred)"

Notes:
  - °5V may be a separate rail (USB/buck); not assumed = MCU 3V3.
  - ALERT/RDY, decoupling caps, I2C pullups: omitted at this diagram level.
  - °PUMP_IN / °PUMP_OUT are floating dry-contact leaves until mains TBs (`table04`).
  - RELAY and ZMCT103C are **modules** (named pin dots), same genre as MCU/ADC —
    not 4×3 passives.
