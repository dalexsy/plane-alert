import { Component, OnInit, Type } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';

function isSightingsPath(): boolean {
  if (typeof location === 'undefined') return false;
  return location.pathname.replace(/\/+$/, '') === '/sightings';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgComponentOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'plane-alert';
  screen: Type<unknown> | null = null;

  async ngOnInit(): Promise<void> {
    if (isSightingsPath()) {
      const page = await import(
        './pages/antenna-sightings/antenna-sightings.page'
      );
      this.screen = page.AntennaSightingsPage;
      return;
    }
    const map = await import('./map/map.component');
    this.screen = map.MapComponent;
  }
}
