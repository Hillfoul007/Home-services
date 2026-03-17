import React, { useState, useEffect } from "react";
import { Package } from "lucide-react";
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

      if (pkgsRes.data?.success) {
        setPackages(pkgsRes.data.packages);
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
    <div className="flex flex-col h-full bg-slate-50 relative z-50">
      <div className="flex items-center justify-between p-4 bg-white shadow-sm shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
          <Package className="w-5 h-5 text-indigo-600" />
          Subscription Packages
        </h2>
        <Button variant="ghost" onClick={onClose} size="sm">
          Close
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {packages.map(pkg => (
                  <Card key={pkg._id} className="overflow-hidden border-slate-200 premium-service-card group">
                     <CardHeader className="bg-slate-50 pb-4 border-b">
                        <div className="flex justify-between items-start">
                           <div>
                              <CardTitle className="text-lg font-bold text-slate-800">{pkg.name}</CardTitle>
                              <CardDescription className="text-sm mt-1">{pkg.description}</CardDescription>
                           </div>
                           <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none shrink-0 ml-2">
                             {pkg.validity_days} Days
                           </Badge>
                        </div>
                     </CardHeader>
                     <CardContent className="pt-4 flex items-center justify-between">
                        <div>
                           <p className="text-sm text-slate-500 mb-1">Pay</p>
                           <p className="text-2xl font-bold text-slate-800">₹{pkg.price}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-sm text-slate-500 mb-1">Get Wallet Credit</p>
                           <p className="text-2xl font-bold text-green-600">₹{pkg.wallet_amount}</p>
                        </div>
                     </CardContent>
                     <CardFooter className="pt-0">
                        <Button 
                           onClick={() => handlePurchase(pkg)} 
                           className="w-full premium-add-button"
                        >
                           Buy Package
                        </Button>
                     </CardFooter>
                  </Card>
               ))}
             </div>
          )}
        </div>
        
        {/* History */}
        {userPackages.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-bold mb-4 text-slate-800">Purchase History</h3>
            <div className="space-y-3">
               {userPackages.map(up => (
                 <div key={up._id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between items-center">
                   <div>
                     <p className="font-medium text-slate-800">{up.package_id?.name || 'Unknown Package'}</p>
                     <p className="text-xs text-slate-500">
                       Credited: ₹{up.amount_credited}
                     </p>
                   </div>
                   <div className="text-right">
                     <p className="text-sm text-slate-600">
                       Valid till {new Date(up.validity_end).toLocaleDateString()}
                     </p>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
