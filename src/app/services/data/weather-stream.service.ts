// src/app/services/data/weather-stream.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, timer, lastValueFrom } from 'rxjs';
import { WeatherDataLoaderService, WeatherDataPoint } from './weather-data-loader.service';

/**
 * Servicio responsable del streaming de datos meteorológicos en tiempo real.
 * Responsabilidad única: gestión del estado y emisión temporal de datos.
 */
@Injectable({
  providedIn: 'root'
})
export class WeatherStreamService {
  // Estado observable
  private currentDataSubject = new BehaviorSubject<WeatherDataPoint>({
    time: '00:00:00',
    temperature: 0,
    energy: 0
  });

  private dataHistorySubject = new BehaviorSubject<WeatherDataPoint[]>([]);

  // Almacenamiento interno
  private allData: WeatherDataPoint[] = [];
  private dataHistory: WeatherDataPoint[] = [];
  private currentIndex = 0;
  private isStreaming = false;
  private streamSub?: Subscription;

  // Configuración
  private readonly STEP_INTERVAL_MS = 5000; // 5 segundos
  private readonly HISTORY_PRELOAD = 60;    // Precargar 60 puntos (5 min)
  private readonly MAX_HISTORY = 200;       // Límite de historial en memoria

  // Derivados
  private get expectedPointsPerDay(): number {
    // 24h * 3600 s / intervalo(s)
    return Math.floor((24 * 3600) / (this.STEP_INTERVAL_MS / 1000));
  }

  constructor(private dataLoader: WeatherDataLoaderService) {}

  /**
   * Carga datos desde un archivo YAML y arranca el streaming.
   * - Carga y valida los datos
   * - Calcula el índice inicial basado en la hora actual
   * - Precarga historial para tener datos desde el inicio
   * - Inicia el streaming automático
   * 
   * @param path Ruta al archivo YAML
   */
  async startStreaming(path: string): Promise<void> {
    try {
      // 1) Cargar datos
      this.allData = await lastValueFrom(this.dataLoader.loadWeatherData(path));

      // 2) Validar
      if (!this.dataLoader.validateData(this.allData)) {
        throw new Error('Datos inválidos o vacíos tras el parseo');
      }

      // 2.1) Aviso si no cubre 24h
      if (this.allData.length < this.expectedPointsPerDay) {
        console.warn(
          `ℹ️ Dataset incompleto: ${this.allData.length} puntos, ` +
          `pero se esperan ~${this.expectedPointsPerDay} puntos para 24h a ${this.STEP_INTERVAL_MS / 1000}s.`
        );
      }

      // 3) Calcular índice inicial según hora actual (con clamp)
      this.currentIndex = this.calculateCurrentIndex();

      // 4) Precargar historial (últimos N puntos antes del índice actual)
      this.preloadHistory();

      // 5) Emitir punto actual inmediatamente (si existe)
      const current = this.allData[this.currentIndex];
      if (current) this.currentDataSubject.next(current);

      // 6) Iniciar streaming
      this.startStreamingTimer();

      console.log(
        `✅ Streaming iniciado. Índice actual: ${this.currentIndex}/${this.allData.length} ` +
        `(intervalo=${this.STEP_INTERVAL_MS}ms, historial precargado=${this.dataHistory.length})`
      );
    } catch (error) {
      console.error('❌ Error iniciando streaming:', error);
      // No relanzamos para no romper la UI; si prefieres, puedes throw error;
      throw error;
    }
  }

  /**
   * Calcula el índice actual basándose en la hora del día.
   * Asume que los datos comienzan a medianoche con intervalos de 5s.
   * Aplica clamp si el índice resultante excede el tamaño real del dataset.
   */
  private calculateCurrentIndex(): number {
    if (!this.allData.length) return 0;

    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);

    const elapsedMs = now.getTime() - midnight.getTime();
    const stepsSinceMidnight = Math.floor(elapsedMs / this.STEP_INTERVAL_MS);

    if (stepsSinceMidnight >= this.allData.length) {
      console.warn(
        `ℹ️ Índice calculado (${stepsSinceMidnight}) supera el tamaño del dataset (${this.allData.length}). ` +
        `Se aplicará clamp al último índice disponible.`
      );
    }

    return Math.min(
      Math.max(stepsSinceMidnight, 0),
      this.allData.length - 1
    );
  }

  /**
   * Precarga el historial con los últimos N puntos antes del índice actual.
   */
  private preloadHistory(): void {
    const start = Math.max(0, this.currentIndex - this.HISTORY_PRELOAD);
    this.dataHistory = this.allData.slice(start, this.currentIndex);
    this.dataHistorySubject.next([...this.dataHistory]);
  }

  /**
   * Inicia el timer que emite datos cada 5 segundos.
   */
  private startStreamingTimer(): void {
    if (this.isStreaming) return;

    this.isStreaming = true;

    // Primer tick tras STEP_INTERVAL_MS (ya emitimos inmediatamente en startStreaming)
    this.streamSub = timer(this.STEP_INTERVAL_MS, this.STEP_INTERVAL_MS).subscribe(() => {
      this.emitNextDataPoint();
    });
  }

  /**
   * Emite el siguiente punto de datos y actualiza el historial.
   * Al finalizar el array (fin del "día"), rota a índice 0, precarga historial y emite punto 0 sin esperar al siguiente tick.
   */
  private emitNextDataPoint(): void {
    if (!this.allData.length) return;

    // Si hemos llegado al final, rotamos a 0 y reprecargamos historial
    if (this.currentIndex >= this.allData.length) {
      this.currentIndex = 0;
      this.preloadHistory();
      const rotated = this.allData[this.currentIndex];
      if (rotated) {
        this.currentDataSubject.next(rotated);
        this.dataHistory.push(rotated);
        if (this.dataHistory.length > this.MAX_HISTORY) this.dataHistory.shift();
        this.dataHistorySubject.next([...this.dataHistory]);
      }
      this.currentIndex++;
      return;
    }

    const currentPoint = this.allData[this.currentIndex];

    // Emitir dato actual
    this.currentDataSubject.next(currentPoint);

    // Actualizar historial con límite
    this.dataHistory.push(currentPoint);
    if (this.dataHistory.length > this.MAX_HISTORY) {
      this.dataHistory.shift();
    }
    this.dataHistorySubject.next([...this.dataHistory]);

    this.currentIndex++;
  }

  /**
   * Detiene el streaming.
   */
  stopStreaming(): void {
    if (!this.isStreaming) return;

    this.streamSub?.unsubscribe();
    this.streamSub = undefined;
    this.isStreaming = false;
  }

  /**
   * Reinicia completamente el streaming.
   */
  resetStreaming(): void {
    this.stopStreaming();
    this.currentIndex = 0;
    this.dataHistory = [];
    this.dataHistorySubject.next([]);
    this.allData = [];
  }

  // ========== Observables públicos ==========

  /**
   * Observable del dato actual (último emitido).
   */
  getCurrentData(): Observable<WeatherDataPoint> {
    return this.currentDataSubject.asObservable();
  }

  /**
   * Observable del historial de datos.
   */
  getDataHistory(): Observable<WeatherDataPoint[]> {
    return this.dataHistorySubject.asObservable();
  }

  // ========== Getters ==========

  /**
   * Obtiene el número de puntos procesados.
   */
  getProcessedDataCount(): number {
    return this.currentIndex;
  }

  /**
   * Indica si el streaming está activo.
   */
  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  /**
   * Obtiene el total de puntos de datos disponibles.
   */
  getTotalDataPoints(): number {
    return this.allData.length;
  }
}
