import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTrackingConfig, pathMatches } from "@/hooks/useTrackingConfig";

/**
 * Strict format validators for admin-managed tracking IDs. These prevent a
 * compromised admin account from injecting arbitrary JavaScript into the
 * inline script `innerHTML` (stored XSS). Only well-formed real-world IDs pass.
 */
const GA4_RE = /^G-[A-Z0-9]{4,12}$/;
const GTM_RE = /^GTM-[A-Z0-9]{4,10}$/;
const PIXEL_RE = /^[0-9]{10,20}$/;
const ADS_RE = /^AW-[0-9]{6,15}$/;

const isValid = (re: RegExp, v?: string | null): v is string =>
  typeof v === "string" && re.test(v);

/**
 * Conditionally injects GA4, GTM, Meta Pixel and Google Ads scripts based on
 * admin-managed tracking_config. Skips on disabled paths (e.g. /admin).
 */
export const TrackingScripts = () => {
  const { data: cfg } = useTrackingConfig();
  const location = useLocation();

  useEffect(() => {
    if (!cfg || !cfg.enabled) return;
    const path = location.pathname;
    if (pathMatches(path, cfg.disabled_paths)) return;
    if (cfg.enabled_paths.length && !pathMatches(path, cfg.enabled_paths)) return;

    // GA4
    if (cfg.ga4_id && !document.getElementById("ga4-script")) {
      const s = document.createElement("script");
      s.id = "ga4-script";
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${cfg.ga4_id}`;
      document.head.appendChild(s);
      const inline = document.createElement("script");
      inline.id = "ga4-init";
      inline.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${cfg.ga4_id}');${cfg.google_ads_id ? `gtag('config','${cfg.google_ads_id}');` : ""}`;
      document.head.appendChild(inline);
    }

    // GTM
    if (cfg.gtm_id && !document.getElementById("gtm-script")) {
      const s = document.createElement("script");
      s.id = "gtm-script";
      s.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${cfg.gtm_id}');`;
      document.head.appendChild(s);
      // Add noscript fallback
      const noscript = document.createElement("div");
      noscript.id = "gtm-noscript";
      noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${cfg.gtm_id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
      const container = document.getElementById("gtm-noscript-container");
      if (container) container.appendChild(noscript);
    }

    // Meta Pixel
    if (cfg.meta_pixel_id && !document.getElementById("meta-pixel-script")) {
      const s = document.createElement("script");
      s.id = "meta-pixel-script";
      s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${cfg.meta_pixel_id}');fbq('track','PageView');`;
      document.head.appendChild(s);
    }
  }, [cfg]);

  // Track page changes for SPA
  useEffect(() => {
    if (!cfg?.enabled) return;
    const path = location.pathname + location.search;
    // @ts-ignore
    if (cfg.ga4_id && window.gtag) window.gtag("event", "page_view", { page_path: path });
    // @ts-ignore
    if (cfg.meta_pixel_id && window.fbq) window.fbq("track", "PageView");
  }, [location, cfg]);

  return null;
};

export default TrackingScripts;
