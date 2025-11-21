import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-api-status-overlay',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="api-status-overlay" *ngIf="show">
      <div class="status-card">
        <app-icon icon="warning" size="large"></app-icon>
        <h3>Aircraft Data Unavailable</h3>
        <p>The ADS-B API is currently experiencing issues.</p>
        <p class="last-update">Last successful update: {{ lastUpdate }}</p>
        <p class="retry-info">Retrying automatically every minute...</p>
      </div>
    </div>
  `,
  styles: [
    `
      .api-status-overlay {
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2000;
        pointer-events: none;
      }

      .status-card {
        background: rgba(40, 40, 40, 0.98);
        border: 2px solid #ff6b6b;
        border-radius: 12px;
        padding: 20px 30px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(10px);
        text-align: center;
        max-width: 400px;
        pointer-events: auto;
        animation: slideDown 0.3s ease-out;
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      h3 {
        margin: 10px 0 8px;
        color: #ff6b6b;
        font-size: 1.1em;
        font-weight: 600;
      }

      p {
        margin: 6px 0;
        color: #ddd;
        font-size: 0.9em;
        line-height: 1.4;
      }

      .last-update {
        color: #aaa;
        font-size: 0.85em;
        margin-top: 12px;
      }

      .retry-info {
        color: #888;
        font-size: 0.8em;
        font-style: italic;
      }

      app-icon {
        color: #ff6b6b;
      }
    `,
  ],
})
export class ApiStatusOverlayComponent {
  @Input() show = false;
  @Input() lastUpdate = 'Unknown';
}
