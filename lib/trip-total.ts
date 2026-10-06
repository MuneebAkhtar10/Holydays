/** One formula for taxi / Ziyarat / food bookings, used by the booking screen and the API so the card charge always matches what was shown. */
export function independentTripTotal(input: {
  kind: string;
  price: number;
  priceUnit?: string;
  guests: number;
  taxi?: { ratePerPerson: number; privateRate: number } | null;
  taxiMode?: string;
}) {
  const guests = Math.max(1, Math.floor(Number(input.guests)) || 1);
  if (input.kind === "TAXI" && input.taxi) {
    if (input.taxiMode === "custom") return 0;
    if (input.taxiMode === "private") return input.taxi.privateRate;
    return input.taxi.ratePerPerson * guests;
  }
  const price = Number(input.price) || 0;
  return input.priceUnit === "person" ? price * guests : price;
}
