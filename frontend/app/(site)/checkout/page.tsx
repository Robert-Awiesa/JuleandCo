"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, CreditCard, Smartphone } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { Button } from "@/components/ui/Button";
import { cartLineKey, cn, describeCartLine, formatCurrency } from "@/lib/utils";

type Step = "shipping" | "payment" | "review" | "confirmation";
type PaymentMethod = "mobile_money" | "card";

const steps: { id: Step; label: string }[] = [
  { id: "shipping", label: "Shipping" },
  { id: "payment", label: "Payment" },
  { id: "review", label: "Review" },
];

export default function CheckoutPage() {
  const { lines, subtotal, clear } = useCartStore();
  const [step, setStep] = useState<Step>("shipping");
  const [orderNumber, setOrderNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");

  const [shipping, setShipping] = useState({
    fullName: "",
    phone: "",
    address: "",
    city: "",
    region: "",
  });

  const shippingCost = subtotal() > 1000 || subtotal() === 0 ? 0 : 45;
  const total = useMemo(() => subtotal() + shippingCost, [subtotal, shippingCost]);

  const stepIndex = steps.findIndex((s) => s.id === step);

  const handlePlaceOrder = () => {
    const generated = `AO-${Math.floor(100000 + Math.random() * 900000)}`;
    setOrderNumber(generated);
    clear();
    setStep("confirmation");
  };

  if (lines.length === 0 && step !== "confirmation") {
    return (
      <div className="container-elevated flex flex-col items-center justify-center gap-4 py-32 text-center">
        <p className="font-serif text-2xl">Your bag is empty</p>
        <p className="text-sm text-ink-subtle">Add something you love before checking out.</p>
        <Link href="/shop" className="btn-primary mt-2">
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (step === "confirmation") {
    return (
      <div className="container-elevated flex flex-col items-center justify-center gap-5 py-32 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sage/20 text-sage-dark">
          <Check size={26} />
        </div>
        <p className="font-serif text-3xl">Order Confirmed</p>
        <p className="max-w-sm text-sm text-ink-muted">
          Thank you — your order <span className="font-medium text-ink">{orderNumber}</span> has
          been placed. A confirmation and tracking notifications will be sent to your phone.
        </p>
        <Link href="/shop" className="btn-primary mt-2">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container-elevated py-12">
      <h1 className="mb-10 font-serif text-4xl">Checkout</h1>

      <div className="mb-12 flex items-center gap-4">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs",
                  i <= stepIndex
                    ? "border-ink bg-ink text-surface"
                    : "border-line-strong text-ink-subtle"
                )}
              >
                {i + 1}
              </span>
              <span className={cn("text-sm", i <= stepIndex ? "text-ink" : "text-ink-subtle")}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <span className="h-px w-8 bg-line-strong" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1.3fr_1fr]">
        <div>
          {step === "shipping" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep("payment");
              }}
              className="space-y-5"
            >
              <h2 className="font-serif text-2xl">Shipping Address</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <input
                  required
                  placeholder="Full Name"
                  value={shipping.fullName}
                  onChange={(e) => setShipping({ ...shipping, fullName: e.target.value })}
                  className="border border-line-strong bg-transparent px-4 py-3 text-sm focus:border-gold focus:outline-none"
                />
                <input
                  required
                  type="tel"
                  placeholder="Phone Number"
                  value={shipping.phone}
                  onChange={(e) => setShipping({ ...shipping, phone: e.target.value })}
                  className="border border-line-strong bg-transparent px-4 py-3 text-sm focus:border-gold focus:outline-none"
                />
              </div>
              <input
                required
                placeholder="Street Address"
                value={shipping.address}
                onChange={(e) => setShipping({ ...shipping, address: e.target.value })}
                className="w-full border border-line-strong bg-transparent px-4 py-3 text-sm focus:border-gold focus:outline-none"
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <input
                  required
                  placeholder="City"
                  value={shipping.city}
                  onChange={(e) => setShipping({ ...shipping, city: e.target.value })}
                  className="border border-line-strong bg-transparent px-4 py-3 text-sm focus:border-gold focus:outline-none"
                />
                <input
                  required
                  placeholder="Region"
                  value={shipping.region}
                  onChange={(e) => setShipping({ ...shipping, region: e.target.value })}
                  className="border border-line-strong bg-transparent px-4 py-3 text-sm focus:border-gold focus:outline-none"
                />
              </div>
              <Button type="submit" className="mt-2">
                Continue to Payment
              </Button>
            </form>
          )}

          {step === "payment" && (
            <div className="space-y-5">
              <h2 className="font-serif text-2xl">Payment Method</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setPaymentMethod("mobile_money")}
                  className={cn(
                    "flex items-center gap-3 border p-4 text-left transition-colors",
                    paymentMethod === "mobile_money" ? "border-line-strong" : "border-line-strong"
                  )}
                >
                  <Smartphone size={20} />
                  <div>
                    <p className="text-sm font-medium">Mobile Money</p>
                    <p className="text-xs text-ink-subtle">MTN, Vodafone, AirtelTigo</p>
                  </div>
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={cn(
                    "flex items-center gap-3 border p-4 text-left transition-colors",
                    paymentMethod === "card" ? "border-line-strong" : "border-line-strong"
                  )}
                >
                  <CreditCard size={20} />
                  <div>
                    <p className="text-sm font-medium">Card</p>
                    <p className="text-xs text-ink-subtle">Visa, Mastercard</p>
                  </div>
                </button>
              </div>

              {paymentMethod === "mobile_money" ? (
                <input
                  placeholder="Mobile Money Number"
                  className="w-full border border-line-strong bg-transparent px-4 py-3 text-sm focus:border-gold focus:outline-none"
                />
              ) : (
                <div className="space-y-4">
                  <input
                    placeholder="Card Number"
                    className="w-full border border-line-strong bg-transparent px-4 py-3 text-sm focus:border-gold focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      placeholder="MM / YY"
                      className="border border-line-strong bg-transparent px-4 py-3 text-sm focus:border-gold focus:outline-none"
                    />
                    <input
                      placeholder="CVC"
                      className="border border-line-strong bg-transparent px-4 py-3 text-sm focus:border-gold focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setStep("shipping")}>
                  Back
                </Button>
                <Button onClick={() => setStep("review")}>Review Order</Button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-6">
              <h2 className="font-serif text-2xl">Review &amp; Place Order</h2>

              <div className="border border-line p-5 text-sm">
                <p className="mb-1 text-xs uppercase tracking-widest2 text-ink-subtle">Ship To</p>
                <p>{shipping.fullName}</p>
                <p className="text-ink-muted">
                  {shipping.address}, {shipping.city}, {shipping.region}
                </p>
                <p className="text-ink-muted">{shipping.phone}</p>
              </div>

              <div className="border border-line p-5 text-sm">
                <p className="mb-1 text-xs uppercase tracking-widest2 text-ink-subtle">Payment</p>
                <p className="capitalize">{paymentMethod.replace("_", " ")}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setStep("payment")}>
                  Back
                </Button>
                <Button onClick={handlePlaceOrder}>Place Order</Button>
              </div>
            </div>
          )}
        </div>

        <div className="h-fit border border-line p-6">
          <p className="mb-5 font-serif text-xl">Order Summary</p>
          <ul className="space-y-4">
            {lines.map((line) => (
              <li key={cartLineKey(line)} className="flex gap-3">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-surface-tile">
                  <Image src={line.image} alt={line.name} fill sizes="56px" className="object-cover" />
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium">{line.name}</p>
                  <p className="text-xs text-ink-subtle">
                    {describeCartLine(line)} &times; {line.quantity}
                  </p>
                </div>
                <p className="text-sm">{formatCurrency(line.price * line.quantity)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-ink-muted">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal())}</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>Shipping</span>
              <span>{shippingCost === 0 ? "Complimentary" : formatCurrency(shippingCost)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
