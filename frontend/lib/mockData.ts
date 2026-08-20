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
    subtitle: "Polarised gold-mirror silhouettes for high summer",
    image: img("collection-aviator", 1200, 1500),
    href: "/shop?category=eyewear&frameShape=aviator",
    span: "tall",
  },
  {
    // TODO(copy): placeholder wording and imagery — refine before launch.
    id: "c2",
    title: "Everyday Gold",
    subtitle: "Vermeil and solid gold layers, made to never come off",
    image: img("collection-gold-jewellery", 1400, 1000),
    href: "/shop?category=jewellery&metal=yellow-gold",
    span: "wide",
  },
  {
    id: "c3",
    title: "The Optical Archive",
    subtitle: "Clear-lens frames for the studio and the boardroom",
    image: img("collection-optical", 1000, 1250),
    href: "/shop?category=eyewear&subCategory=optical",
  },
  {
    // TODO(copy): placeholder wording and imagery — refine before launch.
    id: "c4",
    title: "Carry Everything",
    subtitle: "Structured leather totes for the working week",
    image: img("collection-totes", 1000, 1250),
    href: "/shop?category=bags&subCategory=totes",
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
      "The anklet has not left my ankle since it arrived — still bright, still perfect.",
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
