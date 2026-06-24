// src/app/components/ui/input.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputComponent } (from '../input/input.component';

describe('InputComponent', () => {
  let component: InputComponent;
  let fixture: ComponentFixture<InputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit inputChange on input', () => {
    spyOn(component.inputChange, 'emit');
    const testValue = 'test input';
    
    component.onInput({ target: { value: testValue } } as any);
    
    expect(component.inputChange.emit).toHaveBeenCalledWith(testValue);
  });

  it('should emit enterPressed on Enter key', () => {
    spyOn(component.enterPressed, 'emit');
    const keyEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    
    component.onKeydown(keyEvent);
    
    expect(component.enterPressed.emit).toHaveBeenCalledWith(keyEvent);
  });

  it('should set textarea type correctly', () => {
    component.type = 'textarea';
    fixture.detectChanges();
    
    const textarea = fixture.nativeElement.querySelector('textarea');
    const input = fixture.nativeElement.querySelector('input');
    
    expect(textarea).toBeTruthy();
    expect(input).toBeFalsy();
  });

  it('should set input type correctly', () => {
    component.type = 'text';
    fixture.detectChanges();
    
    const textarea = fixture.nativeElement.querySelector('textarea');
    const input = fixture.nativeElement.querySelector('input');
    
    expect(textarea).toBeFalsy();
    expect(input).toBeTruthy();
    expect(input.type).toBe('text');
  });
});
