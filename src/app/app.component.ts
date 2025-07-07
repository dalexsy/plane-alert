import { Component, OnInit } from '@angular/core';
import { MapComponent } from './map/map.component';
import { CommonModule } from '@angular/common';
import { MidnightRefreshService } from './services/midnight-refresh.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [CommonModule, MapComponent], // Import MapComponent and CommonModule
})
export class AppComponent implements OnInit {
  title = 'plane-alert';

  constructor(private midnightRefreshService: MidnightRefreshService) {}

  ngOnInit() {
    this.midnightRefreshService.start();
  }
}
