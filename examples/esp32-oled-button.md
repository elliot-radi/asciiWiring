# ESP32-C3 + SSD1306 OLED + Button

Wiring diagram for an ESP32-C3 SuperMini driving a 0.96" SSD1306 OLED
via I2C, with a pushbutton on GPIO5.

| Signal     | ESP32-C3 | OLED | BUTTON | 10kΩ |
|------------|----------|------|--------|------|
| I2C DATA   | GPIO8    | SDA  |        |      |
| I2C CLOCK  | GPIO9    | SCK  |        |      |
| BUTTON     | GPIO5    |      | (NO)   |  x   |
| °3.3V      | 3V3      | VCC  |        |  x   |
| °GND       | GND      | GND  | GND    |      |

Abbreviations:
  ESP32-C3 ≝ "ESP32-C3 SuperMini Zero rev1.41"
  OLED     ≝ "0.96\" SSD1306 OLED module"