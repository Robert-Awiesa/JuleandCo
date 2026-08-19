"use client";

import { useEffect } from "react";
import { useForm, FormProvider, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/admin-ui/tabs";
import { api } from "../../_lib/api";
import type { AdminProduct } from "../../_lib/types";
import { productFormSchema, type ProductFormInput, type ProductFormValues } from "./schema";
import { DetailsTab } from "./DetailsTab";
import { AttributesTab } from "./AttributesTab";
import { ColorsImagesTab } from "./ColorsImagesTab";
import { InventoryTab } from "./InventoryTab";
import { CrossSellTab } from "./CrossSellTab";

function toFormValues(product?: AdminProduct): ProductFormInput {
  if (!product) {
    return {
      name: "",
      slug: "",
      category: "eyewear",
      subCategory: "",
      description: "",
      price: 0,
      images: [],
      clothingSize: [],
      lensOptions: [],
      tags: [],
      colors: [],
      variants: [],
      pairsWith: [],
      publishStatus: "draft",
    };
  }

  const colorMap = new Map<
    string,
    { colorId: string; colorLabel: string; colorHex?: string; colorImage?: string }
  >();
  product.variants.forEach((v) => {
    if (!colorMap.has(v.colorId)) {
      colorMap.set(v.colorId, {
        colorId: v.colorId,
        colorLabel: v.colorLabel,
        colorHex: v.colorHex,
        colorImage: v.colorImage,
      });
    }
  });

  return {
    name: product.name,
    slug: product.slug,
    category: product.category,
    subCategory: product.subCategory,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    images: product.images,
    frameShape: product.frameShape,
    frameMaterial: product.frameMaterial,
    lensColor: product.lensColor,
    lensOptions: product.lensOptions ?? [],
    measurements: product.measurements ?? {},
    fabric: product.fabric,
    clothingSize: product.clothingSize ?? [],
    composition: product.composition,
    fit: product.fit,
    gender: product.gender,
    careInstructions: product.careInstructions,
    isNewArrival: product.isNewArrival,
    isBestSeller: product.isBestSeller,
    tags: product.tags ?? [],
    publishStatus: product.publishStatus ?? "draft",
    costPrice: product.costPrice,
    barcode: product.barcode,
    weightGrams: product.weightGrams,
    seo: product.seo ?? {},
    colors: Array.from(colorMap.values()),
    variants: product.variants,
    pairsWith: product.pairsWith ?? [],
  };
}

export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(product);

  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: toFormValues(product),
  });

  useEffect(() => {
    function warnOnUnload(e: BeforeUnloadEvent) {
      if (form.formState.isDirty) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", warnOnUnload);
    return () => window.removeEventListener("beforeunload", warnOnUnload);
  }, [form.formState.isDirty]);

  const saveMutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const { colors, ...payload } = values;
      void colors;
      return isEditing
        ? api.put<AdminProduct>(`/products/${product!._id}`, payload)
        : api.post<AdminProduct>("/products", payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? "Product updated" : "Product created");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      router.push("/admin/products");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Zod errors on a tab the user isn't looking at are invisible otherwise —
  // a click on Save would just do nothing. Surface them as a toast.
  function onInvalid(errors: FieldErrors<ProductFormInput>) {
    const fields = Object.keys(errors);
    toast.error(
      fields.length === 1
        ? `Cannot save — check the "${fields[0]}" field.`
        : `Cannot save — ${fields.length} fields need attention: ${fields.join(", ")}.`
    );
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values), onInvalid)}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl text-obsidian">
            {isEditing ? `Edit ${product!.name}` : "New Product"}
          </h1>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded bg-obsidian px-6 py-2.5 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving…" : "Save product"}
          </button>
        </div>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="attributes">Attributes</TabsTrigger>
            <TabsTrigger value="colors">Colors &amp; Images</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="cross-sell">Cross-sell</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <DetailsTab />
          </TabsContent>
          <TabsContent value="attributes">
            <AttributesTab />
          </TabsContent>
          <TabsContent value="colors">
            <ColorsImagesTab />
          </TabsContent>
          <TabsContent value="inventory">
            <InventoryTab />
          </TabsContent>
          <TabsContent value="cross-sell">
            <CrossSellTab currentProductId={product?._id} />
          </TabsContent>
        </Tabs>
      </form>
    </FormProvider>
  );
}
