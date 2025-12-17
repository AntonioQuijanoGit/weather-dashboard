import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Wind, Sun, Moon, HelpCircle } from 'lucide-angular';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent {
  @Input() isStreaming = false;
  @Input() themeChoice: 'light' | 'dark' = 'light';
  @Output() themeChange = new EventEmitter<'light' | 'dark'>();
  @Output() helpClick = new EventEmitter<void>();

  @ViewChild('themeToggle') themeToggleEl!: ElementRef<HTMLInputElement>;

  // Lucide icons
  Wind = Wind;
  Sun = Sun;
  Moon = Moon;
  HelpCircle = HelpCircle;

  onThemeToggle(checked: boolean): void {
    const newTheme = checked ? 'dark' : 'light';
    this.themeChange.emit(newTheme);
  }

  openHelp(): void {
    this.helpClick.emit();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 't') {
      const newTheme = this.themeChoice === 'dark' ? 'light' : 'dark';
      this.themeChange.emit(newTheme);
      queueMicrotask(() => this.themeToggleEl?.nativeElement?.focus());
    }
  }
}
