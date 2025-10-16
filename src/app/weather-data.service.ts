// src/app/services/weather-data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, timer, Observable, Subscription, lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import * as yaml from 'js-yaml';

export interface WeatherDataPoint {
  time: string;        // "HH:MM:SS"
  temperature: number; // °C
  energy: number;      // kWh (energía en cada intervalo de 5 s)
}

@Injectable({ providedIn: 'root' })
export class WeatherDataService {
  // Estado observable
  private currentDataSubject = new BehaviorSubject<WeatherDataPoint>({
    time: '00:00:00',
    temperature: 0,
    energy: 0
  });
  private dataHistorySubject = new BehaviorSubject<WeatherDataPoint[]>([]);

  // Almacenamiento interno
  private dataHistory: WeatherDataPoint[] = [];
  private streamData: WeatherDataPoint[] = []; // datos cargados desde YAML
  private currentIndex = 0;
  private isStreaming = false;
  private streamSub?: Subscription;

  constructor(private http: HttpClient) {}

  /** Lee un YAML en /assets y lo parsea a objeto */
  loadYAMLFile<T = any>(path: string): Observable<T> {
    return this.http.get(path, { responseType: 'text' }).pipe(
      map(text => yaml.load(text) as T)
    );
  }

  /**
   * Carga datos desde YAML (keys: temperature, power) y arranca el streaming.
   * - temperature.values: [{ time: "HH:MM:SS", value: number(dK) }]
   * - power.values:       [{ time: "HH:MM:SS", value: number|string (MW) }]
   * Convierte dK → °C y MW → kWh por intervalo de 5 s.
   * Precarga historial para que haya estadísticas desde el primer segundo.
   */
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
      console.warn('⚠️ YAML sin estructura esperada: faltan temperature.values o power.values');
      return;
    }

    // Mapa de potencia por timestamp
    const powerMap = new Map<string, number>();
    for (const item of data.power.values) {
      const v = typeof item.value === 'string' ? parseFloat(item.value) : item.value;
      powerMap.set(item.time, Number.isFinite(v) ? v : 0);
    }

    // Unificar en puntos de 5 s
    this.streamData = data.temperature.values.map(item => {
      const tempC = this.convertDKToCelsius(item.value);
      const powerMW = powerMap.get(item.time) ?? 0;
      // kWh en 5 s: MW * 1000 kW/MW * (5/3600) h
      const energyKwh = powerMW * 1000 * (5 / 3600);
      return {
        time: item.time,
        temperature: tempC,
        energy: Number(energyKwh.toFixed(2))
      };
    });

    // Precarga y arranque
    this.resetStreaming();

    // Calcular índice inicial según hora actual (desde medianoche, paso 5 s)
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const stepMs = 5000;
    const stepsSinceMidnight = Math.floor((now.getTime() - midnight.getTime()) / stepMs);

    this.currentIndex = Math.min(Math.max(stepsSinceMidnight, 0), this.streamData.length - 1);

    // Precargar últimos 60 puntos (≈5 min) para tener gráficos/estadísticas de inicio
    const HISTORY_WINDOW = 60;
    const start = Math.max(0, this.currentIndex - HISTORY_WINDOW);
    this.dataHistory = this.streamData.slice(start, this.currentIndex);
    this.dataHistorySubject.next([...this.dataHistory]);

    // Emitir el punto actual inmediatamente
    if (this.streamData[this.currentIndex]) {
      this.currentDataSubject.next(this.streamData[this.currentIndex]);
    }

    // Arrancar timer
    this.startStreaming();
  }

  /** Inicia la emisión en “tiempo real” (cada 5 s) */
  startStreaming(): void {
    if (this.isStreaming || this.streamData.length === 0) return;
    this.isStreaming = true;

    const stepMs = 5000;

    this.streamSub = timer(0, stepMs).subscribe(() => {
      if (this.currentIndex < this.streamData.length) {
        const current = this.streamData[this.currentIndex];

        // Emitir dato actual
        this.currentDataSubject.next(current);

        // Mantener historial (cap para no crecer infinito)
        this.dataHistory.push(current);
        if (this.dataHistory.length > 200) this.dataHistory.shift();
        this.dataHistorySubject.next([...this.dataHistory]);

        this.currentIndex++;
      } else {
        // Reiniciar al finalizar el día
        this.currentIndex = 0;
      }
    });
  }

  /** Detiene el streaming */
  stopStreaming(): void {
    this.streamSub?.unsubscribe();
    this.streamSub = undefined;
    this.isStreaming = false;
  }

  /** Limpia índices e historial */
  private resetStreaming(): void {
    this.stopStreaming();
    this.currentIndex = 0;
    this.dataHistory = [];
    this.dataHistorySubject.next([]);
  }

  /** Observables para el componente */
  getCurrentData(): Observable<WeatherDataPoint> {
    return this.currentDataSubject.asObservable();
  }
  getDataHistory(): Observable<WeatherDataPoint[]> {
    return this.dataHistorySubject.asObservable();
  }

  /** Puntos procesados (índice actual) */
  getProcessedDataCount(): number {
    return this.currentIndex;
  }

  /** Conversión dK → °C */
  convertDKToCelsius(dK: number): number {
    // dK = decikelvin. 1 dK = 0.1 K. 0°C = 273.15 K.
    return Number(((dK / 10) - 273.15).toFixed(2));
  }
}
