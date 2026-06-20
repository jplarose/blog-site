import { InputRule } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)$/;
const MARKDOWN_LINK_GLOBAL_PATTERN = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g;

interface ParsedMarkdownLink {
  text: string;
  href: string;
  title?: string;
}

function parseMarkdownLink(value: string): ParsedMarkdownLink | null {
  const match = value.match(MARKDOWN_LINK_PATTERN);
  if (!match) {
    return null;
  }

  const text = match[1]?.trim();
  const rawHref = match[2]?.trim();
  const title = match[3]?.trim();
  if (!text || !rawHref) {
    return null;
  }

  const href = normalizeMarkdownLinkHref(rawHref);
  if (!href) {
    return null;
  }

  return title ? { text, href, title } : { text, href };
}

function normalizeMarkdownLinkHref(href: string): string | null {
  if (href.startsWith("/") || href.startsWith("mailto:")) {
    return href;
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(href)) {
    return href;
  }

  return `https://${href}`;
}

export const MarkdownLink = Link.extend({
  addInputRules() {
    return [
      new InputRule({
        find: MARKDOWN_LINK_PATTERN,
        handler: ({ state, range, match }) => {
          const parsed = parseMarkdownLink(match[0]);
          if (!parsed) {
            return;
          }

          state.tr.replaceWith(
            range.from,
            range.to,
            state.schema.text(parsed.text, [
              this.type.create({
                href: parsed.href,
                ...(parsed.title ? { title: parsed.title } : {}),
              }),
            ]),
          );
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("markdownLinkTransformer"),
        appendTransaction: (_transactions, _oldState, newState) => {
          const replacements = findMarkdownLinkReplacements(newState.doc);
          if (replacements.length === 0) {
            return null;
          }

          const tr = newState.tr;
          replacements
            .sort((left, right) => right.from - left.from)
            .forEach((replacement) => {
              tr.replaceWith(
                replacement.from,
                replacement.to,
                newState.schema.text(replacement.text, [
                  this.type.create({
                    href: replacement.href,
                    ...(replacement.title ? { title: replacement.title } : {}),
                  }),
                ]),
              );
            });

          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});

interface MarkdownLinkReplacement {
  from: number;
  href: string;
  text: string;
  title?: string;
  to: number;
}

function findMarkdownLinkReplacements(doc: ProseMirrorNode): MarkdownLinkReplacement[] {
  const replacements: MarkdownLinkReplacement[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return true;
    }

    const text = node.textContent;
    if (!text.includes("](")) {
      return true;
    }

    const textSegments = collectTextSegments(node, pos);
    for (const match of text.matchAll(MARKDOWN_LINK_GLOBAL_PATTERN)) {
      const fullMatch = match[0];
      const startOffset = match.index;
      if (startOffset === undefined) {
        continue;
      }

      const parsed = parseMarkdownLink(fullMatch);
      if (!parsed) {
        continue;
      }

      const from = offsetToDocumentPosition(textSegments, startOffset);
      const to = offsetToDocumentPosition(textSegments, startOffset + fullMatch.length);
      if (from === null || to === null || from >= to) {
        continue;
      }

      replacements.push({
        from,
        href: parsed.href,
        text: parsed.text,
        ...(parsed.title ? { title: parsed.title } : {}),
        to,
      });
    }

    return true;
  });

  return replacements;
}

interface TextSegment {
  end: number;
  from: number;
  start: number;
}

function collectTextSegments(node: ProseMirrorNode, nodePos: number): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentOffset = 0;

  node.descendants((child, childPos) => {
    if (!child.isText) {
      return true;
    }

    const text = child.text ?? "";
    const from = nodePos + 1 + childPos;
    segments.push({
      start: currentOffset,
      end: currentOffset + text.length,
      from,
    });
    currentOffset += text.length;
    return true;
  });

  return segments;
}

function offsetToDocumentPosition(segments: TextSegment[], targetOffset: number): number | null {
  for (const segment of segments) {
    if (targetOffset >= segment.start && targetOffset <= segment.end) {
      return segment.from + (targetOffset - segment.start);
    }
  }

  return null;
}
