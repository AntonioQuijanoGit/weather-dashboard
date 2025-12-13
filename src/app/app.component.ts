import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectorRef,
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { WeatherStreamService } from './services/data/weather-stream.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeatherDataPoint } from './services/data/weather-data-loader.service';
import { Subscription, fromEvent } from 'rxjs';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import {
  KpiCardComponent,
  KPICardData,
} from './components/kpi-card/kpi-card.component';
import {
  StatisticsComponent,
  StatisticsData,
} from './components/statistics/statistics.component';
import {
  LucideAngularModule,
  Thermometer,
  TrendingUp,
  BarChart3,
  Lightbulb,
  HelpCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Database,
  Flame,
  ArrowLeftRight,
  Gauge,
  Rocket,
  Clock,
  Hourglass,
  Activity,
  BatteryCharging,
  Download,
  FileText,
  Image,
  Code,
  Github,
  ExternalLink,
  Info,
  Bell,
  Filter,
  Calendar,
  BarChart,
  Settings,
  Save,
  Bookmark,
  Maximize2,
} from 'lucide-angular';

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

type OverlaySummary = {
  min: number;
  max: number;
  last: number;
  pctHalf?: number;
  count: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    FooterComponent,
    KpiCardComponent,
    StatisticsComponent,
    LucideAngularModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('temperatureChart')
  temperatureChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('energyChart') energyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('tempSparkline') tempSparklineRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('energySparklineCanvas') energySparklineRef!: ElementRef<HTMLCanvasElement>;

  // Estado UI
  currentTemperature = 0;
  currentEnergy = 0;
  currentTime = '00:00:00';
  isStreaming = false;
  dataPointsProcessed = 0;
  elapsedTime = '00:00:00';
  currentYear = new Date().getFullYear();
  showHelp = false;
  helpSlideIndex = 0;

  // Tema
  themeChoice: ThemeChoice = 'light';
  isDark = false;

  // Rango de tiempo
  ranges = [
    { key: '5m', label: '5 min', minutes: 5 },
    { key: '15m', label: '15 min', minutes: 15 },
    { key: '60m', label: '60 min', minutes: 60 },
    { key: '24h', label: '24 h', minutes: 24 * 60 },
  ] as { key: RangeKey; label: string; minutes: number }[];
  activeRangeKey: RangeKey = '15m';
  get activeRangeLabel(): string {
    const item = this.ranges.find((r) => r.key === this.activeRangeKey);
    return item ? item.label : 'period';
  }

  get activeRangeMinutes(): number {
    return (
      this.ranges.find((r) => r.key === this.activeRangeKey)?.minutes ?? 15
    );
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

  // Historial local para sparklines de KPI cards
  private dataHistory: WeatherDataPoint[] = [];

  // Getters para datos de KPI Cards
  get tempKpiData(): KPICardData {
    const last60 = this.getLastNPoints(60);
    return {
      title: 'Average Temperature',
      icon: Thermometer,
      value: this.tempDisplay,
      unit: '°C',
      trend: this.trendTemp,
      pulse: this.tempPulse,
      sparklineData: last60.map((d) => d.temperature),
      sparklineColor: this.teal,
      overlaySummary: this.overlayTempSummary,
      activeRangeLabel: this.activeRangeLabel,
    };
  }

  get energyKpiData(): KPICardData {
    const last60 = this.getLastNPoints(60);
    return {
      title: 'Energy Produced',
      icon: Zap,
      value: this.energyDisplay,
      unit: 'kWh',
      trend: this.trendEnergy,
      pulse: this.energyPulse,
      sparklineData: last60.map((d) => d.energy),
      sparklineColor: this.slate,
      overlaySummary: this.overlayEnergySummary,
      activeRangeLabel: this.activeRangeLabel,
    };
  }

  private getLastNPoints(n: number): WeatherDataPoint[] {
    return this.dataHistory.slice(-n);
  }

  get statisticsData(): StatisticsData {
    return {
      processedDisplay: this.processedDisplay,
      deltas: this.deltas,
      stats: {
        tempMax: this.stats.tempMax,
        energySum: this.stats.energySum,
        prodAvgPerMin: this.stats.prodAvgPerMin,
        utilizationPct: this.stats.utilizationPct,
      },
      elapsedTime: this.elapsedTime,
      activeRangeLabel: this.activeRangeLabel,
    };
  }

  // Paleta series - Mejorada para mejor contraste y accesibilidad
  private teal = '#06B6D4'; // Cyan más vibrante y accesible
  private slate = '#64748B'; // Slate más claro y legible

  // Formateadores
  nfTemp = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  nfEnergy = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  nfInt = new Intl.NumberFormat('en-US');
  get tempDisplay(): string {
    return this.nfTemp.format(this.currentTemperature);
  }
  get energyDisplay(): string {
    return this.nfEnergy.format(this.currentEnergy);
  }
  get processedDisplay(): string {
    return this.nfInt.format(this.dataPointsProcessed);
  }

  // Helper methods for trend labels
  getTempTrendLabel(): string {
    if (!this.tempKpiData) return 'Stable';
    switch (this.tempKpiData.trend) {
      case 'up':
        return 'Rising';
      case 'down':
        return 'Falling';
      default:
        return 'Stable';
    }
  }

  getEnergyTrendLabel(): string {
    if (!this.energyKpiData) return 'Stable';
    switch (this.energyKpiData.trend) {
      case 'up':
        return 'Rising';
      case 'down':
        return 'Falling';
      default:
        return 'Stable';
    }
  }

  // Tendencias y pulses (mantienen último estado hasta que cambie)
  trendTemp: 'up' | 'down' | 'flat' = 'flat';
  trendEnergy: 'up' | 'down' | 'flat' = 'flat';
  tempPulse = false;
  energyPulse = false;

  private lastRealTrendTemp: 'up' | 'down' = 'down';
  private lastRealTrendEnergy: 'up' | 'down' = 'down';

  // Estadísticas
  stats = {
    tempAvg: 0,
    tempMax: 0,
    energySum: 0,
    points: 0,
    prodAvgPerMin: 0,
    prodAvgPerHour: 0,
    utilizationPct: 0,
  };

  // Para variaciones vs ventana anterior
  prevStats: { tempAvg: number; energySum: number } = {
    tempAvg: 0,
    energySum: 0,
  };
  deltas: { tempAvgPct: number; energySumPct: number } = {
    tempAvgPct: 0,
    energySumPct: 0,
  };
  
  // Comparison values for display
  comparisonValues: {
    currentTempAvg: number;
    previousTempAvg: number;
    currentEnergySum: number;
    previousEnergySum: number;
  } = {
    currentTempAvg: 0,
    previousTempAvg: 0,
    currentEnergySum: 0,
    previousEnergySum: 0,
  };

  // "Updated … ago"
  lastUpdatedAt: number = Date.now();
  lastUpdatedRel: string = '0 seconds ago';
  private rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

  // KPIs de resumen
  energyPeakTime = '--:--';
  energyPeakKwh = 0;
  tempStateLabel = 'Stable';
  tempVariationLabel = '±0.0%';

  // Variación térmica en número y dirección para flecha/colores
  tempVariationDeltaPct = 0;
  tempDeltaDir: 'up' | 'down' | 'flat' = 'flat';

  // Hovercards
  overlayTempSummary: OverlaySummary = {
    min: 0,
    max: 0,
    last: 0,
    count: 0,
    pctHalf: undefined,
  };
  overlayEnergySummary: OverlaySummary = {
    min: 0,
    max: 0,
    last: 0,
    count: 0,
    pctHalf: undefined,
  };

  // Control de animaciones de contador
  private tempAnimationFrame?: number;
  private energyAnimationFrame?: number;

  constructor(
    private weatherStream: WeatherStreamService,
    private cdr: ChangeDetectorRef
  ) {}

  // ---------- Ciclo de vida ----------
  ngOnInit(): void {
    // Load saved views
    const saved = localStorage.getItem('savedViews');
    if (saved) {
      try {
        this.savedViews = JSON.parse(saved);
      } catch (e) {
        console.error('Error loading saved views:', e);
      }
    }

    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      this.themeChoice = stored;
    } else {
      // Default to light theme (white) regardless of system preference
      this.themeChoice = 'light';
      localStorage.setItem('theme', this.themeChoice);
    }
    this.applyThemeFromChoice();

    this.subscribeToData();

    this.weatherStream
      .startStreaming('assets/data.yml')
      .then(() => {
        this.isStreaming = true;
        this.startTimer();
      })
      .catch((err: unknown) =>
        console.error('Error cargando assets/data.yml:', err)
      );

    this.subscriptions.add(
      fromEvent<KeyboardEvent>(window, 'keydown').subscribe((ev) => {
        if (ev.key.toLowerCase() === 't') {
          this.setTheme(this.themeChoice === 'dark' ? 'light' : 'dark');
        }
      })
    );
  }

  ngAfterViewInit(): void {
    this.initializeCharts();
    this.initializeSparklines();
  }

  ngOnDestroy(): void {
    if (this.tempAnimationFrame) cancelAnimationFrame(this.tempAnimationFrame);
    if (this.energyAnimationFrame)
      cancelAnimationFrame(this.energyAnimationFrame);

    this.subscriptions.unsubscribe();
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
    // Apply to both html and body for better compatibility
    document.documentElement.classList.toggle('theme-dark', this.isDark);
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

    const restyle = (chart?: Chart, gradientColor?: string) => {
      if (!chart) return;
      const o = chart.options!;
      if ((o.scales as any)?.x?.grid) (o.scales as any).x.grid.color = t.grid;
      if ((o.scales as any)?.x?.ticks) (o.scales as any).x.ticks.color = t.tick;
      if ((o.scales as any)?.y?.grid) (o.scales as any).y.grid.color = t.grid;
      if ((o.scales as any)?.y?.ticks) (o.scales as any).y.ticks.color = t.tick;
      if (o.plugins?.tooltip) {
        o.plugins.tooltip.backgroundColor = t.tooltipBg as any;
        o.plugins.tooltip.titleColor = t.tooltipTitle as any;
        o.plugins.tooltip.bodyColor = t.tooltipBody as any;
        o.plugins.tooltip.borderColor = t.tooltipBorder as any;
      }

      // Regenerate gradient if provided - use actual canvas height
      if (gradientColor && chart.data.datasets[0]) {
        const canvas = chart.canvas;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const canvasHeight = canvas.height || 260;
          const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
          gradient.addColorStop(0, gradientColor + '40');
          gradient.addColorStop(1, gradientColor + '00');
          chart.data.datasets[0].backgroundColor = gradient;
        }
      }

      chart.update('none');
    };

    restyle(this.temperatureChart, this.teal);
    restyle(this.energyChart, this.slate);
  }

  // ---------- Charts ----------
  private initializeCharts(): void {
    if (
      !this.temperatureChartRef?.nativeElement ||
      !this.energyChartRef?.nativeElement
    ) {
      setTimeout(() => this.initializeCharts(), 100);
      return;
    }

    const tempCanvas = this.temperatureChartRef.nativeElement;
    const energyCanvas = this.energyChartRef.nativeElement;

    // Verificar que los canvas tengan dimensiones
    const tempRect = tempCanvas.getBoundingClientRect();
    const energyRect = energyCanvas.getBoundingClientRect();

    if (
      tempRect.width === 0 ||
      tempRect.height === 0 ||
      energyRect.width === 0 ||
      energyRect.height === 0
    ) {
      setTimeout(() => this.initializeCharts(), 100);
      return;
    }

    const t = this.themeTokens();

    // Obtener DPR del dispositivo
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Función para configurar canvas con DPR correcto
    const configureCanvas = (canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || canvas.offsetWidth || 400;
      const height = rect.height || 260; // Usar altura real del canvas (260px según CSS)

      if (width > 0 && height > 0) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
      }
    };

    // Configurar ambos canvas ANTES de crear las gráficas
    configureCanvas(tempCanvas);
    configureCanvas(energyCanvas);

    const commonOptions: ChartConfiguration['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: dpr,
      animation: { 
        duration: 600,
        easing: 'easeOutCubic' as any,
      },
      transitions: {
        active: {
          animation: {
            duration: 0,
          },
        },
      },
      layout: { padding: { top: 12, bottom: 50, left: 8, right: 8 } },
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
          displayColors: true,
          cornerRadius: 10,
          padding: 12,
          titleFont: {
            size: 13,
            weight: '600' as any,
          },
          bodyFont: {
            size: 12,
            weight: '400' as any,
          },
          titleSpacing: 6,
          bodySpacing: 4,
          caretSize: 6,
          caretPadding: 8,
        },
        decimation: { enabled: true, algorithm: 'lttb', samples: 80 },
      },
      scales: {
        x: {
          grid: { 
            color: t.grid,
            lineWidth: 1,
          },
          ticks: {
            color: t.tick,
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: 10,
            padding: 12,
            font: {
              size: 11,
              weight: '500' as any,
            },
            callback: function(value: any, index: number, ticks: any[]) {
              // Show labels more intelligently
              const totalTicks = ticks.length;
              const step = Math.max(1, Math.ceil(totalTicks / 10));
              return index % step === 0 ? this.getLabelForValue(value) : '';
            },
          },
          border: { display: false },
        },
        y: {
          grid: { 
            color: t.grid,
            lineWidth: 1,
          },
          ticks: { 
            color: t.tick, 
            autoSkip: true, 
            maxTicksLimit: 6,
            padding: 12,
            font: {
              size: 11,
              weight: '500' as any,
            },
          },
          border: { display: false },
          beginAtZero: false,
        },
      },
    };

    // Create gradient for temperature chart - use actual canvas height
    const tempCtx = tempCanvas.getContext('2d')!;
    const tempHeight = tempCanvas.height || 260;
    const tempGradient = tempCtx.createLinearGradient(0, 0, 0, tempHeight);
    tempGradient.addColorStop(0, this.teal + '30'); // Más sutil
    tempGradient.addColorStop(0.5, this.teal + '15');
    tempGradient.addColorStop(1, this.teal + '00');

    this.temperatureChart = new Chart(this.temperatureChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Temperature (°C)',
            data: [],
            borderColor: this.teal,
            backgroundColor: tempGradient,
            tension: 0.5, // Más suave
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 0,
            pointHoverBackgroundColor: 'transparent',
            pointHoverBorderColor: 'transparent',
            pointHoverBorderWidth: 0,
            borderWidth: 2.5,
            pointBackgroundColor: 'transparent',
            pointBorderColor: 'transparent',
            cubicInterpolationMode: 'monotone' as any, // Interpolación más suave
          },
        ],
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins!.tooltip!,
            callbacks: {
              title: (items: any[]) => {
                const item = items?.[0];
                return item ? `Time: ${item.label}` : '';
              },
              label: (item: any) => {
                const val =
                  typeof item.parsed?.y === 'number' ? item.parsed.y : 0;
                return `Temperature: ${this.nfTemp.format(val)} °C`;
              },
              labelColor: () => ({
                borderColor: 'transparent',
                backgroundColor: this.teal,
              }),
            },
          },
        },
      },
    });

    // Create gradient for energy chart - use actual canvas height
    const energyCtx = energyCanvas.getContext('2d')!;
    const energyHeight = energyCanvas.height || 260;
    const energyGradient = energyCtx.createLinearGradient(0, 0, 0, energyHeight);
    energyGradient.addColorStop(0, this.slate + '30'); // Más sutil
    energyGradient.addColorStop(0.5, this.slate + '15');
    energyGradient.addColorStop(1, this.slate + '00');

    this.energyChart = new Chart(this.energyChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Energy (kWh)',
            data: [],
            borderColor: this.slate,
            backgroundColor: energyGradient,
            tension: 0.5, // Más suave
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 0,
            pointHoverBackgroundColor: 'transparent',
            pointHoverBorderColor: 'transparent',
            pointHoverBorderWidth: 0,
            borderWidth: 2.5,
            pointBackgroundColor: 'transparent',
            pointBorderColor: 'transparent',
            cubicInterpolationMode: 'monotone' as any, // Interpolación más suave
          },
        ],
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins!.tooltip!,
            callbacks: {
              title: (items: any[]) => {
                const item = items?.[0];
                return item ? `Time: ${item.label}` : '';
              },
              label: (item: any) => {
                const val =
                  typeof item.parsed?.y === 'number' ? item.parsed.y : 0;
                return `Energy: ${this.nfEnergy.format(val)} kWh`;
              },
              labelColor: () => ({
                borderColor: 'transparent',
                backgroundColor: this.slate,
              }),
            },
          },
        },
      },
    });

    // Reconfigurar canvas cuando cambie el tamaño de la ventana
    window.addEventListener('resize', () => {
      if (this.temperatureChartRef?.nativeElement) {
        configureCanvas(this.temperatureChartRef.nativeElement);
        this.temperatureChart?.resize();
      }
      if (this.energyChartRef?.nativeElement) {
        configureCanvas(this.energyChartRef.nativeElement);
        this.energyChart?.resize();
      }
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
    this.subscriptions.add(
      this.weatherStream.getCurrentData().subscribe((d: WeatherDataPoint) => {
        const newTrendTemp = this.compareTrend(
          this.currentTemperature,
          d.temperature
        );
        const newTrendEnergy = this.compareTrend(this.currentEnergy, d.energy);

        if (newTrendTemp !== 'flat') {
          this.lastRealTrendTemp = newTrendTemp;
          this.trendTemp = newTrendTemp;
        } else {
          this.trendTemp = this.lastRealTrendTemp;
        }

        if (newTrendEnergy !== 'flat') {
          this.lastRealTrendEnergy = newTrendEnergy;
          this.trendEnergy = newTrendEnergy;
        } else {
          this.trendEnergy = this.lastRealTrendEnergy;
        }

        if (this.tempAnimationFrame)
          cancelAnimationFrame(this.tempAnimationFrame);
        this.tempAnimationFrame = this.animateValue(
          this.currentTemperature,
          d.temperature,
          400,
          (value) => {
            this.currentTemperature = value;
          }
        );
        this.tempPulse = !this.tempPulse;

        if (this.energyAnimationFrame)
          cancelAnimationFrame(this.energyAnimationFrame);
        this.energyAnimationFrame = this.animateValue(
          this.currentEnergy,
          d.energy,
          400,
          (value) => {
            this.currentEnergy = value;
          }
        );
        this.energyPulse = !this.energyPulse;

        // Check alerts on each update
        this.checkAlerts();

        const now = new Date();
        this.currentTime =
          `${String(now.getHours()).padStart(2, '0')}:` +
          `${String(now.getMinutes()).padStart(2, '0')}:` +
          `${String(now.getSeconds()).padStart(2, '0')}`;

        this.dataPointsProcessed = this.weatherStream.getProcessedDataCount();
        this.lastUpdatedAt = Date.now();
      })
    );

    this.subscriptions.add(
      this.weatherStream
        .getDataHistory()
        .subscribe((history: WeatherDataPoint[]) => {
          this.dataHistory = history; // Almacenar para KPI cards
          this.updateCharts(history);
          this.updateSummary(history);
          this.updateStats(history);
          this.updateOverlaySummaries(history);
          // Reload comparison data if comparison mode is active
          if (this.comparisonMode) {
            this.loadComparisonData();
          }
          this.cdr.markForCheck(); // Trigger change detection para KPI cards
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
    const m =
      this.ranges.find((r) => r.key === this.activeRangeKey)?.minutes ?? 15;
    const requestedPoints = Math.floor((m * 60) / 5);
    // Usar todos los datos disponibles si el historial es menor que lo solicitado
    const availablePoints = this.dataHistory?.length ?? 0;
    if (availablePoints > 0) {
      // Si solicitamos más puntos de los disponibles, usar todos los disponibles
      return Math.min(requestedPoints, availablePoints);
    }
    return Math.max(12, requestedPoints);
  }

  onChangeRange(key: string): void {
    const allowed: RangeKey[] = ['5m', '15m', '60m', '24h'];
    if (allowed.includes(key as RangeKey)) {
      const previousRange = this.activeRangeKey;
      
      // Solo actualizar si el rango cambió
      if (previousRange !== key) {
        this.activeRangeKey = key as RangeKey;
        
        // Actualizar gráficos si están inicializados y hay datos
        if (this.temperatureChart && 
            this.energyChart && 
            this.dataHistory && 
            this.dataHistory.length > 0) {
          this.updateCharts(this.dataHistory);
          this.updateSummary(this.dataHistory);
          this.updateStats(this.dataHistory);
          this.updateOverlaySummaries(this.dataHistory);
          this.drawIndicatorSparklines();
          this.cdr.markForCheck();
        }
      }
    }
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

    if (last.length === 0) return;

    const now = new Date();
    const labels = last.map((_, index) => {
      const secondsAgo = (last.length - 1 - index) * 5;
      const timestamp = new Date(now.getTime() - secondsAgo * 1000);
      const h = String(timestamp.getHours()).padStart(2, '0');
      const m = String(timestamp.getMinutes()).padStart(2, '0');
      const s = String(timestamp.getSeconds()).padStart(2, '0');
      return `${h}:${m}:${s}`;
    });

    const temperatures = last.map((d) => d.temperature);
    const energies = last.map((d) => d.energy);

    // Calculate reference lines for temperature (only average)
    const tempAvg = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;

    // Calculate reference lines for energy (only average)
    const energyAvg = energies.reduce((a, b) => a + b, 0) / energies.length;

    if (this.temperatureChart) {
      this.temperatureChart.data.labels = labels;
      const mainDataset = this.temperatureChart.data.datasets[0] as any;
      mainDataset.data = temperatures;
      // Ensure no points are shown
      mainDataset.pointRadius = 0;
      mainDataset.pointHoverRadius = 0;
      this.temperatureChart.getDatasetMeta(0).hidden = !this.showTemp;
      
      // Remove all reference lines
      this.removeReferenceLines(this.temperatureChart);
      
      // Add comparison dataset if comparison mode is active
      let comparisonIdx = this.temperatureChart.data.datasets.findIndex((d: any) => d.label === 'Previous Period');
      if (this.comparisonMode && this.comparisonData.temp.length > 0) {
        // Create comparison dataset if it doesn't exist
        if (comparisonIdx === -1) {
          comparisonIdx = this.temperatureChart.data.datasets.length;
          this.temperatureChart.data.datasets.push({
            label: 'Previous Period',
            data: [],
            borderColor: this.isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(107, 114, 128, 0.4)',
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointHoverBackgroundColor: 'transparent',
            pointHoverBorderColor: 'transparent',
            pointBackgroundColor: 'transparent',
            pointBorderColor: 'transparent',
            order: 2,
          } as any);
        }
        // Align comparison data with current labels
        const comparisonData = this.comparisonData.temp.slice(-labels.length);
        while (comparisonData.length < labels.length) {
          comparisonData.unshift(null as any);
        }
        (this.temperatureChart.data.datasets[comparisonIdx].data as number[]) = comparisonData.slice(-labels.length);
        this.temperatureChart.getDatasetMeta(comparisonIdx).hidden = !this.showTemp;
      } else {
        // Remove comparison dataset if comparison mode is off
        if (comparisonIdx !== -1) {
          this.temperatureChart.data.datasets.splice(comparisonIdx, 1);
        }
      }
      
      this.temperatureChart.update('active');
    }
    
    if (this.energyChart) {
      this.energyChart.data.labels = labels;
      const mainDataset = this.energyChart.data.datasets[0] as any;
      mainDataset.data = energies;
      // Ensure no points are shown
      mainDataset.pointRadius = 0;
      mainDataset.pointHoverRadius = 0;
      this.energyChart.getDatasetMeta(0).hidden = !this.showEnergy;
      
      // Remove all reference lines
      this.removeReferenceLines(this.energyChart);
      
      // Add comparison dataset if comparison mode is active
      let comparisonIdx = this.energyChart.data.datasets.findIndex((d: any) => d.label === 'Previous Period');
      if (this.comparisonMode && this.comparisonData.energy.length > 0) {
        // Create comparison dataset if it doesn't exist
        if (comparisonIdx === -1) {
          comparisonIdx = this.energyChart.data.datasets.length;
          this.energyChart.data.datasets.push({
            label: 'Previous Period',
            data: [],
            borderColor: this.isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(107, 114, 128, 0.4)',
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointHoverBackgroundColor: 'transparent',
            pointHoverBorderColor: 'transparent',
            pointBackgroundColor: 'transparent',
            pointBorderColor: 'transparent',
            order: 2,
          } as any);
        }
        // Align comparison data with current labels
        const comparisonData = this.comparisonData.energy.slice(-labels.length);
        while (comparisonData.length < labels.length) {
          comparisonData.unshift(null as any);
        }
        (this.energyChart.data.datasets[comparisonIdx].data as number[]) = comparisonData.slice(-labels.length);
        this.energyChart.getDatasetMeta(comparisonIdx).hidden = !this.showEnergy;
      } else {
        // Remove comparison dataset if comparison mode is off
        if (comparisonIdx !== -1) {
          this.energyChart.data.datasets.splice(comparisonIdx, 1);
        }
      }
      
      this.energyChart.update('active');
    }

    // Update indicator sparklines - use setTimeout to ensure DOM is ready
    setTimeout(() => {
      this.drawIndicatorSparklines();
    }, 50);
  }


  private removeReferenceLines(chart: Chart | undefined): void {
    if (!chart) return;

    const datasets = chart.data.datasets;
    const toRemove = ['Average', 'Normal Zone Max', 'Normal Zone Min', 'Maximum', 'Minimum'];
    
    // Remove all reference lines
    toRemove.forEach(label => {
      const idx = datasets.findIndex((d: any) => d.label === label);
      if (idx !== -1) {
        datasets.splice(idx, 1);
      }
    });
  }

  private updateSummary(history: WeatherDataPoint[]): void {
    if (!history?.length) {
      this.energyPeakTime = '--:--';
      this.energyPeakKwh = 0;
      this.tempStateLabel = 'Estable';
      this.tempVariationLabel = '±0.0%';
      this.tempVariationDeltaPct = 0;
      this.tempDeltaDir = 'flat';
      return;
    }

    let maxEnergy = -Infinity;
    let peakTime = '--:--';
    for (const p of history) {
      if (p.energy > maxEnergy) {
        maxEnergy = p.energy;
        peakTime = (p.time || '').slice(0, 5);
      }
    }
    this.energyPeakTime = peakTime || '--:--';
    this.energyPeakKwh = Number(
      (maxEnergy === -Infinity ? 0 : maxEnergy).toFixed(2)
    );

    const temps = history.map((h) => h.temperature);
    if (!temps.length) {
      this.tempStateLabel = 'Estable';
      this.tempVariationLabel = '±0.0%';
      this.tempVariationDeltaPct = 0;
      this.tempDeltaDir = 'flat';
      return;
    }

    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const range = maxTemp - minTemp;

    let state = 'Stable';
    if (range < 2) state = 'Very stable';
    else if (range < 5) state = 'Stable';
    else if (range < 10) state = 'Variable';
    else state = 'Very variable';
    this.tempStateLabel = state;

    let deltaPct = 0;
    if (temps.length >= 6) {
      const mid = Math.floor(temps.length / 2);
      const first = temps.slice(0, mid);
      const second = temps.slice(mid);

      const avg = (arr: number[]) =>
        arr.reduce((a, b) => a + b, 0) / arr.length;
      const m1 = avg(first);
      const m2 = avg(second);

      deltaPct =
        !Number.isFinite(m1) || Math.abs(m1) < 1e-9
          ? 0
          : ((m2 - m1) / m1) * 100;
    }

    this.tempVariationDeltaPct = Number(deltaPct.toFixed(1));
    this.tempDeltaDir =
      Math.abs(deltaPct) < 0.05 ? 'flat' : deltaPct > 0 ? 'up' : 'down';

    const sign = deltaPct >= 0 ? '+' : '−';
    this.tempVariationLabel = `${sign}${Math.abs(deltaPct).toFixed(1)}%`;
  }

  private updateStats(history: WeatherDataPoint[]): void {
    if (!history?.length) {
      this.stats = {
        tempAvg: 0,
        tempMax: 0,
        energySum: 0,
        points: 0,
        prodAvgPerMin: 0,
        prodAvgPerHour: 0,
        utilizationPct: 0,
      };
      this.prevStats = { tempAvg: 0, energySum: 0 };
      this.deltas = { tempAvgPct: 0, energySumPct: 0 };
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

    const currTempAvg = tempSum / points;
    const currEnergySum = energySum;

    const minutes = Math.max(1, this.activeRangeMinutes);
    const prodAvgPerMin = currEnergySum / minutes;
    const prodAvgPerHour = prodAvgPerMin * 60;

    const currentEnergy = this.currentEnergy;
    const utilizationPctRaw =
      this.energyPeakKwh > 0 ? (currentEnergy / this.energyPeakKwh) * 100 : 0;

    const N = this.windowPoints();
    const lastN = history.slice(-N);
    let prevSlice: WeatherDataPoint[] = [];
    if (history.length >= 2 * N) {
      prevSlice = history.slice(-2 * N, -N);
    }

    let prevTempAvg = currTempAvg;
    let prevEnergySum = currEnergySum;

    if (prevSlice.length === N) {
      let tSum = 0,
        eSum = 0;
      for (const p of prevSlice) {
        tSum += p.temperature;
        eSum += p.energy;
      }
      prevTempAvg = tSum / prevSlice.length;
      prevEnergySum = eSum;
    } else if (lastN.length >= 6) {
      const mid = Math.floor(lastN.length / 2);
      const firstHalf = lastN.slice(0, mid);
      const secondHalf = lastN.slice(mid);

      const avg = (arr: WeatherDataPoint[], sel: 'temperature' | 'energy') =>
        arr.reduce((a, b) => a + b[sel], 0) / arr.length;

      const sum = (arr: WeatherDataPoint[], sel: 'energy' | 'temperature') =>
        arr.reduce((a, b) => a + b[sel], 0);

      prevTempAvg = avg(firstHalf, 'temperature');
      prevEnergySum = sum(firstHalf, 'energy');

      const currTempAvgHalf = avg(secondHalf, 'temperature');
      const currEnergySumHalf = sum(secondHalf, 'energy');

      const pct = (curr: number, prev: number) =>
        !Number.isFinite(prev) || Math.abs(prev) < 1e-9
          ? 0
          : ((curr - prev) / prev) * 100;

      this.prevStats = {
        tempAvg: Number(prevTempAvg.toFixed(1)),
        energySum: Number(prevEnergySum.toFixed(2)),
      };
      this.deltas = {
        tempAvgPct: Number(pct(currTempAvgHalf, prevTempAvg).toFixed(1)),
        energySumPct: Number(pct(currEnergySumHalf, prevEnergySum).toFixed(1)),
      };

      this.stats = {
        tempAvg: Number(currTempAvg.toFixed(1)),
        tempMax: Number(tempMax.toFixed(1)),
        energySum: Number(currEnergySum.toFixed(2)),
        points,
        prodAvgPerMin: Number(prodAvgPerMin.toFixed(3)),
        prodAvgPerHour: Number(prodAvgPerHour.toFixed(3)),
        utilizationPct: Number(
          Math.max(0, Math.min(100, utilizationPctRaw)).toFixed(1)
        ),
      };
      return;
    }

    const pct = (curr: number, prev: number) =>
      !Number.isFinite(prev) || Math.abs(prev) < 1e-9
        ? 0
        : ((curr - prev) / prev) * 100;

    this.prevStats = {
      tempAvg: Number(prevTempAvg.toFixed(1)),
      energySum: Number(prevEnergySum.toFixed(2)),
    };

    this.deltas = {
      tempAvgPct: Number(pct(currTempAvg, prevTempAvg).toFixed(1)),
      energySumPct: Number(pct(currEnergySum, prevEnergySum).toFixed(1)),
    };
    
    // Store comparison values for display
    this.comparisonValues = {
      currentTempAvg: currTempAvg,
      previousTempAvg: prevTempAvg,
      currentEnergySum: currEnergySum,
      previousEnergySum: prevEnergySum,
    };

    this.stats = {
      tempAvg: Number(currTempAvg.toFixed(1)),
      tempMax: Number(tempMax.toFixed(1)),
      energySum: Number(currEnergySum.toFixed(2)),
      points,
      prodAvgPerMin: Number(prodAvgPerMin.toFixed(3)),
      prodAvgPerHour: Number(prodAvgPerHour.toFixed(3)),
      utilizationPct: Number(
        Math.max(0, Math.min(100, utilizationPctRaw)).toFixed(1)
      ),
    };
  }

  private updateOverlaySummaries(history: WeatherDataPoint[]): void {
    const N = this.windowPoints();
    const last = history.slice(-N);
    if (!last.length) {
      this.overlayTempSummary = {
        min: 0,
        max: 0,
        last: 0,
        count: 0,
        pctHalf: undefined,
      };
      this.overlayEnergySummary = {
        min: 0,
        max: 0,
        last: 0,
        count: 0,
        pctHalf: undefined,
      };
      return;
    }

    const pct = (curr: number, prev: number) =>
      !Number.isFinite(prev) || Math.abs(prev) < 1e-9
        ? 0
        : ((curr - prev) / prev) * 100;

    const temps = last.map((d) => d.temperature);
    const tMin = Math.min(...temps);
    const tMax = Math.max(...temps);
    const tLast = temps[temps.length - 1];
    let tPctHalf: number | undefined;
    if (temps.length >= 6) {
      const mid = Math.floor(temps.length / 2);
      const m1 = temps.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const m2 =
        temps.slice(mid).reduce((a, b) => a + b, 0) / (temps.length - mid);
      tPctHalf = pct(m2, m1);
    }
    this.overlayTempSummary = {
      min: Number(tMin.toFixed(2)),
      max: Number(tMax.toFixed(2)),
      last: Number(tLast.toFixed(2)),
      pctHalf: tPctHalf !== undefined ? Number(tPctHalf.toFixed(1)) : undefined,
      count: temps.length,
    };

    const eners = last.map((d) => d.energy);
    const eMin = Math.min(...eners);
    const eMax = Math.max(...eners);
    const eLast = eners[eners.length - 1];
    let ePctHalf: number | undefined;
    if (eners.length >= 6) {
      const mid = Math.floor(eners.length / 2);
      const s1 = eners.slice(0, mid).reduce((a, b) => a + b, 0);
      const s2 = eners.slice(mid).reduce((a, b) => a + b, 0);
      ePctHalf = pct(s2, s1);
    }
    this.overlayEnergySummary = {
      min: Number(eMin.toFixed(2)),
      max: Number(eMax.toFixed(2)),
      last: Number(eLast.toFixed(2)),
      pctHalf: ePctHalf !== undefined ? Number(ePctHalf.toFixed(1)) : undefined,
      count: eners.length,
    };
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

      const diffSec = Math.max(
        1,
        Math.round((Date.now() - (this.lastUpdatedAt || Date.now())) / 1000)
      );
      let rel: string;
      // Format time more naturally and concisely
      if (diffSec < 5) {
        rel = 'now';
      } else if (diffSec < 60) {
        rel = `${diffSec}s ago`;
      } else if (diffSec < 3600) {
        const mins = Math.round(diffSec / 60);
        rel = `${mins}m ago`;
      } else if (diffSec < 86400) {
        const hours = Math.round(diffSec / 3600);
        rel = `${hours}h ago`;
      } else {
        const days = Math.round(diffSec / 86400);
        rel = `${days}d ago`;
      }
      this.lastUpdatedRel = rel;
    }, 1000);
  }

  // Initialize sparklines for indicator cards
  private initializeSparklines(): void {
    setTimeout(() => {
      this.drawIndicatorSparklines();
    }, 200);
  }

  private drawIndicatorSparklines(): void {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      if (this.tempSparklineRef?.nativeElement) {
        const tempData = this.tempKpiData?.sparklineData;
        if (tempData && tempData.length >= 2) {
          this.drawSparkline(
            this.tempSparklineRef.nativeElement,
            tempData,
            this.tempKpiData.sparklineColor
          );
        }
      }

      if (this.energySparklineRef?.nativeElement) {
        const energyData = this.energyKpiData?.sparklineData;
        if (energyData && energyData.length >= 2) {
          this.drawSparkline(
            this.energySparklineRef.nativeElement,
            energyData,
            this.energyKpiData.sparklineColor
          );
        }
      }
    });
  }

  private drawSparkline(canvas: HTMLCanvasElement, values: number[], color: string): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || !values || values.length < 2) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || canvas.clientWidth || 200;
    const cssH = rect.height || canvas.clientHeight || 100;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (cssW <= 0 || cssH <= 0) {
      setTimeout(() => this.drawSparkline(canvas, values, color), 100);
      return;
    }

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, cssW, cssH);

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    // Add vertical padding for better visual spacing
    const vPadding = range > 0 ? range * 0.1 : cssH * 0.1;
    const hPadding = 0;
    
    const scaleX = (i: number) => (i / (values.length - 1)) * (cssW - hPadding * 2) + hPadding;
    const scaleY = (v: number) => {
      if (range === 0) return cssH / 2;
      const normalized = (v - min + vPadding) / (range + vPadding * 2);
      return cssH - normalized * (cssH - 0) - 0;
    };

    // Draw very subtle gradient area
    const gradient = ctx.createLinearGradient(0, 0, 0, cssH);
    gradient.addColorStop(0, color + '06');
    gradient.addColorStop(0.5, color + '03');
    gradient.addColorStop(1, color + '00');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(scaleX(0), cssH);
    ctx.lineTo(scaleX(0), scaleY(values[0]));
    
    // Draw smooth line with rounded joins
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(scaleX(i), scaleY(values[i]));
    }
    ctx.lineTo(scaleX(values.length - 1), cssH);
    ctx.closePath();
    ctx.fill();

    // Draw clean, smooth line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;
    
    ctx.beginPath();
    ctx.moveTo(scaleX(0), scaleY(values[0]));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(scaleX(i), scaleY(values[i]));
    }
    ctx.stroke();
  }

  toggleHelp(): void {
    this.showHelp = !this.showHelp;
    if (this.showHelp) {
      this.helpSlideIndex = 0;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeHelp(): void {
    this.showHelp = false;
    this.helpSlideIndex = 0;
    document.body.style.overflow = '';
  }

  nextHelpSlide(): void {
    if (this.helpSlideIndex < this.helpSlides.length - 1) {
      this.helpSlideIndex++;
    }
  }

  prevHelpSlide(): void {
    if (this.helpSlideIndex > 0) {
      this.helpSlideIndex--;
    }
  }

  goToHelpSlide(index: number): void {
    if (index >= 0 && index < this.helpSlides.length) {
      this.helpSlideIndex = index;
    }
  }

  // ---------- Export Functions ----------
  exportChartAsImage(chartType: 'temperature' | 'energy'): void {
    const chart = chartType === 'temperature' ? this.temperatureChart : this.energyChart;
    if (!chart) return;

    const canvas = chart.canvas;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `weather-${chartType}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = url;
    link.click();
  }

  exportDataAsCSV(): void {
    if (!this.dataHistory || this.dataHistory.length === 0) return;

    const headers = ['Time', 'Temperature (°C)', 'Energy (kWh)'];
    const rows = this.dataHistory.map((point) => [
      point.time || '',
      point.temperature.toFixed(2),
      point.energy.toFixed(2),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `weather-data-${new Date().toISOString().split('T')[0]}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  exportAllChartsAsImages(): void {
    this.exportChartAsImage('temperature');
    setTimeout(() => {
      this.exportChartAsImage('energy');
    }, 500);
  }

  setHelpTab(tab: 'tutorial' | 'about'): void {
    this.helpModalTab = tab;
  }

  // ---------- Comparison Functions ----------
  toggleComparison(): void {
    this.comparisonMode = !this.comparisonMode;
    if (this.comparisonMode) {
      // Load comparison data when enabling
      if (this.dataHistory && this.dataHistory.length > 0) {
        this.loadComparisonData();
      }
    }
    this.cdr.detectChanges();
  }

  loadComparisonData(): void {
    if (!this.dataHistory || this.dataHistory.length === 0) return;
    
    const N = this.windowPoints();
    const comparisonStart = Math.max(0, this.dataHistory.length - 2 * N);
    const comparisonEnd = this.dataHistory.length - N;
    
    if (comparisonStart >= 0 && comparisonEnd > comparisonStart && comparisonEnd <= this.dataHistory.length) {
      const comparisonSlice = this.dataHistory.slice(comparisonStart, comparisonEnd);
      const now = new Date();
      
      this.comparisonData = {
        temp: comparisonSlice.map((d) => d.temperature),
        energy: comparisonSlice.map((d) => d.energy),
        labels: comparisonSlice.map((_, index) => {
          const secondsAgo = (comparisonSlice.length - 1 - index) * 5;
          const timestamp = new Date(now.getTime() - (secondsAgo + N * 5) * 1000);
          const h = String(timestamp.getHours()).padStart(2, '0');
          const m = String(timestamp.getMinutes()).padStart(2, '0');
          return `${h}:${m}`;
        }),
      };
    }
    this.cdr.markForCheck();
  }

  // ---------- Alerts Functions ----------
  toggleAlerts(): void {
    this.showAlerts = !this.showAlerts;
  }

  addAlert(type: 'temperature' | 'energy', threshold: number, condition: 'above' | 'below'): void {
    const alert = {
      id: Date.now().toString(),
      type,
      threshold,
      condition,
      active: true,
      triggered: false,
    };
    this.alerts.push(alert);
    this.checkAlerts();
  }

  addAlertFromInputs(typeValue: string, thresholdValue: string, conditionValue: string): void {
    const type = typeValue === 'temperature' ? 'temperature' : 'energy';
    const condition = conditionValue === 'above' ? 'above' : 'below';
    const threshold = parseFloat(thresholdValue);
    
    if (isNaN(threshold)) {
      return;
    }
    
    this.addAlert(type, threshold, condition);
  }

  removeAlert(id: string): void {
    this.alerts = this.alerts.filter((a) => a.id !== id);
  }

  checkAlerts(): void {
    this.alerts.forEach((alert) => {
      if (!alert.active) return;

      const value = alert.type === 'temperature' ? this.currentTemperature : this.currentEnergy;
      let triggered = false;

      if (alert.condition === 'above' && value > alert.threshold) {
        triggered = true;
      } else if (alert.condition === 'below' && value < alert.threshold) {
        triggered = true;
      }

      if (triggered && !alert.triggered) {
        alert.triggered = true;
        this.showAlertNotification(alert);
      } else if (!triggered) {
        alert.triggered = false;
      }
    });
  }

  showAlertNotification(alert: any): void {
    // Show visual notification
    const message = `${alert.type === 'temperature' ? 'Temperature' : 'Energy'} is ${alert.condition === 'above' ? 'above' : 'below'} ${alert.threshold}${alert.type === 'temperature' ? '°C' : 'kWh'}`;
    console.log('Alert:', message);
    
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'alert-toast';
    toast.textContent = `⚠️ ${message}`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--error);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideInRight 0.3s ease-out;
      font-size: 14px;
      font-weight: 500;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ---------- Filter Functions ----------
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  applyFilters(): void {
    // Filter logic - for now just update charts
    // In a full implementation, you'd filter dataHistory here
    this.updateCharts(this.dataHistory);
    this.cdr.markForCheck();
  }

  clearFilters(): void {
    this.dateFilter = {};
    this.valueFilters = {
      tempMin: 0,
      tempMax: 100,
      energyMin: 0,
      energyMax: 100,
    };
    this.applyFilters();
  }

  // ---------- Saved Views Functions ----------
  savedViews: Array<{ id: string; name: string; config: any }> = [];
  showSavedViews = false;

  saveCurrentView(name: string): void {
    const view = {
      id: Date.now().toString(),
      name,
      config: {
        activeRangeKey: this.activeRangeKey,
        showTemp: this.showTemp,
        showEnergy: this.showEnergy,
        filters: { ...this.valueFilters, ...this.dateFilter },
      },
    };
    this.savedViews.push(view);
    localStorage.setItem('savedViews', JSON.stringify(this.savedViews));
  }

  loadView(viewId: string): void {
    const view = this.savedViews.find((v) => v.id === viewId);
    if (view) {
      this.activeRangeKey = view.config.activeRangeKey;
      this.showTemp = view.config.showTemp;
      this.showEnergy = view.config.showEnergy;
      this.valueFilters = view.config.filters;
      this.applyFilters();
    }
  }

  deleteView(viewId: string): void {
    this.savedViews = this.savedViews.filter((v) => v.id !== viewId);
    localStorage.setItem('savedViews', JSON.stringify(this.savedViews));
  }

  // Lucide icon components
  Thermometer = Thermometer;
  TrendingUp = TrendingUp;
  BarChart3 = BarChart3;
  Lightbulb = Lightbulb;
  HelpCircle = HelpCircle;
  X = X;
  ChevronLeft = ChevronLeft;
  ChevronRight = ChevronRight;
  Zap = Zap;
  ArrowUpRight = ArrowUpRight;
  ArrowDownRight = ArrowDownRight;
  Minus = Minus;
  Database = Database;
  Flame = Flame;
  ArrowLeftRight = ArrowLeftRight;
  Gauge = Gauge;
  Rocket = Rocket;
  Clock = Clock;
  Hourglass = Hourglass;
  Activity = Activity;
  BatteryCharging = BatteryCharging;
  Download = Download;
  FileText = FileText;
  Image = Image;
  Code = Code;
  Github = Github;
  ExternalLink = ExternalLink;
  Info = Info;
  Maximize2 = Maximize2;
  Bell = Bell;
  Filter = Filter;
  Calendar = Calendar;
  BarChart = BarChart;
  Settings = Settings;
  Save = Save;
  Bookmark = Bookmark;

  // Help modal tabs
  helpModalTab: 'tutorial' | 'about' = 'tutorial';

  // Comparison mode
  comparisonMode = false;
  comparisonRange: RangeKey = '15m';
  comparisonData: { temp: number[]; energy: number[]; labels: string[] } = {
    temp: [],
    energy: [],
    labels: [],
  };
  
  // Debug: Make sure comparisonMode is accessible
  get isComparisonMode(): boolean {
    return this.comparisonMode;
  }

  // Alerts system
  alerts: Array<{
    id: string;
    type: 'temperature' | 'energy';
    threshold: number;
    condition: 'above' | 'below';
    active: boolean;
    triggered: boolean;
  }> = [];
  showAlerts = false;
  alertSettings = {
    tempMin: 0,
    tempMax: 50,
    energyMin: 0,
    energyMax: 100,
  };

  // Filters
  showFilters = false;
  dateFilter: { start?: Date; end?: Date } = {};
  valueFilters = {
    tempMin: 0,
    tempMax: 100,
    energyMin: 0,
    energyMax: 100,
  };

  helpSlides = [
    {
      icon: Thermometer,
      title: 'Current Status',
      description: 'Monitor real-time temperature and energy production values. Each card shows the current value, trend indicators (rising/falling), and a mini chart showing recent changes.',
    },
    {
      icon: TrendingUp,
      title: 'Time Series Charts',
      description: 'Visualize temperature and energy data over different time ranges. Use the Time Range buttons (5 min, 15 min, 60 min, 24 h) to change the window of data displayed. Toggle series visibility with checkboxes.',
    },
    {
      icon: BarChart3,
      title: 'Statistics & Analytics',
      description: 'Get detailed statistics including processed data points, average temperature change, min/max values, current vs peak utilization, and update intervals.',
    },
    {
      icon: Lightbulb,
      title: 'Tips & Tricks',
      description: 'Hover over KPI cards for detailed tooltips. Use the theme toggle to switch between light and dark modes. The status indicator shows real-time data updates.',
    },
  ];
}
