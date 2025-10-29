import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { ConeConfigEditorComponent } from './components/cone-config-editor/cone-config-editor.component';

@NgModule({
  declarations: [
    // AppComponent, // REMOVE THIS LINE
  
    ConeConfigEditorComponent
  ],
  imports: [
    BrowserModule,
  ],
  providers: [],
  // bootstrap: [AppComponent] // REMOVE THIS LINE
})
export class AppModule { }
