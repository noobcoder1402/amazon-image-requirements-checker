"use client";
import { useEffect, useRef, useState } from "react";
import s from "./page.module.css";
import { analyzeFile, UnreadableImage, type Report } from "@/lib/analyze";
import { LINKS } from "@/lib/content";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "error"; message: string }
  | { kind: "done"; report: Report; example?: boolean };
type Fix =
  | { kind: "fixing" }
  | {
      kind: "fixed";
      url: string;
      after: Report;
      side: number;
      watermarked: boolean;
    }
  | { kind: "failed"; message: string };

const ICON = { pass: "✓", warn: "!", fail: "✕", info: "?" };
const FIX_ERRORS: Record<string, string> = {
  too_small:
    "This photo is too small to make Amazon-ready: the product needs to be at least 450px across. Start from a larger original.",
  busy: "The photo fixer is at its daily limit. Try again tomorrow.",
  bad_image: "We couldn't read this photo. Save it as a JPEG and try again.",
  too_large: "This photo is too large to send. Try a smaller export.",
};

function verdict(r: Report) {
  if (r.fails > 0)
    return {
      tone: s.fail,
      title: "At risk of rejection",
      line: `Your photo fails ${r.fails} of Amazon's main image rules.`,
    };
  if (r.warns > 0)
    return {
      tone: s.warn,
      title: "Passes, with room to improve",
      line: "No hard failures, but a few things are holding it back.",
    };
  return {
    tone: s.pass,
    title: "Ready for Amazon",
    line: "Your photo passes every rule we can check automatically.",
  };
}

// Downsize in the browser before sending: keeps uploads small and fast (and under hosting limits).
async function prepareUpload(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 3600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs would otherwise turn black in a JPEG
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.9));
}

// Amazon's bulk-upload naming: identifier.SLOT.jpg, full stops only. ASIN/ISBN-10 = 10 chars, UPC 12, EAN/JAN/ISBN-13 13, GTIN 14.
// "See an example": a real check on a sample photo, plus its saved Photoroom fix, so no API call is spent.
const EXAMPLE = {
  before: "/example/jeans-before.jpg",
  after: "/example/jeans-after.jpg",
  side: 2000,
};
const fetchFile = async (url: string, name: string) => new File([await (await fetch(url)).blob()], name, { type: "image/jpeg" });

const cleanId = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
const validId = (id: string) => /^[A-Z0-9]{10,14}$/.test(id);

export default function Checker() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [fix, setFix] = useState<Fix | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [productId, setProductId] = useState("");
  const [showBefore, setShowBefore] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const run = useRef(0); // ignore results from a photo the user has since replaced

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const fixedUrl = fix?.kind === "fixed" ? fix.url : null;
  useEffect(() => () => void (fixedUrl && URL.revokeObjectURL(fixedUrl)), [fixedUrl]);

  async function startFix(file: File, id: number) {
    setFix({ kind: "fixing" });
    try {
      const body = new FormData();
      body.append("image", await prepareUpload(file), "photo.jpg");
      const res = await fetch("/api/fix", { method: "POST", body });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "failed" }));
        throw new Error(error);
      }
      const blob = await res.blob();
      const after = await analyzeFile(new File([blob], "fixed.jpg", { type: "image/jpeg" }));
      if (run.current !== id) return;
      setShowBefore(false);
      setFix({
        kind: "fixed",
        url: URL.createObjectURL(blob),
        after,
        side: Number(res.headers.get("x-side")),
        watermarked: res.headers.get("x-watermarked") === "1",
      });
    } catch (e) {
      if (run.current !== id) return;
      const code = e instanceof Error ? e.message : "";
      setFix({
        kind: "failed",
        message: FIX_ERRORS[code] ?? "Photoroom couldn't fix this photo right now. Please try again.",
      });
    }
  }

  async function check(file: File | undefined, example = false) {
    if (!file) return;
    const id = ++run.current;
    setPreview(URL.createObjectURL(file));
    setFix(null);
    setState({ kind: "checking" });
    try {
      const report = await analyzeFile(file);
      if (run.current !== id) return;
      setState({ kind: "done", report, example });
      if (example) showExampleFix(id);
      else startFix(file, id);
    } catch (e) {
      const heic = /\.(heic|heif)$/i.test(file.name);
      const message =
        e instanceof UnreadableImage
          ? heic
            ? "Your browser can't read iPhone HEIC photos, and Amazon doesn't accept them either. Export as JPEG and try again."
            : "We couldn't read this file. Save it as a JPEG or PNG and try again."
          : "Something went wrong reading this photo. Please try another.";
      setPreview(null);
      setState({ kind: "error", message });
    }
  }

  async function showExampleFix(id: number) {
    setFix({ kind: "fixing" });
    try {
      const file = await fetchFile(EXAMPLE.after, "fixed.jpg");
      const after = await analyzeFile(file);
      if (run.current !== id) return;
      setShowBefore(false);
      setFix({
        kind: "fixed",
        url: URL.createObjectURL(file),
        after,
        side: EXAMPLE.side,
        watermarked: false,
      });
    } catch {
      if (run.current === id)
        setFix({
          kind: "failed",
          message: "The example didn't load. Try uploading your own photo.",
        });
    }
  }

  async function tryExample() {
    setState({ kind: "checking" });
    try {
      await check(await fetchFile(EXAMPLE.before, "example-jeans.jpg"), true);
    } catch {
      setState({
        kind: "error",
        message: "The example didn't load. Try uploading your own photo.",
      });
    }
  }

  const reset = () => {
    run.current++;
    setPreview(null);
    setFix(null);
    setState({ kind: "idle" });
    if (input.current) input.current.value = "";
  };

  if (state.kind === "done" && preview) {
    const v = verdict(state.report);
    const id = cleanId(productId);
    const filename = validId(id) ? `${id}.MAIN.jpg` : "amazon-main-image.jpg";
    return (
      <>
        <div className={s.result}>
          {/* Toggle, not a slider: "Before" shows the original as uploaded, so the empty space (the 85% fill problem) stays visible. */}
          <div className={s.viewer}>
            <div className={s.frame}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs, nothing to optimise */}
              <img
                src={fix?.kind === "fixed" && !showBefore ? fix.url : preview}
                alt={fix?.kind === "fixed" && !showBefore ? "Amazon-ready version" : "Your original product photo"}
              />
              {fix?.kind === "fixing" && <div className={s.frameNote}>Fixing your photo with Photoroom…</div>}
            </div>
            {fix?.kind === "fixed" && (
              <div className={s.toggle} role="group" aria-label="Show before or after">
                <button className={showBefore ? s.on : ""} onClick={() => setShowBefore(true)} aria-pressed={showBefore}>
                  Before
                </button>
                <button className={!showBefore ? s.on : ""} onClick={() => setShowBefore(false)} aria-pressed={!showBefore}>
                  After
                </button>
              </div>
            )}
          </div>

          <div className={s.side}>
            <div className={`card ${s.fixCard}`}>
              <p className={`${s.verdict} ${v.tone}`}>{v.title}</p>
              <p className={s.verdictLine}>{v.line}</p>

              {fix?.kind === "fixing" && <p className={s.fixStatus}>Making your Amazon-ready version…</p>}
              {fix?.kind === "failed" && (
                <p className={s.fixError} role="alert">
                  {fix.message}
                </p>
              )}
              {fix?.kind === "fixed" && (
                <>
                  <h3 className={s.fixTitle}>Your Amazon-ready photo</h3>
                  <p className={s.fixMeta}>
                    {fix.after.fails === 0 ? "✓ Passes" : "Passes"} {fix.after.checks.filter((c) => c.status === "pass").length}{" "}
                    of 5 automatic checks · {fix.side.toLocaleString("en-US")} × {fix.side.toLocaleString("en-US")}px · pure white
                    · JPEG
                  </p>
                  {fix.side < 1000 && (
                    <p className={s.fixNote}>
                      Your original was small, so we didn&apos;t enlarge it (Amazon asks sellers not to). It will upload, but zoom
                      needs 1,000px+.
                    </p>
                  )}
                  {fix.watermarked && (
                    <p className={s.fixNote}>
                      Demo mode: this preview carries a Photoroom watermark, which Amazon doesn&apos;t allow.
                    </p>
                  )}
                  {state.example ? (
                    <button className={`btn ${s.download}`} onClick={reset}>
                      Now try your own photo
                    </button>
                  ) : (
                    <>
                      <label className={s.idLabel} htmlFor="pid">
                        Product ID <span className="muted">(optional: ASIN, UPC, EAN or ISBN)</span>
                      </label>
                      <input
                        id="pid"
                        className={s.idInput}
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        placeholder="e.g. B000123456"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <p className={s.fileName}>
                        Saves as <code>{filename}</code>
                        {!validId(id) && (
                          <span className="muted"> · add your ID to get the name Amazon&apos;s bulk upload needs</span>
                        )}
                      </p>
                      <a className={`btn ${s.download}`} href={fix.url} download={filename}>
                        Download Amazon-ready photo
                      </a>
                    </>
                  )}
                </>
              )}
            </div>

            <div className={`card ${s.report}`}>
              <h3 className={s.reportTitle}>What we found in your original</h3>
              <ul className={s.checks}>
                {state.report.checks.map((c) => (
                  <li key={c.id}>
                    <span className={`${s.icon} ${s[c.status]}`} aria-label={c.status}>
                      {ICON[c.status]}
                    </span>
                    <div>
                      <strong>{c.label}</strong>
                      <p>{c.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <button className="btn ghost" onClick={reset}>
                Try another photo
              </button>
            </div>
          </div>
        </div>
        {fix?.kind === "fixed" && (
          <p className={s.nextStep}>
            Amazon recommends 6+ more images.{" "}
            <a href={LINKS.aiPhotos("results")} target="_blank" rel="noopener">
              Make lifestyle shots with AI →
            </a>
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <label
        className={`${s.drop} ${dragging ? s.dragging : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          check(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={input}
          className={s.file}
          type="file"
          accept="image/*,.heic,.heif"
          aria-label="Upload your main product photo"
          onChange={(e) => check(e.target.files?.[0])}
        />
        {state.kind === "checking" ? (
          <span className={s.dropTitle}>Checking your photo…</span>
        ) : (
          <>
            <span className="btn">Upload your main photo</span>
            <span className={s.dropHint}>or drag it here · JPEG, PNG, TIFF or GIF</span>
            {state.kind === "error" && (
              <span className={s.error} role="alert">
                {state.message}
              </span>
            )}
          </>
        )}
      </label>
      {state.kind !== "checking" && (
        <p className={s.exampleRow}>
          No photo handy?{" "}
          <button className={s.exampleLink} onClick={tryExample}>
            See an example
          </button>
        </p>
      )}
    </>
  );
}
