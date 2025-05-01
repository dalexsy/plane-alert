import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-plane-address-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plane-address-overlay.component.html',
  styleUrls: ['./plane-address-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaneAddressOverlayComponent {
  /** Human-readable address for the followed/nearest plane */
  @Input() address: string | null = null;
}
