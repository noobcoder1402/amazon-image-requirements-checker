// POST a photo (multipart field "image", already downsized in the browser) → Amazon-ready JPEG.
import { fixForAmazon, FixError, isSandbox } from "@/lib/photoroom";

const MAX_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5MB request limit; the browser downsizes before sending

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof Blob) || file.size === 0) return Response.json({ error: "bad_image" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "too_large" }, { status: 413 });
  try {
    const { jpeg, side } = await fixForAmazon(Buffer.from(await file.arrayBuffer()));
    return new Response(new Uint8Array(jpeg), {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "no-store",
        "x-side": String(side),
        "x-watermarked": isSandbox() ? "1" : "0",
      },
    });
  } catch (e) {
    const code = e instanceof FixError ? e.code : "failed";
    const status = { bad_image: 400, too_small: 422, busy: 429, no_key: 503, failed: 502 }[code];
    return Response.json({ error: code }, { status });
  }
}
