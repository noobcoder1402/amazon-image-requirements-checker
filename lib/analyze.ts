// Checks a photo against Amazon's main-image rules, entirely in the browser (the photo is never uploaded).
// Reads a downscaled copy of the pixels: the outer border tells us the background, everything that
// differs from it is "product", and its bounding box gives the frame fill.

export type Status = "pass" | "warn" | "fail" | "info";
export type Check = { id: string; label: string; status: Status; detail: string };
export type Report = { checks: Check[]; fails: number; warns: number; width: number; height: number };

const ACCEPTED: Record<string, string> = { "image/jpeg": "JPEG", "image/png": "PNG", "image/gif": "GIF", "image/tiff": "TIFF" };
const SAMPLE = 600; // analyse at most 600px on the longest side: plenty for background and fill

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pct = (x: number) => Math.round(x * 100);
const fmt = (n: number) => n.toLocaleString("en-US");

export class UnreadableImage extends Error {}

export async function analyzeFile(file: File): Promise<Report> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new UnreadableImage();
  }
  const W = bmp.width;
  const H = bmp.height;
  const scale = Math.min(1, SAMPLE / Math.max(W, H));
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const { data } = ctx.getImageData(0, 0, w, h);

  const bg = checkBackground(data, w, h);
  const checks = [
    bg.check,
    checkFill(data, w, h, bg),
    checkSize(W, H),
    checkFile(file),
    checkShape(W, H),
    {
      id: "nothing-added",
      label: "Nothing added to the photo",
      status: "info" as const,
      detail: "We can't check this automatically. One unit, shown once, with no packaging, props or mannequins, and no text, badges, review stars or logos.",
    },
  ];
  return {
    checks,
    fails: checks.filter((c) => c.status === "fail").length,
    warns: checks.filter((c) => c.status === "warn").length,
    width: W,
    height: H,
  };
}

type Background = { check: Check; plain: boolean; transparent: boolean; ref: number[] };

function checkBackground(d: Uint8ClampedArray, w: number, h: number): Background {
  const ring = Math.max(3, Math.round(Math.min(w, h) * 0.02));
  const px: number[][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (x < ring || y < ring || x >= w - ring || y >= h - ring) {
        const i = (y * w + x) * 4;
        px.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
      }
  const n = px.length;
  const transparentShare = px.filter((p) => p[3] < 250).length / n;
  // 253+ rather than exactly 255: JPEG compression nudges pure white by a point or two.
  const whiteShare = px.filter((p) => p[3] >= 250 && Math.min(p[0], p[1], p[2]) >= 253).length / n;
  const med = [0, 1, 2].map((c) => median(px.map((p) => p[c])));
  const uniformShare = px.filter((p) => p[3] >= 250 && dist(p, med) < 20).length / n;
  const rgb = `RGB ${med.join(", ")}`;
  const label = "Pure white background";

  if (transparentShare > 0.5)
    return {
      plain: true,
      transparent: true,
      ref: med,
      check: { id: "background", label, status: "warn", detail: "Transparent background. Amazon asks for pure white, so export it on white (RGB 255, 255, 255) rather than relying on transparency." },
    };
  if (whiteShare >= 0.97)
    return { plain: true, transparent: false, ref: [255, 255, 255], check: { id: "background", label, status: "pass", detail: "Pure white edge to edge (RGB 255, 255, 255)." } };
  if (uniformShare >= 0.85 && Math.min(...med) >= 230)
    return {
      plain: true,
      transparent: false,
      ref: med,
      check: { id: "background", label, status: "fail", detail: `Off-white (${rgb}). It looks white, but Amazon's check wants exactly 255, 255, 255.` },
    };
  if (uniformShare >= 0.85)
    return {
      plain: true,
      transparent: false,
      ref: med,
      check: { id: "background", label, status: "fail", detail: `Plain coloured background (${rgb}). That works for images 2–7, but the main image needs pure white.` },
    };
  // Mostly white edge: often the product itself running off the frame, so still measure fill against white.
  if (whiteShare >= 0.6)
    return {
      plain: true,
      transparent: false,
      ref: [255, 255, 255],
      check: {
        id: "background",
        label,
        status: "warn",
        detail: `Mostly pure white, but ${pct(1 - whiteShare)}% of the frame's edge isn't. Fine if that's your product touching the edge; if it's a shadow or the backdrop, Amazon may flag it.`,
      },
    };
  return {
    plain: false,
    transparent: false,
    ref: med,
    check: { id: "background", label, status: "fail", detail: "Busy or photographed background. The main image needs the product alone on pure white." },
  };
}

function checkFill(d: Uint8ClampedArray, w: number, h: number, bg: Background): Check {
  const label = "Product fills 85% of the frame";
  if (!bg.plain)
    return { id: "fill", label, status: "info", detail: "Can't measure on a busy background. Fix the background first; then the product should fill 85% or more." };

  const rows = new Array(h).fill(0);
  const cols = new Array(w).fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const isProduct = bg.transparent ? d[i + 3] > 16 : d[i + 3] > 16 && dist([d[i], d[i + 1], d[i + 2]], bg.ref) > 35;
      if (isProduct) {
        rows[y]++;
        cols[x]++;
      }
    }
  // Ignore stray specks: a row/column only counts if a few pixels in it differ from the background.
  const min = Math.max(2, Math.round(Math.min(w, h) * 0.003));
  const ys = rows.flatMap((c, i) => (c >= min ? [i] : []));
  const xs = cols.flatMap((c, i) => (c >= min ? [i] : []));
  if (!ys.length || !xs.length) return { id: "fill", label, status: "fail", detail: "We couldn't find a product in this photo." };

  const [x0, x1, y0, y1] = [xs[0], xs[xs.length - 1], ys[0], ys[ys.length - 1]];
  // Measured against the longest side, because Amazon shows every main image in a square tile.
  const fill = Math.max(x1 - x0 + 1, y1 - y0 + 1) / Math.max(w, h);
  const touches = x0 <= 1 || y0 <= 1 || x1 >= w - 2 || y1 >= h - 2;
  if (touches)
    return { id: "fill", label, status: "warn", detail: "Your product touches the edge of the frame. Make sure nothing is cropped: Amazon wants the whole product in view." };
  if (fill >= 0.85) return { id: "fill", label, status: "pass", detail: `Product fills ${pct(fill)}% of the frame.` };
  return { id: "fill", label, status: "fail", detail: `Product fills ${pct(fill)}% of the frame. Below 85%, it looks small next to competitors in search results.` };
}

function checkSize(W: number, H: number): Check {
  const label = "Big enough to zoom";
  const dims = `${fmt(W)} × ${fmt(H)}px`;
  const longest = Math.max(W, H);
  if (longest > 10000) return { id: "size", label, status: "fail", detail: `${dims}. Over Amazon's 10,000px maximum, so it won't upload.` };
  if (longest >= 1000) return { id: "size", label, status: "pass", detail: `${dims}. Shoppers can zoom in.` };
  if (longest >= 500) return { id: "size", label, status: "warn", detail: `${dims}. It will upload, but zoom needs 1,000px or more on the longest side.` };
  return { id: "size", label, status: "fail", detail: `${dims}. Under 500px on the longest side, so Amazon won't accept the upload.` };
}

function checkFile(file: File): Check {
  const label = "Accepted file type";
  const type = ACCEPTED[file.type];
  if (!type) {
    const ext = (file.name.split(".").pop() || "This").toUpperCase();
    return { id: "file", label, status: "fail", detail: `${ext} files aren't accepted. Amazon takes JPEG (recommended), PNG, TIFF or non-animated GIF.` };
  }
  return { id: "file", label, status: "pass", detail: type === "JPEG" ? "JPEG, Amazon's recommended format." : `${type} is accepted, though Amazon recommends JPEG.` };
}

function checkShape(W: number, H: number): Check {
  const label = "Square (1:1)";
  const r = W / H;
  if (Math.abs(r - 1) <= 0.02) return { id: "shape", label, status: "pass", detail: "Square, so it fills the search-results tile." };
  const kind = r > 1 ? "Landscape" : "Portrait";
  return { id: "shape", label, status: "warn", detail: `${kind} (${(r > 1 ? r : 1 / r).toFixed(2)}:1). Amazon accepts it, but a square photo uses the whole search-results tile.` };
}
