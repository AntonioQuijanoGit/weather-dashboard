import {
  Component,
  Input,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  Database,
  ArrowLeftRight,
  Flame,
  Zap,
  Clock,
  Hourglass,
  Gauge,
  Rocket,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-angular';

export interface StatisticsData {
  processedDisplay: string;
  deltas: {
    tempAvgPct: number;
    energySumPct: number;
  };
  stats: {
    tempMax: number;
    energySum: number;
    prodAvgPerMin: number;
    utilizationPct: number;
  };
  elapsedTime: string;
  activeRangeLabel: string;
}

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None,
})
export class StatisticsComponent {
  @Input() data!: StatisticsData;

  // Lucide icons
  Database = Database;
  ArrowLeftRight = ArrowLeftRight;
  Flame = Flame;
  Zap = Zap;
  Clock = Clock;
  Hourglass = Hourglass;
  Gauge = Gauge;
  Rocket = Rocket;
  ArrowUpRight = ArrowUpRight;
  ArrowDownRight = ArrowDownRight;
  Minus = Minus;
}
