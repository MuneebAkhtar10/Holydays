export function mapsEmbedUrl(lat: number, lng: number, zoom = 16) {
  const q = encodeURIComponent(`${lat},${lng}`);
  return `https://maps.google.com/maps?q=${q}&z=${zoom}&hl=en&output=embed`;
}

export function mapsSearchUrl(lat: number, lng: number, name?: string) {
  const q = encodeURIComponent(name ? `${name} ${lat},${lng}` : `${lat},${lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function mapsDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function hasCoords(lat?: number, lng?: number) {
  return Boolean(lat && lng && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 30.4 && lng === 69.3));
}
