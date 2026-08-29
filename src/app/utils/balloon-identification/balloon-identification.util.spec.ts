import {
  isBalloonAircraft,
  isBalloonByCallsign,
  isBalloonByModel,
  isBalloonCategory,
  isBalloonTypeCode,
} from './balloon-identification.util';

describe('balloon identification', () => {
  it('treats ADS-B category B2 as lighter-than-air', () => {
    expect(isBalloonCategory('B2')).toBe(true);
    expect(isBalloonCategory('A1')).toBe(false);
  });

  it('treats ICAO types BALL, BLMP, and SHIP as balloons', () => {
    expect(isBalloonTypeCode('BALL')).toBe(true);
    expect(isBalloonTypeCode('BLMP')).toBe(true);
    expect(isBalloonTypeCode('SHIP')).toBe(true);
    expect(isBalloonTypeCode('C172')).toBe(false);
  });

  it('matches balloon model names', () => {
    expect(isBalloonByModel('Worner NL-1000/STU Gas Balloon')).toBe(true);
    expect(isBalloonByModel('CESSNA 172 Skyhawk')).toBe(false);
  });

  it('matches German D-O balloon callsigns with or without hyphen', () => {
    expect(isBalloonByCallsign('DOTLI')).toBe(true);
    expect(isBalloonByCallsign('D-OTLI')).toBe(true);
    expect(isBalloonByCallsign('DOBCW   ')).toBe(true);
    expect(isBalloonByCallsign('DEDUF')).toBe(false);
  });

  it('identifies live Berlin balloons from type, category, or D-O flight id', () => {
    expect(isBalloonAircraft({ icaoType: 'BALL', callsign: 'DOTLI' })).toBe(true);
    expect(isBalloonAircraft({ category: 'B2', callsign: 'DOBCW' })).toBe(true);
    expect(isBalloonAircraft({ callsign: 'DOOGB' })).toBe(true);
  });

  it('does not treat a glider as a balloon when type is GLID, even with a D-O flight id', () => {
    expect(
      isBalloonAircraft({ icaoType: 'GLID', category: 'B2', callsign: 'DOABD', model: 'Schleicher Ka 6' }),
    ).toBe(false);
  });
});
