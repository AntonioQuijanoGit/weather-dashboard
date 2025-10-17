import { Injectable } from '@angular/core';

/**
 * Servicio para conversión de unidades meteorológicas y energéticas.
 * - dK → °C
 * - MW → kWh
 * - Sanitización numérica
 */
@Injectable({
  providedIn: 'root',
})
export class WeatherConverterService {
  /**
   * Convierte decikelvin a grados Celsius.
   * @param decikelvin Temperatura en decikelvin (dK). 1 dK = 0.1 K
   * @returns Temperatura en grados Celsius (°C)
   *
   * Fórmula: °C = (dK / 10) - 273.15
   *
   * Ejemplo: 2931.5 dK → 20.0 °C
   */
  convertDecikelvinToCelsius(decikelvin: number): number {
    // Soporta null/undefined y valores no numéricos
    if (!Number.isFinite(decikelvin ?? (NaN as any))) return 0;
    const kelvin = decikelvin / 10;
    return kelvin - 273.15; // sin redondeo aquí
  }

  /**
   * Convierte megavatios (MW) a kilovatios-hora (kWh) para un intervalo de tiempo.
   * @param megawatts Potencia en megavatios (MW)
   * @param intervalSeconds Intervalo de tiempo en segundos (default: 5s)
   * @returns Energía en kilovatios-hora (kWh)
   *
   * Fórmula: kWh = MW × 1000 kW/MW × (intervalSeconds / 3600) h
   *
   * Ejemplo: 100 MW en 5 s → 138.89 kWh
   */
  convertMegawattsToKilowattHours(
    megawatts: number,
    intervalSeconds: number = 5
  ): number {
    // Mantiene la política actual: negativos → 0 (lo revisamos más adelante)
    if (!Number.isFinite(megawatts) || megawatts < 0) return 0;
    if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) return 0;

    const kilowatts = megawatts * 1000;
    const hours = intervalSeconds / 3600;
    return kilowatts * hours; // sin redondeo aquí; se formatea en la UI
  }

  /**
   * Valida y sanitiza un valor numérico.
   * - Acepta strings con comas decimales ("12,34").
   * - Devuelve un fallback si el valor no es válido.
   * @param value Valor a validar
   * @param fallback Valor por defecto si es inválido (default: 0)
   * @returns Valor numérico válido
   */
  sanitizeNumericValue(value: any, fallback: number = 0): number {
    const parsed =
      typeof value === 'string'
        ? parseFloat(value.replace(',', '.'))
        : value;
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
