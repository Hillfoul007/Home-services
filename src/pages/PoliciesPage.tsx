import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ShieldCheck,
  Star,
  RefreshCw,
  AlertTriangle,
  Phone,
  Smartphone,
  Clock,
  FileText,
  Info,
} from "lucide-react";

interface PolicySection {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  content: React.ReactNode;
  highlight?: boolean;
}

const PoliciesPage: React.FC = () => {
  const navigate = useNavigate();
  const [openSection, setOpenSection] = useState<string | null>("gcpp");

  const toggle = (id: string) =>
    setOpenSection((prev) => (prev === id ? null : id));

  const sections: PolicySection[] = [
    {
      id: "gcpp",
      highlight: true,
      icon: <ShieldCheck className="w-5 h-5" />,
      title: "Guaranteed Cloth Protection Program",
      subtitle: "5× refund on processing value · Free re-processing · Zero cost",
      content: (
        <div className="space-y-5 text-gray-700 text-sm leading-relaxed">
          {/* Hero callout */}
          <div className="bg-gradient-to-br from-purple-600 to-pink-500 rounded-2xl p-5 text-white">
            <p className="text-lg font-bold mb-1">
              Your clothes are fully protected with Laundrify.
            </p>
            <p className="text-white/80 text-sm">
              The Guaranteed Cloth Protection Program (GCPP) covers every
              eligible order against damage, loss, and quality issues — at
              absolutely zero cost to you.
            </p>
          </div>

          {/* 3 key benefits */}
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-start gap-3 bg-purple-50 border border-purple-100 rounded-xl p-4">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Star className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-purple-900 text-sm">
                  Up to 5× Refund on Processing Value
                </p>
                <p className="text-purple-700 text-xs mt-0.5">
                  In case of confirmed damage or loss, you receive up to{" "}
                  <strong>5 times the processing cost</strong> of the affected
                  item — as charged on your Laundrify invoice after any
                  discount. Not the retail price. Not the brand value. The
                  exact amount we charged you to process that item, multiplied
                  by 5.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl p-4">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-900 text-sm">
                  Free Re-Processing for Quality Issues
                </p>
                <p className="text-green-700 text-xs mt-0.5">
                  If your garment is returned with unsatisfactory cleaning,
                  pressing, or finishing quality, we will re-process it{" "}
                  <strong>completely free of charge</strong> — no questions
                  asked. Just report within 7 days of delivery.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-blue-900 text-sm">
                  Zero Cost — Promotional Offer
                </p>
                <p className="text-blue-700 text-xs mt-0.5">
                  This protection program is provided at <strong>no extra charge</strong> as a
                  promotional offer. It is automatically applied to all eligible
                  orders — no enrolment needed.
                </p>
              </div>
            </div>
          </div>

          {/* Eligibility */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-purple-500" />
              Eligibility — Important Condition
            </h4>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-amber-800 text-sm">
                The Guaranteed Cloth Protection Program applies{" "}
                <strong>only to orders for which full payment is made
                through the Laundrify mobile app</strong>. Cash payments,
                partial app payments, or orders placed through third-party
                platforms are not eligible for GCPP coverage.
              </p>
            </div>
          </div>

          {/* Reporting window */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-500" />
              7-Day Reporting Window
            </h4>
            <p className="text-gray-600 text-sm">
              Customers are requested to <strong>examine garments at the time of
              delivery</strong>. All damage, loss, or quality issues must be
              reported within <strong>7 days of delivery</strong>. Any complaint
              received after 7 days of delivery will be <strong>null and void</strong> and
              will not be covered under this program.
            </p>
          </div>

          {/* Item confiscation */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-purple-500" />
              Item Confiscation on Dispute
            </h4>
            <p className="text-gray-600 text-sm">
              In case a refund is approved under GCPP, the article under
              dispute will be <strong>confiscated by Laundrify</strong>. The customer
              will no longer retain the item once the refund is processed. This
              condition applies to all damage and loss claims.
            </p>
          </div>

          {/* What "order value of item" means */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h4 className="font-semibold text-gray-800 text-sm mb-1">
              What does "Order Value of Item" mean?
            </h4>
            <p className="text-gray-600 text-xs leading-relaxed">
              <strong>Order value of item</strong> refers to the{" "}
              <em>processing cost charged for that specific garment</em> on your
              Laundrify invoice — after any applicable discounts or offers. It
              is <strong>not</strong> the retail price, purchase price, or
              brand value of the garment. For example: if we charged ₹40 to
              wash and press a shirt, the maximum refund under GCPP for that
              shirt would be ₹40 × 5 = <strong>₹200</strong>.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "damage",
      icon: <AlertTriangle className="w-5 h-5" />,
      title: "Damage & Loss Coverage",
      subtitle: "What qualifies and how claims are processed",
      content: (
        <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
          <p>
            GCPP covers your garments against confirmed damage or loss that
            occurs while the item is in Laundrify's custody — from pickup to
            delivery.
          </p>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">
              What is Covered
            </h4>
            <ul className="space-y-1.5">
              {[
                "Damage caused during the washing, drying, or finishing process",
                "Discolouration or colour bleeding caused by our processing",
                "Shrinkage beyond normal tolerance due to machine handling",
                "Tearing or fraying caused during processing",
                "Item lost, misplaced, or not returned after pickup",
                "Item mixed up or delivered to wrong customer",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">
              What is NOT Covered
            </h4>
            <ul className="space-y-1.5">
              {[
                "Pre-existing damage or stains present before pickup",
                "Delicate items (silk, leather, embroidered) not declared at pickup",
                "Items sent with no-wash or dry-clean-only labels that were ignored by the customer",
                "Jewellery, cash, accessories, or valuables found inside pockets",
                "Normal fading or wear due to standard washing",
                "Orders paid via cash or outside the Laundrify app",
                "Complaints submitted after 7 days of delivery",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">
              Claim Process
            </h4>
            <ol className="space-y-2 text-gray-600">
              {[
                "Examine garments at time of delivery and note any issues immediately.",
                "Report the issue via the Laundrify app within 7 days of delivery.",
                "Upload clear photographs of the damaged or missing item.",
                "Our team investigates with the vendor within 3–5 business days.",
                "If approved, refund (up to 5× processing value) is issued and the item is confiscated.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: "reprocessing",
      icon: <RefreshCw className="w-5 h-5" />,
      title: "Free Re-Processing Policy",
      subtitle: "Not satisfied with cleaning quality? We'll redo it free",
      content: (
        <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
          <p>
            If you are not satisfied with the quality of processing — whether
            it is cleaning, washing, ironing, dry-cleaning, or any other
            service — Laundrify will arrange a{" "}
            <strong>free re-processing of the item</strong>. This is included
            in the GCPP at no additional cost.
          </p>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">
              What Qualifies for Re-Processing
            </h4>
            <ul className="space-y-1.5">
              {[
                "Clothes returned with stains or dirt not removed despite standard washing",
                "Clothes returned with poor ironing — creases not removed, new creases introduced",
                "Dry-cleaned items returned with residual odour or marks",
                "Folding or finishing quality below reasonable standard",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Conditions</h4>
            <ul className="space-y-1.5">
              {[
                "Quality issue must be reported within 7 days of delivery.",
                "The item must be returned to Laundrify in its delivered condition for re-processing.",
                "Re-processing is limited to one attempt per order.",
                "Applicable only to GCPP-eligible orders (app payment).",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-600">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-green-800 text-xs">
              <strong>Note:</strong> Re-processing is a service remedy, not a
              refund. If the quality issue persists after re-processing, you
              may escalate to a damage/loss claim under GCPP.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "general",
      icon: <FileText className="w-5 h-5" />,
      title: "General Service Terms",
      subtitle: "Pickup, delivery, billing, cancellations",
      content: (
        <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Service Coverage</h4>
            <p className="text-gray-600">
              Laundrify operates within designated service zones. Orders
              outside our coverage area may be cancelled and fully refunded.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Item Responsibility</h4>
            <p className="text-gray-600">
              Customers must check garments before handing them over. Pre-existing
              stains, damage, or defects must be declared at pickup. Laundrify is
              not liable for damage to garments already worn, torn, or stained
              before collection.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Delicate & High-Value Items</h4>
            <p className="text-gray-600">
              Do not send jewellery, cash, accessories, or valuables with your
              laundry. Delicate fabrics (silk, leather, embroidered) must be
              declared at pickup. Laundrify bears no responsibility for
              undisclosed high-value or delicate items.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Billing</h4>
            <p className="text-gray-600">
              Your bill is generated based on services selected and garment
              count or weight. A detailed invoice is available in the app.
              All charges are inclusive of applicable taxes.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Cancellation</h4>
            <p className="text-gray-600">
              Orders may be cancelled free of charge before a rider is
              assigned. Once a rider is dispatched, a cancellation fee may
              apply. Cancellations due to our fault receive a full refund.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Jurisdiction</h4>
            <p className="text-gray-600">
              All disputes are subject to the jurisdiction of Courts in the
              city of service only.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "contact",
      icon: <Phone className="w-5 h-5" />,
      title: "Contact & Grievance",
      subtitle: "How to reach us for claims and support",
      content: (
        <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
          <p>
            For any damage, loss, or quality complaints, first use the{" "}
            <strong>Help & Support</strong> section in the Laundrify app — it
            is the fastest way to file a claim and track its status.
          </p>

          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Phone className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-purple-500 font-medium uppercase tracking-wide">
                Customer Care
              </p>
              <p className="text-purple-900 font-bold text-lg">
                Contact support in-app
              </p>
              <p className="text-purple-600 text-xs">
                Available via Laundrify Help & Support
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Claim Timelines</h4>
            <div className="space-y-2">
              {[
                ["Report deadline", "Within 7 days of delivery"],
                ["Investigation turnaround", "3–5 business days"],
                ["Refund processing (if approved)", "5–7 business days"],
                ["Re-processing turnaround", "Same as standard order"],
              ].map(([label, value], i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-gray-400 text-xs">
            Laundrify reserves the right to update these policies at any time.
            The most current version is always available in the app.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/80 hover:text-white text-sm mb-5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {/* GCPP Hero badge */}
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-white/20 rounded-full px-3 py-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
              <span className="text-white text-xs font-semibold tracking-wide uppercase">
                GCPP Enabled
              </span>
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-1">Laundrify Policies</h1>
          <p className="text-white/80 text-sm">
            Guaranteed Cloth Protection Program &amp; Service Terms
          </p>

          {/* Key stats row */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { value: "5×", label: "Max Refund" },
              { value: "Free", label: "Re-processing" },
              { value: "7 Days", label: "Claim Window" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="bg-white/15 rounded-xl p-3 text-center"
              >
                <p className="text-white font-bold text-lg leading-none">
                  {value}
                </p>
                <p className="text-white/70 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {sections.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <div
              key={section.id}
              className={`rounded-2xl shadow-sm border overflow-hidden ${
                section.highlight
                  ? "border-purple-200 shadow-purple-100"
                  : "border-gray-100 bg-white"
              }`}
            >
              <button
                onClick={() => toggle(section.id)}
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${
                  section.highlight
                    ? "bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      section.highlight
                        ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white"
                        : "bg-gradient-to-br from-purple-100 to-pink-100 text-purple-600"
                    }`}
                  >
                    {section.icon}
                  </div>
                  <div>
                    <p
                      className={`font-semibold text-sm leading-tight ${
                        section.highlight ? "text-purple-900" : "text-gray-900"
                      }`}
                    >
                      {section.title}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        section.highlight ? "text-purple-500" : "text-gray-400"
                      }`}
                    >
                      {section.subtitle}
                    </p>
                  </div>
                </div>
                <div
                  className={`flex-shrink-0 ml-2 ${
                    section.highlight ? "text-purple-400" : "text-gray-400"
                  }`}
                >
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-white">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-10">
        <p className="text-center text-gray-400 text-xs">
          Last updated July 2025 · Laundrify reserves the right to modify
          these policies at any time.
        </p>
      </div>
    </div>
  );
};

export default PoliciesPage;
