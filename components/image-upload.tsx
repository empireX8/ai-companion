"use client";

import { CldUploadWidget } from "next-cloudinary";
import type { CloudinaryUploadWidgetResults } from "@cloudinary-util/types";
import Image from "next/image";
import { useState } from "react";

interface ImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const ImageUpload = ({ value, onChange, disabled }: ImageUploadProps) => {
  const [preview, setPreview] = useState(value);

  const handleUpload = (result: CloudinaryUploadWidgetResults) => {
    if (!result || result.event !== "success") return;
    if (!result.info || typeof result.info !== "object") return;
    const info = result.info as { secure_url?: unknown };
    const url = typeof info.secure_url === "string" ? info.secure_url : undefined;
    if (!url) return;

    setPreview(url);
    onChange(url);
  };

  return (
    <CldUploadWidget
      uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
      onSuccess={handleUpload}
    >
      {({ open }) => (
        <div
  onClick={() => !disabled && open()}
  className={`
    relative cursor-pointer flex items-center justify-center
    border-2 border-dashed rounded-xl hover:opacity-75 transition
    w-full h-48                     /* 🔥 gives space for preview */
    ${disabled ? "opacity-50 pointer-events-none" : ""}
  `}
>
          {preview ? (
            <Image src={preview} alt="uploaded image" fill className="object-cover rounded-xl" />
          ) : (
            <span className="text-neutral-500">Upload Image</span>
          )}
        </div>
      )}
    </CldUploadWidget>
  );
};
