import { Collection, Product, Testimonial } from "./types";

const img = (seed: string, w = 900, h = 1125) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const products: Product[] = [
  {
    id: "p1",
    slug: "the-aviator",
    name: "The Aviator",
    category: "eyewear",
    subCategory: "Sunglasses",
    price: 890,
    compareAtPrice: 1050,
    description:
      "A refined take on the classic silhouette, hand-finished in acetate with polarized gold-mirror lenses.",
    images: [img("aviator-1"), img("aviator-2")],
    frameShape: "Aviator",
    lensColor: "Gold Mirror",
    colors: [
      { id: "tortoise", label: "Tortoise", hex: "#6B4226", inStock: true },
      { id: "black", label: "Black", hex: "#121212", inStock: true },
      { id: "champagne", label: "Champagne", hex: "#D4AF37", inStock: false },
    ],
    stock: 6,
    isBestSeller: true,
    rating: 4.8,
    reviewCount: 132,
    pairsWith: ["p9", "p7"],
  },
  {
    id: "p2",
    slug: "the-coastal",
    name: "The Coastal",
    category: "eyewear",
    subCategory: "Sunglasses",
    price: 760,
    description:
      "Soft round lenses with a sage tint, set in a lightweight bio-acetate frame built for everyday wear.",
    images: [img("coastal-1"), img("coastal-2")],
    frameShape: "Round",
    lensColor: "Sage Tint",
    colors: [
      { id: "sage", label: "Sage", hex: "#8A9A86", inStock: true },
      { id: "cream", label: "Cream", hex: "#F9F8F6", inStock: true },
    ],
    stock: 3,
    isNew: true,
    rating: 4.6,
    reviewCount: 58,
    pairsWith: ["p10"],
  },
  {
    id: "p3",
    slug: "the-editor",
    name: "The Editor",
    category: "eyewear",
    subCategory: "Optical",
    price: 820,
    description:
      "Precise square optical frames with a keyhole bridge — designed for long days at the desk and beyond.",
    images: [img("editor-1"), img("editor-2")],
    frameShape: "Square",
    lensColor: "Clear",
    colors: [
      { id: "black", label: "Black", hex: "#121212", inStock: true },
      { id: "walnut", label: "Walnut", hex: "#5A4632", inStock: true },
    ],
    stock: 0,
    rating: 4.9,
    reviewCount: 41,
    pairsWith: ["p12"],
  },
  {
    id: "p4",
    slug: "the-muse",
    name: "The Muse",
    category: "eyewear",
    subCategory: "Sunglasses",
    price: 940,
    compareAtPrice: 1100,
    description:
      "A dramatic cat-eye with smoked gradient lenses — the statement piece of any collection.",
    images: [img("muse-1"), img("muse-2")],
    frameShape: "Cat-Eye",
    lensColor: "Smoke",
    colors: [
      { id: "black", label: "Black", hex: "#121212", inStock: true },
      { id: "tortoise", label: "Tortoise", hex: "#6B4226", inStock: true },
    ],
    stock: 9,
    isBestSeller: true,
    rating: 4.7,
    reviewCount: 96,
    pairsWith: ["p11"],
  },
  {
    id: "p5",
    slug: "the-architect",
    name: "The Architect",
    category: "eyewear",
    subCategory: "Optical",
    price: 780,
    description:
      "Clean rectangular optical frames in matte titanium, engineered for structure and minimal weight.",
    images: [img("architect-1"), img("architect-2")],
    frameShape: "Rectangle",
    lensColor: "Clear",
    colors: [
      { id: "gunmetal", label: "Gunmetal", hex: "#3B3B3D", inStock: true },
      { id: "champagne", label: "Champagne", hex: "#D4AF37", inStock: true },
    ],
    stock: 4,
    rating: 4.5,
    reviewCount: 27,
    pairsWith: ["p9"],
  },
  {
    id: "p6",
    slug: "the-voyager",
    name: "The Voyager",
    category: "eyewear",
    subCategory: "Sunglasses",
    price: 990,
    description:
      "Oversized amber lenses and a bold brow line for an editorial, off-duty finish.",
    images: [img("voyager-1"), img("voyager-2")],
    frameShape: "Oversized",
    lensColor: "Amber",
    colors: [
      { id: "amber", label: "Amber", hex: "#B8942B", inStock: true },
      { id: "black", label: "Black", hex: "#121212", inStock: false },
    ],
    stock: 2,
    isNew: true,
    rating: 4.4,
    reviewCount: 19,
    pairsWith: ["p8"],
  },
  {
    id: "p7",
    slug: "cashmere-crewneck",
    name: "Cashmere Crewneck",
    category: "apparel",
    subCategory: "Knitwear",
    price: 1450,
    description:
      "A relaxed-fit crewneck in pure Mongolian cashmere, garment-dyed for a soft, worn-in hand-feel.",
    images: [img("crewneck-1"), img("crewneck-2")],
    fabric: "100% Cashmere",
    clothingSize: ["XS", "S", "M", "L", "XL"],
    colors: [
      { id: "alabaster", label: "Alabaster", hex: "#F9F8F6", inStock: true },
      { id: "obsidian", label: "Obsidian", hex: "#121212", inStock: true },
      { id: "sage", label: "Sage", hex: "#8A9A86", inStock: true },
    ],
    sizes: [
      { id: "xs", label: "XS", inStock: true },
      { id: "s", label: "S", inStock: true },
      { id: "m", label: "M", inStock: true },
      { id: "l", label: "L", inStock: false },
      { id: "xl", label: "XL", inStock: true },
    ],
    stock: 14,
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 74,
    pairsWith: ["p1", "p5"],
  },
  {
    id: "p8",
    slug: "merino-turtleneck",
    name: "Merino Wool Turtleneck",
    category: "apparel",
    subCategory: "Knitwear",
    price: 980,
    description:
      "Fine-gauge merino wool, ribbed at the cuffs and hem, engineered to layer cleanly under tailoring.",
    images: [img("turtleneck-1"), img("turtleneck-2")],
    fabric: "100% Merino Wool",
    clothingSize: ["S", "M", "L", "XL"],
    colors: [
      { id: "obsidian", label: "Obsidian", hex: "#121212", inStock: true },
      { id: "walnut", label: "Walnut", hex: "#5A4632", inStock: true },
    ],
    sizes: [
      { id: "s", label: "S", inStock: true },
      { id: "m", label: "M", inStock: true },
      { id: "l", label: "L", inStock: true },
      { id: "xl", label: "XL", inStock: false },
    ],
    stock: 8,
    rating: 4.6,
    reviewCount: 33,
    pairsWith: ["p6"],
  },
  {
    id: "p9",
    slug: "tailored-wool-coat",
    name: "Tailored Wool Coat",
    category: "apparel",
    subCategory: "Outerwear",
    price: 3200,
    compareAtPrice: 3650,
    description:
      "A single-breasted overcoat cut from a heavyweight Italian wool blend, built to anchor any silhouette.",
    images: [img("coat-1"), img("coat-2")],
    fabric: "Wool Blend",
    clothingSize: ["S", "M", "L", "XL"],
    colors: [
      { id: "camel", label: "Camel", hex: "#B08A5A", inStock: true },
      { id: "obsidian", label: "Obsidian", hex: "#121212", inStock: true },
    ],
    sizes: [
      { id: "s", label: "S", inStock: true },
      { id: "m", label: "M", inStock: false },
      { id: "l", label: "L", inStock: true },
      { id: "xl", label: "XL", inStock: true },
    ],
    stock: 5,
    isBestSeller: true,
    rating: 5.0,
    reviewCount: 21,
    pairsWith: ["p1", "p5"],
  },
  {
    id: "p10",
    slug: "silk-button-down",
    name: "Silk Button-Down",
    category: "apparel",
    subCategory: "Shirting",
    price: 890,
    description:
      "A fluid, mulberry-silk shirt with mother-of-pearl buttons and a relaxed, unstructured collar.",
    images: [img("silk-shirt-1"), img("silk-shirt-2")],
    fabric: "100% Mulberry Silk",
    clothingSize: ["XS", "S", "M", "L"],
    colors: [
      { id: "cream", label: "Cream", hex: "#F9F8F6", inStock: true },
      { id: "sage", label: "Sage", hex: "#8A9A86", inStock: true },
    ],
    sizes: [
      { id: "xs", label: "XS", inStock: true },
      { id: "s", label: "S", inStock: true },
      { id: "m", label: "M", inStock: true },
      { id: "l", label: "L", inStock: true },
    ],
    stock: 11,
    rating: 4.7,
    reviewCount: 45,
    pairsWith: ["p2"],
  },
  {
    id: "p11",
    slug: "relaxed-linen-trouser",
    name: "Relaxed Linen Trouser",
    category: "apparel",
    subCategory: "Bottoms",
    price: 720,
    description:
      "Wide-leg trousers in washed European linen with a high rise and a fluid, breathable drape.",
    images: [img("linen-trouser-1"), img("linen-trouser-2")],
    fabric: "100% Linen",
    clothingSize: ["XS", "S", "M", "L", "XL"],
    colors: [
      { id: "alabaster", label: "Alabaster", hex: "#F9F8F6", inStock: true },
      { id: "walnut", label: "Walnut", hex: "#5A4632", inStock: false },
    ],
    sizes: [
      { id: "xs", label: "XS", inStock: true },
      { id: "s", label: "S", inStock: true },
      { id: "m", label: "M", inStock: true },
      { id: "l", label: "L", inStock: true },
      { id: "xl", label: "XL", inStock: true },
    ],
    stock: 17,
    isNew: true,
    rating: 4.5,
    reviewCount: 12,
    pairsWith: ["p4"],
  },
  {
    id: "p12",
    slug: "structured-blazer",
    name: "Structured Blazer",
    category: "apparel",
    subCategory: "Outerwear",
    price: 2100,
    description:
      "A sharply tailored wool blazer with a nipped waist and horn buttons — the modern uniform staple.",
    images: [img("blazer-1"), img("blazer-2")],
    fabric: "Virgin Wool",
    clothingSize: ["XS", "S", "M", "L", "XL"],
    colors: [
      { id: "obsidian", label: "Obsidian", hex: "#121212", inStock: true },
      { id: "camel", label: "Camel", hex: "#B08A5A", inStock: true },
    ],
    sizes: [
      { id: "xs", label: "XS", inStock: false },
      { id: "s", label: "S", inStock: true },
      { id: "m", label: "M", inStock: true },
      { id: "l", label: "L", inStock: true },
      { id: "xl", label: "XL", inStock: true },
    ],
    stock: 7,
    rating: 4.8,
    reviewCount: 29,
    pairsWith: ["p3"],
  },

  // --- Real Jules & Co inventory (migrated from julesandco.shop) ---
  {
    id: "j1",
    slug: "deep-square",
    name: "Deep Square",
    category: "eyewear",
    subCategory: "Optical",
    price: 120,
    description: "Beautifully shaped eyewear suitable for prescriptions.",
    images: ["/images/products/deep-square.jpg", "/images/products/deep-square.jpg"],
    frameShape: "Square",
    colors: [],
    tags: ["Corporate Prescription", "Unisex"],
    stock: 2,
  },
  {
    id: "j2",
    slug: "jc-ideal",
    name: "JC Ideal",
    category: "eyewear",
    subCategory: "Optical",
    price: 180,
    compareAtPrice: 200,
    description: "A sharp cat-eye optical frame styled for everyday wear.",
    images: ["/images/products/jc-ideal.jpg", "/images/products/jc-ideal.jpg"],
    frameShape: "Cat-Eye",
    colors: [{ id: "black", label: "Black", hex: "#121212", inStock: true }],
    stock: 10,
    isBestSeller: true,
  },
  {
    id: "j3",
    slug: "carly-frames",
    name: "Carly Frames",
    category: "eyewear",
    subCategory: "Optical",
    price: 100,
    description: "Thick square frames suitable for prescriptions.",
    images: ["/images/products/carly-frames.jpg", "/images/products/carly-frames.jpg"],
    frameShape: "Square",
    colors: [
      { id: "black", label: "Black", hex: "#121212", inStock: true },
      { id: "transparent", label: "Transparent", hex: "#E8E4DC", inStock: true },
      { id: "dark-gray", label: "Dark Gray", hex: "#4A4A4A", inStock: true },
    ],
    stock: 5,
  },
  {
    id: "j4",
    slug: "jc020",
    name: "JC020",
    category: "eyewear",
    subCategory: "Sunglasses",
    price: 120,
    description: "Bold rectangular sunglasses in a rich tinted acetate.",
    images: ["/images/products/jc020.jpg", "/images/products/jc020.jpg"],
    frameShape: "Rectangle",
    colors: [
      { id: "amber", label: "Amber", hex: "#C17A3D", inStock: true },
      { id: "burgundy", label: "Burgundy", hex: "#5C1F2E", inStock: true },
      { id: "black", label: "Black", hex: "#121212", inStock: true },
    ],
    stock: 10,
    isNew: true,
  },
  {
    id: "j5",
    slug: "jc024",
    name: "JC024",
    category: "eyewear",
    subCategory: "Optical",
    price: 90,
    compareAtPrice: 100,
    description: "Oversized round optical frames with a soft, retro silhouette.",
    images: ["/images/products/jc024.jpg", "/images/products/jc024.jpg"],
    frameShape: "Round",
    colors: [
      { id: "black", label: "Black", hex: "#121212", inStock: true },
      { id: "blush-tortoise", label: "Blush Tortoise", hex: "#D9A8A0", inStock: true },
    ],
    stock: 10,
  },
  {
    id: "j6",
    slug: "shein-sxy",
    name: "Shein SXY",
    category: "apparel",
    subCategory: "Dresses",
    price: 210,
    description: "A strapless bodycon midi dress with a striped hem detail.",
    images: ["/images/products/shein-sxy.jpg", "/images/products/shein-sxy.jpg"],
    fabric: "Ponte Knit",
    clothingSize: ["S", "M", "L"],
    colors: [{ id: "black", label: "Black", hex: "#121212", inStock: true }],
    sizes: [
      { id: "s", label: "S", inStock: true },
      { id: "m", label: "M", inStock: true },
      { id: "l", label: "L", inStock: true },
    ],
    tags: ["Clothes"],
    stock: 10,
  },
  {
    id: "j7",
    slug: "origin-celine",
    name: "Origin Celine",
    category: "eyewear",
    subCategory: "Sunglasses",
    price: 150,
    description: "Oval sunglasses with a polished acetate finish.",
    images: ["/images/products/origin-celine.jpg", "/images/products/origin-celine.jpg"],
    frameShape: "Oval",
    colors: [],
    stock: 10,
    isBestSeller: true,
  },
  {
    id: "j8",
    slug: "oval-y2k",
    name: "Oval Y2K",
    category: "eyewear",
    subCategory: "Optical",
    price: 90,
    compareAtPrice: 100,
    description: "Round Y2K-inspired optical frames in a compact silhouette.",
    images: ["/images/products/oval-y2k.jpg", "/images/products/oval-y2k.jpg"],
    frameShape: "Round",
    colors: [
      { id: "black", label: "Black", hex: "#121212", inStock: true },
      { id: "tortoise", label: "Tortoise", hex: "#6B4226", inStock: true },
    ],
    stock: 10,
    isNew: true,
  },
];

export const collections: Collection[] = [
  {
    id: "c1",
    title: "The Aviator Edit",
    subtitle: "Polarized gold-mirror silhouettes for high summer",
    image: img("collection-aviator", 1200, 1500),
    href: "/shop?category=eyewear&frameShape=Aviator",
    span: "tall",
  },
  {
    id: "c2",
    title: "Minimalist Knitwear",
    subtitle: "Cashmere and merino, cut for quiet luxury",
    image: img("collection-knitwear", 1400, 1000),
    href: "/shop?category=apparel&subCategory=Knitwear",
    span: "wide",
  },
  {
    id: "c3",
    title: "The Optical Archive",
    subtitle: "Clear-lens frames for the studio and the boardroom",
    image: img("collection-optical", 1000, 1250),
    href: "/shop?category=eyewear&subCategory=Optical",
  },
  {
    id: "c4",
    title: "Outerwear Season",
    subtitle: "Tailored coats and blazers for transitional weather",
    image: img("collection-outerwear", 1000, 1250),
    href: "/shop?category=apparel&subCategory=Outerwear",
  },
];

export const testimonials: Testimonial[] = [
  {
    id: "t1",
    quote:
      "The craftsmanship is on another level — my Aviators still look brand new two years in.",
    author: "Adjoa M.",
    role: "Accra",
  },
  {
    id: "t2",
    quote:
      "Finally a size guide that actually works. Ordering apparel online has never felt this safe.",
    author: "Kwame B.",
    role: "Kumasi",
  },
  {
    id: "t3",
    quote:
      "Aura & Optic feels like shopping an editorial spread, not a catalog. The pairing suggestions are spot on.",
    author: "Naana O.",
    role: "London",
  },
  {
    id: "t4",
    quote:
      "Checkout with Mobile Money took under a minute. Tracking notifications kept me updated the whole way.",
    author: "Yaw D.",
    role: "Takoradi",
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getRelatedProducts(product: Product): Product[] {
  if (!product.pairsWith) return [];
  return product.pairsWith
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));
}

export const frameShapes = Array.from(
  new Set(products.filter((p) => p.frameShape).map((p) => p.frameShape as string))
);

export const lensColors = Array.from(
  new Set(products.filter((p) => p.lensColor).map((p) => p.lensColor as string))
);

export const clothingSizes = Array.from(
  new Set(products.flatMap((p) => p.clothingSize ?? []))
);

export const fabrics = Array.from(
  new Set(products.filter((p) => p.fabric).map((p) => p.fabric as string))
);

export const priceBounds: [number, number] = [
  Math.min(...products.map((p) => p.price)),
  Math.max(...products.map((p) => p.price)),
];
