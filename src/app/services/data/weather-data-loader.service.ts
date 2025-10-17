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
  energy: number;      // kWh
}

/**
 * Estructura raw del archivo YAML.
 */
interface YAMLRawData {
  temperature: {
    unit: string;
    values: Array<{ time: string; value: number }>;
  };
  power: {
    unit: string;
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
   * Convierte las unidades raw (dK, MW) a unidades finales (°C, kWh).
   * 
   /**
 * Carga y procesa datos meteorológicos desde un archivo YAML.
 * Convierte las unidades raw (dK, MW) a unidades finales (°C, kWh).
 * 
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
   * - Combina temperatura y potencia por timestamp
   * - Convierte dK → °C
   * - Convierte MW → kWh (intervalo 5s)
   * 
   * @param rawData Datos raw del YAML
   * @returns Array de puntos procesados
   */
 /**
 * Procesa los datos raw del YAML y los convierte a WeatherDataPoint[].
 * - Combina temperatura y potencia por timestamp
 * - Convierte dK → °C
 * - Convierte MW → kWh (intervalo 5s)
 * 
 * @param rawData Datos raw del YAML
 * @returns Array de puntos procesados
 */
private processRawData(rawData: YAMLRawData): WeatherDataPoint[] {
  if (!rawData?.temperature?.values || !rawData?.power?.values) {
    console.warn('⚠️ YAML sin estructura esperada');
    return [];
  }

  // Crear mapa de potencia por timestamp para acceso O(1)
  const powerMap = new Map<string, number>();
  for (const item of rawData.power.values) {
    const powerMW = this.converter.sanitizeNumericValue(item.value, 0);
    powerMap.set(item.time, powerMW);
  }

  // Procesar cada punto de temperatura
  return rawData.temperature.values.map(tempItem => {
    // Convertir temperatura: dK → °C
    const temperatureCelsius = this.converter.convertDecikelvinToCelsius(
      tempItem.value
    );

    // Obtener potencia correspondiente
    const powerMW = powerMap.get(tempItem.time) ?? 0;

    // Convertir potencia: MW → kWh (intervalo 5s)
    const energyKwh = this.converter.convertMegawattsToKilowattHours(
      powerMW,
      5 // intervalo en segundos
    );

    return {
      time: tempItem.time,
      temperature: temperatureCelsius,
      energy: energyKwh
    };
  });
}

/**
 * Convierte un timestamp HH:MM:SS a segundos desde medianoche
 */
private timeToSeconds(time: string): number {
  const parts = time.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseInt(parts[2], 10) || 0;
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