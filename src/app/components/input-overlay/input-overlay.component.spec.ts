import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputOverlayComponent } from './input-overlay.component';

describe('InputOverlayComponent', () => {
  let component: InputOverlayComponent;
  let fixture: ComponentFixture<InputOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InputOverlayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InputOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
