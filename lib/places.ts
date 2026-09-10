import { pilgrimCountries } from "@/lib/pilgrim";

export type PlaceCountry = {
  code: string;
  name: string;
  cities: string[];
};

export const countries: PlaceCountry[] = pilgrimCountries.map((c) => ({
  code: c.code,
  name: c.name,
  cities: c.cities,
}));

export function countryByCode(code: string) {
  return countries.find((c) => c.code === code);
}

export function placeLabel(countryCode: string, city: string) {
  const country = countryByCode(countryCode);
  if (city && country) return `${city}, ${country.name}`;
  if (country) return country.name;
  return "";
}

export function filterPlaces(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return countries;
  return countries
    .map((c) => ({
      ...c,
      cities: c.cities.filter((city) => city.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
    }))
    .filter((c) => c.name.toLowerCase().includes(q) || c.cities.length > 0);
}
