// src/app/app.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectorRef
} from '@angular/core';
import {
  Chart,
  ChartConfiguration,
  registerables
} from 'chart.js';
import { WeatherStreamService } from './services/data/weather-stream.service';
import { WeatherDataPoint } from './services/data/weather-data-loader.service';
import { Subscription, fromEvent } from 'rxjs';

Chart.register(...registerables);

type ThemeTokens = {
  grid: string;
  tick: string;
  tooltipBg: string;
  tooltipTitle: string;
  tooltipBody: string;
  tooltipBorder: string;
};

type ThemeChoice = 'light' | 'dark';
type RangeKey = '5m' | '15m' | '60m' | '24h';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('temperatureChart') temperatureChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('energyChart') energyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sparkTemp') sparkTempRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sparkEnergy') sparkEnergyRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('themeToggle') themeToggleEl!: ElementRef<HTMLInputElement>;

  // Estado UI
  currentTemperature = 0;
  currentEnergy = 0;
  currentTime = '00:00:00';
  isStreaming = false;
  dataPointsProcessed = 0;
  elapsedTime = '00:00:00';
  currentYear = new Date().getFullYear();

  // Tema
  themeChoice: ThemeChoice = 'light';
  isDark = false;

  // Rango de tiempo
  ranges = [
    { key: '5m',  label: '5 min',  minutes: 5 },
    { key: '15m', label: '15 min', minutes: 15 },
    { key: '60m', label: '60 min', minutes: 60 },
    { key: '24h', label: '24 h',   minutes: 24 * 60 },
  ] as { key: RangeKey; label: string; minutes: number }[];
  activeRangeKey: RangeKey = '15m';
  get activeRangeLabel(): string {
    const item = this.ranges.find(r => r.key === this.activeRangeKey);
    return item ? item.label : '';
  }

  // Mostrar/ocultar series
  showTemp = true;
  showEnergy = true;

  // Charts
  private temperatureChart?: Chart;
  private energyChart?: Chart;

  // Subs / timer
  private subscriptions = new Subscription();
  private startTime?: Date;
  private timerInterval?: any;
  private resizeSub?: any;

  // Paleta series
  private teal  = '#0EA5A2';
  private slate = '#475569';

  // Formateadores
  nfTemp   = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  nfEnergy = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  nfInt    = new Intl.NumberFormat('es-ES');
  get tempDisplay(): string   { return this.nfTemp.format(this.currentTemperature); }
  get energyDisplay(): string { return this.nfEnergy.format(this.currentEnergy); }
  get processedDisplay(): string { return this.nfInt.format(this.dataPointsProcessed); }

  // Tendencias
  trendTemp:   'up' | 'down' | 'flat' = 'flat';
  trendEnergy: 'up' | 'down' | 'flat' = 'flat';
  tempPulse = false;
  energyPulse = false;


  private lastRealTrendTemp:   'up' | 'down' = 'down';
  private lastRealTrendEnergy: 'up' | 'down' = 'down';

  // Estadísticas simples
  stats = { tempAvg: 0, tempMax: 0, energySum: 0, points: 0 };

  // "Actualizado hace …"
  lastUpdatedAt: number = Date.now();
  lastUpdatedRel: string = 'hace 0 s';
  private rtf = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });

  // KPIs de resumen (sin donuts)
  energyPeakTime = '--:--';
  energyPeakKwh  = 0;
  tempStateLabel = 'Estable';
  tempVariationLabel = '±0.0°C';

  // Control de animaciones de contador
  private tempAnimationFrame?: number;
  private energyAnimationFrame?: number;

  constructor(
    private weatherStream: WeatherStreamService,
    private cdr: ChangeDetectorRef
  ) {}

  // ---------- Ciclo de vida ----------
  ngOnInit(): void {
    // Tema guardado o preferencia del SO
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      this.themeChoice = stored;
    } else {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      this.themeChoice = prefersDark ? 'dark' : 'light';
      localStorage.setItem('theme', this.themeChoice);
    }
    this.applyThemeFromChoice();

    // Suscripciones a datos
    this.subscribeToData();

    // Arranque de streaming (YAML en assets)
    this.weatherStream
      .startStreaming('assets/data.yml')
      .then(() => {
        this.isStreaming = true;
        this.startTimer();
      })
      .catch((err: unknown) => console.error('Error cargando assets/data.yml:', err));

    // Redibujar sparklines on resize
    this.resizeSub = fromEvent(window, 'resize').subscribe(() => this.drawSparklines());

    // Atajo teclado: 't' alterna tema
    this.subscriptions.add(
      fromEvent<KeyboardEvent>(window, 'keydown').subscribe((ev) => {
        if (ev.key.toLowerCase() === 't') {
          this.setTheme(this.themeChoice === 'dark' ? 'light' : 'dark');
          queueMicrotask(() => this.themeToggleEl?.nativeElement?.focus());
        }
      })
    );
  }

  ngAfterViewInit(): void {
    this.initializeCharts();
  }

  ngOnDestroy(): void {
    if (this.tempAnimationFrame) cancelAnimationFrame(this.tempAnimationFrame);
    if (this.energyAnimationFrame) cancelAnimationFrame(this.energyAnimationFrame);

    this.subscriptions.unsubscribe();
    this.resizeSub?.unsubscribe?.();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.temperatureChart?.destroy();
    this.energyChart?.destroy();
  }

  // ---------- Tema ----------
  setTheme(choice: ThemeChoice): void {
    this.themeChoice = choice;
    localStorage.setItem('theme', choice);
    this.applyThemeFromChoice();
    this.restyleChartsForTheme();
  }

  private applyThemeFromChoice(): void {
    this.isDark = this.themeChoice === 'dark';
    document.body.classList.toggle('theme-dark', this.isDark);
  }

  private themeTokens(): ThemeTokens {
    return this.isDark
      ? {
          grid: 'rgba(148,163,184,0.12)',
          tick: '#CBD5E1',
          tooltipBg: '#0b1220',
          tooltipTitle: '#FFFFFF',
          tooltipBody: '#E2E8F0',
          tooltipBorder: '#111827',
        }
      : {
          grid: 'rgba(2,6,23,0.05)',
          tick: '#6b7280',
          tooltipBg: '#0f172a',
          tooltipTitle: '#ffffff',
          tooltipBody: '#e5e7eb',
          tooltipBorder: '#111827',
        };
  }

  private restyleChartsForTheme(): void {
    const t = this.themeTokens();

    const restyle = (chart?: Chart) => {
      if (!chart) return;
      const o = chart.options!;
      if ((o.scales as any)?.x?.grid)  (o.scales as any).x.grid.color  = t.grid;
      if ((o.scales as any)?.x?.ticks) (o.scales as any).x.ticks.color = t.tick;
      if ((o.scales as any)?.y?.grid)  (o.scales as any).y.grid.color  = t.grid;
      if ((o.scales as any)?.y?.ticks) (o.scales as any).y.ticks.color = t.tick;
      if (o.plugins?.tooltip) {
        o.plugins.tooltip.backgroundColor = t.tooltipBg as any;
        o.plugins.tooltip.titleColor = t.tooltipTitle as any;
        o.plugins.tooltip.bodyColor = t.tooltipBody as any;
        o.plugins.tooltip.borderColor = t.tooltipBorder as any;
      }
      chart.update('none');
    };

    restyle(this.temperatureChart);
    restyle(this.energyChart);
    this.drawSparklines();
  }

  // ---------- Charts ----------
  private initializeCharts(): void {
    if (!this.temperatureChartRef?.nativeElement || !this.energyChartRef?.nativeElement) {
      queueMicrotask(() => this.initializeCharts());
      return;
    }
    const t = this.themeTokens();

    const commonOptions: ChartConfiguration['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 220 },
      layout: { padding: 4 },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          intersect: false,
          mode: 'index',
          backgroundColor: t.tooltipBg,
          titleColor: t.tooltipTitle,
          bodyColor: t.tooltipBody,
          borderColor: t.tooltipBorder,
          borderWidth: 1,
          displayColors: false,
          cornerRadius: 8,
          padding: 10,
        },
        decimation: { enabled: true, algorithm: 'lttb', samples: 60 },
      },
      scales: {
        x: {
          grid: { color: t.grid },
          ticks: { color: t.tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
          border: { display: false },
        },
        y: {
          grid: { color: t.grid },
          ticks: { color: t.tick, autoSkip: true, maxTicksLimit: 5 },
          border: { display: false },
          beginAtZero: false,
        },
      },
    };

    this.temperatureChart = new Chart(this.temperatureChartRef.nativeElement, {
      type: 'line',
      data: { labels: [], datasets: [{
        label: 'Temperatura (°C)',
        data: [],
        borderColor: this.teal,
        backgroundColor: 'transparent',
        tension: 0.25,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 1.75,
      }]},
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins!.tooltip!,
            callbacks: {
              title: (items) => (items?.[0]?.label ?? ''),
              label: (item) => {
                const val = typeof item.parsed?.y === 'number' ? item.parsed.y : 0;
                return `${this.nfTemp.format(val)} °C`;
              },
            },
          },
        },
      },
    });

    this.energyChart = new Chart(this.energyChartRef.nativeElement, {
      type: 'line',
      data: { labels: [], datasets: [{
        label: 'Energía (kWh)',
        data: [],
        borderColor: this.slate,
        backgroundColor: 'transparent',
        tension: 0.25,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 1.75,
        borderDash: [4, 3],
      }]},
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins!.tooltip!,
            callbacks: {
              title: (items) => (items?.[0]?.label ?? ''),
              label: (item) => {
                const val = typeof item.parsed?.y === 'number' ? item.parsed.y : 0;
                return `${this.nfEnergy.format(val)} kWh`;
              },
            },
          },
        },
      },
    });
  }

  // ---------- Animación de valores numéricos ----------
  private animateValue(
    start: number,
    end: number,
    duration: number,
    onUpdate: (value: number) => void,
    onComplete?: () => void
  ): number {
    const startTime = performance.now();
    const delta = end - start;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = start + delta * eased;

      onUpdate(currentValue);
      this.cdr.markForCheck();

      if (progress < 1) {
        return requestAnimationFrame(animate);
      } else {
        onUpdate(end);
        this.cdr.markForCheck();
        if (onComplete) onComplete();
        return 0;
      }
    };

    return requestAnimationFrame(animate);
  }

  // ---------- Datos ----------
  private subscribeToData(): void {
    // Dato actual
    this.subscriptions.add(
      this.weatherStream.getCurrentData().subscribe((d: WeatherDataPoint) => {
        const newTrendTemp = this.compareTrend(this.currentTemperature, d.temperature);
        const newTrendEnergy = this.compareTrend(this.currentEnergy, d.energy);

        if (newTrendTemp !== 'flat') { this.lastRealTrendTemp = newTrendTemp; this.trendTemp = newTrendTemp; }
        else { this.trendTemp = this.lastRealTrendTemp; }

        if (newTrendEnergy !== 'flat') { this.lastRealTrendEnergy = newTrendEnergy; this.trendEnergy = newTrendEnergy; }
        else { this.trendEnergy = this.lastRealTrendEnergy; }

        if (this.tempAnimationFrame) cancelAnimationFrame(this.tempAnimationFrame);
        this.tempAnimationFrame = this.animateValue(this.currentTemperature, d.temperature, 400, (value) => {
          this.currentTemperature = value;
        });
        this.tempPulse = !this.tempPulse

        if (this.energyAnimationFrame) cancelAnimationFrame(this.energyAnimationFrame);
        this.energyAnimationFrame = this.animateValue(this.currentEnergy, d.energy, 400, (value) => {
          this.currentEnergy = value;
        });
          this.energyPulse = !this.energyPulse; 


        const now = new Date();
        this.currentTime =
          `${String(now.getHours()).padStart(2,'0')}:` +
          `${String(now.getMinutes()).padStart(2,'0')}:` +
          `${String(now.getSeconds()).padStart(2,'0')}`;

        this.dataPointsProcessed = this.weatherStream.getProcessedDataCount();
        this.lastUpdatedAt = Date.now();
      })
    );

    // Historial
    this.subscriptions.add(
      this.weatherStream.getDataHistory().subscribe((history: WeatherDataPoint[]) => {
        this.updateCharts(history);
        this.updateSummary(history); // ← KPIs de resumen sin donuts
        this.updateStats(history);
        this.drawSparklines(history);
      })
    );
  }

  private compareTrend(prev: number, next: number): 'up' | 'down' | 'flat' {
    const delta = next - prev;
    const eps = 0.001;
    if (delta > eps) return 'up';
    if (delta < -eps) return 'down';
    return 'flat';
  }

  private windowPoints(): number {
    const m = this.ranges.find(r => r.key === this.activeRangeKey)?.minutes ?? 15;
    return Math.max(12, Math.floor((m * 60) / 5));
  }

  /* >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
     % de progreso de la ventana activa (0–100)
     <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< */
  get windowProgressPct(): number {
    const total = this.windowPoints();
    const points = this.stats?.points ?? 0;
    if (!total || !Number.isFinite(points)) return 0;
    const pct = (points / total) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  onChangeRange(key: string): void {
    const allowed: RangeKey[] = ['5m','15m','60m','24h'];
    if (allowed.includes(key as RangeKey)) this.activeRangeKey = key as RangeKey;
  }

  onTempCheckboxChange(checked: boolean): void {
    this.showTemp = checked;
    this.applyVisibility();
  }

  onEnergyCheckboxChange(checked: boolean): void {
    this.showEnergy = checked;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    if (this.temperatureChart) {
      this.temperatureChart.getDatasetMeta(0).hidden = !this.showTemp;
      this.temperatureChart.update('none');
    }
    if (this.energyChart) {
      this.energyChart.getDatasetMeta(0).hidden = !this.showEnergy;
      this.energyChart.update('none');
    }
  }

  private updateCharts(history: WeatherDataPoint[]): void {
    const N = this.windowPoints();
    const last = history.slice(-N);

    const now = new Date();
    const labels = last.map((_, index) => {
      const secondsAgo = (last.length - 1 - index) * 5;
      const timestamp = new Date(now.getTime() - secondsAgo * 1000);
      const h = String(timestamp.getHours()).padStart(2,'0');
      const m = String(timestamp.getMinutes()).padStart(2,'0');
      const s = String(timestamp.getSeconds()).padStart(2,'0');
      return `${h}:${m}:${s}`;
    });

    const temperatures = last.map(d => d.temperature);
    const energies = last.map(d => d.energy);

    if (this.temperatureChart) {
      this.temperatureChart.data.labels = labels;
      (this.temperatureChart.data.datasets[0].data as number[]) = temperatures;
      this.temperatureChart.getDatasetMeta(0).hidden = !this.showTemp;
      this.temperatureChart.update('none');
    }
    if (this.energyChart) {
      this.energyChart.data.labels = labels;
      (this.energyChart.data.datasets[0].data as number[]) = energies;
      this.energyChart.getDatasetMeta(0).hidden = !this.showEnergy;
      this.energyChart.update('none');
    }
  }

  // KPIs de resumen SIN donuts (solo cálculos)
  private updateSummary(history: WeatherDataPoint[]): void {
    if (!history?.length) {
      this.energyPeakTime = '--:--';
      this.energyPeakKwh = 0;
      this.tempStateLabel = 'Estable';
      this.tempVariationLabel = '±0.0°C';
      return;
    }

    // Pico de energía (valor máximo y su hora)
    let maxEnergy = -Infinity;
    let peakTime = '--:--';
    for (const p of history) {
      if (p.energy > maxEnergy) {
        maxEnergy = p.energy;
        peakTime = p.time.slice(0, 5);
      }
    }
    this.energyPeakTime = peakTime;
    this.energyPeakKwh  = Number((maxEnergy === -Infinity ? 0 : maxEnergy).toFixed(2));

    // Estado térmico y variación
    const temps = history.map(h => h.temperature);
    if (temps.length) {
      const minTemp = Math.min(...temps);
      const maxTemp = Math.max(...temps);
      const range = maxTemp - minTemp;

      let tempState = 'Estable';
      if (range < 2) tempState = 'Muy estable';
      else if (range < 5) tempState = 'Estable';
      else if (range < 10) tempState = 'Variable';
      else tempState = 'Muy variable';

      this.tempStateLabel = tempState;
      this.tempVariationLabel = `±${(range / 2).toFixed(1)}°C`;
    } else {
      this.tempStateLabel = 'Estable';
      this.tempVariationLabel = '±0.0°C';
    }
  }

  private updateStats(history: WeatherDataPoint[]): void {
    if (!history?.length) {
      this.stats = { tempAvg: 0, tempMax: 0, energySum: 0, points: 0 };
      return;
    }
    const points = history.length;
    let tempSum = 0;
    let tempMax = Number.NEGATIVE_INFINITY;
    let energySum = 0;

    for (const p of history) {
      tempSum += p.temperature;
      if (p.temperature > tempMax) tempMax = p.temperature;
      energySum += p.energy;
    }
    this.stats = {
      tempAvg: Number((tempSum / points).toFixed(1)),
      tempMax: Number(tempMax.toFixed(1)),
      energySum: Number(energySum.toFixed(2)),
      points,
    };
  }

  private drawSparklines(history?: WeatherDataPoint[]): void {
    const N = 60;
    const data = history ?? [];
    const last = data.slice(-N);

    const draw = (canvas: HTMLCanvasElement | undefined, values: number[], stroke: string) => {
      if (!canvas || values.length < 2) return;
      const ctx = canvas.getContext('2d')!;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = (canvas.width = canvas.clientWidth * ratio);
      const h = (canvas.height = canvas.clientHeight * ratio);
      ctx.clearRect(0, 0, w, h);

      const min = Math.min(...values);
      const max = Math.max(...values);
      const scaleX = (i: number) => (i / (values.length - 1)) * (w - 2) + 1;
      const scaleY = (v: number) => {
        if (max === min) return h / 2;
        const t = (v - min) / (max - min);
        return h - t * (h - 2) - 1;
      };

      ctx.lineWidth = 1.5;
      (ctx as any).strokeStyle = stroke;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(scaleX(0), scaleY(values[0]));
      for (let i = 1; i < values.length; i++) ctx.lineTo(scaleX(i), scaleY(values[i]));
      ctx.stroke();
    };

    const temps = last.map((d) => d.temperature);
    const eners = last.map((d) => d.energy);
    draw(this.sparkTempRef?.nativeElement, temps, this.teal);
    draw(this.sparkEnergyRef?.nativeElement, eners, this.slate);
  }

  private startTimer(): void {
    this.startTime = new Date();
    this.timerInterval = setInterval(() => {
      if (!this.startTime) return;

      const elapsed = Date.now() - this.startTime.getTime();
      const s = Math.floor(elapsed / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      this.elapsedTime =
        `${String(h).padStart(2, '0')}:` +
        `${String(m % 60).padStart(2, '0')}:` +
        `${String(s % 60).padStart(2, '0')}`;

      // "Actualizado hace …"
      const diffSec = Math.max(1, Math.round((Date.now() - (this.lastUpdatedAt || Date.now())) / 1000));
      let rel: string;
      if (diffSec < 60) rel = this.rtf.format(-diffSec, 'second');
      else if (diffSec < 3600) rel = this.rtf.format(-Math.round(diffSec/60), 'minute');
      else if (diffSec < 86400) rel = this.rtf.format(-Math.round(diffSec/3600), 'hour');
      else rel = this.rtf.format(-Math.round(diffSec/86400), 'day');
      this.lastUpdatedRel = rel.replace('dentro de ', 'en ');
    }, 1000);
  }
}
