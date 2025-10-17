// src/app/services/data/weather-data-loader.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as yaml from 'js-yaml';
import { WeatherConverterService } from './weather-converter.service';

/**
 * Punto de datos meteorológicos procesado y listo para consumir.
 */
export interface WeatherDataPoint {
  time: string;        // "HH:MM:SS"
  temperature: number; // °C
  energy: number;      // kWh (para el intervalo, p.ej. 5 s)
}

/**
 * Estructura raw del archivo YAML.
 */
interface YAMLRawData {
  temperature: {
    unit: string; // dK | K | °C
    values: Array<{ time: string; value: number }>;
  };
  power: {
    unit: string; // MW | kW | W
    values: Array<{ time: string; value: string | number }>;
  };
}

/**
 * Servicio responsable de cargar y parsear datos meteorológicos desde archivos YAML.
 * Responsabilidad única: I/O de datos y parsing.
 */
@Injectable({
  providedIn: 'root'
})
export class WeatherDataLoaderService {

  // Intervalo de muestreo por punto (segundos). Debe coincidir con el origen.
  private readonly DEFAULT_INTERVAL_SECONDS = 5;

  constructor(
    private http: HttpClient,
    private converter: WeatherConverterService
  ) {}

  /**
   * Carga un archivo YAML desde la ruta especificada.
   * @param path Ruta al archivo YAML (ej: 'assets/data.yml')
   * @returns Observable con el contenido parseado
   */
  private loadYAMLFile<T = any>(path: string): Observable<T> {
    return this.http.get(path, { responseType: 'text' }).pipe(
      map(text => {
        try {
          return yaml.load(text) as T;
        } catch (error) {
          console.error('❌ Error parseando YAML:', error);
          throw new Error(`Error al parsear YAML desde ${path}`);
        }
      })
    );
  }

  /**
   * Carga y procesa datos meteorológicos desde un archivo YAML.
   * Convierte las unidades raw a unidades finales (°C, kWh por intervalo).
   * @param path Ruta al archivo YAML
   * @returns Observable con array de puntos de datos procesados
   */
  loadWeatherData(path: string): Observable<WeatherDataPoint[]> {
    return this.loadYAMLFile<YAMLRawData>(path).pipe(
      map(rawData => this.processRawData(rawData))
    );
  }

  /**
   * Procesa los datos raw del YAML y los convierte a WeatherDataPoint[].
   * - Valida/avisa por unidades inesperadas.
   * - Ordena por hora (HH:MM:SS).
   * - Combina temperatura y potencia por timestamp.
   * - Convierte a °C y kWh/intervalo (por defecto 5 s).
   * @param rawData Datos raw del YAML
   * @returns Array de puntos procesados
   */
  private processRawData(rawData: YAMLRawData): WeatherDataPoint[] {
    if (!rawData?.temperature?.values || !rawData?.power?.values) {
      console.warn('⚠️ YAML sin estructura esperada (temperature.values / power.values ausentes)');
      return [];
    }

    // === 1) Normalización de unidades: avisos y factores ===
    const tUnit = (rawData.temperature.unit || '').trim();
    const pUnit = (rawData.power.unit || '').trim();

    // Temperatura admitida: dK | K | °C
    const allowedTemp = ['dK', 'K', '°C', 'C'];
    if (!allowedTemp.includes(tUnit)) {
      console.warn(`⚠️ Unidad de temperatura inesperada: "${tUnit}". Se intentará interpretar; esperado: dK | K | °C`);
    }

    // Potencia admitida: MW | kW | W
    const allowedPower = ['MW', 'kW', 'W'];
    if (!allowedPower.includes(pUnit)) {
      console.warn(`⚠️ Unidad de potencia inesperada: "${pUnit}". Se intentará interpretar; esperado: MW | kW | W`);
    }

    // Factor para convertir potencia leída a MW (porque nuestro conversor espera MW)
    const powerToMWFactor =
      pUnit === 'MW' ? 1 :
      pUnit === 'kW' ? 1 / 1000 :
      pUnit === 'W'  ? 1 / 1_000_000 :
      1; // fallback (asume que ya viene en MW si es desconocida)

    // === 2) Ordenar arrays por hora (HH:MM:SS) ===
    const sortByTime = <T extends { time: string }>(arr: T[]) =>
      [...arr].sort((a, b) => this.timeToSeconds(a.time) - this.timeToSeconds(b.time));

    const tempSorted = sortByTime(rawData.temperature.values);
    const powerSorted = sortByTime(rawData.power.values);

    // === 3) Map de potencia por timestamp (último valor para duplicados) ===
    const powerMap = new Map<string, number>();
    for (const item of powerSorted) {
      const mwRaw = this.converter.sanitizeNumericValue(item.value, 0) * powerToMWFactor;
      powerMap.set(item.time, mwRaw);
    }

    // === 4) Construcción de puntos normalizados ===
    const points: WeatherDataPoint[] = [];
    for (const t of tempSorted) {
      // Convertir temperatura según unidad declarada
      let tempC = 0;
      if (tUnit === 'dK') {
        tempC = this.converter.convertDecikelvinToCelsius(t.value);
      } else if (tUnit === 'K') {
        // °C = K - 273.15
        if (Number.isFinite(t.value)) tempC = (t.value as number) - 273.15;
      } else if (tUnit === '°C' || tUnit === 'C') {
        tempC = Number.isFinite(t.value) ? (t.value as number) : 0;
      } else {
        // Intento heurístico: si el valor es grande (≈300), tratamos como K; si no, como °C
        const v = Number.isFinite(t.value) ? (t.value as number) : 0;
        tempC = v >= 200 ? (v - 273.15) : v;
      }

      // Potencia correspondiente en MW (o 0 si falta)
      const powerMW = powerMap.get(t.time);
      if (powerMW === undefined) {
        // Puedes cambiar el comportamiento a: saltar punto si no hay potencia
        console.warn(`ℹ️ Sin dato de potencia para time=${t.time}. Se usará 0 MW.`);
      }
      const mw = powerMW ?? 0;

      // Convertir MW → kWh para el intervalo (por defecto 5 s)
      const kwh = this.converter.convertMegawattsToKilowattHours(mw, this.DEFAULT_INTERVAL_SECONDS);

      points.push({
        time: t.time,
        temperature: tempC,
        energy: kwh,
      });
    }

    return points;
  }

  /**
   * Convierte un timestamp HH:MM:SS a segundos desde medianoche.
   */
  private timeToSeconds(time: string): number {
    if (!time || typeof time !== 'string') return 0;
    const parts = time.split(':');
    const hours = parseInt(parts[0] || '0', 10) || 0;
    const minutes = parseInt(parts[1] || '0', 10) || 0;
    const seconds = parseInt(parts[2] || '0', 10) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Valida que los datos cargados sean correctos.
   * @param data Array de datos a validar
   * @returns true si los datos son válidos
   */
  validateData(data: WeatherDataPoint[]): boolean {
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('⚠️ Datos vacíos o inválidos');
      return false;
    }

    // Verificar que los primeros puntos tengan la estructura correcta
    const sample = data[0];
    if (!sample.time || !Number.isFinite(sample.temperature) || !Number.isFinite(sample.energy)) {
      console.warn('⚠️ Estructura de datos inválida:', sample);
      return false;
    }

    return true;
  }
}
