import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { importProvidersFrom, enableProdMode } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { APP_BASE_HREF } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';


enableProdMode();

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(HttpClientModulee, BrowserAnimationsModule),
    Title,
    { provide: APP_BASE_HREF, useValue: '/plane-alert/' } // Provide APP_BASE_HREF here
  ],
}).catch((err) => console.error(err));
