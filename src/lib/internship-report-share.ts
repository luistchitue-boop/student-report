import { createHmac, timingSafeEqual } from "node:crypto";

function getSigningSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured.");
  return secret;
}

function signatureFor(reportId: string, expires: number) {
  return createHmac("sha256", getSigningSecret()).update(`${reportId}:${expires}`).digest("hex");
}

export function createInternshipReportShareSignature(reportId: string, expires: number) {
  return signatureFor(reportId, expires);
}

export function isValidInternshipReportShare(reportId: string, expiresValue: string | null, signature: string | null) {
  if (!expiresValue || !signature || !/^\d+$/.test(expiresValue) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expires = Number(expiresValue);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires < now || expires > now + 24 * 60 * 60) return false;
  const expected = Buffer.from(signatureFor(reportId, expires), "hex");
  const supplied = Buffer.from(signature, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
