import React, { useState, useEffect } from "react";
import { Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { packageApi } from "@/lib/api";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface UserPackagesProps {
  currentUser: any;
  onClose: () => void;
}

export default function UserPackages({ currentUser, onClose }: UserPackagesProps) {
  const [packages, setPackages] = useState<any[]>([]);
  const [userPackages, setUserPackages] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [validity, setValidity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [pkgsRes, userPkgsRes] = await Promise.all([
        packageApi.getPackages(),
        packageApi.getUserPackages(currentUser._id)
      ]);

      console.log("📦 Package API response:", JSON.stringify(pkgsRes));
      console.log("📦 User package API response:", JSON.stringify(userPkgsRes));

      if (pkgsRes.data?.success) {
        setPackages(pkgsRes.data.packages || []);
        console.log(`📦 Found ${(pkgsRes.data.packages || []).length} available packages`);
      } else {
        console.warn("📦 Package fetch returned non-success:", pkgsRes);
      }

      if (userPkgsRes.data?.success) {
        setUserPackages(userPkgsRes.data.history || []);
        setBalance(userPkgsRes.data.current_balance || 0);
        setValidity(userPkgsRes.data.current_validity || null);
      }
    } catch (error) {
      console.error("Error fetching package data:", error);
      toast.error("Failed to load packages");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: any) => {
    try {
      if (!window.Razorpay) {
        toast.error("Payment SDK not loaded. Please try again.");
        return;
      }

      // Step 1: Create Order via backend
      const orderRes = await packageApi.createOrder({
        packageId: pkg._id,
        userId: currentUser._id,
      });

      if (!orderRes.data?.success) {
        throw new Error(orderRes.data?.message || "Failed to create order");
      }

      const { order } = orderRes.data;

      // Step 2: Open Razorpay checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "YOUR_KEY_ID",
        amount: order.amount,
        currency: order.currency,
        name: "Laundrify Packages",
        description: `Purchase ${pkg.name}`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            // Step 3: Verify payment on backend
            const verifyRes = await packageApi.verifyPayment({
               razorpay_order_id: response.razorpay_order_id,
               razorpay_payment_id: response.razorpay_payment_id,
               razorpay_signature: response.razorpay_signature,
               packageId: pkg._id,
               userId: currentUser._id,
            });

            if (verifyRes.data?.success) {
               toast.success("Package purchased successfully!");
               fetchData(); // Refresh UI
            } else {
               throw new Error(verifyRes.data?.message || "Payment verification failed");
            }
          } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Something went wrong during verification.");
          }
        },
        prefill: {
          name: currentUser.full_name || currentUser.name,
          contact: currentUser.phone,
          email: currentUser.email || "",
        },
        theme: {
          color: "#4f46e5",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        toast.error(`Payment Failed: ${response.error.description || "Unknown error"}`);
      });
      
      rzp.open();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to initiate purchase.");
    }
  };

  const isExpired = validity ? new Date(validity) < new Date() : true;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="flex items-center justify-between p-4 bg-white shadow-sm shrink-0 sticky top-0 z-10 border-b border-slate-100">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
          <Package className="w-5 h-5 text-indigo-600" />
          Subscription Packages
        </h2>
        <Button variant="ghost" onClick={onClose} size="sm" className="text-slate-500 hover:text-slate-700">
          <X className="w-4 h-4 mr-1" />
          Close
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-8">
        
        {/* Current Active Package Status */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
             <Package className="w-24 h-24" />
          </div>
          <h3 className="text-lg font-medium opacity-90 mb-1">Your Package Balance</h3>
          <div className="text-4xl font-bold mb-3 z-10 relative">₹{balance}</div>
          
          {validity ? (
            <div className={`text-sm py-1 px-3 inline-block rounded-full z-10 relative ${isExpired ? 'bg-red-500/20 text-red-100 border border-red-500/30' : 'bg-white/20 text-white'}`}>
              {isExpired ? 'Expired on' : 'Valid until'}: {new Date(validity).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </div>
          ) : (
            <div className="text-sm opacity-80 z-10 relative">No active package</div>
          )}
        </div>

        {/* Available Packages */}
        <div>
          <h3 className="text-lg font-bold mb-4 text-slate-800">Available Packages</h3>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading packages...</div>
          ) : packages.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg border border-slate-200">
              <p className="text-slate-500">No packages available at the moment.</p>
            </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               {packages.map((pkg, idx) => {
                  const gradients = [
                    "from-rose-400 to-red-500",
                    "from-blue-400 to-indigo-500",
                    "from-emerald-400 to-teal-500",
                    "from-amber-400 to-orange-500",
                    "from-fuchsia-400 to-purple-500"
                  ];
                  const gradient = gradients[idx % gradients.length];
                  
                  return (
                    <div 
                      key={pkg._id} 
                      className={`relative overflow-hidden rounded-2xl border border-slate-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white`}
                    >
                      {/* Decorative header gradient */}
                      <div className={`h-2 w-full bg-gradient-to-r ${gradient}`}></div>
                      
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-xl font-black text-slate-800 tracking-tight">{pkg.name}</h4>
                            <p className="text-sm text-slate-500 mt-1 font-medium">{pkg.description}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${gradient} text-white shadow-sm shrink-0 ml-2`}>
                            {pkg.validity_days} Days
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-5 relative overflow-hidden">
                          <div className="flex justify-between items-center relative z-10">
                            <div>
                               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pay</p>
                               <p className="text-3xl font-black text-slate-800 leading-none">₹{pkg.price}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">Get Credit</p>
                               <p className="text-3xl font-black text-emerald-600 leading-none">₹{pkg.wallet_amount}</p>
                            </div>
                          </div>
                          <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-gradient-to-r ${gradient} opacity-10 blur-xl`}></div>
                        </div>
                        
                        <Button 
                           onClick={() => handlePurchase(pkg)} 
                           className={`w-full text-base font-bold text-white shadow-md hover:shadow-lg transition-all duration-200 bg-gradient-to-r ${gradient} border-0 h-12 rounded-xl`}
                        >
                           Get Package
                        </Button>
                      </div>
                    </div>
                  );
               })}
             </div>
          )}
        </div>
        
        {/* History */}
        <div className="mt-8">
          <h3 className="text-lg font-bold mb-4 text-slate-800">Your Packages</h3>
          {userPackages.length > 0 ? (
            <div className="space-y-3">
               {userPackages.map(up => (
                 <div key={up._id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between items-center relative overflow-hidden">
                   {new Date(up.validity_end) < new Date() && (
                     <div className="absolute top-0 right-0 bottom-0 w-1 bg-red-400"></div>
                   )}
                   {new Date(up.validity_end) >= new Date() && (
                     <div className="absolute top-0 right-0 bottom-0 w-1 bg-green-400"></div>
                   )}
                   <div>
                     <p className="font-medium text-slate-800">{up.package_id?.name || 'Assigned Package'}</p>
                     <p className="text-xs text-slate-500">
                       Credited: ₹{up.amount_credited}
                     </p>
                   </div>
                   <div className="text-right">
                     <p className={`text-sm ${new Date(up.validity_end) < new Date() ? 'text-red-500' : 'text-slate-600'}`}>
                       {new Date(up.validity_end) < new Date() ? 'Expired' : 'Valid till'} {new Date(up.validity_end).toLocaleDateString()}
                     </p>
                   </div>
                 </div>
               ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">You haven't purchased or been assigned any packages yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
