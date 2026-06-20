import createDOMPurify from "dompurify";

const ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "ul", "ol", "li", "a", "span"];
const ALLOWED_ATTR = ["href", "target", "rel", "title", "class", "data-spoiler"];
const ALLOWED_CLASSES = new Set(["spoiler", "spoiler--revealed"]);

function normalizeHtml(html: string): string {
  return html.replace(/\sxmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, "");
}

function isValidHref(href: string): boolean {
  try {
    const url = new URL(href, "https://placeholder.local");
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function sanitizeHtml(dirty: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return normalizeHtml(dirty);
  }

  const purifier =
    typeof (createDOMPurify as unknown as { sanitize?: unknown }).sanitize === "function"
      ? (createDOMPurify as unknown as {
          sanitize: (input: string, options: Record<string, unknown>) => string;
        })
      : (createDOMPurify as unknown as (window: Window) => {
          sanitize: (input: string, options: Record<string, unknown>) => string;
        })(window);

  const clean = purifier.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
  });

  const doc = new DOMParser().parseFromString(clean, "text/html");

  doc.querySelectorAll("[class]").forEach((element) => {
    const kept = Array.from(element.classList).filter((className) =>
      ALLOWED_CLASSES.has(className),
    );

    if (kept.length > 0) {
      element.setAttribute("class", kept.join(" "));
    } else {
      element.removeAttribute("class");
    }
  });

  doc.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    if (!isValidHref(href)) {
      anchor.replaceWith(doc.createTextNode(anchor.textContent ?? ""));
      return;
    }

    if (href.startsWith("http")) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    }
  });

  return normalizeHtml(doc.body.innerHTML);
}
