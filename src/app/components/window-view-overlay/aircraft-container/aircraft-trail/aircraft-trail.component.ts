import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-aircraft-trail',
  standalone: true,
  templateUrl: './aircraft-trail.component.html',
  styleUrls: ['./aircraft-trail.component.scss'],
})
export class AircraftTrailComponent {
  @Input() scale = 1;
  @Input() rotation = '';
}
