// Editorial content only.
//
// This file used to hold the entire product catalogue, and every public page
// rendered from it — which meant nothing entered in the admin dashboard ever
// reached a customer. Products now come from the API via lib/api.ts.
//
// What is left is hand-authored marketing copy with no database home yet:
// the homepage collection tiles and the testimonial quotes. Anything
// product-shaped belongs in Mongo, not here.

import { Collection, Testimonial } from "./types";

const img = (seed: string, w = 900, h = 1125) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

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
      "JULES & CO feels like shopping an editorial spread, not a catalog. The pairing suggestions are spot on.",
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
