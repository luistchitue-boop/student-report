const PLACEHOLDER_DOMAINS = new Set([
  "example.com",
  "example.net",
  "example.org",
  "example.edu",
  "test.com",
  "teste.com",
]);

const RESERVED_DOMAIN_SUFFIXES = [".example", ".invalid", ".localhost", ".test"];

export function isSendableEmailAddress(value: string | null | undefined): boolean {
  if (!value) return false;

  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;

  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (PLACEHOLDER_DOMAINS.has(domain)) return false;

  return !RESERVED_DOMAIN_SUFFIXES.some((suffix) => domain === suffix.slice(1) || domain.endsWith(suffix));
}