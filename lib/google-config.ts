const looksLikePlaceholder = (v: string) => !v || /^(your|replace|xxx|changeme)/i.test(v);

export function googleCredentials() {
  const id = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (looksLikePlaceholder(id) || looksLikePlaceholder(secret) || !id.endsWith(".apps.googleusercontent.com")) return null;
  return { id, secret };
}
