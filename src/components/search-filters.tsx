"use client";

import { FilterX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setIfParam } from "@/lib/utils";

interface SearchFiltersProps {
  brands: Array<{
    id: string;
    name: string;
    models: Array<{ id: string; name: string }>;
  }>;
  onApply?: () => void;
  /** Slot for the title row's right side. The mobile sheet puts its close button here. */
  headerAction?: ReactNode;
}

const YEAR_MIN = 1935;
const YEAR_MAX = 2035;
const YEAR_DIGITS = 4;
const PRICE_DIGITS = 9;

function onlyDigits(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

// Values only ever hold digits, so a length check is enough before the range check.
function isValidYear(value: string) {
  if (value.length !== YEAR_DIGITS) return false;
  const year = Number(value);
  return year >= YEAR_MIN && year <= YEAR_MAX;
}

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function SearchFilters({
  brands,
  onApply,
  headerAction,
}: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The panel is mounted twice on mobile (desktop sidebar in the DOM plus the
  // open sheet), so ids must be unique per instance for the labels to bind.
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  const [selectedBrand, setSelectedBrand] = useState(
    searchParams.get("brand") || "",
  );
  const [selectedModel, setSelectedModel] = useState(
    searchParams.get("model") || "",
  );
  const [selectedType, setSelectedType] = useState(
    searchParams.get("type") || "",
  );
  const [selectedFuel, setSelectedFuel] = useState(
    searchParams.get("fuel") || "",
  );
  const [selectedTransmission, setSelectedTransmission] = useState(
    searchParams.get("transmission") || "",
  );
  const [minYear, setMinYear] = useState(() =>
    onlyDigits(searchParams.get("minYear") || "", YEAR_DIGITS),
  );
  const [maxPrice, setMaxPrice] = useState(() =>
    onlyDigits(searchParams.get("maxPrice") || "", PRICE_DIGITS),
  );
  const [yearTouched, setYearTouched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const minYearInvalid = yearTouched && minYear !== "" && !isValidYear(minYear);

  const selectedBrandData = brands.find((b) => b.id === selectedBrand);

  const allModels = brands.flatMap((brand) =>
    (brand.models ?? []).map((model) => ({
      ...model,
    })),
  );

  const modelsForSelect = selectedBrandData?.models ?? allModels;
  const showBrandInModelLabel = !selectedBrandData;

  const handleFilter = () => {
    const params = new URLSearchParams();

    const search = searchParams.get("search");
    if (search) params.set("search", search);

    setIfParam(params, "brand", selectedBrand);
    setIfParam(params, "model", selectedModel);
    setIfParam(params, "type", selectedType);
    setIfParam(params, "fuel", selectedFuel);
    setIfParam(params, "transmission", selectedTransmission);

    setIfParam(params, "minYear", isValidYear(minYear) ? minYear : "");
    setIfParam(params, "maxPrice", maxPrice);

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/autos/?${query}` : "/autos");
    });
    onApply?.();
  };

  const handleClear = () => {
    setSelectedBrand("");
    setSelectedModel("");
    setSelectedType("");
    setSelectedFuel("");
    setSelectedTransmission("");
    setMinYear("");
    setMaxPrice("");
    setYearTouched(false);

    const params = new URLSearchParams();
    const search = searchParams.get("search");
    if (search) params.set("search", search);

    const query = params.toString();
    router.push(query ? `/autos/?${query}` : "/autos");
    onApply?.();
  };

  return (
    <div className="bg-card space-y-6 rounded-lg p-6 shadow-lg/30">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Filtros de búsqueda</h3>
          {headerAction}
        </div>
        <Button
          className="hover:bg-primary hover:text-card"
          variant="ghost"
          size="sm"
          onClick={handleClear}
        >
          <FilterX className="hover:text-card mr-1 size-4" />
          Limpiar
        </Button>
      </div>

      <div className="space-y-4">
        <FilterField label="Marca" htmlFor={fieldId("brand")}>
          <Select
            value={selectedBrand}
            onValueChange={(value) => {
              setSelectedBrand(value);
              setSelectedModel("");
            }}
          >
            <SelectTrigger id={fieldId("brand")}>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Modelo" htmlFor={fieldId("model")}>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger id={fieldId("model")}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {modelsForSelect.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {showBrandInModelLabel && "brandName" in model
                    ? `${model.brandName} - ${model.name}`
                    : model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <div className="grid grid-cols-2 gap-4">
          <FilterField label="Tipo" htmlFor={fieldId("type")}>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger id={fieldId("type")}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="SUV">SUV</SelectItem>
                <SelectItem value="SEDAN">Sedán</SelectItem>
                <SelectItem value="HATCHBACK">Hatchback</SelectItem>
                <SelectItem value="PICKUP">Pickup</SelectItem>
                <SelectItem value="COUPE">Coupé</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Combustible" htmlFor={fieldId("fuel")}>
            <Select value={selectedFuel} onValueChange={setSelectedFuel}>
              <SelectTrigger id={fieldId("fuel")}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="GASOLINE">Nafta</SelectItem>
                <SelectItem value="DIESEL">Diesel</SelectItem>
                <SelectItem value="ELECTRIC">Eléctrico</SelectItem>
                <SelectItem value="HYBRID">Híbrido</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Transmisión" htmlFor={fieldId("transmission")}>
            <Select
              value={selectedTransmission}
              onValueChange={setSelectedTransmission}
            >
              <SelectTrigger id={fieldId("transmission")}>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="MANUAL">Manual</SelectItem>
                <SelectItem value="AUTOMATIC">Automática</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        </div>

        <FilterField label="Año" htmlFor={fieldId("year")}>
          <Input
            id={fieldId("year")}
            inputMode="numeric"
            maxLength={YEAR_DIGITS}
            placeholder="Ej: 2015"
            value={minYear}
            aria-invalid={minYearInvalid || undefined}
            onChange={(e) =>
              setMinYear(onlyDigits(e.target.value, YEAR_DIGITS))
            }
            onBlur={() => setYearTouched(true)}
          />
        </FilterField>

        <FilterField label="Entrega hasta (ARS)" htmlFor={fieldId("maxPrice")}>
          <Input
            id={fieldId("maxPrice")}
            inputMode="numeric"
            maxLength={PRICE_DIGITS}
            placeholder="Ej: 12.000.000"
            value={maxPrice}
            onChange={(e) =>
              setMaxPrice(onlyDigits(e.target.value, PRICE_DIGITS))
            }
          />
        </FilterField>

        <Button onClick={handleFilter} className="w-full" disabled={isPending}>
          {isPending ? "Aplicando…" : "Aplicar filtros"}
        </Button>
      </div>
    </div>
  );
}
