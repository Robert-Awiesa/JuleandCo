/**
 * Render's `fromService … property: host` yields a bare hostname with no
 * scheme, which is neither a valid fetch target nor a valid CORS origin.
 * Accept it either way rather than depending on whoever sets the variable
 * remembering to prefix it.
 */
function normaliseOrigin(value) {
  if (!value) return "";
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Where the build output goes. `.next` unless told otherwise.
   *
   * A production build is the only check that exercises prerendering — it has
   * caught a broken page that tsc, ESLint and both test suites all passed — but
   * it writes to the same directory a running dev server is serving from, so
   * verifying the build meant breaking whoever was using the site. Setting
   * NEXT_DIST_DIR sends a verification build somewhere harmless instead.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  /**
   * Proxy the API through this app so the browser only ever talks to one origin.
   *
   * The auth cookie is set by the API and read back by frontend/middleware.ts to
   * guard /admin/*. Deployed as two separate services those are different hosts,
   * so the browser would never send the cookie to the frontend and every admin
   * route would bounce to login. onrender.com is on the Public Suffix List, so a
   * shared parent-domain cookie is not available either.
   *
   * Routing browser traffic through /api makes it same-origin, which also means
   * CORS stops mattering and the API host is not exposed to the client.
   *
   * API_ORIGIN is unset locally, where the browser talks to :5000 directly.
   */
  async rewrites() {
    const origin = normaliseOrigin(process.env.API_ORIGIN);
    if (!origin) return [];
    return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        // Where the admin dashboard's ImageUploader puts every product photo.
        // Without this, next/image throws on any admin-created product and
        // takes the whole page down — the seeded products use picsum, so the
        // gap only shows once someone adds a real product.
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

module.exports = nextConfig;
