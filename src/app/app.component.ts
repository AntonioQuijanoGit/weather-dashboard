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
  Clock,
  Activity,
  Flame,
  ArrowLeftRight,
  Gauge,
  Rocket,
  Hourglass,
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
  dataHistory: WeatherDataPoint[] = [];

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
  // Colores mejorados tipo Vercel - más vibrantes y modernos
  private teal = '#00D9FF'; // Cyan brillante y moderno
  private slate = '#8B5CF6'; // Púrpura vibrante para energía (más distintivo)

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
    // Check notification permission
    if ('Notification' in window) {
      this.notificationPermission = Notification.permission;
      this.alertSettings.enableBrowserNotifications = Notification.permission === 'granted';
    }
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
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

    // Keyboard shortcuts are now handled in setupKeyboardShortcuts()
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
          gradient.addColorStop(0, gradientColor + '25');
          gradient.addColorStop(0.3, gradientColor + '12');
          gradient.addColorStop(0.6, gradientColor + '06');
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
      layout: { 
        padding: { 
          top: 12, 
          bottom: 50, 
          left: window.innerWidth < 640 ? 4 : 8,
          right: window.innerWidth < 640 ? 4 : 8 
        } 
      },
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
            maxTicksLimit: window.innerWidth < 640 ? 5 : 6, // Fewer ticks on mobile
            padding: window.innerWidth < 640 ? 6 : 12, // Less padding on mobile
            font: {
              size: window.innerWidth < 640 ? 10 : 11, // Smaller font on mobile
              weight: '500' as any,
            },
            callback: function(value: any) {
              // Format numbers to prevent stretching on mobile
              const num = typeof value === 'number' ? value : parseFloat(value);
              if (isNaN(num)) return '';
              const isMobile = window.innerWidth < 640;
              
              // Use compact notation for large numbers
              if (Math.abs(num) >= 1000) {
                return (num / 1000).toFixed(1) + 'k';
              }
              
              // On mobile, use fewer decimal places and shorter format
              if (isMobile) {
                if (Math.abs(num) >= 100) {
                  return num.toFixed(0); // No decimals for large numbers
                }
                if (Math.abs(num) >= 10) {
                  return num.toFixed(1); // One decimal for medium numbers
                }
                if (Math.abs(num) < 1) {
                  return num.toFixed(1); // One decimal for small numbers
                }
                return num.toFixed(1); // One decimal for numbers between 1-10
              }
              
              // Desktop: more precision
              if (Math.abs(num) < 1) {
                return num.toFixed(2);
              }
              return num.toFixed(1);
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
    tempGradient.addColorStop(0, this.teal + '25'); // Gradiente más sutil y elegante
    tempGradient.addColorStop(0.3, this.teal + '12');
    tempGradient.addColorStop(0.6, this.teal + '06');
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
    energyGradient.addColorStop(0, this.slate + '25'); // Gradiente más sutil y elegante
    energyGradient.addColorStop(0.3, this.slate + '12');
    energyGradient.addColorStop(0.6, this.slate + '06');
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
          this.calculateAdditionalMetrics(); // Calculate additional metrics
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

  async exportChartsAsCombinedImage(): Promise<void> {
    if (!this.temperatureChart || !this.energyChart) return;
    
    const tempCanvas = this.temperatureChart.canvas;
    const energyCanvas = this.energyChart.canvas;
    
    // Create a combined canvas
    const combinedCanvas = document.createElement('canvas');
    const ctx = combinedCanvas.getContext('2d');
    if (!ctx) return;
    
    const spacing = 40;
    const padding = 40;
    const width = Math.max(tempCanvas.width, energyCanvas.width);
    const height = tempCanvas.height + energyCanvas.height + spacing + padding * 2;
    
    combinedCanvas.width = width + padding * 2;
    combinedCanvas.height = height;
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
    
    // Draw temperature chart
    ctx.drawImage(tempCanvas, padding, padding, tempCanvas.width, tempCanvas.height);
    
    // Draw energy chart
    ctx.drawImage(
      energyCanvas,
      padding,
      padding + tempCanvas.height + spacing,
      energyCanvas.width,
      energyCanvas.height
    );
    
    // Add title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Weather Dashboard - Combined Charts',
      combinedCanvas.width / 2,
      30
    );
    
    // Add timestamp
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText(
      `Exported: ${new Date().toLocaleString()}`,
      combinedCanvas.width / 2,
      combinedCanvas.height - 15
    );
    
    // Download
    const url = combinedCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `weather-charts-combined-${new Date().toISOString().split('T')[0]}.png`;
    link.href = url;
    link.click();
    
    // Show success toast
    this.showToast('Charts exported successfully!', 'success');
  }

  exportStatisticsAsJSON(): void {
    const stats = {
      timestamp: new Date().toISOString(),
      dataPoints: this.dataPointsProcessed,
      currentValues: {
        temperature: this.currentTemperature,
        energy: this.currentEnergy,
      },
      statistics: {
        ...this.stats,
        deltas: this.deltas,
      },
      additionalMetrics: this.additionalMetrics,
      activeRange: this.activeRangeKey,
      alerts: this.alerts.map((a) => ({
        type: a.type,
        threshold: a.threshold,
        condition: a.condition,
        triggered: a.triggered,
        triggerCount: a.triggerCount,
      })),
    };
    
    const blob = new Blob([JSON.stringify(stats, null, 2)], {
      type: 'application/json',
    });
    const link = document.createElement('a');
    link.download = `weather-statistics-${new Date().toISOString().split('T')[0]}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    
    this.showToast('Statistics exported successfully!', 'success');
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const toast = document.createElement('div');
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6',
    };
    
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOutDown 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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
      lastTriggered: undefined,
      triggerCount: 0,
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
    const now = Date.now();
    const cooldownMs = this.alertSettings.cooldownSeconds * 1000;

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
        // Check cooldown
        const canTrigger = !alert.lastTriggered || (now - alert.lastTriggered) >= cooldownMs;
        
        if (canTrigger) {
          alert.triggered = true;
          alert.lastTriggered = now;
          alert.triggerCount++;
          
          // Add to history
          this.alertHistory.unshift({
            id: Date.now().toString(),
            alertId: alert.id,
            timestamp: now,
            type: alert.type,
            value,
            threshold: alert.threshold,
            condition: alert.condition,
          });
          
          // Keep only last 100 history items
          if (this.alertHistory.length > 100) {
            this.alertHistory = this.alertHistory.slice(0, 100);
          }
          
          this.showAlertNotification(alert, value);
        }
      } else if (!triggered) {
        alert.triggered = false;
      }
    });
  }

  async showAlertNotification(alert: any, currentValue: number): Promise<void> {
    // Show visual notification
    const message = `${alert.type === 'temperature' ? 'Temperature' : 'Energy'} is ${alert.condition === 'above' ? 'above' : 'below'} ${alert.threshold}${alert.type === 'temperature' ? '°C' : 'kWh'} (Current: ${this.nfTemp.format(currentValue)}${alert.type === 'temperature' ? '°C' : 'kWh'})`;
    
    // Create a toast notification with better styling
    const toast = document.createElement('div');
    toast.className = 'alert-toast';
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">⚠️</span>
        <div>
          <div style="font-weight: 600; margin-bottom: 2px;">Alert Triggered</div>
          <div style="font-size: 13px; opacity: 0.9;">${message}</div>
        </div>
      </div>
    `;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 14px 18px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3);
      z-index: 10000;
      animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 14px;
      font-weight: 500;
      max-width: 400px;
      cursor: pointer;
    `;
    
    toast.addEventListener('click', () => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    });
    
    document.body.appendChild(toast);
    
    // Auto-remove after 6 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
    
    // Browser notification if enabled and permitted
    if (this.alertSettings.enableBrowserNotifications && this.notificationPermission === 'granted') {
      try {
        const notification = new Notification('Weather Alert', {
          body: message,
          icon: '/assets/favicon.svg',
          badge: '/assets/favicon.svg',
          tag: alert.id, // Prevent duplicate notifications
          requireInteraction: false,
        });
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        
        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      } catch (error) {
        console.warn('Failed to show browser notification:', error);
      }
    }
  }

  async requestNotificationPermission(): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }
    
    if (this.notificationPermission === 'default') {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission;
      this.alertSettings.enableBrowserNotifications = permission === 'granted';
    }
  }

  clearAlertHistory(): void {
    this.alertHistory = [];
  }

  // ---------- Keyboard Shortcuts ----------
  setupKeyboardShortcuts(): void {
    this.subscriptions.add(
      fromEvent<KeyboardEvent>(document, 'keydown').subscribe((ev) => {
        // Ignore if typing in input/textarea
        const target = ev.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }

        const key = ev.key.toLowerCase();
        const ctrl = ev.ctrlKey || ev.metaKey;
        const shift = ev.shiftKey;

        // Theme toggle (T)
        if (key === 't' && !ctrl && !shift) {
          ev.preventDefault();
          this.setTheme(this.themeChoice === 'dark' ? 'light' : 'dark');
          return;
        }

        // Toggle panels
        if (key === 'c' && !ctrl && !shift) {
          ev.preventDefault();
          this.toggleComparison();
          return;
        }

        if (key === 'a' && !ctrl && !shift) {
          ev.preventDefault();
          this.toggleAlerts();
          return;
        }

        if (key === 'f' && !ctrl && !shift) {
          ev.preventDefault();
          this.toggleFilters();
          return;
        }

        if (key === 'v' && !ctrl && !shift) {
          ev.preventDefault();
          this.showSavedViews = !this.showSavedViews;
          return;
        }

        // Help (H or ?)
        if ((key === 'h' || key === '?') && !ctrl && !shift) {
          ev.preventDefault();
          this.showHelp = !this.showHelp;
          return;
        }


        // Export shortcuts
        if (ctrl && key === 'e') {
          ev.preventDefault();
          if (shift) {
            this.exportChartsAsCombinedImage();
          } else {
            this.exportDataAsCSV();
          }
          return;
        }

        // Range shortcuts (1-4)
        if (key >= '1' && key <= '4' && !ctrl && !shift) {
          ev.preventDefault();
          const ranges: RangeKey[] = ['5m', '15m', '60m', '24h'];
          const index = parseInt(key) - 1;
          if (ranges[index]) {
            this.onChangeRange(ranges[index]);
          }
          return;
        }

        // Escape to close modals/panels
        if (key === 'escape') {
          if (this.showHelp) {
            this.showHelp = false;
          }
          if (this.showAlerts) {
            this.showAlerts = false;
          }
          if (this.showFilters) {
            this.showFilters = false;
          }
          if (this.showSavedViews) {
            this.showSavedViews = false;
          }
          if (this.comparisonMode) {
            this.comparisonMode = false;
          }
        }
      })
    );
  }

  // ---------- Additional Metrics Calculation ----------
  calculateAdditionalMetrics(): void {
    if (!this.dataHistory || this.dataHistory.length < 2) return;

    const recent = this.dataHistory.slice(-60); // Last 60 points (5 minutes)
    const temps = recent.map((d) => d.temperature);
    const energies = recent.map((d) => d.energy);

    // Change rates (per minute)
    if (recent.length >= 2) {
      const timeDiff = (recent.length - 1) * 5; // seconds
      const tempDiff = temps[temps.length - 1] - temps[0];
      const energyDiff = energies[energies.length - 1] - energies[0];
      this.additionalMetrics.tempChangeRate = (tempDiff / timeDiff) * 60; // per minute
      this.additionalMetrics.energyChangeRate = (energyDiff / timeDiff) * 60; // per minute
    }

    // Standard deviation
    const tempAvg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const energyAvg = energies.reduce((a, b) => a + b, 0) / energies.length;
    const tempVariance =
      temps.reduce((sum, val) => sum + Math.pow(val - tempAvg, 2), 0) /
      temps.length;
    const energyVariance =
      energies.reduce((sum, val) => sum + Math.pow(val - energyAvg, 2), 0) /
      energies.length;
    this.additionalMetrics.tempStdDev = Math.sqrt(tempVariance);
    this.additionalMetrics.energyStdDev = Math.sqrt(energyVariance);

    // Median and percentiles
    const sortedTemps = [...temps].sort((a, b) => a - b);
    const sortedEnergies = [...energies].sort((a, b) => a - b);
    this.additionalMetrics.tempMedian = this.getMedian(sortedTemps);
    this.additionalMetrics.energyMedian = this.getMedian(sortedEnergies);
    this.additionalMetrics.tempPercentile25 = this.getPercentile(sortedTemps, 0.25);
    this.additionalMetrics.tempPercentile75 = this.getPercentile(sortedTemps, 0.75);
    this.additionalMetrics.energyPercentile25 = this.getPercentile(sortedEnergies, 0.25);
    this.additionalMetrics.energyPercentile75 = this.getPercentile(sortedEnergies, 0.75);

    // Historical average (all data)
    if (this.dataHistory.length > 0) {
      const allTemps = this.dataHistory.map((d) => d.temperature);
      const allEnergies = this.dataHistory.map((d) => d.energy);
      this.additionalMetrics.historicalAvg.temp =
        allTemps.reduce((a, b) => a + b, 0) / allTemps.length;
      this.additionalMetrics.historicalAvg.energy =
        allEnergies.reduce((a, b) => a + b, 0) / allEnergies.length;
    }

    // Correlation
    if (temps.length === energies.length && temps.length > 1) {
      this.additionalMetrics.correlation = this.calculateCorrelation(temps, energies);
    }
  }

  private getMedian(sorted: number[]): number {
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.floor(sorted.length * percentile);
    return sorted[Math.min(index, sorted.length - 1)];
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  toggleDayOfWeek(day: number, checked: boolean): void {
    if (checked) {
      if (!this.advancedFilters.daysOfWeek.includes(day)) {
        this.advancedFilters.daysOfWeek.push(day);
      }
    } else {
      this.advancedFilters.daysOfWeek = this.advancedFilters.daysOfWeek.filter(d => d !== day);
    }
  }

  updateCooldown(value: string): void {
    const num = parseInt(value, 10);
    this.alertSettings.cooldownSeconds = isNaN(num) ? 60 : num;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let xSumSq = 0;
    let ySumSq = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      xSumSq += xDiff * xDiff;
      ySumSq += yDiff * yDiff;
    }

    const denominator = Math.sqrt(xSumSq * ySumSq);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  // ---------- Filter Functions - Enhanced ----------
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  applyFilters(): void {
    // Filter logic - apply all filters
    let filteredData = [...this.dataHistory];
    
    // Apply value filters
    filteredData = filteredData.filter((d) => {
      return (
        d.temperature >= this.valueFilters.tempMin &&
        d.temperature <= this.valueFilters.tempMax &&
        d.energy >= this.valueFilters.energyMin &&
        d.energy <= this.valueFilters.energyMax
      );
    });
    
    // Apply advanced filters
    if (this.advancedFilters.hourStart !== 0 || this.advancedFilters.hourEnd !== 23) {
      filteredData = filteredData.filter((d) => {
        if (!d.time) return true;
        const date = new Date(d.time);
        const hour = date.getHours();
        return hour >= this.advancedFilters.hourStart && hour <= this.advancedFilters.hourEnd;
      });
    }
    
    // Apply day of week filter
    if (this.advancedFilters.daysOfWeek.length < 7) {
      filteredData = filteredData.filter((d) => {
        if (!d.time) return true;
        const date = new Date(d.time);
        const dayOfWeek = date.getDay();
        return this.advancedFilters.daysOfWeek.includes(dayOfWeek);
      });
    }
    
    // Apply trend filter (simplified - would need to calculate trend per point)
    // This is a placeholder for future implementation
    
    this.updateCharts(filteredData);
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
    this.advancedFilters = {
      hourStart: 0,
      hourEnd: 23,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      trendFilter: 'all',
      valueRange: {
        tempMin: 0,
        tempMax: 100,
        energyMin: 0,
        energyMax: 100,
      },
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
  Clock = Clock;
  Activity = Activity;
  Flame = Flame;
  ArrowLeftRight = ArrowLeftRight;
  Gauge = Gauge;
  Rocket = Rocket;
  Hourglass = Hourglass;
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

  // Alerts system - Enhanced
  alerts: Array<{
    id: string;
    type: 'temperature' | 'energy';
    threshold: number;
    condition: 'above' | 'below';
    active: boolean;
    triggered: boolean;
    lastTriggered?: number; // Timestamp for cooldown
    triggerCount: number; // Count of times triggered
  }> = [];
  showAlerts = false;
  alertSettings = {
    tempMin: 0,
    tempMax: 50,
    energyMin: 0,
    energyMax: 100,
    cooldownSeconds: 60, // Cooldown period in seconds
    enableBrowserNotifications: false,
  };
  alertHistory: Array<{
    id: string;
    alertId: string;
    timestamp: number;
    type: 'temperature' | 'energy';
    value: number;
    threshold: number;
    condition: 'above' | 'below';
  }> = [];
  notificationPermission: NotificationPermission = 'default';

  // Filters
  showFilters = false;
  
  
  // Additional metrics
  additionalMetrics = {
    tempChangeRate: 0, // °C per minute
    energyChangeRate: 0, // kWh per minute
    tempStdDev: 0,
    energyStdDev: 0,
    tempMedian: 0,
    energyMedian: 0,
    tempPercentile25: 0,
    tempPercentile75: 0,
    energyPercentile25: 0,
    energyPercentile75: 0,
    historicalAvg: {
      temp: 0,
      energy: 0,
    },
    correlation: 0, // Correlation between temp and energy
  };
  
  dateFilter: { start?: Date; end?: Date } = {};
  valueFilters = {
    tempMin: 0,
    tempMax: 100,
    energyMin: 0,
    energyMax: 100,
  };
  advancedFilters = {
    hourStart: 0,
    hourEnd: 23,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // 0 = Sunday, 6 = Saturday
    trendFilter: 'all' as 'all' | 'up' | 'down' | 'flat',
    valueRange: {
      tempMin: 0,
      tempMax: 100,
      energyMin: 0,
      energyMax: 100,
    },
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
