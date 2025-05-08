import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { importProvidersFrom, enableProdMode } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

enableProdMode();

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(HttpClientModule, BrowserAnimationsModule),
    Title,
  ],
}).catch((err) => console.error(err));
