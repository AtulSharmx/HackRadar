import { findCity, searchCities } from '../cities';

test('search by prefix and alias', () => {
  expect(searchCities('gurg')[0].name).toBe('Gurugram');
  expect(searchCities('Bangal')[0].name).toBe('Bengaluru');
  expect(searchCities('')).toEqual([]);
  expect(searchCities('pune').map((c) => c.name)).toContain('Pune');
});

test('find by exact name or alias', () => {
  expect(findCity('Gurgaon').name).toBe('Gurugram');
  expect(findCity(' new delhi ').name).toBe('Delhi');
  expect(findCity('Atlantis')).toBeNull();
});
