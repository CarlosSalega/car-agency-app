import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { ImageService } from "@/lib/images/image-service";
import { getSession } from "@/lib/auth";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const UPLOAD_TOO_LARGE_ERROR =
  "El servidor rechazó la foto por pesada. Probá con una de menos de 15MB.";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const entry = formData.get("file");

    if (!entry || typeof entry === "string") {
      return NextResponse.json(
        { error: "No se proporcionó archivo" },
        { status: 400 },
      );
    }
    const file: File = entry;

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "El archivo debe ser una imagen" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      console.warn("Upload rejected: file too large", {
        size: file.size,
        type: file.type,
      });
      return NextResponse.json(
        { error: UPLOAD_TOO_LARGE_ERROR },
        { status: 413 },
      );
    }

    const result = await ImageService.upload(file);

    return NextResponse.json({
      success: true,
      key: result.key,
      url: result.url,
    });
  } catch (error) {
    console.error("Error al subir imagen:", error);
    return NextResponse.json(
      { error: "Error al subir la imagen" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { key } = body || {};

    if (!key) {
      return NextResponse.json(
        { error: "No se proporcionó key" },
        { status: 400 },
      );
    }

    const carsWithImage = await prisma.car.findMany({
      where: {
        images: {
          has: key,
        },
      },
      select: { id: true, userId: true },
    });

    if (carsWithImage.length === 0) {
      return NextResponse.json(
        {
          error:
            "No tienes permiso para eliminar esta imagen. No pertenece a ninguno de tus vehículos.",
        },
        { status: 403 },
      );
    }

    const hasPermission = carsWithImage.some(
      (car) => car.userId === session.user.id || session.user.role === "ADMIN",
    );

    if (!hasPermission) {
      return NextResponse.json(
        {
          error:
            "No tienes permiso para eliminar esta imagen. Pertenece a otro vehículo.",
        },
        { status: 403 },
      );
    }

    const result = await ImageService.delete(key);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Error al eliminar la imagen" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar imagen:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
