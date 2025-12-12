import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Database,
  TrendingUp,
  TrendingDown,
} from 'lucide-angular';

import type { LucideIconData } from 'lucide-angular';

export interface KPICardData {
  title: string;
  icon: LucideIconData;
  value: string;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  pulse: boolean;
  sparklineData: number[];
  sparklineColor: string;
  overlaySummary: {
    min: number;
    max: number;
    last: number;
    pctHalf?: number;
    count: number;
  };
  activeRangeLabel: string;
}

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './kpi-card.component.html',
  styleUrls: ['./kpi-card.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None,
})
export class KpiCardComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data!: KPICardData;
  @ViewChild('sparkline') sparklineRef!: ElementRef<HTMLCanvasElement>;
  private resizeObserver?: ResizeObserver;

  // Lucide icons
  ArrowUpRight = ArrowUpRight;
  ArrowDownRight = ArrowDownRight;
  Minus = Minus;
  Database = Database;
  TrendingUp = TrendingUp;
  TrendingDown = TrendingDown;

  ngAfterViewInit(): void {
    this.drawSparkline();

    if ('ResizeObserver' in window && this.sparklineRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.drawSparkline();
      });
      this.resizeObserver.observe(this.sparklineRef.nativeElement);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      setTimeout(() => this.drawSparkline(), 0);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private drawSparkline(): void {
    if (
      !this.sparklineRef?.nativeElement ||
      !this.data?.sparklineData?.length ||
      this.data.sparklineData.length < 2
    )
      return;

    const canvas = this.sparklineRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const values = this.data.sparklineData;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Asegurar que el canvas tenga dimensiones
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || canvas.clientWidth || 200;
    const cssH = rect.height || canvas.clientHeight || 56;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (cssW <= 0 || cssH <= 0) {
      // Esperar a que el elemento tenga dimensiones
      setTimeout(() => this.drawSparkline(), 100);
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
    const scaleX = (i: number) => (i / (values.length - 1)) * (cssW - 2) + 1;
    const scaleY = (v: number) => {
      if (max === min) return cssH / 2;
      const t = (v - min) / (max - min);
      return cssH - t * (cssH - 2) - 1;
    };

    // Draw gradient area
    const gradient = ctx.createLinearGradient(0, 0, 0, cssH);
    const color = this.data.sparklineColor;
    gradient.addColorStop(0, color + '20');
    gradient.addColorStop(1, color + '00');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(scaleX(0), cssH);
    ctx.lineTo(scaleX(0), scaleY(values[0]));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(scaleX(i), scaleY(values[i]));
    }
    ctx.lineTo(scaleX(values.length - 1), cssH);
    ctx.closePath();
    ctx.fill();

    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(scaleX(0), scaleY(values[0]));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(scaleX(i), scaleY(values[i]));
    }
    ctx.stroke();
  }

  getTrendLabel(): string {
    switch (this.data.trend) {
      case 'up':
        return 'Rising';
      case 'down':
        return 'Falling';
      default:
        return 'Stable';
    }
  }

  getTrendIcon(): typeof TrendingUp | typeof TrendingDown | typeof Minus {
    switch (this.data.trend) {
      case 'up':
        return TrendingUp;
      case 'down':
        return TrendingDown;
      default:
        return Minus;
    }
  }
}
