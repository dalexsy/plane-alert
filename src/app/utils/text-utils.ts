import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TextUtils {
  /**
   * Truncate text to specified length with ellipsis if longer
   * @param text The text to truncate
   * @param maxLength Maximum length before truncation (default: 30)
   * @returns Truncated text with ellipsis if needed
   */
  static truncateWithEllipsis(
    text: string | undefined | null,
    maxLength: number = 30
  ): string {
    if (!text) return '';
    return text.length > maxLength
      ? text.substring(0, maxLength) + '...'
      : text;
  }

  /**
   * Truncate operator text to 40 characters with ellipsis if longer
   * @param operator The operator text to truncate
   * @returns Truncated operator text
   */
  static truncateOperator(operator: string | undefined | null): string {
    return this.truncateWithEllipsis(operator, 40);
  }
}
