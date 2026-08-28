"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  email: string;
  displayName: string | null;
  profileImageUrl?: string | null;
  sizeClassName?: string;
  fallbackClassName?: string;
  editable?: boolean;
  layout?: "inline" | "stacked";
  onProfileImageChange?: (profileImageUrl: string | null) => void;
}

function initials(name: string, email: string) {
  return (name || email.split("@")[0])
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("nl-BE"))
    .join("");
}

export function ProfileAvatar({
  email,
  displayName,
  profileImageUrl,
  sizeClassName = "size-14",
  fallbackClassName,
  editable = false,
  layout = "inline",
  onProfileImageChange,
}: ProfileAvatarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(profileImageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setImageUrl(profileImageUrl ?? null);
  }, [profileImageUrl]);

  async function uploadPhoto(file?: File) {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        profileImageUrl?: string;
      };

      if (!response.ok || !payload.profileImageUrl) {
        throw new Error(payload.error ?? "Upload mislukt.");
      }

      setImageUrl(payload.profileImageUrl);
      onProfileImageChange?.(payload.profileImageUrl);
      toast.success("Profielfoto opgeslagen.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload mislukt.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setRemoving(true);

    try {
      const response = await fetch("/api/account/avatar", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Verwijderen mislukt.");
      }

      setImageUrl(null);
      onProfileImageChange?.(null);
      toast.success("Profielfoto verwijderd.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Verwijderen mislukt.",
      );
    } finally {
      setRemoving(false);
    }
  }

  const avatar = (
    <Avatar className={cn("border border-neutral-700", sizeClassName)}>
      {imageUrl ? <AvatarImage src={imageUrl} alt="Profielfoto" /> : null}
      <AvatarFallback
        className={cn("bg-neutral-800 text-lg font-semibold", fallbackClassName)}
      >
        {initials(displayName ?? "", email)}
      </AvatarFallback>
    </Avatar>
  );

  if (!editable) {
    return avatar;
  }

  return (
    <div
      className={cn(
        layout === "stacked"
          ? "flex flex-col items-start gap-3"
          : "flex flex-wrap items-center gap-4",
      )}
    >
      <div className="relative">
        {avatar}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || removing}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity hover:opacity-100"
          aria-label="Profielfoto wijzigen"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-white" />
          ) : (
            <Camera className="size-5 text-white" />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          disabled={uploading || removing}
          onChange={(event) => {
            void uploadPhoto(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || removing}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
          Foto uploaden
        </Button>
        {imageUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading || removing}
            onClick={() => void removePhoto()}
          >
            {removing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Foto verwijderen
          </Button>
        ) : null}
        <p className="text-xs text-neutral-500">JPG, PNG, WEBP of GIF · max. 2 MB</p>
      </div>
    </div>
  );
}
