"use client";

import { Download, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/utils";

/**
 * The admin's bulk import screen.
 *
 * Two passes over the same file, both through the route handler: the first
 * reports and the second writes. Nothing is created until the admin confirms a
 * report they have actually seen (spec S1/S2), and the confirmation re-sends the
 * original `File` object rather than the rows on screen, so the server can
 * re-parse and re-validate it instead of trusting the browser (S3).
 */

const IMPORT_URL = "/api/admin/cars/import";
const MAX_ROWS = 50;

interface ImportIssue {
  field?: string;
  message: string;
}

interface PreviewRow {
  line: number;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  currency: string;
  images: number;
}

interface InvalidRow {
  line: number;
  issues: ImportIssue[];
}

interface CreatedRow {
  line: number;
  id: string;
  title: string;
  images: number;
  imagesFailed: number;
}

interface FailedRow {
  line: number;
  title: string;
  reason: string;
}

interface ImportPreview {
  total: number;
  validCount: number;
  invalidCount: number;
  fatal: string | null;
  valid: PreviewRow[];
  invalid: InvalidRow[];
  encodingWarning: string | null;
}

interface ImportResult {
  created: CreatedRow[];
  failed: FailedRow[];
  total: number;
}

/** The union of both responses; every field is optional because errors vary. */
interface ImportResponse {
  mode?: string;
  total?: number;
  validCount?: number;
  invalidCount?: number;
  fatal?: string | null;
  valid?: PreviewRow[];
  invalid?: InvalidRow[];
  encodingWarning?: string | null;
  error?: string;
  created?: CreatedRow[];
  failed?: FailedRow[];
}

type Phase = "idle" | "reviewing" | "reviewed" | "importing" | "imported";

function buildFormData(file: File, mode: "dry-run" | "confirm") {
  const body = new FormData();
  body.append("file", file);
  body.append("mode", mode);
  return body;
}

function toPreview(payload: ImportResponse): ImportPreview {
  const valid = payload.valid ?? [];
  const invalid = payload.invalid ?? [];

  return {
    total: payload.total ?? valid.length + invalid.length,
    validCount: payload.validCount ?? valid.length,
    invalidCount: payload.invalidCount ?? invalid.length,
    fatal: payload.fatal ?? null,
    valid,
    invalid,
    encodingWarning: payload.encodingWarning ?? null,
  };
}

export function CarImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  const isReviewing = phase === "reviewing";
  const isImporting = phase === "importing";

  // S2 in one expression: an import with a single bad row is not offered.
  const canConfirm =
    file !== null &&
    preview !== null &&
    preview.fatal === null &&
    preview.valid.length > 0 &&
    preview.invalid.length === 0 &&
    !isImporting &&
    phase !== "imported";

  async function review(selected: File) {
    setPhase("reviewing");

    try {
      const response = await fetch(IMPORT_URL, {
        method: "POST",
        body: buildFormData(selected, "dry-run"),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as ImportResponse | null;

      if (!response.ok || !payload) {
        // A fatal problem is the file itself and is rendered as one blocking
        // block. An error without a report (too big, unreadable) never deserves
        // an empty table underneath it.
        if (payload?.fatal) {
          setPreview(toPreview(payload));
          return;
        }

        const blocking = payload?.error ?? "No pudimos revisar el archivo.";
        setMessage(blocking);
        toast.error(blocking);
        return;
      }

      setPreview(toPreview(payload));
      setMessage(null);
    } catch {
      const failure = "No pudimos revisar el archivo. Revisá tu conexión.";
      setMessage(failure);
      toast.error(failure);
    } finally {
      setPhase((current) => (current === "reviewing" ? "reviewed" : current));
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;

    setFile(selected);
    setPreview(null);
    setResult(null);
    setMessage(null);
    setPhase("idle");

    if (selected) void review(selected);
  }

  async function confirmImport() {
    if (!file || !canConfirm) return;

    setPhase("importing");
    setMessage(null);

    try {
      const response = await fetch(IMPORT_URL, {
        method: "POST",
        body: buildFormData(file, "confirm"),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as ImportResponse | null;

      if (!response.ok || !payload) {
        const blocking =
          payload?.fatal ??
          payload?.error ??
          "No pudimos importar el inventario.";

        // A rejected confirmation that still carries rows is a report: show it
        // instead of replacing the whole screen with an error.
        if (payload?.valid || payload?.invalid) setPreview(toPreview(payload));

        if (!payload?.fatal) {
          setMessage(blocking);
          toast.error(blocking);
        }
        return;
      }

      const imported: ImportResult = {
        created: payload.created ?? [],
        failed: payload.failed ?? [],
        total: payload.total ?? 0,
      };

      setResult(imported);
      setPhase("imported");

      toast.success(
        imported.created.length === 1
          ? "1 vehículo importado"
          : `${imported.created.length} vehículos importados`,
      );

      if (imported.failed.length > 0) {
        toast.error(
          `${imported.failed.length} filas no se pudieron crear. Revisá el detalle.`,
        );
      }

      router.refresh();
    } catch {
      const failure = "No pudimos importar el inventario. Revisá tu conexión.";
      setMessage(failure);
      toast.error(failure);
    } finally {
      setPhase((current) => (current === "importing" ? "reviewed" : current));
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Importar inventario
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Subí una planilla con varios autos y revisá el resultado antes de
          crear nada. Los vehículos se guardan recién cuando confirmás la
          importación.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Elegí el archivo</CardTitle>
          <CardDescription>
            Un CSV de hasta {MAX_ROWS} filas y 1 MB, con los encabezados en la
            primera fila.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="inventory-file">Planilla CSV</Label>
            <Input
              id="inventory-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isImporting}
            />
            {file ? (
              <p className="text-muted-foreground text-xs">{file.name}</p>
            ) : null}
          </div>

          <div className="text-muted-foreground grid gap-1 text-sm">
            <p>
              <span className="text-foreground font-medium">Obligatorias:</span>{" "}
              titulo, marca, modelo, anio, kilometros, precio.
            </p>
            <p>
              <span className="text-foreground font-medium">Opcionales:</span>{" "}
              moneda, tipo, combustible, transmision, estado, color, version,
              descripcion e imagenes.
            </p>
            <p>
              En imagenes, separá las URLs públicas con «|». Las marcas y los
              modelos se buscan en el catálogo existente, y los enums aceptan el
              valor o la etiqueta en español.
            </p>
          </div>

          <div>
            <Button
              variant="outline"
              render={
                <a href={IMPORT_URL} download>
                  <Download className="size-4" />
                  Descargar plantilla CSV
                </a>
              }
            />
          </div>

          {isReviewing ? (
            <p role="status" className="text-muted-foreground text-sm">
              Revisando el archivo…
            </p>
          ) : null}

          {preview?.fatal ? (
            <p
              role="alert"
              className="bg-destructive text-destructive-foreground rounded-lg px-4 py-3 text-sm font-medium"
            >
              {preview.fatal}
            </p>
          ) : message ? (
            <p role="alert" className="text-destructive text-sm">
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {preview && !preview.fatal ? (
        <Card>
          <CardHeader>
            <CardTitle>2. Revisá el resultado</CardTitle>
            <CardDescription>
              {`Filas válidas: ${preview.validCount} · Filas con problemas: ${preview.invalidCount} · Total: ${preview.total}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-6">
            {preview.encodingWarning ? (
              <p
                role="status"
                className="bg-warning text-warning-foreground rounded-lg px-4 py-3 text-sm"
              >
                {preview.encodingWarning}
              </p>
            ) : null}

            {preview.invalid.length > 0 ? (
              <section className="grid gap-3">
                <h2 className="text-sm font-semibold">Filas con problemas</h2>
                <ul className="grid gap-3">
                  {preview.invalid.map((row) => (
                    <li
                      key={row.line}
                      className="border-border bg-muted rounded-lg border p-4"
                    >
                      <p className="text-sm font-semibold">Fila {row.line}</p>
                      <ul className="mt-2 grid gap-1">
                        {row.issues.map((issue, index) => (
                          <li
                            key={`${row.line}-${index}`}
                            className="text-destructive text-sm"
                          >
                            {issue.field ? `${issue.field}: ` : ""}
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {preview.valid.length > 0 ? (
              <section className="grid gap-3">
                <h2 className="text-sm font-semibold">Filas válidas</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Línea</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Año</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Imágenes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.valid.map((row) => (
                      <TableRow key={row.line}>
                        <TableCell>{row.line}</TableCell>
                        <TableCell>{row.title}</TableCell>
                        <TableCell>{row.brand}</TableCell>
                        <TableCell>{row.model}</TableCell>
                        <TableCell>{row.year}</TableCell>
                        <TableCell>
                          {formatPrice(row.price, row.currency)}
                        </TableCell>
                        <TableCell>{row.images}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                {canConfirm
                  ? "Revisá la vista previa y confirmá para crear los vehículos."
                  : preview.invalid.length > 0
                    ? "Corregí las filas con problemas y volvé a subir el archivo."
                    : "No hay filas válidas para importar."}
              </p>
              <Button
                type="button"
                onClick={() => void confirmImport()}
                disabled={!canConfirm}
              >
                <Upload className="size-4" />
                {isImporting ? "Importando…" : "Confirmar importación"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>3. Resultado</CardTitle>
            <CardDescription>
              {`Creados: ${result.created.length} · Fallidos: ${result.failed.length}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            {result.created.length > 0 ? (
              <section className="grid gap-2">
                <h2 className="text-sm font-semibold">Vehículos creados</h2>
                <ul className="grid gap-1 text-sm">
                  {result.created.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-baseline gap-x-2"
                    >
                      <span className="text-muted-foreground">
                        Fila {row.line}
                      </span>
                      <span>{row.title}</span>
                      <span className="text-muted-foreground">
                        {`${row.images} ${row.images === 1 ? "imagen" : "imágenes"}`}
                        {row.imagesFailed > 0
                          ? ` · ${row.imagesFailed} sin subir`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result.failed.length > 0 ? (
              <section className="grid gap-2">
                <h2 className="text-destructive text-sm font-semibold">
                  Filas que no se pudieron crear
                </h2>
                <ul className="grid gap-1 text-sm">
                  {result.failed.map((row) => (
                    <li key={row.line}>
                      <span className="text-muted-foreground">
                        Fila {row.line}
                      </span>{" "}
                      {row.title}: {row.reason}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result.created.length === 0 && result.failed.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                El servidor no creó ningún vehículo.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
