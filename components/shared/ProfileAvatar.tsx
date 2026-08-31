"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
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

function GatherInitials({
  letters,
  fallbackClassName,
}: {
  letters: string;
  fallbackClassName?: string;
}) {
  const chars = letters.split("");
  if (chars.length <= 1) {
    return (
      <span
        className={cn(
          "flex size-full items-center justify-center font-black text-white",
          fallbackClassName,
        )}
      >
        {letters}
      </span>
    );
  }
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center font-black text-white",
        fallbackClassName,
      )}
      style={{ gap: "0.3em" }}
    >
      {chars.map((char, i) => (
        <span
          key={`${char}-${i}`}
          style={{
            transform: `translateY(${i % 2 ? "0.04em" : "-0.04em"}) rotate(${i % 2 ? 12 : -12}deg)`,
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
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
  const [localImageUrl, setLocalImageUrl] = useState<string | null | undefined>(
    undefined,
  );
  const [trackedProfileImageUrl, setTrackedProfileImageUrl] =
    useState(profileImageUrl);
  if (profileImageUrl !== trackedProfileImageUrl) {
    setTrackedProfileImageUrl(profileImageUrl);
    setLocalImageUrl(undefined);
  }
  const imageUrl = localImageUrl !== undefined ? localImageUrl : (profileImageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const busy = uploading || removing;

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

      setLocalImageUrl(payload.profileImageUrl);
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

      setLocalImageUrl(null);
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
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border border-neutral-700 bg-neutral-800",
        sizeClassName,
      )}
    >
      {imageUrl ? (
        // Blob/data URLs from profile upload are rendered with a native img tag.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Profielfoto"
          className="size-full object-cover"
          draggable={false}
        />
      ) : (
        <GatherInitials
          letters={initials(displayName ?? "", email)}
          fallbackClassName={fallbackClassName}
        />
      )}
    </div>
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
      <div className="group relative shrink-0">
        {avatar}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full bg-black/50",
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
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
          disabled={busy}
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
          disabled={busy}
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
            disabled={busy}
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
