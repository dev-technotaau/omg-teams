import Script from "next/script";
import { env } from "@/lib/env";

// ──────────────────────────────────────────────
//  Google Analytics 4 (gtag.js)
//  Loads asynchronously, sends page_view automatically.
// ──────────────────────────────────────────────

export function GoogleAnalytics() {
  if (!env.hasGA) return null;
  const id = env.GA_MEASUREMENT_ID;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}', {
            page_path: window.location.pathname,
            send_page_view: true
          });
        `}
      </Script>
    </>
  );
}
