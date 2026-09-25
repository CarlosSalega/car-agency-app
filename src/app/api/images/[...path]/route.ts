import { NextRequest, NextResponse } from "next/server";

import { CACHE_REVALIDATE } from "@/lib/cache";

const PROVIDER = process.env.IMAGE_PROVIDER ?? "cloudinary";

const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`;

const S3_BASE_URL = process.env.S3_PUBLIC_BASE_URL;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const resolvedParams = await params;
    const imagePath = resolvedParams.path?.filter(Boolean).join("/");

    if (!imagePath) {
      return NextResponse.json(
        { error: "Ruta de imagen no proporcionada" },
        { status: 400 },
      );
    }

    if (PROVIDER !== "cloudinary" && !S3_BASE_URL) {
      return NextResponse.json(
        { error: "S3 base URL no configurada" },
        { status: 500 },
      );
    }

    const imageUrl =
      PROVIDER === "cloudinary"
        ? `${CLOUDINARY_BASE_URL}/${imagePath}`
        : `${S3_BASE_URL}/${imagePath}`;

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/*",
      },
      next: {
        revalidate: CACHE_REVALIDATE.IMAGES,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Imagen no encontrada" },
        { status: 404 },
      );
    }

    const contentType = response.headers
      .get("content-type")
      ?.startsWith("image/")
      ? response.headers.get("content-type")!
      : "image/webp";

    const cacheMaxAge = CACHE_REVALIDATE.IMAGES;
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${cacheMaxAge}, immutable, stale-while-revalidate=${cacheMaxAge}`,
        "X-Content-Type-Options": "nosniff",
        "CDN-Cache-Control": `public, max-age=${cacheMaxAge}`,
      },
    });
  } catch (error) {
    console.error("Error al obtener imagen:", error);
    return NextResponse.json(
      { error: "Error al obtener la imagen" },
      { status: 500 },
    );
  }
}
