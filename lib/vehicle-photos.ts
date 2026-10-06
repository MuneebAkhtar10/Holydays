const u = (id: string) => `https://images.unsplash.com/photo-${id}?fm=jpg&q=75&w=640&h=420&auto=format&fit=crop`;

const HIACE = u("1650807486050-a142ea418b19");
const MINIBUS = u("1715340614342-899407bed6dd");
const MINIVAN = u("1623371857133-6d5552bbdc13");
const SUV = u("1612563893490-d86ed296e5e6");
const CAR = u("1639280791656-5f8506ff21d2");

/** A stock photo that matches the vehicle name, used when a partner has not uploaded their own. */
export function defaultVehiclePhoto(vehicle?: string): string {
  const v = (vehicle ?? "").toLowerCase();
  if (/coaster|coach|bus|sprinter/.test(v)) return MINIBUS;
  if (/hiace|hi-ace|\bvan\b|starex|h-?1\b|urvan/.test(v)) return HIACE;
  if (/innova|mpv|minivan|ertiga|alphard|noah|carnival|sienna/.test(v)) return MINIVAN;
  if (/yukon|gmc|suv|prado|land ?cruiser|fortuner|jeep|escalade|tahoe|defender|patrol|rover|lexus|lx[0-9]|4x4|4v4|4wd/.test(v)) return SUV;
  return CAR;
}
