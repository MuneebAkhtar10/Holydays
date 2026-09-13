export function normalizePhoneDigits(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function isValidPhone(value: string) {
  const digits = normalizePhoneDigits(value.trim());
  return /^\+?[0-9]{7,15}$/.test(digits);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
