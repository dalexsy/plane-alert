import { Component, OnInit, Input, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-temperature',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './temperature.component.html',
  styleUrls: ['./temperature.component.scss'],
})
export class TemperatureComponent implements OnInit {
  weatherIcon: string = 'wb_sunny';
  @Input() resultsCollapsed = false;
  @HostBinding('class.collapsed') get collapsed() {
    return this.resultsCollapsed;
  }
  temperature: number | null = null;
  highTemp: number | null = null;
  lowTemp: number | null = null;
  loading = true;

  ngOnInit(): void {
    this.fetchTemperature();
    setInterval(() => this.fetchTemperature(), 600000); // refresh every 10 minutes
  }

  private fetchTemperature(): void {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.405&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto'
    )
      .then((res) => res.json())
      .then((data) => {
        this.temperature = data.current_weather?.temperature ?? null;
        // optionally update weatherIcon based on weathercode if available
        if (data.current_weather?.weathercode != null) {
          // basic mapping, sun for clear
          this.weatherIcon =
            data.current_weather.weathercode === 0 ? 'wb_sunny' : 'wb_cloudy';
        }
        this.highTemp = data.daily?.temperature_2m_max?.[0] ?? null;
        this.lowTemp = data.daily?.temperature_2m_min?.[0] ?? null;
        this.loading = false;
      })
      .catch(() => {
        this.temperature = null;
        this.highTemp = null;
        this.lowTemp = null;
        this.loading = false;
      });
  }
}
