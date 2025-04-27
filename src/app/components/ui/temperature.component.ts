import { Component, OnInit, Input, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { SettingsService } from '../../services/settings.service';

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

  constructor(private settings: SettingsService) {}

  ngOnInit(): void {
    this.fetchTemperature();
    setInterval(() => this.fetchTemperature(), 600000); // refresh every 10 minutes
  }

  private fetchTemperature(): void {
    // use home location if set, otherwise default Berlin coords
    const home = this.settings.getHomeLocation();
    const latitude = home?.lat ?? 52.52;
    const longitude = home?.lon ?? 13.405;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
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
