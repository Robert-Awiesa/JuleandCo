"use client";

import { useEffect, useRef } from "react";
import { useForm, FormProvider, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/admin-ui/tabs";
import { api } from "../../_lib/api";
import type { AdminProduct } from "../../_lib/types";
import { useInvalidate } from "../../_lib/invalidate";
import { productFormSchema, type ProductFormInput, type ProductFormValues } from "./schema";
import { DetailsTab } from "./DetailsTab";
import { AttributesTab } from "./AttributesTab";
import { OptionsImagesTab } from "./OptionsImagesTab";
import { InventoryTab } from "./InventoryTab";
import { CrossSellTab } from "./CrossSellTab";
import { ReadinessPanel } from "./ReadinessPanel";

function toFormValues(product?: AdminProduct): ProductFormInput {
  if (!product) {
    return {
      name: "",
      slug: "",
      // Left blank so the admin must choose. There is no sensible default now
      // that categories are data rather than a two-value enum.
      category: "",
      subCategory: "",
      description: "",
      price: 0,
      images: [],
      attributes: {},
      options: [],
      variants: [],
      tags: [],
      pairsWith: [],
      publishStatus: "draft",
    };
  }

  return {
    name: product.name,
    slug: product.slug,
    category: product.category,
    subCategory: product.subCategory,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    images: product.images,

    attributes: product.attributes ?? {},
    options: product.options ?? [],
    variants: product.variants ?? [],

    isNewArrival: product.isNewArrival,
    isBestSeller: product.isBestSeller,
    tags: product.tags ?? [],
    pairsWith: product.pairsWith ?? [],

    publishStatus: product.publishStatus ?? "draft",
    costPrice: product.costPrice,
    barcode: product.barcode,
    weightGrams: product.weightGrams,
    seo: product.seo ?? {},
  };
}

export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const invalidate = useInvalidate();
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

  /**
   * Whether to leave for the list after saving, or stay and start the next one.
   * Held in a ref rather than state: it is read inside the mutation callback,
   * and a state update would not have landed by then.
   */
  const addAnother = useRef(false);

  const saveMutation = useMutation({
    mutationFn: (values: ProductFormValues) =>
      isEditing
        ? api.put<AdminProduct>(`/products/${product!._id}`, values)
        : api.post<AdminProduct>("/products", values),
    onSuccess: (saved) => {
      invalidate.catalogue();

      if (!isEditing && addAnother.current) {
        // Entering a line of pieces means the same category, sub-category and
        // tags over and over. Carrying them into the next blank form is the
        // difference between adding ten necklaces and adding one.
        toast.success(`${saved.name} created — starting the next one`);
        form.reset({
          ...toFormValues(),
          category: saved.category,
          subCategory: saved.subCategory,
          tags: saved.tags ?? [],
        });
        addAnother.current = false;
        return;
      }

      toast.success(isEditing ? "Product updated" : "Product created");
      router.push("/admin/products");
    },
    onError: (err: Error) => {
      addAnother.current = false;
      toast.error(err.message);
    },
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
          <div className="flex items-center gap-3">
            {/* Whether there is anything to lose, stated rather than implied by
                a browser dialog that only appears once it is too late. */}
            <span className="text-xs uppercase tracking-wide text-obsidian/45">
              {saveMutation.isPending
                ? "Saving…"
                : form.formState.isDirty
                  ? "Unsaved changes"
                  : "All changes saved"}
            </span>

            {!isEditing && (
              <button
                type="submit"
                onClick={() => {
                  addAnother.current = true;
                }}
                disabled={saveMutation.isPending}
                className="rounded border border-obsidian/25 px-4 py-2.5 text-xs uppercase tracking-wide text-obsidian/70 hover:border-obsidian/50 hover:text-obsidian disabled:opacity-50"
              >
                Save &amp; add another
              </button>
            )}

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded bg-obsidian px-6 py-2.5 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save product"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Tabs defaultValue="details" className="min-w-0 flex-1">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="attributes">Attributes</TabsTrigger>
              <TabsTrigger value="options">Options &amp; Images</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="cross-sell">Cross-sell</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              <DetailsTab />
            </TabsContent>
            <TabsContent value="attributes">
              <AttributesTab />
            </TabsContent>
            <TabsContent value="options">
              <OptionsImagesTab />
            </TabsContent>
            <TabsContent value="inventory">
              <InventoryTab />
            </TabsContent>
            <TabsContent value="cross-sell">
              <CrossSellTab currentProductId={product?._id} />
            </TabsContent>
          </Tabs>

          {/* Outside the tabs on purpose: what is missing is usually on a tab
              you are not looking at. */}
          <ReadinessPanel />
        </div>
      </form>
    </FormProvider>
  );
}
