import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000;

export type ParentContactConfirmationPayload = {
  parentId: string;
  phone: string;
  email: string;
  expiresAt: number;
};

function getSigningSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.PARENT_CONTACT_CONFIRMATION_SECRET;

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET or PARENT_CONTACT_CONFIRMATION_SECRET is not configured.");
  }

  return secret;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createParentContactConfirmation(payload: ParentContactConfirmationPayload) {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "parent-contact" }));
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", getSigningSecret())
    .update(`${header}.${body}`)
    .digest("hex");

  return `${header}.${body}.${signature}`;
}

export function verifyParentContactConfirmation(token: string) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Token inválido.");
  }

  const [header, body, signature] = parts;
  const expectedSignature = createHmac("sha256", getSigningSecret())
    .update(`${header}.${body}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Token inválido.");
  }

  const payload = JSON.parse(decode(body)) as ParentContactConfirmationPayload;

  if (payload.expiresAt <= Date.now()) {
    throw new Error("O código de confirmação expirou.");
  }

  return payload;
}

export function createParentContactConfirmationUrl(
  parentId: string,
  phone: string,
  email: string,
  appUrl: string
) {
  const payload = {
    parentId,
    phone,
    email,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };

  return new URL(`/api/public/parents/${parentId}/confirm`, appUrl).toString() + `?token=${encodeURIComponent(createParentContactConfirmation(payload))}`;
}
