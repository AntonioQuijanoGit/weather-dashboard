import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { WeatherDataService, WeatherDataPoint } from './weather-data.service';
import { Subscription, fromEvent } from 'rxjs';

Chart.defaults.devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
Chart.register(...registerables);

type ThemeTokens = {
  grid: string; tick: string;
  tooltipBg: string; tooltipTitle: string; tooltipBody: string; tooltipBorder: string;
};

type ThemeChoice = 'light' | 'dark';
type RangeKey = '5m' | '15m' | '60m' | '24h';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [], // usamos @if y @for en la plantilla
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('temperatureChart', { static: true }) temperatureChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('energyChart',       { static: true }) energyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sparkTemp',         { static: true }) sparkTempRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sparkEnergy',       { static: true }) sparkEnergyRef!: ElementRef<HTMLCanvasElement>;

  // Estado
  currentTemperature = 0;
  currentEnergy = 0;
  currentTime = '00:00:00';
  isStreaming = false;
  dataPointsProcessed = 0;
  elapsedTime = '00:00:00';
  currentYear = new Date().getFullYear();

  // Tema (solo claro/oscuro)
  themeChoice: ThemeChoice = 'light';
  isDark = false;

  // Rango de tiempo
  ranges = [
    { key: '5m',  label: '5 min',  minutes: 5 },
    { key: '15m', label: '15 min', minutes: 15 },
    { key: '60m', label: '60 min', minutes: 60 },
    { key: '24h', label: '24 h',   minutes: 24 * 60 }
  ] as { key: RangeKey; label: string; minutes: number; }[];

  activeRangeKey: RangeKey = '15m';

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
  private teal = '#0EA5A2';
  private tealBgLight = 'rgba(14,165,162,0.10)';
  private tealBgDark  = 'rgba(14,165,162,0.20)';
  private slate = '#475569';
  private slateBgLight = 'rgba(71,85,105,0.10)';
  private slateBgDark  = 'rgba(71,85,105,0.22)';

  // Formateadores
  nfTemp   = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  nfEnergy = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  nfInt    = new Intl.NumberFormat('es-ES');

  get tempDisplay(): string { return this.nfTemp.format(this.currentTemperature); }
  get energyDisplay(): string { return this.nfEnergy.format(this.currentEnergy); }
  get processedDisplay(): string { return this.nfInt.format(this.dataPointsProcessed); }

  // Tendencias
  trendTemp: 'up' | 'down' | 'flat' = 'flat';
  trendEnergy: 'up' | 'down' | 'flat' = 'flat';
  private lastRealTrendTemp: 'up' | 'down' = 'down';
  private lastRealTrendEnergy: 'up' | 'down' = 'down';

  constructor(private weatherService: WeatherDataService) {}

  ngOnInit(): void {
    // Carga preferencia; si no hay, decide una vez según el SO
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      this.themeChoice = stored;
    } else {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      this.themeChoice = prefersDark ? 'dark' : 'light';
      localStorage.setItem('theme', this.themeChoice);
    }
    this.applyThemeFromChoice();

    // Charts + datos
    this.initializeCharts();
    this.subscribeToData();

    this.weatherService.startStreamingFromYAML('assets/data.yml')
      .then(() => {
        this.isStreaming = true;
        this.startTimer();
      })
      .catch(err => {
        console.error('Error cargando datos:', err);
      });

    // Redibuja sparklines al redimensionar
    this.resizeSub = fromEvent(window, 'resize').subscribe(() => this.drawSparklines());
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.resizeSub?.unsubscribe?.();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.temperatureChart?.destroy();
    this.energyChart?.destroy();
  }

  // ======== Tema ========
  setTheme(choice: ThemeChoice): void {
    this.themeChoice = choice;
    localStorage.setItem('theme', choice);
    this.applyThemeFromChoice();
    this.restyleChartsForTheme();
  }

  private applyThemeFromChoice(): void {
    this.isDark = this.themeChoice === 'dark';
    this.applyThemeClass();
  }

  private applyThemeClass(): void {
    document.body.classList.toggle('theme-dark', this.isDark);
  }

  private themeTokens(): ThemeTokens {
    return this.isDark ? {
      grid: 'rgba(148,163,184,0.15)',
      tick: '#CBD5E1',
      tooltipBg: '#0b1220',
      tooltipTitle: '#FFFFFF',
      tooltipBody: '#E2E8F0',
      tooltipBorder: '#111827'
    } : {
      grid: 'rgba(2,6,23,0.06)',
      tick: '#6b7280',
      tooltipBg: '#0f172a',
      tooltipTitle: '#ffffff',
      tooltipBody: '#e5e7eb',
      tooltipBorder: '#111827'
    };
  }

  private restyleChartsForTheme(): void {
    const t = this.themeTokens();

    const restyle = (chart?: Chart, darkBg?: string, lightBg?: string) => {
      if (!chart) return;
      const o = chart.options!;
      (o.scales as any).x.grid!.color = t.grid;
      (o.scales as any).x.ticks!.color = t.tick;
      (o.scales as any).y.grid!.color = t.grid;
      (o.scales as any).y.ticks!.color = t.tick;
      if (chart.data.datasets[0]) {
        chart.data.datasets[0].backgroundColor = this.isDark ? darkBg : lightBg;
      }
      if (o.plugins?.tooltip) {
        o.plugins.tooltip.backgroundColor = t.tooltipBg as any;
        o.plugins.tooltip.titleColor = t.tooltipTitle as any;
        o.plugins.tooltip.bodyColor = t.tooltipBody as any;
        o.plugins.tooltip.borderColor = t.tooltipBorder as any;
      }
      chart.update('none');
    };

    restyle(this.temperatureChart, this.tealBgDark, this.tealBgLight);
    restyle(this.energyChart, this.slateBgDark, this.slateBgLight);
    this.drawSparklines();
  }

  // ======== Charts ========
  private initializeCharts(): void {
    const t = this.themeTokens();

    const commonOptions: ChartConfiguration['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 220 },
      layout: { padding: 4 },
      plugins: {
        legend: { display: false },
        tooltip: {
          intersect: false, mode: 'index',
          backgroundColor: t.tooltipBg, titleColor: t.tooltipTitle, bodyColor: t.tooltipBody,
          borderColor: t.tooltipBorder, borderWidth: 1, cornerRadius: 8, padding: 10
        },
        decimation: { enabled: true, algorithm: 'lttb', samples: 60 }
      },
      scales: {
        x: { grid: { color: t.grid }, ticks: { color: t.tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
        y: { grid: { color: t.grid }, ticks: { color: t.tick, autoSkip: true, maxTicksLimit: 5 }, beginAtZero: false }
      }
    };

    this.temperatureChart = new Chart(this.temperatureChartRef.nativeElement, {
      type: 'line',
      data: { labels: [], datasets: [{
        label: 'Temperatura (°C)',
        data: [], borderColor: this.teal,
        backgroundColor: this.isDark ? this.tealBgDark : this.tealBgLight,
        tension: 0.35, fill: true, pointRadius: 0, borderWidth: 2
      }]},
      options: commonOptions
    });

    const energyOptions: ChartConfiguration['options'] = {
      ...commonOptions,
      scales: {
        x: { grid: { color: t.grid }, ticks: { color: t.tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
        y: { grid: { color: t.grid }, ticks: { color: t.tick, autoSkip: true, maxTicksLimit: 5 }, beginAtZero: false }
      }
    };

    this.energyChart = new Chart(this.energyChartRef.nativeElement, {
      type: 'line',
      data: { labels: [], datasets: [{
        label: 'Energía (kWh)',
        data: [], borderColor: this.slate,
        backgroundColor: this.isDark ? this.slateBgDark : this.slateBgLight,
        tension: 0.35, fill: true, pointRadius: 0, borderWidth: 2, borderDash: [6, 4]
      }]},
      options: energyOptions
    });
  }

  // ======== Datos ========
  private subscribeToData(): void {
  this.subscriptions.add(
    this.weatherService.getCurrentData().subscribe((d) => {
      const newTrendTemp = this.compareTrend(this.currentTemperature, d.temperature);
      const newTrendEnergy = this.compareTrend(this.currentEnergy, d.energy);
      
      // Mantener tendencias fijas (solo cambian cuando hay movimiento real)
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

      this.currentTemperature = d.temperature;
      this.currentEnergy = d.energy;
      
      // Usar hora real del sistema
      const now = new Date();
      this.currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      this.dataPointsProcessed = this.weatherService.getProcessedDataCount();
    })
  );

  this.subscriptions.add(
    this.weatherService.getDataHistory().subscribe((history) => {
      this.updateCharts(history);
      this.drawSparklines(history);
    })
  );
}

  private compareTrend(prev: number, next: number): 'up'|'down'|'flat' {
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

  onChangeRange(key: string): void {
    const allowed: RangeKey[] = ['5m','15m','60m','24h'];
    if (allowed.includes(key as RangeKey)) {
      this.activeRangeKey = key as RangeKey;
    }
  }

  // Handlers de checkboxes
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
  
  // Generar etiquetas relativas al tiempo actual
  const now = new Date();
  const labels = last.map((d, index) => {
    // Calcular el timestamp relativo (cada punto es 5 segundos atrás)
    const secondsAgo = (last.length - 1 - index) * 5;
    const timestamp = new Date(now.getTime() - secondsAgo * 1000);
    
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    const seconds = String(timestamp.getSeconds()).padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
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

  private drawSparklines(history?: WeatherDataPoint[]): void {
    const N = 60;
    const data = history ?? [];
    const last = data.slice(-N);

    const draw = (canvas: HTMLCanvasElement | undefined, values: number[], stroke: string) => {
      if (!canvas || values.length < 2) return;
      const ctx = canvas.getContext('2d')!;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width = canvas.clientWidth * ratio;
      const h = canvas.height = canvas.clientHeight * ratio;
      ctx.clearRect(0,0,w,h);

      const min = Math.min(...values);
      const max = Math.max(...values);
      const scaleX = (i: number) => (i / (values.length - 1)) * (w - 2) + 1;
      const scaleY = (v: number) => {
        if (max === min) return h/2;
        const t = (v - min) / (max - min);
        return h - (t * (h - 2)) - 1;
      };

      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(scaleX(0), scaleY(values[0]));
      for (let i = 1; i < values.length; i++) ctx.lineTo(scaleX(i), scaleY(values[i]));
      ctx.stroke();
    };

    const temps = last.map(d => d.temperature);
    const eners = last.map(d => d.energy);
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
        `${String(h).padStart(2,'0')}:` +
        `${String(m % 60).padStart(2,'0')}:` +
        `${String(s % 60).padStart(2,'0')}`;
    }, 1000);
  }
}