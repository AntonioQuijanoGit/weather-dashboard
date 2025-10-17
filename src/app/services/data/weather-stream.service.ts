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
      // 1. Cargar datos
      this.allData = await lastValueFrom(this.dataLoader.loadWeatherData(path));

      // 2. Validar
      if (!this.dataLoader.validateData(this.allData)) {
        throw new Error('Datos inválidos');
      }

      // 3. Calcular índice inicial según hora actual
      this.currentIndex = this.calculateCurrentIndex();

      // 4. Precargar historial (últimos 60 puntos ≈ 5 min)
      this.preloadHistory();

      // 5. Emitir punto actual inmediatamente
      if (this.allData[this.currentIndex]) {
        this.currentDataSubject.next(this.allData[this.currentIndex]);
      }

      // 6. Iniciar streaming
      this.startStreamingTimer();

      console.log(`✅ Streaming iniciado desde índice ${this.currentIndex}/${this.allData.length}`);
    } catch (error) {
      console.error('❌ Error iniciando streaming:', error);
      throw error;
    }
  }

  /**
   * Calcula el índice actual basándose en la hora del día.
   * Asume que los datos comienzan a medianoche con intervalos de 5s.
   */
  private calculateCurrentIndex(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);

    const elapsedMs = now.getTime() - midnight.getTime();
    const stepsSinceMidnight = Math.floor(elapsedMs / this.STEP_INTERVAL_MS);

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

    console.log(`📊 Historial precargado: ${this.dataHistory.length} puntos`);
  }

  /**
   * Inicia el timer que emite datos cada 5 segundos.
   */
  private startStreamingTimer(): void {
    if (this.isStreaming) {
      console.warn('⚠️ Streaming ya está activo');
      return;
    }

    this.isStreaming = true;

    this.streamSub = timer(this.STEP_INTERVAL_MS, this.STEP_INTERVAL_MS).subscribe(() => {
      this.emitNextDataPoint();
    });
  }

  /**
   * Emite el siguiente punto de datos y actualiza el historial.
   */
  private emitNextDataPoint(): void {
    if (this.currentIndex >= this.allData.length) {
      // Reiniciar al finalizar el día
      console.log('🔄 Reiniciando streaming desde el inicio');
      this.currentIndex = 0;
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

    console.log('⏸️ Streaming detenido');
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

    console.log('🔄 Streaming reiniciado');
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