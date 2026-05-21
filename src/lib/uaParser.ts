// Parser leve de User-Agent — detecta SO, navegador, dispositivo, marca/modelo aproximados.
// Sem dependências externas (mantém bundle pequeno).
export interface UAInfo {
  os_name?: string;
  os_version?: string;
  browser_name?: string;
  browser_version?: string;
  device_type?: "mobile" | "tablet" | "desktop" | "bot";
  device_brand?: string;
  device_model?: string;
}

export function parseUA(ua: string): UAInfo {
  if (!ua) return {};
  const out: UAInfo = {};
  const u = ua;

  // SO
  let m;
  if ((m = u.match(/Windows NT ([\d.]+)/))) { out.os_name = "Windows"; out.os_version = m[1]; }
  else if ((m = u.match(/Mac OS X ([\d_.]+)/))) { out.os_name = "macOS"; out.os_version = m[1].replace(/_/g, "."); }
  else if ((m = u.match(/Android ([\d.]+)/))) { out.os_name = "Android"; out.os_version = m[1]; }
  else if ((m = u.match(/(?:iPhone|iPad|iPod).+? OS ([\d_]+)/))) { out.os_name = "iOS"; out.os_version = m[1].replace(/_/g, "."); }
  else if (/Linux/.test(u)) out.os_name = "Linux";

  // Browser
  if ((m = u.match(/Edg\/([\d.]+)/))) { out.browser_name = "Edge"; out.browser_version = m[1]; }
  else if ((m = u.match(/OPR\/([\d.]+)/))) { out.browser_name = "Opera"; out.browser_version = m[1]; }
  else if ((m = u.match(/Chrome\/([\d.]+)/))) { out.browser_name = "Chrome"; out.browser_version = m[1]; }
  else if ((m = u.match(/Firefox\/([\d.]+)/))) { out.browser_name = "Firefox"; out.browser_version = m[1]; }
  else if ((m = u.match(/Version\/([\d.]+).*Safari/))) { out.browser_name = "Safari"; out.browser_version = m[1]; }

  // Bot
  if (/bot|crawl|spider|slurp|bingpreview|facebookexternalhit/i.test(u)) {
    out.device_type = "bot";
    return out;
  }

  // Tipo
  if (/iPad|Tablet/i.test(u)) out.device_type = "tablet";
  else if (/Mobile|Android|iPhone|iPod/i.test(u)) out.device_type = "mobile";
  else out.device_type = "desktop";

  // Marca/modelo (mobile)
  if ((m = u.match(/iPhone/))) { out.device_brand = "Apple"; out.device_model = "iPhone"; }
  else if ((m = u.match(/iPad/))) { out.device_brand = "Apple"; out.device_model = "iPad"; }
  else if ((m = u.match(/;\s*([A-Z]{2,}[-\w ]+)\s+Build/))) { out.device_model = m[1].trim(); }
  else if ((m = u.match(/Android.*?;\s*([^)]+?)(?:\s+Build|\))/))) {
    const raw = m[1].trim();
    out.device_model = raw;
    if (/SM-|Galaxy/i.test(raw)) out.device_brand = "Samsung";
    else if (/Pixel/i.test(raw)) out.device_brand = "Google";
    else if (/Moto|XT\d+/i.test(raw)) out.device_brand = "Motorola";
    else if (/Redmi|Xiaomi|Mi /i.test(raw)) out.device_brand = "Xiaomi";
    else if (/Huawei|HUAWEI/i.test(raw)) out.device_brand = "Huawei";
    else if (/LG-/i.test(raw)) out.device_brand = "LG";
    else if (/ASUS/i.test(raw)) out.device_brand = "Asus";
  }

  return out;
}
