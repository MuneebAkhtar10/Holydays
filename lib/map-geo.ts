import { stays } from "@/lib/stays";
import { convertFromPkr, type DisplayCurrency } from "./currency";

export type MapPt = { x: number; y: number };

export type MapBounds = { x0: number; y0: number; x1: number; y1: number };

export function inBounds(p: MapPt, b: MapBounds, pad = 0) {
  return p.x >= b.x0 - pad && p.x <= b.x1 + pad && p.y >= b.y0 - pad && p.y <= b.y1 + pad;
}

export function projectLatLng(lat: number, lng: number): MapPt {
  let wsum = 0;
  let x = 0;
  let y = 0;
  for (const s of stays) {
    const d2 = (s.lat - lat) ** 2 + (s.lng - lng) ** 2;
    const w = 1 / Math.max(d2, 1e-8);
    wsum += w;
    x += s.pin.x * w;
    y += s.pin.y * w;
  }
  return { x: x / wsum, y: y / wsum };
}

export function inPakistan(lat: number, lng: number) {
  return lat >= 23.5 && lat <= 37.2 && lng >= 60.8 && lng <= 77.9;
}

export function clusterCell(zoom: number) {
  if (zoom >= 2.4) return 0;
  if (zoom >= 1.7) return 4.2;
  if (zoom >= 1.25) return 7;
  return 11;
}

export type Cluster<T extends { id: string; pin: MapPt; start?: number; price?: number }> =
  | { kind: "pin"; item: T; pin: MapPt }
  | { kind: "group"; id: string; items: T[]; pin: MapPt; count: number; from: number };

export function clusterItems<T extends { id: string; pin: MapPt; start?: number; price?: number }>(
  items: T[],
  cell: number,
): Cluster<T>[] {
  if (!cell) return items.map((item) => ({ kind: "pin", item, pin: item.pin }));
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const kx = Math.round(item.pin.x / cell);
    const ky = Math.round(item.pin.y / cell);
    const key = `${kx}:${ky}`;
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  const out: Cluster<T>[] = [];
  for (const [id, group] of buckets) {
    if (group.length === 1) {
      out.push({ kind: "pin", item: group[0], pin: group[0].pin });
      continue;
    }
    const pin = {
      x: group.reduce((s, i) => s + i.pin.x, 0) / group.length,
      y: group.reduce((s, i) => s + i.pin.y, 0) / group.length,
    };
    const from = Math.min(...group.map((i) => i.start ?? i.price ?? 0));
    out.push({ kind: "group", id, items: group, pin, count: group.length, from });
  }
  return out;
}

export function pinPrice(n: number, currency: DisplayCurrency = "USD") {
  if (currency === "PKR") {
    if (n >= 100000) return `Rs ${Math.round(n / 1000)}k`;
    if (n >= 1000) return `Rs ${(n / 1000).toFixed(n % 1000 < 50 ? 0 : 1)}k`.replace(".0k", "k");
    return `Rs ${n}`;
  }
  const value = convertFromPkr(n, currency);
  const sym = currency === "GBP" ? "£" : "$";
  if (value >= 1000) return `${sym}${Math.round(value / 1000)}k`;
  return `${sym}${value < 100 ? value.toFixed(0) : Math.round(value)}`;
}
