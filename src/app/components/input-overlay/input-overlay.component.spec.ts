import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InputOverlayComponent } from './input-overlay.component';
import { By } from '@angular/platform-browser';

describe('InputOverlayComponent', () => {
  let component: InputOverlayComponent;
  let fixture: ComponentFixture<InputOverlayComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputOverlayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InputOverlayComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render address input with autocomplete off', () => {
    const input = element.querySelector('#address') as HTMLInputElement;
    expect(input).withContext('address input exists').toBeTruthy();
    expect(input.autocomplete).toBe('off');
  });

  it('should render search radius input with autocomplete off', () => {
    const input = element.querySelector('#searchRadius') as HTMLInputElement;
    expect(input).withContext('radius input exists').toBeTruthy();
    expect(input.autocomplete).toBe('off');
  });

  it('should render check interval input', () => {
    const input = element.querySelector('#checkInterval') as HTMLInputElement;
    expect(input).withContext('interval input exists').toBeTruthy();
  });

  it('should emit resolveAndUpdate on form submit', () => {
    spyOn(component.resolveAndUpdate, 'emit');
    const form: HTMLFormElement = element.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(component.resolveAndUpdate.emit).toHaveBeenCalled();
  });

  it('should emit useCurrentLocation on useLocationButton click', () => {
    spyOn(component.useCurrentLocation, 'emit');
    const btnDebug = fixture.debugElement.query(
      By.css('#useLocationButton button')
    );
    const btn: HTMLButtonElement = btnDebug.nativeElement;
    btn.click();
    fixture.detectChanges();
    expect(component.useCurrentLocation.emit).toHaveBeenCalled();
  });

  it('should emit goToAirport on berButton click', () => {
    spyOn(component.goToAirport, 'emit');
    const btnDebug = fixture.debugElement.query(By.css('#berButton button'));
    const btn2: HTMLButtonElement = btnDebug.nativeElement;
    btn2.click();
    fixture.detectChanges();
    expect(component.goToAirport.emit).toHaveBeenCalled();
  });

  it('should emit setHome on setHomeButton click', () => {
    spyOn(component.setHome, 'emit');
    const btnDebug3 = fixture.debugElement.query(
      By.css('#setHomeButton button')
    );
    const btn3: HTMLButtonElement = btnDebug3.nativeElement;
    btn3.click();
    fixture.detectChanges();
    expect(component.setHome.emit).toHaveBeenCalled();
  });

  it('should emit goToHome on goHomeButton click', () => {
    spyOn(component.goToHome, 'emit');
    const btnDebug4 = fixture.debugElement.query(
      By.css('#goHomeButton button')
    );
    const btn4: HTMLButtonElement = btnDebug4.nativeElement;
    btn4.click();
    fixture.detectChanges();
    expect(component.goToHome.emit).toHaveBeenCalled();
  });

  it('should emit coneVisibilityChange on showCone checkbox change', () => {
    spyOn(component.coneVisibilityChange, 'emit');
    const checkbox = element.querySelector('#showCone') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(component.coneVisibilityChange.emit).toHaveBeenCalledWith(true);
  });

  it('should emit cloudToggleChange on showCloud checkbox change', () => {
    spyOn(component.cloudToggleChange, 'emit');
    const checkbox = element.querySelector('#showCloud') as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(component.cloudToggleChange.emit).toHaveBeenCalledWith(false);
  });
});
