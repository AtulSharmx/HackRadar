import { yearOptions } from '../labels';

test('years follow the degree', () => {
  expect(yearOptions('bca').map(([, l]) => l)).toEqual(['1st Year', '2nd Year', '3rd Year', '4th Year (Honours)']);
  expect(yearOptions('btech').map(([y]) => y)).toEqual([1, 2, 3, 4]);
  expect(yearOptions('mca').map(([y]) => y)).toEqual([1, 2]);
  expect(yearOptions('other')).toHaveLength(5);
  expect(yearOptions('other')[4][1]).toBe('5th Year');
  expect(yearOptions(null)).toEqual([]);
});
