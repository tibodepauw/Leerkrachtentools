import { existsSync, readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { getDatabase } from "@/lib/auth/database";
import {
  deleteProfileImageFile,
  mimeTypeForProfileImage,
  PROFILE_IMAGE_MAX_BYTES,
  profileImageAbsolutePath,
  profileImageUrl,
  saveProfileImageFile,
} from "@/lib/auth/profileImage";
import { publicErrorMessage } from "@/lib/http/clientError";
import { readBoundedFormData } from "@/lib/http/requestBody";
import { RequestRateLimitError } from "@/lib/http/rateLimit";
import { withUploadCapacity } from "@/lib/http/uploadCapacity";

export const runtime = "nodejs";
const PROFILE_IMAGE_REQUEST_MAX_BYTES =
  PROFILE_IMAGE_MAX_BYTES + 128_000;

function currentProfileImage(userId: string) {
  return getDatabase()
    .prepare("SELECT profile_image_path, updated_at FROM users WHERE id = ?")
    .get(userId) as
    | { profile_image_path: string | null; updated_at: number }
    | undefined;
}

export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const row = currentProfileImage(session.id);
  if (!row?.profile_image_path) {
    return NextResponse.json({ error: "Geen profielfoto gevonden." }, { status: 404 });
  }

  const absolutePath = profileImageAbsolutePath(row.profile_image_path);
  if (!existsSync(absolutePath)) {
    return NextResponse.json({ error: "Profielfoto ontbreekt." }, { status: 404 });
  }

  const buffer = readFileSync(absolutePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeTypeForProfileImage(row.profile_image_path),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  try {
    return await withUploadCapacity(session.id, async () => {
      const formData = await readBoundedFormData(
        request,
        PROFILE_IMAGE_REQUEST_MAX_BYTES,
      );
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Kies een afbeelding om te uploaden." },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const updatedAt = Date.now();
      await saveProfileImageFile(
        session.id,
        file.name,
        buffer,
        file.type,
        request.signal,
        () => {
          if (sessionFromRequest(request)?.id !== session.id) throw new Error("Je sessie is verlopen. Meld je opnieuw aan.");
        },
        (nextPath) => {
          const previous = currentProfileImage(session.id);
          const updated = getDatabase().prepare("UPDATE users SET profile_image_path = ?, updated_at = ? WHERE id = ?").run(nextPath, updatedAt, session.id);
          if (updated.changes !== 1) throw new Error("Je account is niet meer beschikbaar.");
          if (previous?.profile_image_path) deleteProfileImageFile(previous.profile_image_path);
        },
      );

      return NextResponse.json({
        profileImageUrl: profileImageUrl(updatedAt),
      });
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: publicErrorMessage(
          error,
          "Profielfoto kon niet veilig worden opgeslagen.",
        ),
      },
      { status: error instanceof RequestRateLimitError ? 429 : 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const row = currentProfileImage(session.id);
  deleteProfileImageFile(row?.profile_image_path);
  const updatedAt = Date.now();

  getDatabase()
    .prepare(
      "UPDATE users SET profile_image_path = NULL, updated_at = ? WHERE id = ?",
    )
    .run(updatedAt, session.id);

  return NextResponse.json({ ok: true });
}
