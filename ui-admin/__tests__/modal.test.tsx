import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Modal from "@/components/ui/Modal";

function TriggerAndModal({ isOpen, onCloseSpy }: { isOpen: boolean; onCloseSpy: () => void }) {
  return (
    <div>
      <button type="button">Outside button</button>
      <button type="button" id="trigger">
        Open dialog
      </button>
      {isOpen ? (
        <Modal labelledBy="modal-test-title" onClose={onCloseSpy}>
          <h2 id="modal-test-title">Test dialog</h2>
          <button type="button">First</button>
          <button type="button">Second</button>
          <button type="button">Last</button>
        </Modal>
      ) : null}
    </div>
  );
}

describe("Modal", () => {
  afterEach(() => {
    cleanup();
    // Modal manipulates document.body attributes directly; make sure a
    // failed assertion in one test can't leak `inert`/`aria-hidden` into
    // the next test's body children.
    document.body.querySelectorAll("[inert], [aria-hidden]").forEach((el) => {
      el.removeAttribute("inert");
      el.removeAttribute("aria-hidden");
    });
  });

  it("renders a labeled modal dialog and focuses its first focusable element", () => {
    render(<Modal labelledBy="t" onClose={vi.fn()}><h2 id="t">Title</h2><button type="button">First</button></Modal>);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("marks the background container inert and aria-hidden while open", () => {
    // The background is intentionally made inaccessible while the modal is
    // open, so these assertions use a plain DOM query rather than an
    // accessible-role query (which would correctly refuse to find it).
    const { container, rerender } = render(<TriggerAndModal isOpen={false} onCloseSpy={vi.fn()} />);
    expect(container).not.toHaveAttribute("inert");

    rerender(<TriggerAndModal isOpen={true} onCloseSpy={vi.fn()} />);

    expect(container).toHaveAttribute("inert");
    expect(container).toHaveAttribute("aria-hidden", "true");
  });

  it("restores the background container (removes inert/aria-hidden) after close", () => {
    const { container, rerender } = render(<TriggerAndModal isOpen={true} onCloseSpy={vi.fn()} />);
    expect(container).toHaveAttribute("inert");

    rerender(<TriggerAndModal isOpen={false} onCloseSpy={vi.fn()} />);

    expect(container).not.toHaveAttribute("inert");
    expect(container).not.toHaveAttribute("aria-hidden");
  });

  it("restores focus to the triggering element after the dialog closes", () => {
    function Harness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
          >
            Open dialog
          </button>
          {isOpen ? (
            <Modal labelledBy="t2" onClose={() => setIsOpen(false)}>
              <h2 id="t2">Title</h2>
              <button type="button">Confirm</button>
            </Modal>
          ) : null}
        </div>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("Tab from the last focusable element wraps to the first (focus trap)", () => {
    render(
      <Modal labelledBy="t3" onClose={vi.fn()}>
        <h2 id="t3">Title</h2>
        <button type="button">First</button>
        <button type="button">Second</button>
        <button type="button">Last</button>
      </Modal>,
    );

    const last = screen.getByRole("button", { name: "Last" });
    const first = screen.getByRole("button", { name: "First" });
    last.focus();
    expect(last).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(first).toHaveFocus();
  });

  it("Shift+Tab from the first focusable element wraps to the last (focus trap)", () => {
    render(
      <Modal labelledBy="t4" onClose={vi.fn()}>
        <h2 id="t4">Title</h2>
        <button type="button">First</button>
        <button type="button">Second</button>
        <button type="button">Last</button>
      </Modal>,
    );

    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    // Simulate the browser already having moved focus to the first element.
    first.focus();
    expect(first).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(last).toHaveFocus();
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal labelledBy="t5" onClose={onClose}>
        <h2 id="t5">Title</h2>
        <button type="button">First</button>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on backdrop click but not on dialog content click", () => {
    const onClose = vi.fn();
    render(
      <Modal labelledBy="t6" onClose={onClose}>
        <h2 id="t6">Title</h2>
        <button type="button">First</button>
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "First" }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
