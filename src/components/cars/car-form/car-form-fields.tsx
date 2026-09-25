"use client";
import type { CarInput } from "@/lib/validations/car";
import type { BrandWithModels, SellerOption } from "@/types/car-form";
import type { Model, Car, PaymentMethod } from "@prisma/client";
import type {
  UseFormRegister,
  UseFormSetValue,
  FieldErrors,
} from "react-hook-form";

import { EnumSelect } from "@/components/form/enum-select";
import { FormField } from "@/components/form/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CAR_TYPE_OPTIONS,
  FUEL_TYPE_OPTIONS,
  TRANSMISSION_OPTIONS,
  CURRENCY_OPTIONS,
  CAR_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from "@/lib/constants/enum-options";

interface CarFormFieldsProps {
  register: UseFormRegister<CarInput>;
  setValue: UseFormSetValue<CarInput>;
  errors: FieldErrors<CarInput>;
  formData: Partial<CarInput>;
  brands: BrandWithModels[];
  models: Model[];
  sellers: SellerOption[];
  selectedBrandId: string;
  onBrandChange: (brandId: string) => void;
}

export function CarFormFields({
  register,
  setValue,
  errors,
  formData,
  brands,
  models,
  sellers,
  selectedBrandId,
  onBrandChange,
}: CarFormFieldsProps) {
  const hasActiveSellers = sellers.some((s) => s.isActive);
  const selectedPaymentMethods = formData.paymentMethods ?? [];

  const togglePaymentMethod = (method: PaymentMethod) => {
    const current = formData.paymentMethods ?? [];
    const next = current.includes(method)
      ? current.filter((item) => item !== method)
      : [...current, method];
    setValue("paymentMethods", next, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label="Título"
          error={errors.title}
          errorId="title-error"
          htmlFor="title"
          className="md:col-span-2"
        >
          <Input
            id="title"
            aria-invalid={!!errors.title}
            aria-describedby="title-error"
            {...register("title")}
            className={errors.title ? "border-destructive" : ""}
          />
        </FormField>

        <FormField label="Marca" error={errors.brandId} errorId="brandId-error">
          <Select value={formData.brandId || ""} onValueChange={onBrandChange}>
            <SelectTrigger
              aria-invalid={!!errors.brandId}
              aria-describedby="brandId-error"
              className={errors.brandId ? "border-destructive" : ""}
            >
              <SelectValue placeholder="Seleccionar marca" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label="Modelo"
          error={errors.modelId}
          errorId="modelId-error"
        >
          <Select
            value={formData.modelId || ""}
            onValueChange={(value) =>
              setValue("modelId", value, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            disabled={!selectedBrandId}
          >
            <SelectTrigger
              aria-invalid={!!errors.modelId}
              aria-describedby="modelId-error"
              className={errors.modelId ? "border-destructive" : ""}
            >
              <SelectValue placeholder="Seleccionar modelo" />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label="Versión"
          error={errors.version}
          errorId="version-error"
          htmlFor="version"
        >
          <Input
            id="version"
            aria-invalid={!!errors.version}
            aria-describedby="version-error"
            {...register("version")}
            className={errors.version ? "border-destructive" : ""}
          />
        </FormField>

        <FormField
          label="Año"
          error={errors.year}
          errorId="year-error"
          htmlFor="year"
          className="max-w-32"
        >
          <Input
            id="year"
            type="number"
            aria-invalid={!!errors.year}
            aria-describedby="year-error"
            {...register("year", { valueAsNumber: true })}
            className={`${errors.year ? "border-destructive" : ""}no-spinner`}
          />
        </FormField>

        <FormField
          label="Kilómetros"
          error={errors.kilometers}
          errorId="kilometers-error"
          htmlFor="kilometers"
          className="max-w-30"
        >
          <Input
            id="kilometers"
            type="number"
            aria-invalid={!!errors.kilometers}
            aria-describedby="kilometers-error"
            {...register("kilometers", { valueAsNumber: true })}
            className={`${errors.kilometers ? "border-destructive" : ""}max-w-32`}
          />
        </FormField>

        <FormField
          label="Color"
          error={errors.color}
          errorId="color-error"
          htmlFor="color"
          className="max-w-32"
        >
          <Input
            id="color"
            aria-invalid={!!errors.color}
            aria-describedby="color-error"
            {...register("color")}
            className={errors.color ? "border-destructive" : ""}
          />
        </FormField>

        <FormField label="Tipo" error={errors.type} errorId="type-error">
          <EnumSelect
            value={formData.type || "SEDAN"}
            onValueChange={(value: Car["type"]) =>
              setValue("type", value, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            options={CAR_TYPE_OPTIONS}
            triggerClassName={errors.type ? "border-destructive" : ""}
            triggerAriaInvalid={!!errors.type}
            triggerAriaDescribedBy="type-error"
          />
        </FormField>

        <FormField
          label="Combustible"
          error={errors.fuelType}
          errorId="fuelType-error"
        >
          <EnumSelect
            value={formData.fuelType || "GASOLINE"}
            onValueChange={(value: Car["fuelType"]) =>
              setValue("fuelType", value, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            options={FUEL_TYPE_OPTIONS}
            triggerClassName={errors.fuelType ? "border-destructive" : ""}
            triggerAriaInvalid={!!errors.fuelType}
            triggerAriaDescribedBy="fuelType-error"
          />
        </FormField>

        <FormField
          label="Transmisión"
          error={errors.transmission}
          errorId="transmission-error"
        >
          <EnumSelect
            value={formData.transmission || "MANUAL"}
            onValueChange={(value: Car["transmission"]) => {
              if (value === "MANUAL" || value === "AUTOMATIC") {
                setValue("transmission", value, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
              }
            }}
            options={TRANSMISSION_OPTIONS}
            triggerClassName={errors.transmission ? "border-destructive" : ""}
            triggerAriaInvalid={!!errors.transmission}
            triggerAriaDescribedBy="transmission-error"
          />
        </FormField>

        <FormField
          label="Entrega Mínima"
          error={errors.price}
          errorId="price-error"
          htmlFor="price"
          className="max-w-32"
        >
          <Input
            id="price"
            type="number"
            step="1"
            aria-invalid={!!errors.price}
            aria-describedby="price-error"
            {...register("price", { valueAsNumber: true })}
            className={errors.price ? "border-destructive" : ""}
          />
        </FormField>

        <FormField
          label="Moneda"
          error={errors.currency}
          errorId="currency-error"
        >
          <EnumSelect
            value={formData.currency || "ARS"}
            onValueChange={(value: Car["currency"]) =>
              setValue("currency", value, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            options={CURRENCY_OPTIONS}
            triggerClassName={errors.currency ? "border-destructive" : ""}
            triggerAriaInvalid={!!errors.currency}
            triggerAriaDescribedBy="currency-error"
          />
        </FormField>
      </div>

      <FormField
        label="Descripción"
        error={errors.description}
        errorId="description-error"
        htmlFor="description"
      >
        <Textarea
          id="description"
          aria-invalid={!!errors.description}
          aria-describedby="description-error"
          {...register("description")}
          rows={4}
          className={errors.description ? "border-destructive" : ""}
        />
      </FormField>

      <FormField
        label="Formas de pago"
        error={errors.paymentMethods}
        errorId="paymentMethods-error"
        required
      >
        <div
          role="group"
          aria-label="Formas de pago"
          aria-describedby="paymentMethods-error"
          className="flex flex-wrap gap-x-6 gap-y-3"
        >
          {PAYMENT_METHOD_OPTIONS.map((option) => {
            const checkboxId = `paymentMethod-${option.value}`;
            const checked = selectedPaymentMethods.includes(option.value);
            return (
              <div key={option.value} className="flex items-center gap-2">
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={checked}
                  onChange={() => togglePaymentMethod(option.value)}
                  aria-invalid={!!errors.paymentMethods}
                  aria-describedby="paymentMethods-error"
                  className="size-4 shrink-0 cursor-pointer accent-primary"
                />
                <Label htmlFor={checkboxId} className="cursor-pointer">
                  {option.label}
                </Label>
              </div>
            );
          })}
        </div>
      </FormField>

      <div
        className={`grid grid-cols-1 gap-4 ${hasActiveSellers ? "md:grid-cols-2" : ""}`}
      >
        <FormField label="Estado" error={errors.status} errorId="status-error">
          <EnumSelect
            value={formData.status || "AVAILABLE"}
            onValueChange={(value: Car["status"]) =>
              setValue("status", value, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            options={CAR_STATUS_OPTIONS}
            triggerClassName={errors.status ? "border-destructive" : ""}
            triggerAriaInvalid={!!errors.status}
            triggerAriaDescribedBy="status-error"
          />
        </FormField>

        <FormField
          label="Vendedor (opcional)"
          error={errors.sellerId}
          errorId="sellerId-error"
        >
          <Select
            value={formData.sellerId || ""}
            onValueChange={(value) => {
              const NO_SELLER = "__no_seller__";
              setValue("sellerId", value === NO_SELLER ? "" : value, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          >
            <SelectTrigger
              aria-invalid={!!errors.sellerId}
              aria-describedby="sellerId-error"
              className={errors.sellerId ? "border-destructive" : ""}
            >
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__no_seller__">Sin asignar</SelectItem>
              {sellers
                .filter((seller) => seller.isActive)
                .map((seller) => (
                  <SelectItem key={seller.id} value={seller.id}>
                    {seller.firstName} {seller.lastName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
    </>
  );
}
