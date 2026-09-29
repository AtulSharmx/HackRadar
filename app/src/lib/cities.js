// The same city list the collector uses (built from OpenStreetMap by collector/build_cities.py).
import data from '../../../shared/cities.json';

export const CITIES = data.cities;

const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z ]/g, '').trim();

// "gurg" -> Gurugram (via alias Gurgaon); prefix matches first, then anywhere in the name
export function searchCities(query, limit = 8) {
  const q = norm(query);
  if (!q) return [];
  const names = (c) => [c.name, ...c.aliases].map(norm);
  const starts = CITIES.filter((c) => names(c).some((n) => n.startsWith(q)));
  const contains = CITIES.filter((c) => !starts.includes(c) && names(c).some((n) => n.includes(q)));
  return [...starts, ...contains].slice(0, limit);
}

// Exact name or alias -> city entry, else null ("Bangalore" -> Bengaluru)
export function findCity(name) {
  const n = norm(name);
  return CITIES.find((c) => [c.name, ...c.aliases].some((x) => norm(x) === n)) || null;
}
