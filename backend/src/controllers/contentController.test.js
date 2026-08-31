const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const SiteContent = require("../models/SiteContent");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");
const { seedCatalogConfig, seedVocabulary } = require("../test/catalogFixtures");
const { SLOT_KEYS, normaliseSlotData, defaultsFor } = require("../utils/contentSlots");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  await connectTestDB();
});
afterEach(async () => {
  await clearTestDB();
});
afterAll(async () => {
  await closeTestDB();
});

async function adminToken() {
  const admin = await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });
  return jwt.sign({ id: admin._id, role: "admin" }, process.env.JWT_SECRET);
}

const asAdmin = (req, token) => req.set("Cookie", [`token=${token}`]);

describe("reading content", () => {
  test("an untouched database still returns the whole site", async () => {
    const res = await request(app).get("/api/content");

    expect(res.status).toBe(200);
    // The defaults are the values that were hardcoded in the frontend, so
    // shipping this cannot blank the homepage.
    expect(Object.keys(res.body).sort()).toEqual([...SLOT_KEYS].sort());
    // Compared against the defaults themselves rather than a hardcoded count,
    // which went stale the first time a hero slide was added.
    expect(res.body["hero.slides"]).toHaveLength(defaultsFor("hero.slides").length);
    expect(res.body["site.seo"].title).toMatch(/JULES & CO/);
  });

  test("a saved slot wins over its default", async () => {
    await SiteContent.create({
      slot: "site.seo",
      data: { title: "Edited", description: "Edited too", ogImage: "" },
    });

    const res = await request(app).get("/api/content");
    expect(res.body["site.seo"].title).toBe("Edited");
    // Untouched slots still come back. Asserted against the hero rather than
    // the testimonials, which ship empty on purpose — nobody's words go on the
    // homepage until someone has actually said them.
    expect(res.body["hero.slides"]).toHaveLength(defaultsFor("hero.slides").length);
    expect(res.body["hero.slides"].length).toBeGreaterThan(0);
  });

  test("a single slot can be read on its own", async () => {
    const res = await request(app).get("/api/content/home.collections");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
  });

  test("an unknown slot is a 404, not an empty success", async () => {
    const res = await request(app).get("/api/content/home.nonsense");
    expect(res.status).toBe(404);
  });
});

describe("writing content", () => {
  test("an admin can replace a slot", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).put("/api/content/home.testimonials"), token).send({
      data: [{ quote: "Wonderful.", author: "Ama K.", role: "Accra" }],
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].author).toBe("Ama K.");
    // An id is assigned so reordering and deleting do not depend on position.
    expect(res.body.data[0].id).toBeTruthy();
  });

  test("the storefront sees the edit immediately", async () => {
    const token = await adminToken();
    await asAdmin(request(app).put("/api/content/site.seo"), token).send({
      data: { title: "New Title", description: "New description", ogImage: "" },
    });

    const publicRead = await request(app).get("/api/content");
    expect(publicRead.body["site.seo"].title).toBe("New Title");
  });

  test("a missing required field is refused, naming the field", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).put("/api/content/home.testimonials"), token).send({
      data: [{ quote: "No name given.", role: "Accra" }],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/client name/i);
  });

  test("an invalid select value is refused", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).put("/api/content/home.collections"), token).send({
      data: [
        {
          title: "Tile",
          subtitle: "Sub",
          // A permitted host, so the span is what fails and not the image.
          image: "https://picsum.photos/seed/a/900/1125",
          href: "/shop",
          span: "enormous",
        },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Tile size/i);
  });

  test("writes are admin-only", async () => {
    const res = await request(app).put("/api/content/site.seo").send({ data: { title: "x" } });
    expect(res.status).toBe(401);
  });

  test("clearing a list actually clears it", async () => {
    const token = await adminToken();
    await asAdmin(request(app).put("/api/content/home.testimonials"), token).send({ data: [] });

    const res = await request(app).get("/api/content/home.testimonials");
    // Not the four defaults: an empty list is a decision, and minimize:false is
    // what stops Mongoose dropping it and leaving the old content in place.
    expect(res.body.data).toEqual([]);
  });

  test("resetting a slot returns it to the built-in content", async () => {
    const token = await adminToken();
    await asAdmin(request(app).put("/api/content/site.seo"), token).send({
      data: { title: "Temporary", description: "Temporary", ogImage: "" },
    });

    const reset = await asAdmin(request(app).delete("/api/content/site.seo"), token);
    expect(reset.status).toBe(200);

    const after = await request(app).get("/api/content/site.seo");
    expect(after.body.data.title).toBe(defaultsFor("site.seo").title);
    expect(await SiteContent.countDocuments({ slot: "site.seo" })).toBe(0);
  });
});

describe("the slot registry", () => {
  test("describes every slot for the admin, without leaking content", async () => {
    const token = await adminToken();
    const res = await asAdmin(request(app).get("/api/content/meta/slots"), token);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(SLOT_KEYS.length);
    expect(res.body[0]).toEqual(
      expect.objectContaining({ slot: expect.any(String), label: expect.any(String) })
    );
    // Never edited, so the storefront is on the built-in default.
    expect(res.body.every((d) => d.updatedAt === null)).toBe(true);
  });

  test("validates nested lists, not just the top level", () => {
    // A mega menu column whose link has no href: two levels down.
    expect(() =>
      normaliseSlotData("nav.megaMenu", [
        {
          key: "eyewear",
          label: "Eyewear",
          href: "/shop",
          columns: [{ title: "Shop by Shape", links: [{ label: "Aviator" }] }],
          featured: { title: "T", image: "https://picsum.photos/seed/b/900/1125", href: "/shop" },
        },
      ])
    ).toThrow(/link/i);
  });

  test("every slot's own defaults survive its validator", () => {
    // Guards against a default that could never be saved through the admin.
    SLOT_KEYS.forEach((slot) => {
      expect(() => normaliseSlotData(slot, defaultsFor(slot))).not.toThrow();
    });
  });
});

describe("image hosts", () => {
  test("an image from a host next/image cannot load is refused", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).put("/api/content/home.testimonials"), token).send({
      data: [
        { quote: "Lovely.", author: "Ama K.", role: "Accra", image: "https://evil.example.com/x.jpg" },
      ],
    });

    // next/image throws on an unconfigured host and takes the whole page down,
    // so this has to be caught at the save rather than by the storefront.
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/evil\.example\.com/);
    expect(res.body.message).toMatch(/res\.cloudinary\.com/);
  });

  test("an uploaded Cloudinary image is accepted", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).put("/api/content/home.testimonials"), token).send({
      data: [
        {
          quote: "Lovely.",
          author: "Ama K.",
          role: "Accra",
          image: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
        },
      ],
    });

    expect(res.status).toBe(200);
  });

  test("a path into the site's own public folder is accepted", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).put("/api/content/hero.slides"), token).send({
      data: [{ image: "/images/hero/jules-hero.jpg", headline: "Hello", alt: "Campaign" }],
    });

    expect(res.status).toBe(200);
  });

  test("http is refused — the site is served over https", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).put("/api/content/home.testimonials"), token).send({
      data: [
        { quote: "Lovely.", author: "Ama K.", role: "Accra", image: "http://picsum.photos/a.jpg" },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/https/);
  });
});

describe("menu links have to point at something", () => {
  beforeEach(async () => {
    // The validator checks links against real categories and vocabularies, so
    // both have to exist — a group with no options is not a smaller catalogue,
    // it is a different one.
    await seedCatalogConfig();
    await seedVocabulary();
  });

  function menu(links) {
    return [
      {
        key: "eyewear",
        label: "Eyewear",
        href: "/shop?category=eyewear",
        columns: [{ title: "Shop by Type", links }],
        featured: {
          title: "T",
          image: "https://picsum.photos/seed/a/900/1125",
          href: "/shop",
        },
      },
    ];
  }

  test("a mis-typed sub-category is refused, naming it", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).put("/api/content/nav.megaMenu"), token).send({
      data: menu([{ label: "Sunglases", href: "/shop?category=eyewear&subCategory=sunglases" }]),
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sunglases/);
  });

  test("an attribute that does not apply to the category is refused", async () => {
    const token = await adminToken();

    // Frame shape is an eyewear vocabulary; a jewellery link using it could
    // never return anything.
    const res = await asAdmin(request(app).put("/api/content/nav.megaMenu"), token).send({
      data: [
        {
          key: "jewellery",
          label: "Jewellery",
          href: "/shop?category=jewellery",
          columns: [
            {
              title: "Shop by Shape",
              links: [
                { label: "Aviator", href: "/shop?category=jewellery&frameShape=aviator" },
              ],
            },
          ],
          featured: { title: "T", image: "https://picsum.photos/seed/a/900/1125", href: "/shop" },
        },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not apply to Jewellery/i);
  });

  test("an unknown attribute value is refused", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).put("/api/content/nav.megaMenu"), token).send({
      data: menu([{ label: "Hexagonal", href: "/shop?category=eyewear&frameShape=hexagonal" }]),
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hexagonal/i);
  });

  test("a valid link with nothing behind it yet is allowed", async () => {
    const token = await adminToken();

    // The vocabulary exists and applies; there are simply no products carrying
    // it. Refusing this would stop a shop preparing a line before it launches.
    const res = await asAdmin(request(app).put("/api/content/nav.megaMenu"), token).send({
      data: menu([{ label: "Men", href: "/shop?category=eyewear&gender=mens" }]),
    });

    expect(res.status).toBe(200);
  });

  test("a sort link carries no filter and is left alone", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).put("/api/content/nav.megaMenu"), token).send({
      data: menu([{ label: "New Arrivals", href: "/shop?category=eyewear&sort=new" }]),
    });

    expect(res.status).toBe(200);
  });

  test("the built-in menu passes its own validator", async () => {
    const token = await adminToken();
    const { defaultsFor } = require("../utils/contentSlots");

    // Scoped to the categories this fixture models. The whole menu is checked
    // against the real vocabulary by the audit in backend/src/scripts — a
    // fixture covering every category would be a second copy of the seed.
    const eyewear = defaultsFor("nav.megaMenu").filter((s) => s.key === "eyewear");

    const res = await asAdmin(request(app).put("/api/content/nav.megaMenu"), token).send({
      data: eyewear,
    });

    // Guards against shipping a default menu that could not be saved.
    expect(res.status).toBe(200);
  });
});
