import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ScheduleDialog from "@/components/posts/ScheduleDialog";

function futureDatetimeLocalValue(): string {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  return future.toISOString().slice(0, 16);
}

function pastDatetimeLocalValue(): string {
  const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  return past.toISOString().slice(0, 16);
}

describe("ScheduleDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders as a labeled modal dialog and explains there is no background scheduler", () => {
    render(
      <ScheduleDialog postTitle="Hello" isSubmitting={false} serverError={null} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(/will not go public automatically/i)).toBeInTheDocument();
  });

  it("blocks submission and shows a validation message when no time is chosen", () => {
    const onConfirm = vi.fn();
    render(
      <ScheduleDialog postTitle="Hello" isSubmitting={false} serverError={null} onCancel={vi.fn()} onConfirm={onConfirm} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/choose a publish date/i);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("blocks submission and shows a validation message for a past time", () => {
    const onConfirm = vi.fn();
    render(
      <ScheduleDialog postTitle="Hello" isSubmitting={false} serverError={null} onCancel={vi.fn()} onConfirm={onConfirm} />,
    );

    fireEvent.change(screen.getByLabelText(/publish date/i), { target: { value: pastDatetimeLocalValue() } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/must be in the future/i);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm with an ISO timestamp for a valid future time", () => {
    const onConfirm = vi.fn();
    render(
      <ScheduleDialog postTitle="Hello" isSubmitting={false} serverError={null} onCancel={vi.fn()} onConfirm={onConfirm} />,
    );

    fireEvent.change(screen.getByLabelText(/publish date/i), { target: { value: futureDatetimeLocalValue() } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [iso] = onConfirm.mock.calls[0] as [string];
    expect(new Date(iso).getTime()).toBeGreaterThan(Date.now());
  });

  it("surfaces a server error message", () => {
    render(
      <ScheduleDialog
        postTitle="Hello"
        isSubmitting={false}
        serverError="Only Draft or Scheduled posts can be scheduled"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/only draft or scheduled posts/i);
  });

  it("disables the confirm button while submitting", () => {
    render(
      <ScheduleDialog postTitle="Hello" isSubmitting={true} serverError={null} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /scheduling/i })).toBeDisabled();
  });

  it("calls onCancel when Escape is pressed", () => {
    const onCancel = vi.fn();
    render(
      <ScheduleDialog postTitle="Hello" isSubmitting={false} serverError={null} onCancel={onCancel} onConfirm={vi.fn()} />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onCancel).toHaveBeenCalled();
  });
});
