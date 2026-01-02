import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Wind, Thermometer, Zap, TrendingUp, X, ArrowRight } from 'lucide-angular';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit {
  showWelcome = signal(true);
  
  // Lucide icons
  Wind = Wind;
  Thermometer = Thermometer;
  Zap = Zap;
  TrendingUp = TrendingUp;
  X = X;
  ArrowRight = ArrowRight;

  ngOnInit() {
    // Welcome screen always shows on page load
    // No localStorage - user can see it every time they reload
    this.showWelcome.set(true);
  }

  closeWelcome() {
    this.showWelcome.set(false);
    // Don't save to localStorage - allow user to see welcome screen on next visit
  }

  getStarted() {
    this.closeWelcome();
    // Scroll to main content
    setTimeout(() => {
      const mainContent = document.querySelector('main.container');
      if (mainContent) {
        mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }
}

