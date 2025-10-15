// src/app/services/weather-data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, timer, Observable, Subscription, lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import * as yaml from 'js-yaml';

/** Interface para representar un punto de datos meteorológicos */
export interface WeatherDataPoint {
  time: string;
  temperature: number; // °C
  energy: number;      // kWh
}

@Injectable({ providedIn: 'root' })
export class WeatherDataService {
  // Último dato emitido
  private currentDataSubject = new BehaviorSubject<WeatherDataPoint>({
    time: '00:00:00',
    temperature: 0,
    energy: 0
  });

  // Historial para gráficos
  private dataHistory: WeatherDataPoint[] = [];
  private dataHistorySubject = new BehaviorSubject<WeatherDataPoint[]>([]);

  // Datos (simulados o cargados de YAML)
  private mockData: WeatherDataPoint[] = [];
  private currentIndex = 0;
  private isStreaming = false;
  private streamSub?: Subscription;

  constructor(private http: HttpClient) {
    // Si sólo quieres usar YAML, comenta esta línea
    // this.generateMockData();
  }

  /** Lee un YAML en /assets y lo convierte a objeto tipado */
  loadYAMLFile<T = any>(path: string): Observable<T> {
    return this.http.get(path, { responseType: 'text' }).pipe(
      map(text => yaml.load(text) as T)
    );
  }

  /** Carga datos desde YAML (estructura con temperature y power) y arranca el streaming */
 /** Carga datos desde YAML (estructura con temperature y power) y arranca el streaming */
async startStreamingFromYAML(path: string): Promise<void> {
  interface YAMLStructure {
    temperature: {
      unit: string;
      values: Array<{ time: string; value: number }>;
    };
    power: {
      unit: string;
      values: Array<{ time: string; value: string | number }>;
    };
  }

  const data = await lastValueFrom(this.loadYAMLFile<YAMLStructure>(path));
  
  if (!data?.temperature?.values || !data?.power?.values) {
    console.warn('El YAML no tiene la estructura esperada (temperature y power)');
    return;
  }

  // Crear un mapa de power por time para búsqueda rápida
  const powerMap = new Map<string, number>();
  data.power.values.forEach(item => {
    const powerValue = typeof item.value === 'string' 
      ? parseFloat(item.value) 
      : item.value;
    powerMap.set(item.time, powerValue);
  });

  // Combinar temperatura y power
// Combinar temperatura y power
this.mockData = data.temperature.values.map(item => {
  const temp = this.convertDKToCelsius(item.value);
  const powerMW = powerMap.get(item.time) || 0;
  
  // Convertir MW a kWh (energía producida en 5 segundos)
  // kWh = MW × 1000 kW/MW × (5 segundos / 3600 segundos/hora)
  const energy = powerMW * 1000 * (5 / 3600);

    return {
      time: item.time,
      temperature: temp,
      energy: Number(energy.toFixed(2))
    };
  });

  console.log(`Cargados ${this.mockData.length} puntos desde YAML`);
  this.resetStreaming();
  this.startStreaming();
}

  /** Genera datos simulados para demostración (24h, paso de 5s) */
  private generateMockData(): void {
    const startTime = new Date();
    startTime.setHours(0, 0, 0, 0);

    // 24 * 60 * 60 / 5 = 17280 puntos
    for (let i = 0; i < 17280; i++) {
      const time = new Date(startTime.getTime() + i * 5000);
      const hours = time.getHours();
      const minutes = time.getMinutes();
      const seconds = time.getSeconds();

      // Temperatura base según hora del día (simulación)
      const baseTemp = 15 + 10 * Math.sin((hours / 24) * Math.PI);
      const tempVariation = Math.random() * 2 - 1;
      const temperature = baseTemp + tempVariation;

      // Energía solar (mayor durante el día)
      const solarFactor = Math.max(0, Math.sin(((hours - 6) / 12) * Math.PI));
      const energy = solarFactor * (800 + Math.random() * 200);

      this.mockData.push({
        time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
        temperature: Number(temperature.toFixed(2)),
        energy: Number(energy.toFixed(2))
      });
    }
  }

  /** Inicia el streaming de datos progresivo (cada 5s) */
  startStreaming(): void {
    if (this.isStreaming) return;
    this.isStreaming = true;

    // ⏱️ Comenzar desde la hora actual del día (para no ver energía 0 de madrugada)
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const stepMs = 5000;
    const stepsSinceMidnight = Math.floor((now.getTime() - midnight.getTime()) / stepMs);
    this.currentIndex = Math.min(Math.max(stepsSinceMidnight, 0), this.mockData.length - 1);

    // 🆕 Prellenar historial con los últimos 60 puntos (o los disponibles)
    const historyStartIndex = Math.max(0, this.currentIndex - 60);
    this.dataHistory = this.mockData.slice(historyStartIndex, this.currentIndex);
    this.dataHistorySubject.next([...this.dataHistory]);

    // 🆕 Emitir el dato actual inmediatamente
    if (this.mockData[this.currentIndex]) {
      this.currentDataSubject.next(this.mockData[this.currentIndex]);
    }

    // 🆕 Usar timer(0, 5000) en lugar de interval(5000)
    this.streamSub = timer(0, stepMs).subscribe(() => {
      if (this.currentIndex < this.mockData.length) {
        const currentData = this.mockData[this.currentIndex];

        // Emitir el valor actual
        this.currentDataSubject.next(currentData);

        // Mantener historial (máx. 60 puntos)
        this.dataHistory.push(currentData);
        if (this.dataHistory.length > 60) this.dataHistory.shift();
        this.dataHistorySubject.next([...this.dataHistory]);

        this.currentIndex++;
      } else {
        // Reiniciar al final del día
        this.currentIndex = 0;
      }
    });
  }

  /** Detiene el streaming y limpia la suscripción */
  stopStreaming(): void {
    this.streamSub?.unsubscribe();
    this.streamSub = undefined;
    this.isStreaming = false;
  }

  /** Resetea contadores/historial (útil al cambiar de fuente de datos) */
  private resetStreaming(): void {
    this.stopStreaming();
    this.currentIndex = 0;
    this.dataHistory = [];
    this.dataHistorySubject.next([]);
  }

  /** Observable para obtener el último valor de datos */
  getCurrentData(): Observable<WeatherDataPoint> {
    return this.currentDataSubject.asObservable();
  }

  /** Observable para obtener el historial de datos */
  getDataHistory(): Observable<WeatherDataPoint[]> {
    return this.dataHistorySubject.asObservable();
  }

  /** Número total de puntos procesados */
  getProcessedDataCount(): number {
    return this.currentIndex;
  }

  /** Convierte de decikelvins (dK) a °C */
  convertDKToCelsius(dK: number): number {
    return Number(((dK / 10) - 273.15).toFixed(2));
  }
}