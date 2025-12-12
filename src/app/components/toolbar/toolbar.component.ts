import {
  Component,
  Input,
  Output,
  EventEmitter,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Thermometer, Zap } from 'lucide-angular';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None,
})
export class ToolbarComponent {
  @Input() showTemp = true;
  @Input() showEnergy = true;
  @Output() tempToggle = new EventEmitter<boolean>();
  @Output() energyToggle = new EventEmitter<boolean>();

  // Lucide icons
  Thermometer = Thermometer;
  Zap = Zap;

  onTempChange(checked: boolean): void {
    this.tempToggle.emit(checked);
  }

  onEnergyChange(checked: boolean): void {
    this.energyToggle.emit(checked);
  }
}
