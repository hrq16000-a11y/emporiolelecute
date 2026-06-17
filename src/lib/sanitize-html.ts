import DOMPurify from "dompurify";

/**
 * Sanitizes admin-authored HTML (blog posts, institutional pages) before it is
 * rendered with `dangerouslySetInnerHTML`. Removes scripts and inline event
 * handlers (e.g. `onerror`) while preserving normal rich-text markup so a
 * compromised admin account cannot inject executable JavaScript into the
 * public site.
 */
export const sanitizeHtml = (dirty: string | null | undefined): string => {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["style"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
};
