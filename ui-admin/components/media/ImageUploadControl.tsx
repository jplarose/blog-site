"use client";

import { useId, useRef, useState } from "react";

import { mediaApi, type MediaUpload } from "@/lib/api";

interface ImageUploadControlProps {
  label: string;
  value?: string;
  onUploaded: (url: string) => void;
  uploadImage?: (file: File) => Promise<MediaUpload>;
}

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

export default function ImageUploadControl({
  label,
  value = "",
  onUploaded,
  uploadImage = mediaApi.uploadImage,
}: ImageUploadControlProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const uploaded = await uploadImage(file);
      onUploaded(uploaded.url);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Image upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  const inputLabel = value ? `Replace ${label}` : label;

  return (
    <div className="space-y-3">
      {value ? (
        // Existing remote URLs are intentional; Next Image would require
        // deployment-specific remotePatterns for the configured media origin.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt={`${label} preview`}
          className="max-h-56 w-full rounded-lg border border-gray-200 object-contain"
        />
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="sr-only"
        aria-label={inputLabel}
        disabled={isUploading}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUploading ? "Uploading..." : value ? "Replace image" : "Choose image"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
