import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConeComponent } from './cone.component';

describe('ConeComponent', () => {
  let component: ConeComponent;
  let fixture: ComponentFixture<ConeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
