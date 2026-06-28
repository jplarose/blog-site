import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ImageUploadControl from "@/components/media/ImageUploadControl";

describe("ImageUploadControl", () => {
  it("uploads a selected file and reports the returned URL", async () => {
    const uploadImage = vi.fn().mockResolvedValue({
      url: "https://media.example/new.png",
    });
    const onUploaded = vi.fn();
    render(
      <ImageUploadControl
        label="Featured image"
        value=""
        onUploaded={onUploaded}
        uploadImage={uploadImage}
      />,
    );

    fireEvent.change(screen.getByLabelText("Featured image"), {
      target: {
        files: [new File(["image"], "image.png", { type: "image/png" })],
      },
    });

    expect(screen.getByRole("button", { name: "Uploading..." })).toBeDisabled();
    await waitFor(() =>
      expect(onUploaded).toHaveBeenCalledWith(
        "https://media.example/new.png",
      ),
    );
  });

  it("preserves the current image and shows an error when upload fails", async () => {
    const onUploaded = vi.fn();
    render(
      <ImageUploadControl
        label="Featured image"
        value="https://media.example/existing.png"
        onUploaded={onUploaded}
        uploadImage={vi.fn().mockRejectedValue(new Error("Storage unavailable"))}
      />,
    );

    fireEvent.change(screen.getByLabelText("Replace Featured image"), {
      target: {
        files: [new File(["image"], "image.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByText("Storage unavailable")).toBeInTheDocument();
    expect(onUploaded).not.toHaveBeenCalled();
    expect(screen.getByAltText("Featured image preview")).toHaveAttribute(
      "src",
      "https://media.example/existing.png",
    );
  });
});
