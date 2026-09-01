/**
 * Every piece of editorial content the storefront renders, described once.
 *
 * A slot is a named block of content — the hero slides, the homepage tiles, the
 * testimonials. Each declares its shape as `fields`, and that one declaration
 * does three jobs: it validates what the API accepts, it tells the admin what
 * form to draw, and its `defaults` are what the storefront falls back to.
 *
 * The defaults are the values that were hardcoded in the frontend until now, so
 * a database with no content documents renders exactly the site that shipped
 * before this existed. Seeding is therefore optional rather than a migration
 * step someone can forget and end up with an empty homepage.
 *
 * Field types the admin knows how to render:
 *   text | textarea | image | boolean | url | list
 * `list` nests another set of fields, which is how the mega menu's columns and
 * the footer's link groups are expressed without a bespoke editor each.
 */

const unsplash = (id, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/**
 * The shape every policy page shares: a heading, a short opening, the date it
 * was last reviewed, and a list of sections.
 *
 * One shape rather than three bespoke ones, because the operations on them are
 * identical and the admin editor is generated from these specs — so all three
 * pages get a working editor without one being written.
 */
const policyFields = [
  { key: "headline", label: "Page title", type: "text", required: true },
  { key: "intro", label: "Opening paragraph", type: "textarea", required: true },
  {
    key: "updated",
    label: "Last reviewed",
    type: "text",
    help: "Shown to customers. Update it whenever you change the wording.",
  },
  {
    key: "sections",
    label: "Sections",
    type: "list",
    itemLabel: "Section",
    itemTitle: "heading",
    fields: [
      { key: "heading", label: "Heading", type: "text", required: true },
      { key: "body", label: "Text", type: "textarea", required: true },
    ],
  },
];

const linkFields = [
  { key: "label", label: "Label", type: "text", required: true },
  { key: "href", label: "Link", type: "url", required: true },
];

const SLOTS = {
  "hero.slides": {
    label: "Hero slides",
    description:
      "The rotating homepage banner. Only the photograph and the headline change between slides — the eyebrow, paragraph and buttons are fixed, so it reads as one composition re-dressing itself.",
    kind: "list",
    itemLabel: "Slide",
    itemTitle: "headline",
    fields: [
      { key: "image", label: "Photograph", type: "image", required: true },
      { key: "headline", label: "Headline", type: "text", required: true },
      {
        key: "emoji",
        label: "Emoji",
        type: "text",
        help: "Optional, sits after the headline.",
      },
      { key: "alt", label: "Alt text", type: "text", required: true, help: "Describes the photograph for screen readers." },
      {
        key: "objectPosition",
        label: "Focal point",
        type: "text",
        default: "center",
        help: 'How the photo is cropped, e.g. "center 22%". Portrait shots usually need this so a face is not cut off.',
      },
      { key: "active", label: "Show this slide", type: "boolean", default: true },
    ],
    defaults: [
      {
        id: "slide-1",
        image: "/images/hero/jules-hero.jpg",
        alt: "JULES & CO editorial campaign",
        headline: "Thank you for visiting Jules and Co!",
        objectPosition: "center",
        active: true,
      },
      {
        id: "slide-2",
        image: "/images/hero/jules-hero-1.jpeg",
        alt: "A client wearing JULES & CO optical frames",
        headline: "Complete the look!",
        objectPosition: "center 22%",
        active: true,
      },
      {
        id: "slide-3",
        image: "/images/hero/jules-hero-3.png",
        alt: "A client wearing JULES & CO sunglasses",
        headline: "Pick a Pair",
        emoji: "😎",
        objectPosition: "center 28%",
        active: true,
      },
      {
        id: "slide-4",
        image: "/images/hero/jules-hero-5.jpeg",
        alt: "A JULES & CO campaign photograph",
        headline: "It's shop@jules",
        emoji: "🛍️",
        objectPosition: "center",
        active: true,
      },
    ],
  },

  "home.collections": {
    label: "Homepage collection tiles",
    description:
      "The curated edit below the hero. Each tile links into the shop with a filter already applied, so the photograph and the results it promises should agree.",
    kind: "list",
    itemLabel: "Tile",
    itemTitle: "title",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "subtitle", label: "Subtitle", type: "text", required: true },
      { key: "image", label: "Photograph", type: "image", required: true },
      {
        key: "href",
        label: "Links to",
        type: "url",
        required: true,
        help: "A shop URL with filters, e.g. /shop?category=jewellery&metal=yellow-gold",
      },
      {
        key: "span",
        label: "Tile size",
        type: "select",
        options: [
          { value: "default", label: "Standard" },
          { value: "wide", label: "Wide" },
          { value: "tall", label: "Tall" },
        ],
        default: "default",
      },
    ],
    defaults: [
      {
        id: "c1",
        title: "The Gold Frame Edit",
        subtitle: "Round gold-rimmed frames, cut for a softer line",
        image: unsplash("photo-1511499767150-a48a237f0083", 1000),
        href: "/shop?category=eyewear&frameShape=round",
        span: "tall",
      },
      {
        id: "c2",
        title: "Everyday Gold",
        subtitle: "Vermeil and solid gold layers, made to never come off",
        image: unsplash("photo-1611652022419-a9419f74343d", 1400),
        href: "/shop?category=jewellery&metal=yellow-gold",
        span: "wide",
      },
      {
        id: "c3",
        title: "The Optical Archive",
        subtitle: "Clear-lens frames for the studio and the boardroom",
        image: unsplash("photo-1574258495973-f010dfbb5371", 1000),
        href: "/shop?category=eyewear&subCategory=optical",
        span: "default",
      },
      {
        id: "c4",
        title: "Carry Everything",
        subtitle: "Structured leather with gold hardware",
        image: unsplash("photo-1594223274512-ad4803739b7c", 1000),
        href: "/shop?category=bags",
        span: "default",
      },
    ],
  },

  "home.testimonials": {
    label: "What our clients say",
    description:
      "Real client quotes, shown on the homepage. The section is hidden entirely while this is empty — never add a quote nobody said. A portrait is optional; without one the card falls back to a monogram, which is a designed state rather than a hole.",
    kind: "list",
    itemLabel: "Testimonial",
    itemTitle: "author",
    fields: [
      { key: "quote", label: "Quote", type: "textarea", required: true },
      { key: "author", label: "Client name", type: "text", required: true },
      { key: "role", label: "Location or role", type: "text", required: true },
      {
        key: "image",
        label: "Portrait",
        type: "image",
        help: "Optional. Only publish a photograph you have permission to use.",
      },
    ],
    /**
     * Deliberately empty.
     *
     * This shipped with four quotes attributed to named people — "Adjoa M.",
     * "Kwame B." — who never said them. As development placeholders that was
     * fine; on a live shop they are invented customer endorsements presented as
     * real, which is a thing a shop must not publish whatever the intent.
     *
     * The homepage section hides itself when this is empty, so the site simply
     * does not claim anything until there is something true to claim. Add real
     * quotes under Content → What our clients say.
     */
    defaults: [],
  },

  "nav.megaMenu": {
    label: "Header mega menu",
    description:
      "Curated navigation, not the full facet list — the shop sidebar renders that from the catalogue. Link values must match the sub-category and attribute slugs a product actually carries, or the menu leads to an empty shop.",
    kind: "list",
    itemLabel: "Menu section",
    itemTitle: "label",
    fields: [
      {
        key: "key",
        label: "Category slug",
        type: "text",
        required: true,
        help: "Must match a category, e.g. eyewear.",
      },
      { key: "label", label: "Menu label", type: "text", required: true },
      { key: "href", label: "Links to", type: "url", required: true },
      {
        key: "columns",
        label: "Columns",
        type: "list",
        itemLabel: "Column",
        itemTitle: "title",
        fields: [
          { key: "title", label: "Column heading", type: "text", required: true },
          { key: "links", label: "Links", type: "list", itemLabel: "Link", itemTitle: "label", fields: linkFields },
        ],
      },
      {
        key: "featured",
        label: "Featured tile",
        type: "group",
        fields: [
          { key: "title", label: "Title", type: "text", required: true },
          { key: "subtitle", label: "Subtitle", type: "text" },
          { key: "image", label: "Photograph", type: "image", required: true },
          { key: "href", label: "Links to", type: "url", required: true },
        ],
      },
    ],
    defaults: [
      {
        id: "eyewear",
        key: "eyewear",
        label: "Eyewear",
        href: "/shop?category=eyewear",
        columns: [
          {
            id: "shape",
            title: "Shop by Shape",
            links: [
              { id: "aviator", label: "Aviator", href: "/shop?category=eyewear&frameShape=aviator" },
              { id: "round", label: "Round", href: "/shop?category=eyewear&frameShape=round" },
              { id: "square", label: "Square", href: "/shop?category=eyewear&frameShape=square" },
              { id: "cat-eye", label: "Cat-Eye", href: "/shop?category=eyewear&frameShape=cat-eye" },
              { id: "oversized", label: "Oversized", href: "/shop?category=eyewear&frameShape=oversized" },
              { id: "rectangle", label: "Rectangle", href: "/shop?category=eyewear&frameShape=rectangle" },
            ],
          },
          {
            id: "type",
            title: "Shop by Type",
            links: [
              { id: "sunglasses", label: "Sunglasses", href: "/shop?category=eyewear&subCategory=sunglasses" },
              { id: "optical", label: "Optical", href: "/shop?category=eyewear&subCategory=optical" },
              { id: "mens", label: "Men", href: "/shop?category=eyewear&gender=mens" },
              { id: "new", label: "New Arrivals", href: "/shop?category=eyewear&sort=new" },
              { id: "best", label: "Best Sellers", href: "/shop?category=eyewear&sort=bestseller" },
            ],
          },
        ],
        featured: {
          title: "The Gold Frame Edit",
          subtitle: "Round gold-rimmed frames, cut for a softer line",
          image: unsplash("photo-1511499767150-a48a237f0083", 1000),
          href: "/shop?category=eyewear&frameShape=round",
        },
      },
      {
        id: "jewellery",
        key: "jewellery",
        label: "Jewellery",
        href: "/shop?category=jewellery",
        columns: [
          {
            id: "piece",
            title: "Shop by Piece",
            links: [
              { id: "necklaces", label: "Necklaces", href: "/shop?category=jewellery&subCategory=necklaces" },
              { id: "anklets", label: "Anklets", href: "/shop?category=jewellery&subCategory=anklets" },
              { id: "bracelets", label: "Bracelets", href: "/shop?category=jewellery&subCategory=bracelets" },
              { id: "rings", label: "Rings", href: "/shop?category=jewellery&subCategory=rings" },
              { id: "earrings", label: "Earrings", href: "/shop?category=jewellery&subCategory=earrings" },
              { id: "new", label: "New Arrivals", href: "/shop?category=jewellery&sort=new" },
            ],
          },
          {
            id: "metal",
            title: "Shop by Metal",
            links: [
              { id: "yellow-gold", label: "Yellow Gold", href: "/shop?category=jewellery&metal=yellow-gold" },
              { id: "rose-gold", label: "Rose Gold", href: "/shop?category=jewellery&metal=rose-gold" },
              { id: "sterling-silver", label: "Sterling Silver", href: "/shop?category=jewellery&metal=sterling-silver" },
              { id: "gold-vermeil", label: "Gold Vermeil", href: "/shop?category=jewellery&metal=gold-vermeil" },
            ],
          },
        ],
        featured: {
          title: "Everyday Gold",
          subtitle: "Vermeil and solid gold layers, made to never come off",
          image: unsplash("photo-1611652022419-a9419f74343d", 1400),
          href: "/shop?category=jewellery&metal=yellow-gold",
        },
      },
      {
        id: "bags",
        key: "bags",
        label: "Bags",
        href: "/shop?category=bags",
        columns: [
          {
            id: "style",
            title: "Shop by Style",
            links: [
              { id: "totes", label: "Totes", href: "/shop?category=bags&subCategory=totes" },
              { id: "shoulder", label: "Shoulder Bags", href: "/shop?category=bags&subCategory=shoulder-bags" },
              { id: "crossbody", label: "Crossbody Bags", href: "/shop?category=bags&subCategory=crossbody-bags" },
              { id: "clutches", label: "Clutches", href: "/shop?category=bags&subCategory=clutches" },
              { id: "new", label: "New Arrivals", href: "/shop?category=bags&sort=new" },
            ],
          },
          {
            id: "material",
            title: "Shop by Material",
            links: [
              { id: "leather", label: "Full-Grain Leather", href: "/shop?category=bags&bagMaterial=full-grain-leather" },
              { id: "suede", label: "Suede", href: "/shop?category=bags&bagMaterial=suede" },
              { id: "canvas", label: "Canvas", href: "/shop?category=bags&bagMaterial=canvas" },
              { id: "raffia", label: "Raffia", href: "/shop?category=bags&bagMaterial=raffia" },
            ],
          },
        ],
        featured: {
          title: "Carry Everything",
          subtitle: "Structured leather with gold hardware",
          image: unsplash("photo-1594223274512-ad4803739b7c", 1000),
          href: "/shop?category=bags",
        },
      },
    ],
  },

  "layout.footer": {
    label: "Footer",
    description: "The blurb under the logo and the link columns beside it.",
    kind: "group",
    fields: [
      { key: "blurb", label: "Blurb", type: "textarea", required: true },
      {
        key: "columns",
        label: "Link columns",
        type: "list",
        itemLabel: "Column",
        itemTitle: "title",
        fields: [
          { key: "title", label: "Column heading", type: "text", required: true },
          { key: "links", label: "Links", type: "list", itemLabel: "Link", itemTitle: "label", fields: linkFields },
        ],
      },
      {
        key: "tagline",
        label: "Tagline",
        type: "text",
        help: "The gold line above the copyright.",
      },
    ],
    defaults: {
      blurb:
        "Curated eyewear, jewellery and bags for the woman who wants to express herself with confidence, sophistication and individuality.",
      tagline: "Created with purpose · Worn with confidence · Inspired by legacy",
      columns: [
        {
          id: "shop",
          title: "Shop",
          links: [
            { id: "eyewear", label: "Eyewear", href: "/shop?category=eyewear" },
            { id: "jewellery", label: "Jewellery", href: "/shop?category=jewellery" },
            { id: "bags", label: "Bags", href: "/shop?category=bags" },
            { id: "new", label: "New Arrivals", href: "/shop?sort=new" },
            { id: "best", label: "Best Sellers", href: "/shop?sort=bestseller" },
          ],
        },
        {
          id: "support",
          title: "Support",
          links: [
            // These four used to be /contact, /shipping, /size-guide and
            // /account/orders — none of which existed, so every one returned a
            // 404 from the footer of every page. They now point at pages that
            // are real, and that a worried customer is actually looking for.
            { id: "returns", label: "Returns & Refunds", href: "/returns" },
            { id: "terms", label: "Terms of Sale", href: "/terms" },
            { id: "privacy", label: "Privacy Notice", href: "/privacy" },
          ],
        },
        {
          id: "house",
          title: "The House",
          links: [
            { id: "ethos", label: "Our Ethos", href: "/ethos" },
            { id: "stand-for", label: "What We Stand For", href: "/ethos" },
          ],
        },
      ],
    },
  },

  "page.ethos": {
    label: "Ethos page",
    description:
      "The founder's own words. This is brand copy the owner wrote, not marketing filler — edit it carefully.",
    kind: "group",
    fields: [
      { key: "headline", label: "Headline", type: "text", required: true },
      { key: "intro", label: "Introduction", type: "textarea", required: true },
      { key: "image", label: "Photograph", type: "image" },
      { key: "valuesHeading", label: "Values heading", type: "text", required: true },
      {
        key: "values",
        label: "What we stand for",
        type: "list",
        itemLabel: "Value",
        itemTitle: "title",
        fields: [
          { key: "title", label: "Value", type: "text", required: true },
          { key: "body", label: "Description", type: "textarea", required: true },
        ],
      },
      {
        key: "beliefs",
        label: "Our belief",
        type: "list",
        itemLabel: "Line",
        itemTitle: "text",
        fields: [{ key: "text", label: "Line", type: "textarea", required: true }],
      },
      { key: "founderQuote", label: "Founder's quote", type: "textarea" },
      { key: "promise", label: "Our promise", type: "textarea", required: true },
      { key: "promiseBody", label: "Promise, continued", type: "textarea" },
    ],
    defaults: {
      headline: "Born from loss, created from love.",
      intro:
        "We believe that style is personal, confidence is powerful, and elegance should never require compromise. From our sunglasses and optical frames to our jewellery and future collections, every piece is thoughtfully selected for the woman who wants to express herself with confidence, sophistication and individuality.",
      image: "/images/brand/ethos-image.jpeg",
      valuesHeading: "Six things we will not compromise on.",
      values: [
        {
          id: "legacy",
          title: "Legacy",
          body: "We honour where we come from while creating something meaningful for the future.",
        },
        {
          id: "elegance",
          title: "Elegance",
          body: "We believe true elegance is timeless. It is found in simplicity, confidence and the way you carry yourself.",
        },
        {
          id: "individuality",
          title: "Individuality",
          body: "Your style should speak before you do. We encourage every woman to embrace what makes her different.",
        },
        {
          id: "confidence",
          title: "Confidence",
          body: "Jules & Co. is designed for women who know that looking good is not vanity — it is a form of self-expression.",
        },
        {
          id: "affordability",
          title: "Affordability",
          body: "Luxury should feel attainable. We strive to offer pieces that look sophisticated, feel special and remain accessible.",
        },
        {
          id: "purpose",
          title: "Purpose",
          body: "Every brand should stand for something bigger than what it sells. For Jules & Co., that purpose is to turn inspiration into something tangible and lasting.",
        },
      ],
      beliefs: [
        { id: "b1", text: "We believe that beauty can emerge from the hardest seasons of life." },
        { id: "b2", text: "We believe that grief can coexist with growth." },
        { id: "b3", text: "We believe that a legacy can begin with a single idea." },
        {
          id: "b4",
          text: "And we believe that sometimes, the most beautiful chapters of our lives are written after the chapters we never wanted to end.",
        },
      ],
      founderQuote:
        "Jules & Co. is my reminder that from loss can come purpose, from memories can come inspiration, and from love can come something that lives on.",
      promise:
        "To create pieces that make you feel seen, confident and beautifully yourself.",
      promiseBody:
        "Because Jules & Co. isn’t simply about what you wear. It is about who you become when you wear it.",
    },
  },

  "page.privacy": {
    label: "Privacy notice",
    description:
      "What you collect, why, and who else sees it. Ghana's Data Protection Act, 2012 (Act 843) requires you to tell people this. **Have this checked before you trade on it.** The wording describes how this shop actually works and is a starting point, not legal advice — and anywhere it says [YOUR ...] or [CONFIRM ...] you must supply your own details.",
    kind: "group",
    fields: policyFields,
    defaults: {
      headline: "Privacy Notice",
      intro:
        "This notice explains what personal information JULES & CO collects when you shop with us, why we need it, and who else handles it. It is short and specific on purpose: a privacy notice nobody can read protects nobody.",
      updated: "Last reviewed: [DATE]",
      sections: [
        {
          id: "who-we-are",
          heading: "Who we are",
          body:
            "JULES & CO is operated by [YOUR REGISTERED BUSINESS NAME], registered in Ghana at [YOUR REGISTERED ADDRESS]. We are the data controller for the information described here, and you can reach us using the contact details at the bottom of every page.",
        },
        {
          id: "what-we-collect",
          heading: "What we collect",
          body:
            "When you place an order we collect your name, email address, phone number and delivery address. That is all we ask for, and all of it is needed to send you what you bought and to tell you where it is.\n\nIf you write a product review we store the name you give and your email address. Your email is never published — it is only used to check whether you actually bought the piece you are reviewing.\n\nWe do not require an account, so unless you order or review, we hold nothing about you at all.",
        },
        {
          id: "payment",
          heading: "We never hold your payment details",
          body:
            "Payments are taken by Paystack, not by this website. Your card number or mobile money details are entered on Paystack's own secure page and never reach our systems. We receive only a confirmation that a payment succeeded, the amount, and which method was used.",
        },
        {
          id: "who-else",
          heading: "Who else handles your information",
          body:
            "A small number of services run the shop, and each sees only what it needs.\n\nPaystack processes your payment. Resend sends your order emails. MongoDB Atlas stores orders and reviews. Cloudinary stores product photographs and our encrypted database backups.\n\nWe do not sell your information to anyone, and we do not share it for advertising.",
        },
        {
          id: "how-long",
          heading: "How long we keep it",
          body:
            "Orders are kept as our record of trading, which we are required to maintain. Reviews are kept while they are published. Encrypted backups are kept on a rolling basis and older ones are deleted automatically.\n\nIf you want your details removed, write to us and we will do it — except where we must keep an order as a financial record.",
        },
        {
          id: "your-rights",
          heading: "Your rights",
          body:
            "Under the Data Protection Act, 2012 (Act 843) you may ask what we hold about you, ask us to correct it if it is wrong, and ask us to delete it. Write to us using the contact details below and we will respond.\n\nYou may also complain to the Data Protection Commission of Ghana.",
        },
        {
          id: "cookies",
          heading: "Cookies and your browser",
          body:
            "This site keeps your shopping bag and saved pieces in your own browser, so they are still there when you come back. That stays on your device and is never sent to us.\n\nIf you sign in to the shop's dashboard a secure cookie keeps you signed in, but that is for us, not for customers.\n\n[Keep this paragraph only if you have switched Google Analytics on, and delete it otherwise.] We use Google Analytics to count visits and see which pieces people look at, so we know what to stock. It sets its own cookies and reports on visits in aggregate, not on you by name.",
        },
      ],
    },
  },

  "page.returns": {
    label: "Returns & refunds",
    description:
      "What happens when something arrives damaged or is not what the customer expected. Paystack and the card networks both expect this published, and its absence is a common reason a chargeback is decided against a merchant. **Have this checked before you trade on it.** The wording describes how this shop actually works and is a starting point, not legal advice — and anywhere it says [YOUR ...] or [CONFIRM ...] you must supply your own details.",
    kind: "group",
    fields: policyFields,
    defaults: {
      headline: "Returns & Refunds",
      intro:
        "We want you to love what you bought. If something is not right, tell us — we would far rather hear from you than not.",
      updated: "Last reviewed: [DATE]",
      sections: [
        {
          id: "damaged",
          heading: "If it arrives damaged, or is not what you ordered",
          body:
            "Contact us within 3 days of delivery with your order number and a photograph. We will replace the piece or refund you in full, including any delivery you paid. This is always our cost, never yours.",
        },
        {
          id: "changed-mind",
          heading: "If you change your mind",
          body:
            "Write to us within 3 days of delivery. The piece must be unworn, undamaged and in its original packaging. Once we have it back and have checked it, we will refund the price of the piece.\n\n[CONFIRM: who pays return delivery in this case — you or the customer.]",
        },
        {
          id: "exceptions",
          heading: "What we cannot take back",
          body:
            "For hygiene reasons we cannot accept pierced earrings back once the packaging has been opened, unless they are faulty.\n\n[CONFIRM: add anything else you will not accept back — pieces made or engraved to order, for example.]",
        },
        {
          id: "how-to",
          heading: "How to start a return",
          body:
            "Reply to your order email, or use the contact details at the bottom of any page, and give us your order number. We will tell you where to send the piece and what happens next.\n\nPlease speak to us before sending anything back.",
        },
        {
          id: "refunds",
          heading: "How refunds are paid",
          body:
            "Refunds go back to the same card or mobile money account that paid, through Paystack. Once approved, a refund usually reaches you within [CONFIRM: 5–10] working days depending on your bank or network.\n\nIf we cancel an order you have already paid for, we will contact you about the refund without you having to ask.",
        },
      ],
    },
  },

  "page.terms": {
    label: "Terms of sale",
    description:
      "The agreement between you and the customer. It matters more here than in most shops, because delivery is agreed after the order rather than priced at checkout. **Have this checked before you trade on it.** The wording describes how this shop actually works and is a starting point, not legal advice — and anywhere it says [YOUR ...] or [CONFIRM ...] you must supply your own details.",
    kind: "group",
    fields: policyFields,
    defaults: {
      headline: "Terms of Sale",
      intro:
        "These terms apply when you buy from JULES & CO. They are written plainly on purpose — you should be able to read them.",
      updated: "Last reviewed: [DATE]",
      sections: [
        {
          id: "who",
          heading: "Who you are buying from",
          body:
            "JULES & CO is operated by [YOUR REGISTERED BUSINESS NAME], registered in Ghana at [YOUR REGISTERED ADDRESS]. [YOUR REGISTRATION NUMBER, if you have one.]",
        },
        {
          id: "order",
          heading: "How an order is made",
          body:
            "Placing an order is an offer to buy. We hold the pieces for you while you pay, but the sale is agreed only once we confirm your order — you will get an email when we do.\n\nIf a piece turns out to be unavailable after you have paid, we will tell you and refund you in full.",
        },
        {
          id: "prices",
          heading: "Prices",
          body:
            "All prices are in Ghana Cedis and include any tax that applies. The price you see at checkout is the price of the pieces themselves.",
        },
        {
          id: "delivery",
          heading: "Delivery is agreed with you, not charged automatically",
          body:
            "What delivery costs depends on where your order is going, so we do not add a charge at checkout. After we confirm your order we agree the cost with you, and nothing is dispatched before you have agreed it.\n\nThis means the total shown at checkout is for the pieces alone.",
        },
        {
          id: "payment",
          heading: "Payment",
          body:
            "Payment is taken by Paystack, which accepts mobile money and cards. Your payment details are entered on Paystack's own page and are never held by us.\n\nAn order that is not paid for is cancelled automatically after a time, and the pieces go back on sale.",
        },
        {
          id: "cancelling",
          heading: "Cancelling",
          body:
            "You may cancel before your order has been dispatched — write to us and we will refund you in full. After dispatch, our Returns & Refunds policy applies.\n\nWe may cancel an order if a piece is unavailable, if we cannot agree delivery with you, or if we believe the order is fraudulent. If we do, we will tell you and refund anything you have paid.",
        },
        {
          id: "law",
          heading: "Governing law",
          body: "These terms are governed by the laws of Ghana.",
        },
      ],
    },
  },

  "product.assurances": {
    label: "Product page assurances",
    description:
      "The short reassurances under the Add to Bag button, on every product page. **Only promise what the shop actually does** — these shipped hardcoded, and claimed complimentary shipping over GH₵1,000 and 30-day returns, neither of which was true.",
    kind: "list",
    itemLabel: "Assurance",
    itemTitle: "text",
    fields: [
      {
        key: "icon",
        label: "Icon",
        type: "select",
        options: [
          { value: "truck", label: "Delivery" },
          { value: "returns", label: "Returns" },
          { value: "shield", label: "Guarantee" },
          { value: "sparkle", label: "Quality" },
        ],
        default: "truck",
      },
      { key: "text", label: "Text", type: "text", required: true },
    ],
    /**
     * Defaults that are true whatever the owner later decides.
     *
     * Delivery is agreed after confirmation rather than priced at checkout, so
     * the line says exactly that. Returns point at the policy rather than
     * naming a number that would then have to be kept in step with it.
     */
    defaults: [
      {
        id: "a1",
        icon: "truck",
        text: "Free shipping on orders over GH₵700",
      },
      {
        id: "a2",
        icon: "returns",
        text: "3-day returns",
      },
    ],
  },

  "store.delivery": {
    label: "Delivery",
    group: "settings",
    description:
      "What customers are told about delivery at checkout. There is no price here on purpose: what delivery costs depends on where a piece is going, and it is agreed with the customer once the order is confirmed. The charge is recorded against the order itself, on the Orders page.",
    kind: "group",
    fields: [
      {
        key: "checkoutNote",
        label: "Message at checkout",
        type: "textarea",
        required: true,
        help: "Shown where a delivery total would otherwise be, so nobody is left wondering what it will cost.",
      },
    ],
    defaults: {
      checkoutNote:
        "Orders over GH₵700 ship free. Below that, delivery is arranged with you once your order is confirmed — we will be in touch with the cost before anything is dispatched.",
    },
  },

  "store.contact": {
    label: "Contact & social",
    group: "settings",
    description:
      "How customers reach the house. Anything left blank is simply not shown — the footer's social icons used to be drawn whether or not there was an account behind them.",
    kind: "group",
    fields: [
      { key: "email", label: "Email", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      {
        key: "whatsapp",
        label: "WhatsApp number",
        type: "text",
        help: 'With country code. Spaces and a leading + are fine — the floating button strips them, so "+233 24 659 8404" and "233246598404" both work.',
      },
      { key: "address", label: "Address", type: "textarea" },
      { key: "instagram", label: "Instagram URL", type: "url" },
      { key: "tiktok", label: "TikTok URL", type: "url" },
    ],
    defaults: {
      email: "",
      phone: "",
      whatsapp: "+233 24 659 8404",
      address: "",
      instagram: "https://instagram.com",
      tiktok: "https://tiktok.com",
    },
  },

  "site.seo": {
    label: "Search & sharing",
    description:
      "The title and description search engines show, and the image that appears when someone shares a link.",
    kind: "group",
    fields: [
      { key: "title", label: "Site title", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea", required: true },
      { key: "ogImage", label: "Share image", type: "image" },
    ],
    defaults: {
      title: "JULES & CO — Wear the Difference",
      description:
        "Curated eyewear, jewellery and bags for the woman who wants to express herself with confidence, sophistication and individuality. Born from loss, created from love.",
      ogImage: "/images/brand/og-image.jpg",
    },
  },
};

const SLOT_KEYS = Object.keys(SLOTS);

function isSlot(slot) {
  return Object.prototype.hasOwnProperty.call(SLOTS, slot);
}

/** Stable enough for content rows, and readable in the database. */
function generateId(prefix = "item") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Hosts next/image is allowed to load, mirroring `images.remotePatterns` in
 * frontend/next.config.js. **Keep the two in step.**
 *
 * This matters more here than anywhere else: content images are typed into the
 * admin, and next/image *throws* on an unconfigured host rather than falling
 * back — which takes down the whole page, not just the picture. Refusing the
 * save turns a broken homepage into a sentence explaining what to do instead.
 */
const ALLOWED_IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "picsum.photos",
  "res.cloudinary.com",
]);

function assertRenderableImage(value, where) {
  // A path into the site's own public folder, e.g. /images/hero/jules-hero.jpg.
  if (value.startsWith("/")) return;

  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${where} must be a full https:// address or a path starting with /`);
  }

  if (url.protocol !== "https:") {
    fail(`${where} must be served over https`);
  }

  if (!ALLOWED_IMAGE_HOSTS.has(url.hostname)) {
    fail(
      `${where}: images cannot be loaded from ${url.hostname}. Upload the picture here instead, or use one of: ${[...ALLOWED_IMAGE_HOSTS].join(", ")}`
    );
  }
}

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

/**
 * Coerces one value against its field spec, throwing on anything a field
 * declares as required. Recursive, so a list of columns of links validates in
 * the same pass as a headline.
 */
function normaliseValue(field, value, path) {
  const where = path.join(" › ");

  if (field.type === "list") {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) fail(`${where} must be a list`);
    return value.map((item, i) => normaliseFields(field.fields, item, [...path, `#${i + 1}`], field.key));
  }

  if (field.type === "group") {
    return normaliseFields(field.fields, value || {}, [...path], field.key);
  }

  if (field.type === "boolean") {
    if (value === undefined) return field.default ?? false;
    return Boolean(value);
  }

  /**
   * Numbers are settled before the text handling below, which would otherwise
   * turn a blank into "" and store a quantity as a string — and a shipping
   * threshold has to come back as a number to be compared against a subtotal.
   */
  if (field.type === "number") {
    if (value === undefined || value === null || value === "") {
      if (field.required) fail(`${where} is required`);
      return field.default ?? 0;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) fail(`${where} must be a number`);
    if (field.min !== undefined && n < field.min) fail(`${where} cannot be below ${field.min}`);
    if (field.max !== undefined && n > field.max) fail(`${where} cannot be above ${field.max}`);
    return n;
  }

  const text = value === undefined || value === null ? "" : String(value).trim();

  if (!text) {
    if (field.required) fail(`${where} is required`);
    return field.default !== undefined && value === undefined ? field.default : "";
  }

  if (field.type === "select" && field.options) {
    const allowed = field.options.map((o) => o.value);
    if (!allowed.includes(text)) fail(`${where} must be one of: ${allowed.join(", ")}`);
  }

  if (field.type === "image") assertRenderableImage(text, where);

  return text;
}

function normaliseFields(fields, input, path, idPrefix) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    fail(`${path.join(" › ") || "Content"} must be an object`);
  }

  // Rows keep an id so the admin can reorder and delete them without the list
  // index becoming the identity — which breaks the moment anything moves.
  const out = { id: String(input.id || generateId(idPrefix)) };

  fields.forEach((field) => {
    out[field.key] = normaliseValue(field, input[field.key], [...path, field.label]);
  });

  return out;
}

/** Validates and cleans a whole slot payload. Throws a 400-tagged error. */
function normaliseSlotData(slot, data) {
  if (!isSlot(slot)) fail(`"${slot}" is not a content slot`);
  const spec = SLOTS[slot];

  if (spec.kind === "list") {
    if (!Array.isArray(data)) fail(`${spec.label} must be a list`);
    return data.map((item, i) =>
      normaliseFields(spec.fields, item, [`${spec.itemLabel} ${i + 1}`], spec.itemLabel.toLowerCase())
    );
  }

  const normalised = normaliseFields(spec.fields, data || {}, [], slot);
  // A group is a single record; its generated id carries no meaning.
  delete normalised.id;
  return normalised;
}

/** What the admin needs to draw the editors — shape only, no content. */
function slotDescriptors() {
  return SLOT_KEYS.map((slot) => ({
    slot,
    label: SLOTS[slot].label,
    description: SLOTS[slot].description,
    // Content is what the storefront says; settings are how the shop runs.
    // They live in one collection but belong on different admin screens.
    group: SLOTS[slot].group || "content",
    kind: SLOTS[slot].kind,
    itemLabel: SLOTS[slot].itemLabel,
    itemTitle: SLOTS[slot].itemTitle,
    fields: SLOTS[slot].fields,
  }));
}

function defaultsFor(slot) {
  // Deep clone: callers persist and mutate these, and a shared reference would
  // let one edit leak into every later read in the same process.
  return JSON.parse(JSON.stringify(SLOTS[slot].defaults));
}

module.exports = {
  SLOTS,
  SLOT_KEYS,
  isSlot,
  normaliseSlotData,
  slotDescriptors,
  defaultsFor,
};
