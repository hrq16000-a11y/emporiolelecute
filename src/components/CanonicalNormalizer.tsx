import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Normalizes URLs for SEO consistency:
 *  - strips trailing slash (except root)
 *  - removes known tracking params (utm_*, fbclid, gclid, msclkid, mc_cid, mc_eid, ref, _ga)
 *  - lowercases the pathname for case-insensitive routes
 *
 * Uses a 301-equivalent client-side replace (no history entry) and updates
 * the <link rel="canonical"> tag to match the cleaned URL.
 */
const TRACKING_PARAMS = [
  "fbclid", "gclid", "msclkid", "mc_cid", "mc_eid", "ref", "_ga", "yclid",
];

const ORIGIN = "https://emporiolelecute.com.br";

function cleanSearch(search: string): string {
  if (!search) return "";
  const params = new URLSearchParams(search);
  const toDelete: string[] = [];
  params.forEach((_v, k) => {
    if (k.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.includes(k.toLowerCase())) {
      toDelete.push(k);
    }
  });
  toDelete.forEach((k) => params.delete(k));
  const out = params.toString();
  return out ? `?${out}` : "";
}

function cleanPath(pathname: string): string {
  let p = pathname;
  // skip admin/api
  if (p.startsWith("/admin")) return p;
  // lowercase
  p = p.toLowerCase();
  // strip trailing slash (except root)
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "");
  return p;
}

function setCanonical(url: string) {
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'),
  );
  // Helmet (data-rh="true") é a fonte de verdade quando presente:
  // mantemos apenas UM canonical por página para não confundir crawlers.
  const helmetLink = links.find((l) => l.dataset.rh === "true");
  if (helmetLink) {
    links.filter((l) => l !== helmetLink).forEach((l) => l.remove());
    return;
  }
  let link = links[0];
  links.slice(1).forEach((l) => l.remove());
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}


export default function CanonicalNormalizer() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const cleanedPath = cleanPath(location.pathname);
    const cleanedSearch = cleanSearch(location.search);
    const needsRedirect =
      cleanedPath !== location.pathname || cleanedSearch !== location.search;

    if (needsRedirect) {
      navigate(`${cleanedPath}${cleanedSearch}${location.hash}`, { replace: true });
      return;
    }

    setCanonical(`${ORIGIN}${cleanedPath}`);
    // Helmet injeta o canonical da rota logo após a montagem; roda de novo
    // para eliminar qualquer duplicata remanescente.
    const t = window.setTimeout(() => setCanonical(`${ORIGIN}${cleanedPath}`), 400);
    return () => window.clearTimeout(t);
  }, [location.pathname, location.search, location.hash, navigate]);


  return null;
}
