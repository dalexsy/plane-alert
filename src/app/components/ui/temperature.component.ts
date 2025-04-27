import { Component, OnInit, Input, HostBinding } from '@angular/core';

@Component({
  selector: 'app-temperature',
  standalone: true,
  templateUrl: './temperature.component.html',
  styleUrls: ['./temperature.component.scss'],
})
export class TemperatureComponent implements OnInit {
  @Input() resultsCollapsed = false;
  @HostBinding('class.collapsed') get collapsed() {
    return this.resultsCollapsed;
  }
  temperature: number | null = null;
  loading = true;

  ngOnInit(): void {
    this.fetchTemperature();
    setInterval(() => this.fetchTemperature(), 600000); // refresh every 10 minutes
  }

  private fetchTemperature(): void {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.405&current_weather=true'
    )
      .then((res) => res.json())
      .then((data) => {
        this.temperature = data.current_weather?.temperature ?? null;
        this.loading = false;
      })
      .catch(() => {
        this.temperature = null;
        this.loading = false;
      });
  }
}
