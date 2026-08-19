/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
