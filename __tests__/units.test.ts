import { cmToFeetInches, feetInchesToCm, flOzToMl, kgToLb, lbToKg, mlToFlOz } from '@/lib/units';

describe('units', () => {
  it('converts kg and lb both ways', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 3);
    expect(lbToKg(220.462)).toBeCloseTo(100, 3);
  });

  it('converts height to feet and inches', () => {
    expect(cmToFeetInches(178)).toEqual({ feet: 5, inches: 10 });
    expect(cmToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 });
    expect(feetInchesToCm(5, 10)).toBeCloseTo(177.8, 1);
  });

  it('converts water volumes', () => {
    expect(mlToFlOz(250)).toBeCloseTo(8.454, 3);
    expect(flOzToMl(8)).toBeCloseTo(236.59, 2);
  });
});
