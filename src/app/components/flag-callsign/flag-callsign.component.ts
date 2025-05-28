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
      <span class="callsign" [ngClass]="{ 'none-callsign': isPending }">
        {{ displayCallsign }}
      </span>
    </span>
  `,
  styleUrls: ['./flag-callsign.component.scss'],
})
export class FlagCallsignComponent {
  @Input() callsign: string = '';
  @Input() origin: string = '';

  constructor(public countryService: CountryService) {}

  /** Get the display callsign, showing "Pending" for invalid callsigns */
  get displayCallsign(): string {
    return this.callsign && this.callsign.trim().length >= 3
      ? this.callsign
      : 'Pending';
  }

  /** Check if the callsign should show as pending */
  get isPending(): boolean {
    return !(this.callsign && this.callsign.trim().length >= 3);
  }
}
