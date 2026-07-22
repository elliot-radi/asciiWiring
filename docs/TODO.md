# TODO — future language, fixtures, layout

Living list of deferred work. Near-term product roadmap stays in
[ROADMAP.md](ROADMAP.md). This file captures **design debt and ideas** from
real hardware (boiler-room pump controller) that must not be forgotten when
slicing fixtures.

Last updated with the pump-controller braindump → `table02` module slice.

---

## Fixture ladder (same product, growing truth)

| ID | Intent | Status |
|----|--------|--------|
| `table01` | ESP32 + OLED + button + pullup passive | done (`golden01`) |
| `table02` | Pump controller **module-level**: MCU + ADS1115 + ZMCT + relay | table + art02 target + golden02; multi-pin module branches |
| `table03` | **One** NTC channel fully expanded: NTC + 2×TB + 100k + sense into AINx | not started |
| `table04` | Three NTC channels + CT + relay + mains TBs | not started |
| `artNN` / `goldenNN` | Hand target + generator snapshot per table | as each lands |

---

## Language / SPEC (before expanded channels)

### Feedthrough components (terminal blocks, jumpers)

- [ ] New layout role distinct from multi-net **passive** (avoid overloaded “bridge”).
  Suggested name: **`feedthrough`** (or `terminal`).
- [ ] Semantics: two ports, **same net**, continuity through the body.
  Art motif: `─│ TB01 │─` or vertical equivalent (orientation free).
- [ ] **Cell / incidence problem:** today one cell per component per net —
  cannot place two anonymous ends on one net. Design one of:
  - cell form `x-x` / `╡ prov` / similar dual-end marker on a single net row
  - port-count stereotype via frontmatter (`TB1: { role: feedthrough }`)
  - other SPEC’d form — **no silent hacks**
- [ ] No pin dots required; minimal 4×3-ish box optional for identity.

### Refdes + exterior labels

- [ ] Component header = short refdes (`R1`, `NTC1`, `TB01`) allowed and preferred for passives.
- [ ] Exterior labels (value `100k`, name `TPO`, net hints) as **presentation**, not incidence cells:
  - footnotes / side table / frontmatter `labels: { R1: "100k" }`
  - paint places text N/S/E/W of mini-box without bloating the box
- [ ] Mini-box sizing heuristic: TYPE 1–3 letters + NUM 1–99 → ~4×3 default for passives/feedthroughs.

### NTC / sensor semi-passives

- [ ] Model NTC as two-terminal component (often with feedthrough TBs on each leg).
- [ ] Channel template / motif (optional later): NTC + TB_sig + TB_gnd + divider R → sense net.
- [ ] Do not collapse nets just to get thinner art; fold is layout/paint only if used.

### Rails & power

- [ ] Multi-rail boards (`°3.3V`, `°5V`, `°GND`) — layout should not assume single floating rail.
- [ ] Optional derivation of port kind (pwr/gnd/signal) from net name patterns.

### Commodities deferred from pump board prose

- [ ] I2C pullups on SDA/SCL (passives to 3.3V) when we want them explicit.
- [ ] ADS1115 ALERT/RDY + pullup.
- [ ] Decoupling caps (usually omitted from wiring-block diagrams).
- [ ] Relay COM/NC/NO full dry-contact + **mains TB pair** to 220VAC load.
- [ ] ADDR hardwire vs GPIO strap documented per build.

---

## Layout / paint capabilities

- [x] Branch off non-primary bus (needed for ZMCT → ADS CURRENT) — aim with `table02`
- [ ] Multiple branches without colliding stems (RELAY_CMD + others)
- [ ] Single-port nets as free labels / stub on module (TPO/TPU/AMB into AIN only)
- [ ] Dry-contact or open nets labeled without fake second module
- [ ] Passive **series** between two signal modules (LED + R motif), distinct from pullup-to-rail
- [ ] Feedthrough in-line on a routed net (TB on way from connector to ADC)
- [ ] Hop-heavy stems still rare but tested when pin order forces it
- [ ] Abbreviations applied to art titles when desired (`ADS1115` → short vs long)
- [ ] Vertical vs horizontal auto-orientation for feedthroughs / mini-passives

---

## Process

- [ ] `table02` → human-OK art → `art02.md` + `golden02.md` + selftest case
- [ ] After `table03` language decisions: update SPEC §6–§8 and ARCHITECTURE roles
- [ ] Keep HARDWARE.md-style prose under tables for collapsed chemistry

---

## Non-goals (still)

- Full PCB/schematic capture of boiler plant
- SPICE of NTC curves
- Auto BOM from the matrix
