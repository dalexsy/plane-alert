import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root',
})
export class TitleService {
  private baseTitle = 'Plane Alert';

  constructor(private titleService: Title) {
    // Immediately set the default title on service initialization
    this.resetTitle();
  }

  /**
   * Update the page title based on the provided plane model
   * @param model - The plane model to display in the title
   * @param isMilitary - Whether the plane is military (for optional styling)
   */
  updateTitleWithPlaneModel(model?: string, isMilitary?: boolean): void {
    if (model) {
      // Format: "[MIL] Boeing C-17 peeped! | Plane Alert" or "Airbus A320 peeped! | Plane Alert"
      const militaryPrefix = isMilitary ? '[MIL] ' : '';
      const newTitle = `${militaryPrefix}${model} peeped! | ${this.baseTitle}`;

      // Use both methods to set the title to ensure it works
      this.titleService.setTitle(newTitle);
      document.title = newTitle; // Direct DOM manipulation as a fallback
    } else {
      // Reset to default title if no model provided
      this.resetTitle();
    }
  }

  /**
   * Reset the page title to the default
   */
  resetTitle(): void {
    this.titleService.setTitle(this.baseTitle);
    document.title = this.baseTitle; // Direct DOM manipulation as a fallback
  }
}
