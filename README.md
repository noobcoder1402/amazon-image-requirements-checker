# Amazon Image Requirements Checker & Fixer

A free tool page: upload one main product photo, see what would get it rejected by Amazon, and download a fixed, Amazon-ready version.

Built by [Ankita Agarwal](https://ankita-1402.vercel.app) as a growth work sample. **Unofficial: not affiliated with Photoroom or Amazon.**

## How it works
1. **Check (in the browser, instant):** background, fill, size, file type, shape and "nothing added", read from the photo's pixels. Nothing is uploaded for this step.
2. **Fix:** Photoroom's cutout API removes the background; our code places the product on pure white at 90% fill, square, up to 2000px, sRGB JPEG. The result is re-checked.
3. **Download:** optionally named `PRODUCTID.MAIN.jpg`, the format Amazon's bulk upload expects.

Rules are taken from Amazon Seller Central help pages, not blog summaries.

## Run locally
```bash
npm install
echo "PHOTOROOM_API_KEY=your_key" > .env.local
npm run dev
```

Optional env vars: `PHOTOROOM_DAILY_CAP` (default 50) and `PHOTOROOM_TOTAL_CAP` (default 400). The counter is stored in the server's temp folder, so on serverless hosts it is per instance.

Stack: Next.js, React, TypeScript, sharp.
