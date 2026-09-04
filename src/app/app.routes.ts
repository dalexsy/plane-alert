import { Routes } from '@angular/router';
import { MapComponent } from './map/map.component';
import { AntennaSightingsPage } from './pages/antenna-sightings/antenna-sightings.page';

export const routes: Routes = [
  { path: '', component: MapComponent },
  {
    path: 'sightings',
    component: AntennaSightingsPage,
    title: 'Antenna sightings',
  },
  { path: '**', redirectTo: '' },
];
