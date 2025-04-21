import { Component } from '@angular/core';
import { MapComponent } from './map/map.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [CommonModule, MapComponent], // Import MapComponent and CommonModule
})
export class AppComponent {
  title = 'plane-alert';
}
