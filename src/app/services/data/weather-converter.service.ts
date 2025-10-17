// src/app/services/data/weather-converter.service.ts
import { Injectable } from '@angular/core';

/**
 * Servicio para conversiones de unidades meteorológicas.
 * Responsabilidad única: transformar valores entre diferentes unidades.
 */
@Injectable({
  providedIn: 'root'
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
    if (!Number.isFinite(decikelvin)) {
      console.warn('⚠️ Valor inválido para decikelvin:', decikelvin);
      return 0;
    }
    
    const kelvin = decikelvin / 10;
    const celsius = kelvin - 273.15;
    
    return Number(celsius.toFixed(2));
  }

  /**
   * Convierte megavatios (MW) a kilovatios-hora (kWh) para un intervalo de tiempo.
   * @param megawatts Potencia en megavatios (MW)
   * @param intervalSeconds Intervalo de tiempo en segundos (default: 5s)
   * @returns Energía en kilovatios-hora (kWh)
   * 
   * Fórmula: kWh = MW × 1000 kW/MW × (intervalSeconds / 3600) h
   * 
   * Ejemplo: 100 MW en 5s → 0.14 kWh
   */
  convertMegawattsToKilowattHours(
    megawatts: number, 
    intervalSeconds: number = 5
  ): number {
    if (!Number.isFinite(megawatts) || megawatts < 0) {
      console.warn('⚠️ Valor inválido para megawatts:', megawatts);
      return 0;
    }

    if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
      console.warn('⚠️ Intervalo inválido:', intervalSeconds);
      return 0;
    }

    const kilowatts = megawatts * 1000;
    const hours = intervalSeconds / 3600;
    const kilowattHours = kilowatts * hours;
    
    return Number(kilowattHours.toFixed(2));
  }

  /**
   * Valida y sanitiza un valor numérico.
   * @param value Valor a validar
   * @param fallback Valor por defecto si es inválido (default: 0)
   * @returns Valor sanitizado
   */
  sanitizeNumericValue(value: any, fallback: number = 0): number {
    const parsed = typeof value === 'string' ? parseFloat(value) : value;
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}