import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountryService } from '../../services/country.service';

@Component({
  selector: 'app-flag-callsign',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="flag-callsign-wrapper">
      <span [innerHTML]="countryService.getFlagHTML(origin)"></span>
      <span class="callsign">{{ callsign }}</span>
    </span>
  `,
  styleUrls: ['./flag-callsign.component.scss'],
})
export class FlagCallsignComponent {
  @Input() callsign: string = '';
  @Input() origin: string = '';

  constructor(public countryService: CountryService) {}
}
