import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-clock',
  standalone: true,
  templateUrl: './clock.component.html',
  styleUrls: ['./clock.component.scss'],
})
export class ClockComponent implements OnInit {
  currentTime = '';
  weekday = '';
  dayMonth = '';

  ngOnInit(): void {
    this.updateTime();
    setInterval(() => this.updateTime(), 1000);
  }

  private updateTime(): void {
    const now = new Date();
    this.weekday = now.toLocaleDateString('en-GB', { weekday: 'long' });
    this.dayMonth = now.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
    });
    this.currentTime = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
