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

/**
 * Homepage collection tiles.
 *
 * TEMPORARY IMAGERY. These are hotlinked Unsplash photographs standing in until
 * the brand's own photography is shot — every one is to be replaced before
 * launch. `images.unsplash.com` is already whitelisted in next.config.js.
 *
 * Each was checked by eye rather than by filename: candidates showing
 * third-party branding (a Ray-Ban temple, a Ferragamo clasp, an RVCA cap) were
 * rejected, since putting another label's product on this storefront is wrong
 * even as a placeholder. Titles and filter links match what each photo actually
 * depicts, so the tile does not promise something the results contradict.
 *
 * These tiles are the last hand-authored catalogue content on the site and are
 * destined to become admin-managed records, at which point this array goes.
 */
const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const collections: Collection[] = [
  {
    id: "c1",
    title: "The Gold Frame Edit",
    subtitle: "Round gold-rimmed frames, cut for a softer line",
    // Gold-rimmed round frames on marble — matches the `round` filter below.
    image: unsplash("photo-1511499767150-a48a237f0083", 1000),
    href: "/shop?category=eyewear&frameShape=round",
    span: "tall",
  },
  {
    id: "c2",
    title: "Everyday Gold",
    subtitle: "Vermeil and solid gold layers, made to never come off",
    // Layered necklaces and stacked rings, worn.
    image: unsplash("photo-1611652022419-a9419f74343d", 1400),
    href: "/shop?category=jewellery&metal=yellow-gold",
    span: "wide",
  },
  {
    id: "c3",
    title: "The Optical Archive",
    subtitle: "Clear-lens frames for the studio and the boardroom",
    // Tortoiseshell browline optical frames.
    image: unsplash("photo-1574258495973-f010dfbb5371", 1000),
    href: "/shop?category=eyewear&subCategory=optical",
  },
  {
    id: "c4",
    title: "Carry Everything",
    subtitle: "Structured leather with gold hardware",
    // Teal leather bag with gold hardware, unbranded.
    image: unsplash("photo-1594223274512-ad4803739b7c", 1000),
    href: "/shop?category=bags",
  },
];

/**
 * PLACEHOLDER TESTIMONIALS. These quotes are invented and must be replaced with
 * real, permitted client feedback before launch.
 *
 * `image` is deliberately left unset on all of them. The card supports a client
 * photograph and will render one the moment it is provided, but attaching a
 * real, identifiable face to an invented quote presents a specific person as
 * endorsing the brand, which is a different thing from placeholder copy. Until
 * the quotes are real, the cards show a monogram instead.
 *
 * Destined to become admin-managed records alongside the collection tiles.
 */
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
