// Places for "Where are you?": real towns, cities and areas as you type, and the real city name for GPS.
// Search: Photon (komoot's OpenStreetMap search, built for search-as-you-type, no key needed), limited to
// India. The phone's own 110-city list answers instantly and when Photon can't be reached.
// Privacy: only the typed text and, for GPS, the rounded position (about 1 km) are sent.
import * as Location from 'expo-location';

import { CITIES, findCity, searchCities } from './cities';
import { haversineKm } from './geo';

const PHOTON = 'https://photon.komoot.io';
const INDIA_BBOX = '68.1,6.5,97.4,35.7';
// settlements and parts of them; not states, roads, shops or boundary polygons
const SETTLEMENTS = new Set(['city', 'town', 'village', 'hamlet']);
const AREAS = new Set(['suburb', 'neighbourhood', 'quarter', 'borough', 'locality']);

export const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

// OSM's English name -> the name our city list and the collector use ("Gurgaon" -> "Gurugram"),
// only in the same state: a village called Gurgaon in Uttar Pradesh stays Gurgaon
function canon(name, state) {
  if (!name) return null;
  const known = findCity(name);
  return known && (!state || known.state === state) ? known.name : name;
}

// A Photon feature -> { key, name, detail, city, state, lat, lng }, or null when it isn't a place in India
export function fromPhoton(feature) {
  const p = feature?.properties || {};
  if (p.countrycode !== 'IN' || p.osm_key !== 'place') return null;
  const settlement = SETTLEMENTS.has(p.osm_value);
  if (!settlement && !AREAS.has(p.osm_value)) return null;
  const [lng, lat] = feature.geometry?.coordinates || [];
  if (lat == null || lng == null) return null;
  const name = settlement ? canon(p.name, p.state) : p.name;
  const city = settlement ? name : canon(p.city || p.county, p.state) || name;
  return {
    key: `${p.osm_type}${p.osm_id}`,
    name,
    detail: [city !== name ? city : null, p.state].filter(Boolean).join(', '),
    city,
    state: p.state || null,
    lat: round2(lat),
    lng: round2(lng),
  };
}

function dedupe(places) {
  const seen = new Set();
  return places.filter((x) => {
    const k = `${x.name}|${x.detail}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// The phone's list, same shape: instant, and the fallback when offline
export function localPlaces(query) {
  return searchCities(query).map((c) => ({
    key: `local-${c.name}-${c.state}`, name: c.name, detail: c.state, city: c.name, state: c.state, lat: c.lat, lng: c.lng,
  }));
}

export async function searchPlaces(query, signal) {
  const params = new URLSearchParams({ q: query, limit: '12', lang: 'en', bbox: INDIA_BBOX });
  ['city', 'district', 'locality'].forEach((l) => params.append('layer', l));
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`place search ${res.status}`);
  const data = await res.json();
  return dedupe((data.features || []).map(fromPhoton).filter(Boolean)).slice(0, 8);
}

// Nearest city in our list, used only when no name service answers (within 40 km, else unknown)
export function nearestCity(lat, lng) {
  let best = null;
  for (const c of CITIES) {
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (!best || km < best.km) best = { km, city: c.name, state: c.state };
  }
  return best && best.km <= 40 ? { city: best.city, state: best.state } : null;
}

async function nameFor(lat, lng) {
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=en`);
    const p = (await res.json()).features?.[0]?.properties;
    const city = canon(p?.city || (SETTLEMENTS.has(p?.osm_value) ? p?.name : null) || p?.county, p?.state);
    if (city && p?.countrycode === 'IN') return { city, state: p.state || null };
  } catch {
    // try the phone's geocoder
  }
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const city = canon(a?.city || a?.subregion, a?.region);
    if (city) return { city, state: a?.region || null };
  } catch {
    // last resort below
  }
  return nearestCity(lat, lng);
}

// GPS -> { city, state, lat, lng } | { denied: true, canAskAgain }. Throws when no position can be had.
export async function locateMe() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return { denied: true, canAskAgain: perm.canAskAgain };
  const recent = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 1000 }).catch(() => null);
  const pos = recent || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
  const lat = round2(pos.coords.latitude);
  const lng = round2(pos.coords.longitude);
  const named = await nameFor(lat, lng);
  return { city: named?.city || null, state: named?.state || null, lat, lng };
}
