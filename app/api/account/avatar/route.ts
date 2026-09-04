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
import { assertContentLength } from "@/lib/http/requestBody";

export const runtime = "nodejs";

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
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  try {
    assertContentLength(request, PROFILE_IMAGE_MAX_BYTES + 128_000);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Kies een afbeelding om te uploaden." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const nextPath = saveProfileImageFile(session.id, file.name, buffer);
    const updatedAt = Date.now();

    const previous = currentProfileImage(session.id);
    if (
      previous?.profile_image_path &&
      previous.profile_image_path !== nextPath
    ) {
      deleteProfileImageFile(previous.profile_image_path);
    }

    getDatabase()
      .prepare(
        "UPDATE users SET profile_image_path = ?, updated_at = ? WHERE id = ?",
      )
      .run(nextPath, updatedAt, session.id);

    return NextResponse.json({
      profileImageUrl: profileImageUrl(updatedAt),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: publicErrorMessage(
          error,
          "Profielfoto kon niet veilig worden opgeslagen.",
        ),
      },
      { status: 400 },
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
