import { getIconPathForModel } from './plane-icons';

describe('getIconPathForModel balloons', () => {
  it('uses the balloon icon for BALL type even with a 5-letter German callsign', () => {
    const icon = getIconPathForModel(
      'Worner NL-1000/STU Gas Balloon',
      'DOTLI',
      undefined,
      false,
      { icaoType: 'BALL' },
    );
    expect(icon.iconType).toBe('balloon');
  });

  it('uses the balloon icon for category B2 when type is missing', () => {
    const icon = getIconPathForModel('', 'DOBCW', undefined, false, { category: 'B2' });
    expect(icon.iconType).toBe('balloon');
  });

  it('uses the balloon icon for German D-O callsigns with no type or category', () => {
    const icon = getIconPathForModel('', 'DOOGB');
    expect(icon.iconType).toBe('balloon');
  });

  it('still maps a real Cessna 5-letter D-E callsign to single-engine', () => {
    const icon = getIconPathForModel('CESSNA 172 Skyhawk', 'DEDUF', undefined, false, {
      icaoType: 'C172',
    });
    expect(icon.iconType).toBe('single_engine');
  });

  it('does not let a 5-letter callsign override a known twin type', () => {
    const icon = getIconPathForModel('BOMBARDIER CL-600 Challenger', 'DAAAY', undefined, false, {
      icaoType: 'CL60',
    });
    expect(icon.iconType).toBe('twin_engine');
  });
});
