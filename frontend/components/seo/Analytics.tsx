import Script from "next/script";

/**
 * Google Analytics 4, and nothing at all without a measurement ID.
 *
 * Same reasoning as the mailer: unset, the shop works exactly as it does now
 * and simply measures nothing, so a developer machine and the test suites never
 * pollute the owner's figures.
 *
 * `NEXT_PUBLIC_GA_ID` is read at **build** time, like every NEXT_PUBLIC_
 * variable — setting it on Vercel needs a redeploy before it takes effect.
 *
 * Worth doing before launch rather than after: analytics history begins the day
 * it is installed and cannot be backfilled.
 */
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;

  return (
    <>
      {/* afterInteractive: measurement must not compete with the page itself. */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}
