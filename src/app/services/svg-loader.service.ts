import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root',
})
export class SvgLoaderService {
  private svgCache = new Map<string, SafeHtml>();

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  loadSvg(url: string): Observable<SafeHtml> {
    if (this.svgCache.has(url)) {
      return of(this.svgCache.get(url)!);
    }

    return this.http.get(url, { responseType: 'text' }).pipe(
      map((svgContent) => {
        // Add stroke styling to all path elements
        const modifiedSvg = svgContent.replace(
          /<path([^>]*)>/g,
          '<path$1 stroke="currentColor" stroke-width="1" paint-order="stroke fill">'
        );

        const safeHtml = this.sanitizer.bypassSecurityTrustHtml(modifiedSvg);
        this.svgCache.set(url, safeHtml);
        return safeHtml;
      }),
      catchError(() => of(this.sanitizer.bypassSecurityTrustHtml('')))
    );
  }
}
