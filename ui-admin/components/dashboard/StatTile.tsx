import Link from "next/link";
import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: number | string;
  caption?: string;
  href?: string;
}

const CARD_CLASSES =
  "block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow";

/**
 * A single stat card: label, a large tabular-nums value, and an optional
 * short caption. Renders as a link when `href` is given (e.g. dashboard
 * tiles that jump to the filtered posts list) or a plain div otherwise.
 */
export default function StatTile({ label, value, caption, href }: StatTileProps) {
  const content: ReactNode = (
    <>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-900">{value}</p>
      {caption ? <p className="mt-1 text-xs text-gray-400">{caption}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${CARD_CLASSES} hover:shadow-md`}>
        {content}
      </Link>
    );
  }

  return <div className={CARD_CLASSES}>{content}</div>;
}
