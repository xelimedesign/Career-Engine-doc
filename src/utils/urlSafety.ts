export function toSafeHttpUrl(raw?: string | null): string {
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed.length > 2048) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function isSafeDataImageUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  return /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(raw.trim());
}

const ALLOWED_RICH_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ul',
  'ol',
  'li',
  'br',
  'p',
  'div',
]);

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeSanitizedNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeText(node.textContent || '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  // Drop active/dangerous subtrees entirely
  if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
    return '';
  }

  const childrenHtml = Array.from(el.childNodes).map(serializeSanitizedNode).join('');

  if (!ALLOWED_RICH_TAGS.has(tag)) {
    return childrenHtml;
  }

  if (tag === 'br') {
    return '<br>';
  }

  return `<${tag}>${childrenHtml}</${tag}>`;
}

export function sanitizeRichHtml(rawHtml?: string | null): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  if (typeof DOMParser === 'undefined') {
    return escapeText(rawHtml.replace(/<[^>]+>/g, ' '));
  }
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  return Array.from(doc.body.childNodes).map(serializeSanitizedNode).join('');
}

export function extractPlainTextFromHtml(rawHtml?: string | null): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  if (typeof DOMParser === 'undefined') {
    return rawHtml.replace(/<[^>]+>/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  return (doc.body.textContent || '').trim();
}
