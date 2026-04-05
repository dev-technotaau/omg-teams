import Script from "next/script";
import { env } from "@/lib/env";

// ──────────────────────────────────────────────
//  Google Tag Manager
//  Head script + body noscript iframe.
// ──────────────────────────────────────────────

export function GTMScript() {
  if (!env.hasGTM) return null;
  const id = env.GTM_ID;

  return (
    <Script id="gtm-init" strategy="afterInteractive">
      {`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${id}');
      `}
    </Script>
  );
}

export function GTMNoScript() {
  if (!env.hasGTM) return null;
  const id = env.GTM_ID;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${id}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
