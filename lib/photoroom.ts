// Server-only. Cuts the product out with Photoroom's Basic API ($0.02/image on a live key), then builds the
// Amazon main image ourselves: pure white, product at 90% of the frame, square, sRGB JPEG, 72 dpi.
// Doing the layout in our own code (not the $0.10 edit API) is 5x cheaper and guarantees exact white + fill.
// Guardrails: daily cap + lifetime cap, checks the image before spending a call, nothing is stored.
import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp, { type Metadata } from "sharp";

const DIR = process.env.CACHE_DIR || path.join(os.tmpdir(), "amazon-ready");
const DAILY_CAP = Number(process.env.PHOTOROOM_DAILY_CAP ?? 50);
const TOTAL_CAP = Number(process.env.PHOTOROOM_TOTAL_CAP ?? 400); // ~$8 at $0.02, inside the $10 budget
const FILL = 0.9; // Amazon asks for 85%; 90% leaves margin
const MAX_SIDE = 2000;
const MIN_SIDE = 500; // Amazon rejects uploads under 500px on the longest side
fs.mkdirSync(DIR, { recursive: true });

export type FixCode = "bad_image" | "too_small" | "busy" | "failed" | "no_key";
export class FixError extends Error {
  constructor(public code: FixCode) {
    super(code);
  }
}

const counterFile = path.join(DIR, "usage.json");
function readCounter() {
  const day = new Date().toISOString().slice(0, 10);
  let c = { day, today: 0, total: 0 };
  try {
    const saved = JSON.parse(fs.readFileSync(counterFile, "utf8"));
    c = { day, today: saved.day === day ? saved.today : 0, total: saved.total ?? 0 };
  } catch {}
  return c;
}

export const isSandbox = () => (process.env.PHOTOROOM_API_KEY ?? "").startsWith("sandbox_");

export async function fixForAmazon(input: Buffer): Promise<{ jpeg: Buffer; side: number }> {
  // Validate locally first, so junk or tiny files never cost a call.
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new FixError("bad_image");
  }
  if (!meta.width || !meta.height) throw new FixError("bad_image");
  if (Math.max(meta.width, meta.height) < MIN_SIDE) throw new FixError("too_small");

  const key = process.env.PHOTOROOM_API_KEY;
  if (!key) throw new FixError("no_key");
  const counter = readCounter();
  if (counter.today >= DAILY_CAP || counter.total >= TOTAL_CAP) throw new FixError("busy");
  counter.today++;
  counter.total++;
  fs.writeFileSync(counterFile, JSON.stringify(counter)); // count before calling, so failures still count

  const cutout = await segment(input, key);
  return compose(cutout);
}

async function segment(input: Buffer, key: string): Promise<Buffer> {
  const form = new FormData();
  form.append("image_file", new Blob([new Uint8Array(input)], { type: "image/jpeg" }), "photo.jpg");
  form.append("format", "png");
  form.append("crop", "true"); // trims the result to the product's edges
  form.append("size", "full");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://sdk.photoroom.com/v1/segment", {
        method: "POST",
        headers: { "x-api-key": key },
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      if (res.ok && res.headers.get("content-type")?.startsWith("image/")) return Buffer.from(await res.arrayBuffer());
      if (res.status !== 429 && res.status < 500) break; // bad request / auth: retrying won't help
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new FixError("failed");
}

async function compose(cutout: Buffer) {
  const { width = 0, height = 0 } = await sharp(cutout).metadata();
  const longest = Math.max(width, height);
  // Canvas grows with the product but never past 2000px, and the product is never enlarged.
  const side = Math.min(MAX_SIDE, Math.round(longest / FILL));
  if (side < MIN_SIDE) throw new FixError("too_small");
  const box = Math.round(side * FILL);
  const product = await sharp(cutout).resize({ width: box, height: box, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const jpeg = await sharp({ create: { width: side, height: side, channels: 3, background: "#ffffff" } })
    .composite([{ input: product, gravity: "centre" }])
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90 })
    .withDensity(72)
    .toBuffer();
  return { jpeg, side };
}
