jest.mock('expo-location', () => ({}));

import { fromPhoton, localPlaces, nearestCity } from '../places';

// real Photon answers seen on 30 Sep 2026
const feature = (properties, coordinates) => ({ properties: { countrycode: 'IN', osm_key: 'place', osm_type: 'N', osm_id: 1, ...properties }, geometry: { coordinates } });

test('a city takes the name our list and the collector use', () => {
  const p = fromPhoton(feature({ osm_value: 'city', name: 'Gurgaon', state: 'Haryana' }, [77.0299194, 28.4646148]));
  expect(p).toMatchObject({ name: 'Gurugram', city: 'Gurugram', detail: 'Haryana', lat: 28.46, lng: 77.03 });
});

test('only the same state gets our name: a Gurgaon village in Uttar Pradesh stays Gurgaon', () => {
  const p = fromPhoton(feature({ osm_value: 'village', name: 'Gurgaon', state: 'Uttar Pradesh' }, [80.1, 26.9]));
  expect(p).toMatchObject({ name: 'Gurgaon', detail: 'Uttar Pradesh' });
});

test('an area keeps its own name and belongs to its city', () => {
  const p = fromPhoton(feature({ osm_value: 'suburb', name: 'Sector 45', city: 'Gurgaon', state: 'Haryana' }, [77.0663545, 28.4449004]));
  expect(p).toMatchObject({ name: 'Sector 45', city: 'Gurugram', detail: 'Gurugram, Haryana', lat: 28.44, lng: 77.07 });
});

test('states, shops, boundaries and places outside India are not offered', () => {
  expect(fromPhoton(feature({ osm_value: 'state', name: 'Punjab' }, [75.5, 30.9]))).toBeNull();
  expect(fromPhoton(feature({ osm_key: 'amenity', osm_value: 'car_rental', name: 'Punjab Wedding Cars' }, [75.6, 31.2]))).toBeNull();
  expect(fromPhoton(feature({ osm_key: 'boundary', osm_value: 'administrative', name: 'Gurgi' }, [81.4, 24.5]))).toBeNull();
  expect(fromPhoton(feature({ countrycode: 'BT', osm_value: 'town', name: 'Punakha' }, [89.8, 27.6]))).toBeNull();
});

test('offline: the phone list answers, and GPS falls back to the nearest listed city', () => {
  expect(localPlaces('gurg')[0]).toMatchObject({ name: 'Gurugram', detail: 'Haryana' });
  expect(nearestCity(28.44, 77.07)).toEqual({ city: 'Gurugram', state: 'Haryana' }); // Sector 45
  expect(nearestCity(10.0, 60.0)).toBeNull(); // the Arabian Sea is nobody's city
});
