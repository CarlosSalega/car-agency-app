"use client";

import type { CarForEdit } from "@/types/car-form";
import type React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { CarFormFields } from "@/components/cars/car-form/car-form-fields";
import { CarFormSkeleton } from "@/components/cars/car-form/car-form-skeleton";
import { FormActions } from "@/components/form/form-actions";
import { FormField } from "@/components/form/form-field";
import { ImageUpload } from "@/components/image-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBrandModels } from "@/hooks/use-brand-models";
import { useCarFormData } from "@/hooks/use-car-form-data";
import { useImageCleanup } from "@/hooks/use-image-cleanup";
import {
  carToFormValues,
  formValuesToPayload,
} from "@/lib/utils/car-form-utils";
import { carSchema, type CarInput } from "@/lib/validations/car";

interface CarFormProps {
  car?: CarForEdit;
  mode: "create" | "edit";
}

export function CarForm({ car, mode }: CarFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const { brands, sellers, loading: isDataLoading } = useCarFormData();

  const initialFormValues = useMemo(() => carToFormValues(car), [car]);

  const initialImages = useMemo(
    () =>
      Array.isArray(initialFormValues.images) ? initialFormValues.images : [],
    [initialFormValues.images],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
    trigger,
  } = useForm<CarInput>({
    resolver: zodResolver(carSchema) as Resolver<CarInput>,
    defaultValues: initialFormValues,
    mode: "onChange",
  });

  const formData = watch();

  const {
    brandId: selectedBrandId,
    models,
    handleBrandChange,
  } = useBrandModels(brands, car?.brandId);

  const { tempUploaded, setTempUploaded, cleanupUsedImages } =
    useImageCleanup();

  const onSubmit = async (data: CarInput) => {
    if (!data.images || data.images.length === 0) {
      toast.error("Debes agregar al menos una imagen");
      return;
    }

    setIsLoading(true);
    try {
      const apiUrl = mode === "create" ? "/api/cars" : `/api/cars/${car?.id}`;
      const httpMethod = mode === "create" ? "POST" : "PUT";
      const requestPayload = formValuesToPayload(data);

      const response = await fetch(apiUrl, {
        method: httpMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      if (response.ok) {
        const responseData = await response.json();
        const finalImageKeys = Array.isArray(data.images) ? data.images : [];

        cleanupUsedImages(finalImageKeys);

        const successMessage =
          mode === "create"
            ? "Vehículo creado exitosamente"
            : "Vehículo actualizado";
        toast.success(successMessage);

        router.push("/admin/cars");
        router.refresh();
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Error desconocido" }));

        const errorMessage =
          errorData.error ||
          errorData.details?.[0] ||
          "Error al guardar el vehículo";

        toast.error(errorMessage);
        console.error("API Error:", errorData);
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error(
        error instanceof Error ? error.message : "Error al guardar el vehículo",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isDataLoading) {
    return <CarFormSkeleton />;
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const isFormValid = await trigger();
        if (!isFormValid) {
          toast.error(
            "Por favor completa todos los campos requeridos correctamente",
          );
          return;
        }
        await handleSubmit(onSubmit)();
      }}
    >
      <Card className="mx-auto max-w-2xl px-2 py-6 md:px-4">
        <CardHeader className="px-2">
          <CardTitle className="text-primary flex items-center gap-2 underline">
            {mode === "create" ? (
              <Plus className="size-5" />
            ) : (
              <Edit className="size-5" />
            )}
            {mode === "create" ? "Nuevo Vehículo" : "Editar Vehículo"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 px-2">
          <CarFormFields
            register={register}
            setValue={setValue}
            errors={errors}
            formData={formData}
            brands={brands}
            models={models}
            sellers={sellers}
            selectedBrandId={selectedBrandId}
            onBrandChange={(brandId) => handleBrandChange(brandId, setValue)}
          />

          <FormField label="Imágenes" error={errors.images} required>
            <ImageUpload
              value={Array.isArray(formData.images) ? formData.images : []}
              onChange={(imageKeys) => {
                const previousImageKeys = Array.isArray(formData.images)
                  ? formData.images
                  : [];

                const newImageKeys = imageKeys.filter(
                  (imageKey) =>
                    !previousImageKeys.includes(imageKey) &&
                    !initialImages.includes(imageKey),
                );

                if (newImageKeys.length) {
                  setTempUploaded((temporaryUploaded) => {
                    const existingKeysSet = new Set(temporaryUploaded);
                    const uniqueNewKeys = newImageKeys.filter(
                      (imageKey) => !existingKeysSet.has(imageKey),
                    );
                    return uniqueNewKeys.length
                      ? [...temporaryUploaded, ...uniqueNewKeys]
                      : temporaryUploaded;
                  });
                }

                setValue("images", imageKeys, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
          </FormField>

          <FormActions
            loading={isLoading}
            mode={mode}
            onCancel={() => router.back()}
          />
        </CardContent>
      </Card>
    </form>
  );
}
