// Page copy that's used twice: rendered on the page and in the FAQ structured data, so the two never drift.
// Rules follow Amazon's Seller Central help pages (research/amazon-official-image-rules.md).
// Questions use searchers' own phrasing (research/amazon-keywords.md); answers lead with a standalone sentence.

const utm = (content: string) =>
  `utm_source=amazon-checker&utm_medium=referral&utm_campaign=ankita-work-sample&utm_content=${content}`;

export const LINKS = {
  batch: (content: string) => `https://www.photoroom.com/batch?${utm(content)}`,
  api: (content: string) => `https://www.photoroom.com/api?${utm(content)}`,
  virtualModel: (content: string) => `https://www.photoroom.com/tools/virtual-model?${utm(content)}`,
  aiPhotos: (content: string) => `https://www.photoroom.com/ai-product-photography?${utm(content)}`,
};

export const RULES = [
  { title: "Pure white background", body: "Exactly RGB 255, 255, 255. An off-white that looks fine to you can still be flagged." },
  { title: "Product fills 85% of the frame", body: "The whole product, shown once, with nothing cut off." },
  { title: "500px minimum, 1,000px+ for zoom", body: "Amazon rejects images under 500px on the longest side. At 1,000px or more, shoppers can zoom in to see detail; 2,000px is a safe target." },
  {
    title: "The real product, nothing added",
    body: "One unit, no packaging, props or mannequins. No text, badges, review stars or Amazon logos. Adult clothing goes on a standing model.",
  },
  { title: "JPEG in RGB colour", body: "PNG, TIFF and non-animated GIF also work. At least 72 dpi." },
];

export const FAQ: { q: string; a: string; link?: { label: string; href: string } }[] = [
  {
    q: "What are Amazon's main image requirements?",
    a: "The main image must show the real product, once, on a pure white background (RGB 255, 255, 255), filling 85% of the frame. It needs at least 500px on its longest side, and 1,000px+ for zoom. No text, badges, packaging, props or mannequins. JPEG is recommended; PNG, TIFF and non-animated GIF also work.",
  },
  {
    q: "What size should Amazon product images be?",
    a: "Aim for at least 1,000px on the longest side; 2000 × 2000 is a safe target. Amazon won't accept images under 500px and caps them at 10,000px. Below 1,000px, zoom is switched off. Don't upscale a small photo: Amazon asks sellers not to artificially enlarge images.",
  },
  {
    q: "How do I name image files for Amazon?",
    a: "Use the product identifier, the image's slot code and the extension, separated by full stops: B000123456.MAIN.jpg. The identifier can be an ASIN, UPC, EAN, ISBN, GTIN or JAN. Spaces or dashes stop the upload. Names matter most for bulk uploads, and this tool names the file for you.",
  },
  {
    q: "Does the background have to be exactly RGB 255, 255, 255? Can I use light grey?",
    a: "For the main image, yes: pure white only. An off-white like 250, 250, 250 looks white to you but isn't what Amazon asks for. Grey, coloured and lifestyle backgrounds are fine for your other images, just not the main one.",
  },
  {
    q: "What is Amazon's 85% rule?",
    a: "The product should take up 85% of the image, with nothing cut off. In practice, its longest side should run nearly edge to edge. A small product floating in white space looks tiny in search results, which is where shoppers decide whether to click.",
  },
  {
    q: "Are there extra Amazon image rules for different product categories?",
    a: "Some categories have extra main image rules on top of pure white and 85% fill. Amazon's general image guidelines call out: shoes as a single shoe, facing left, at a 45° angle; adult clothing worn by a standing model, with no mannequins of any kind; kids' and baby undergarments, leotards and swimwear laid flat, with no models; and clothing accessories and multipacks laid flat. Other categories, such as jewellery, may have their own style guide in Seller Central, so check yours before uploading. Our fixer cleans up the background and fill, but it can't change the camera angle: if your shoe isn't facing left at 45°, reshoot it.",
  },
  {
    q: "Why is my Amazon main image suppressed or not showing?",
    a: "Images that break technical rules, like an unsupported format or under 500px, are rejected at upload. Ones that break content rules, like an off-white background, text or props, can be accepted and removed later. With no compliant main image, Amazon temporarily removes the listing from search. A new image can take up to 24 hours to appear.",
  },
  {
    q: "Why are my Amazon images blurry, or why doesn't zoom work?",
    a: "Your image is probably under 1,000px on its longest side, the point where Amazon turns zoom on. Upscaling a small photo won't add real detail, and Amazon asks sellers not to do it, so start from the largest original you have.",
  },
  {
    q: "Can I use AI to edit my Amazon main image, or use an AI model?",
    a: "Yes, as long as the product stays accurate. Removing the background or centring the product is fine; generating or reshaping the product isn't. An AI-generated model is allowed, but on the main image they must be standing on pure white, and the clothing must match what the buyer receives: AI models can subtly change a garment's cut or colour, so check closely. Images with photorealistic AI-generated people also need the contains-synthetic-performer tag in the file's metadata, and Amazon then adds a disclosure. Background removal alone doesn't need it.",
    link: { label: "Try AI fashion models on Photoroom", href: LINKS.virtualModel("faq-ai") },
  },
  {
    q: "How do I make hundreds of images Amazon-ready at once?",
    a: "Past a few dozen products, one at a time stops making sense. Photoroom's Batch mode applies the same white background, fill and size to a whole catalogue, and its API can plug into your existing workflow.",
    link: { label: "Do it in bulk on Photoroom", href: LINKS.batch("faq") },
  },
];
