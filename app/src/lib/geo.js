// Straight-line distance, same formula as collector/geocode.py (TRD: haversine, R = 6371 km)
export function haversineKm(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const p1 = lat1 * rad;
  const p2 = lat2 * rad;
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// null when either side has no coordinates
export function distanceKm(event, me) {
  if (event?.lat == null || me?.lat == null) return null;
  return haversineKm(me.lat, me.lng, event.lat, event.lng);
}
