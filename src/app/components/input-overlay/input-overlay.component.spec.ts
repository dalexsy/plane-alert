import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { InputOverlayComponent } from './input-overlay.component';

describe('InputOverlayComponent', () => {
  let component: InputOverlayComponent;
  let fixture: ComponentFixture<InputOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputOverlayComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(InputOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
