import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultsOverlayComponent } from './results-overlay.component';

describe('ResultsOverlayComponent', () => {
  let component: ResultsOverlayComponent;
  let fixture: ComponentFixture<ResultsOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ResultsOverlayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultsOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
