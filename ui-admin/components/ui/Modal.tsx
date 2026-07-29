"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  /** id of the element (usually the dialog's heading) that labels it. */
  labelledBy: string;
  /** Called on Escape, backdrop click, or unmount-driven close requests. */
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Shared modal chrome: portals content to `document.body`, traps Tab focus
 * inside the dialog, marks the rest of the page `inert`/`aria-hidden` while
 * open, and restores focus to whatever was focused before the dialog opened
 * once it closes. `ScheduleDialog` and `ConfirmDeleteDialog` both render
 * their own heading/body/buttons as children of this component so the
 * accessibility plumbing only lives in one place.
 */
export default function Modal({ labelledBy, onClose, children }: ModalProps) {
  const [portalRoot] = useState<HTMLDivElement | null>(() =>
    typeof document === "undefined" ? null : document.createElement("div"),
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  // Mount/unmount: own the portal node, hide the rest of the page from
  // assistive tech and keyboard focus, move focus into the dialog, and
  // restore focus to the trigger element on the way out.
  useEffect(() => {
    if (!portalRoot) return;
    document.body.appendChild(portalRoot);

    const previouslyFocused = document.activeElement;
    const siblings = Array.from(document.body.children).filter((el) => el !== portalRoot);
    const previousInert = siblings.map((el) => el.hasAttribute("inert"));
    const previousAriaHidden = siblings.map((el) => el.getAttribute("aria-hidden"));
    siblings.forEach((el) => {
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    });

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable && focusable[0] ? focusable[0] : dialogRef.current)?.focus();

    return () => {
      siblings.forEach((el, index) => {
        if (previousInert[index]) {
          el.setAttribute("inert", "");
        } else {
          el.removeAttribute("inert");
        }
        const priorAriaHidden = previousAriaHidden[index];
        if (priorAriaHidden === null) {
          el.removeAttribute("aria-hidden");
        } else {
          el.setAttribute("aria-hidden", priorAriaHidden);
        }
      });
      document.body.removeChild(portalRoot);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [portalRoot]);

  // Escape-to-close and Tab focus trapping, kept live against the latest
  // `onClose` without re-running the mount effect above.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const activeIsInsideDialog = active instanceof Node && dialogRef.current.contains(active);

      if (event.shiftKey) {
        if (!activeIsInsideDialog || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!activeIsInsideDialog || active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!portalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    portalRoot,
  );
}
