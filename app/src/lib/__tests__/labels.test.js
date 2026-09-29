import { yearOptions } from '../labels';

test('years follow the degree', () => {
  expect(yearOptions('bca').map(([, l]) => l)).toEqual(['Year 1', 'Year 2', 'Year 3', 'Year 4 (Honours)']);
  expect(yearOptions('btech').map(([y]) => y)).toEqual([1, 2, 3, 4]);
  expect(yearOptions('mca').map(([y]) => y)).toEqual([1, 2]);
  expect(yearOptions('other')).toHaveLength(5);
  expect(yearOptions(null)).toEqual([]);
});
