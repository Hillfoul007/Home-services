import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ArrowLeft, ShieldCheck, AlertTriangle, Shirt, Search } from "lucide-react";

interface PolicySection {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  content: React.ReactNode;
}

const PoliciesPage: React.FC = () => {
  const navigate = useNavigate();
  const [openSection, setOpenSection] = useState<string | null>("general");

  const toggle = (id: string) =>
    setOpenSection((prev) => (prev === id ? null : id));

  const sections: PolicySection[] = [
    {
      id: "general",
      icon: <ShieldCheck className="w-5 h-5" />,
      title: "General Terms & Service Policy",
      subtitle: "How Laundrify operates and what we promise",
      content: (
        <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
          <p>
            Laundrify is a laundry pickup and delivery service that connects
            customers with trusted laundry vendors. By placing an order, you
            agree to the following terms of service.
          </p>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              1. Service Coverage
            </h4>
            <p>
              Laundrify operates within designated service zones. Orders placed
              outside our coverage area may be cancelled and fully refunded.
              Service availability may vary based on vendor capacity, weather
              conditions, and peak demand periods.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              2. Order Pickup & Delivery
            </h4>
            <p>
              Our riders will collect your laundry from your provided address
              within the scheduled pickup window. Delivery timelines are
              estimated and may vary. We are not responsible for delays caused
              by circumstances beyond our control (traffic, weather, vendor
              capacity).
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              3. Item Responsibility
            </h4>
            <p>
              Customers are responsible for checking their clothes before
              handing them over to our rider. Any pre-existing stains, damages,
              or defects must be reported at the time of pickup. Laundrify and
              its vendor partners are not liable for damage to garments that
              were already worn, torn, or stained before collection.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              4. Delicate & High-Value Items
            </h4>
            <p>
              We strongly advise against sending jewellery, cash, valuable
              accessories, heirlooms, or irreplaceable items with your laundry.
              Laundrify bears no responsibility for such items found inside
              pockets or bundled with clothes. Delicate fabrics (silk, leather,
              embroidered garments) must be clearly labelled and declared at
              the time of pickup so our team can handle them with extra care.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              5. Billing & Payments
            </h4>
            <p>
              Your order bill is generated based on the services selected and
              the weight or count of garments. A detailed bill will be shared
              via the app before or after delivery. Payments can be made online
              or using your Laundrify Wallet. All charges are inclusive of
              taxes as applicable.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              6. Cancellation Policy
            </h4>
            <p>
              Orders may be cancelled free of charge before a rider is
              assigned. Once a rider is dispatched, a cancellation fee may
              apply. If the cancellation is due to a fault on our end (e.g.,
              rider unable to reach, vendor not available), you will receive a
              full refund.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              7. Complaints & Grievance
            </h4>
            <p>
              Any complaint must be raised within <strong>48 hours</strong> of
              delivery. Complaints submitted after this window may not be
              considered for compensation. You can raise a complaint via the
              app's support section or by contacting our customer care team.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "damaged",
      icon: <Shirt className="w-5 h-5" />,
      title: "Clothes Damaged / Ruined Policy",
      subtitle: "What happens if your garment is damaged during the process",
      content: (
        <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
          <p>
            We take the utmost care with every garment entrusted to us.
            However, in the rare event that a garment is{" "}
            <strong>damaged, ruined, discoloured, shrunk, or torn</strong>{" "}
            during the laundering process, Laundrify will take full
            accountability and process a compensation claim.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="font-semibold text-amber-800 mb-1">
              Compensation Structure — Damaged Clothes
            </p>
            <p className="text-amber-700 text-sm">
              If the damage is confirmed to have occurred at our vendor's end,
              and the order bill is verified, you are eligible for a{" "}
              <strong>50% refund of the order bill value</strong>:
            </p>
            <ul className="mt-3 space-y-2 text-amber-800">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span>
                  <strong>25% credited to your Bank Account</strong> — refunded
                  to the original payment method within 5–7 business days.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span>
                  <strong>25% credited to your Laundrify Wallet</strong> —
                  instantly available and usable on your next Laundrify order.
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              Eligibility Conditions
            </h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>
                The damage complaint must be raised within{" "}
                <strong>48 hours</strong> of delivery.
              </li>
              <li>
                Photo/video proof of the damaged garment must be submitted
                through the app.
              </li>
              <li>
                The garment must have been in good condition at the time of
                pickup (no pre-existing damage).
              </li>
              <li>
                The item must appear on the verified order bill.
              </li>
              <li>
                Damage caused by following the garment's care label
                instructions is not covered.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              Non-Eligible Cases
            </h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>
                Garments with pre-existing damage declared or visible at
                pickup.
              </li>
              <li>
                Delicate items not declared at the time of pickup (e.g., silk,
                embroidered, leather).
              </li>
              <li>Items with no-wash or dry-clean-only labels ignored.</li>
              <li>Normal fading or wear due to standard washing.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              Investigation Process
            </h4>
            <p>
              Once a claim is submitted, our team will review the complaint
              with the vendor within <strong>3 business days</strong>. You will
              be notified of the outcome via the app. If the claim is approved,
              the refund will be processed as described above.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "lost",
      icon: <Search className="w-5 h-5" />,
      title: "Clothes Lost or Not Returned Policy",
      subtitle: "What happens if an item goes missing after pickup",
      content: (
        <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
          <p>
            In the unlikely event that a garment is{" "}
            <strong>lost, misplaced, or not returned</strong> after being
            collected by our rider or processed by our vendor, Laundrify
            acknowledges full responsibility and will process a compensation
            claim.
          </p>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-semibold text-red-800 mb-1">
              Compensation Structure — Lost Clothes
            </p>
            <p className="text-red-700 text-sm">
              If a garment is confirmed lost after internal investigation, and
              the bill is verified, you are eligible for a{" "}
              <strong>50% refund of the order bill value</strong>:
            </p>
            <ul className="mt-3 space-y-2 text-red-800">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span>
                  <strong>25% credited to your Bank Account</strong> — refunded
                  to the original payment method within 5–7 business days.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span>
                  <strong>25% credited to your Laundrify Wallet</strong> —
                  instantly available and usable on your next Laundrify order.
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              How We Investigate
            </h4>
            <p>
              Upon receiving a missing item complaint, our operations team
              will:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600 mt-2">
              <li>Contact the assigned rider and trace the pickup chain.</li>
              <li>
                Reach out to the vendor to cross-check items received and
                returned.
              </li>
              <li>
                Review any available pickup/delivery records or photos taken
                at handover.
              </li>
              <li>
                Provide a resolution within <strong>5–7 business days</strong>.
              </li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              Eligibility Conditions
            </h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>
                The missing item complaint must be raised within{" "}
                <strong>48 hours</strong> of delivery.
              </li>
              <li>
                The item must be listed on the original pickup order or
                confirmed at the time of collection.
              </li>
              <li>
                Photo proof of the item (before pickup) is encouraged but not
                mandatory.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              High-Value Items Disclaimer
            </h4>
            <p>
              For garments or items valued above ₹2,000, customers are advised
              to declare the value at the time of pickup for better
              protection. Laundrify's standard compensation is limited to 50%
              of the <strong>order bill value</strong>, not the retail or
              sentimental value of the garment. Irreplaceable or heirloom items
              should not be sent for laundry.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "destroyed",
      icon: <AlertTriangle className="w-5 h-5" />,
      title: "Clothes Destroyed Policy",
      subtitle: "Irreparable damage or complete destruction of a garment",
      content: (
        <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
          <p>
            If a garment is returned in a condition that renders it{" "}
            <strong>completely unusable</strong> — including burning (rare, due
            to machine malfunction), extreme tearing, permanent chemical
            staining, or structural destruction — this falls under our Clothes
            Destroyed Policy.
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="font-semibold text-orange-800 mb-1">
              Compensation Structure — Destroyed Clothes
            </p>
            <p className="text-orange-700 text-sm">
              If the destruction is confirmed to be caused during our
              laundering process, and the bill is verified, you are eligible
              for a <strong>50% refund of the order bill value</strong>:
            </p>
            <ul className="mt-3 space-y-2 text-orange-800">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                <span>
                  <strong>25% credited to your Bank Account</strong> — refunded
                  to the original payment method within 5–7 business days.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                <span>
                  <strong>25% credited to your Laundrify Wallet</strong> —
                  instantly available and usable on your next Laundrify order.
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              What Counts as "Destroyed"
            </h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>
                Garment is completely burnt or melted (machine/dryer
                malfunction).
              </li>
              <li>
                Extreme tearing where the garment cannot be worn in any
                capacity.
              </li>
              <li>
                Severe irreversible chemical damage (bleach spills, acid
                exposure from cleaning agents).
              </li>
              <li>
                Structural destruction that makes the fabric entirely
                unusable.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-1">
              Claim Process
            </h4>
            <p>
              Submit your claim via the app with clear photographs of the
              destroyed garment. Our team will verify the claim with the
              vendor. If the garment was destroyed due to vendor negligence or
              machine malfunction, compensation will be approved and processed
              within <strong>7 business days</strong>.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong>Note:</strong> In all damage, loss, or destruction cases,
              the refund is calculated on the <strong>order bill value</strong>{" "}
              — meaning 50% of what you paid for that particular order, split
              equally as 25% to bank and 25% to Laundrify Wallet. Laundrify
              reserves the right to reject claims where the damage was
              pre-existing, caused by the customer's own labelling
              instructions, or where the complaint was raised after the
              48-hour window.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "refund",
      icon: <ShieldCheck className="w-5 h-5" />,
      title: "Refund Policy Summary",
      subtitle: "A quick reference for all refund scenarios",
      content: (
        <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
          <p>
            The following table summarises the refund structure applicable
            across all claim types:
          </p>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-purple-600 to-pink-500 text-white">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">
                    Scenario
                  </th>
                  <th className="text-center px-4 py-3 font-semibold">
                    Total Refund
                  </th>
                  <th className="text-center px-4 py-3 font-semibold">
                    Bank A/C
                  </th>
                  <th className="text-center px-4 py-3 font-semibold">
                    Wallet
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ["Clothes Damaged / Ruined", "50%", "25%", "25%"],
                  ["Clothes Lost / Missing", "50%", "25%", "25%"],
                  ["Clothes Destroyed", "50%", "25%", "25%"],
                  ["Order Cancelled (our fault)", "100%", "100%", "0%"],
                  ["Out-of-coverage cancellation", "100%", "100%", "0%"],
                ].map(([scenario, total, bank, wallet], i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-3 text-gray-800">{scenario}</td>
                    <td className="px-4 py-3 text-center font-semibold text-purple-700">
                      {total}
                    </td>
                    <td className="px-4 py-3 text-center text-green-700 font-medium">
                      {bank}
                    </td>
                    <td className="px-4 py-3 text-center text-blue-700 font-medium">
                      {wallet}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">
              Laundrify Wallet — How it works
            </h4>
            <p>
              Wallet credits are added instantly upon claim approval. They can
              be used on any future Laundrify order and do not expire. Wallet
              credits <strong>cannot</strong> be withdrawn as cash.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">Bank Refund Timeline</h4>
            <p>
              Bank account refunds are processed within{" "}
              <strong>5–7 business days</strong> from the date of claim
              approval. The timeline may vary slightly based on your bank's
              processing speed.
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <p className="text-xs text-purple-700 leading-relaxed">
              All refund amounts are based on the{" "}
              <strong>order bill value</strong> — the amount you actually paid
              for that specific order. Laundrify does not cover the market
              value, brand value, or sentimental value of any garment beyond
              this policy.
            </p>
          </div>
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
            className="flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Laundrify Policies</h1>
          </div>
          <p className="text-white/80 text-sm ml-[52px]">
            Your rights, our responsibilities
          </p>
          <p className="text-white/60 text-xs mt-2 ml-[52px]">
            Last updated: July 2025
          </p>
        </div>
      </div>

      {/* Policy Sections */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {sections.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <div
              key={section.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <button
                onClick={() => toggle(section.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-purple-600">
                    {section.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm leading-tight">
                      {section.title}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {section.subtitle}
                    </p>
                  </div>
                </div>
                <div className="text-gray-400 flex-shrink-0 ml-2">
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-gray-100">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <p className="text-center text-gray-400 text-xs">
          For questions or to raise a claim, contact us via the app's Help &
          Support section.
          <br />
          Laundrify reserves the right to update these policies at any time.
        </p>
      </div>
    </div>
  );
};

export default PoliciesPage;
