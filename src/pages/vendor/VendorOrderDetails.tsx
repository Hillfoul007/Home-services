import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { vendorService } from "@/services/vendorService";
import { formatDateOnlyIST } from "@/utils/timeUtils";
import { toast } from "sonner";

interface OrderDetail {
    _id: string;
    custom_order_id?: string;
    name?: string;
    phone?: string;
    service?: string;
    status?: string;
    scheduled_date?: string;
    scheduled_time?: string;
    items_images?: any[];
    address?: string;
    notes?: string;
    total_price?: number;
    created_at?: string;
}

const VendorOrderDetails: React.FC = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const loadOrderDetails = async () => {
            if (!orderId) {
                toast.error("Order ID not provided");
                navigate("/vendor/dashboard");
                return;
            }

            setLoading(true);
            try {
                const res = await vendorService.fetchAssignedOrders();
                if (res && res.orders) {
                    const foundOrder = res.orders.find((o: any) => o._id === orderId);
                    if (foundOrder) {
                        setOrder(foundOrder);
                    } else {
                        toast.error("Order not found");
                        navigate("/vendor/dashboard");
                    }
                } else {
                    toast.error(res?.error || "Failed to fetch order details");
                }
            } catch (err: any) {
                toast.error(err?.message || "Failed to load order details");
            } finally {
                setLoading(false);
            }
        };

        loadOrderDetails();
    }, [orderId, navigate]);

    const handleStatusUpdate = async (newStatus: string) => {
        if (!order) return;

        setUpdating(true);
        try {
            const res = await vendorService.updateOrderStatus(order._id, newStatus);
            if (res && res.success) {
                setOrder({ ...order, status: newStatus });
                toast.success("Order status updated");
            } else {
                toast.error(res?.error || "Failed to update status");
            }
        } catch (err: any) {
            toast.error(err?.message || "Error updating status");
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-lg text-gray-600">Loading order details...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-lg text-gray-600">Order not found</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-2xl mx-auto">
                <Button
                    variant="outline"
                    onClick={() => navigate("/vendor/dashboard")}
                    className="mb-6"
                >
                    Back to Dashboard
                </Button>

                <Card className="p-6">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold mb-2">Order #{order.custom_order_id || order._id}</h1>
                        <div className="flex items-center gap-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                        order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                            'bg-yellow-100 text-yellow-800'
                                }`}>
                                {order.status || 'pending'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-600 mb-2">Customer Information</h3>
                            <div className="space-y-2">
                                <p><span className="font-medium">Name:</span> {order.name || 'N/A'}</p>
                                <p><span className="font-medium">Phone:</span> {order.phone || 'N/A'}</p>
                                <p><span className="font-medium">Address:</span> {order.address || 'N/A'}</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-gray-600 mb-2">Order Details</h3>
                            <div className="space-y-2">
                                <p><span className="font-medium">Service:</span> {order.service || 'N/A'}</p>
                                <p><span className="font-medium">Scheduled Date:</span> {order.scheduled_date ? formatDateOnlyIST(order.scheduled_date) : 'N/A'}</p>
                                <p><span className="font-medium">Scheduled Time:</span> {order.scheduled_time || 'N/A'}</p>
                                <p><span className="font-medium">Total Price:</span> ₹{order.total_price || '0'}</p>
                            </div>
                        </div>
                    </div>

                    {order.notes && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-600 mb-2">Notes</h3>
                            <p className="text-gray-700">{order.notes}</p>
                        </div>
                    )}

                    {order.items_images && order.items_images.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-600 mb-2">Item Images</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {order.items_images.map((image: any, index: number) => (
                                    <div key={index} className="aspect-square bg-gray-200 rounded overflow-hidden">
                                        {typeof image === 'string' ? (
                                            <img src={image} alt={`Item ${index + 1}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                Image unavailable
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="border-t pt-6">
                        <h3 className="text-sm font-semibold text-gray-600 mb-4">Update Status</h3>
                        <div className="flex flex-wrap gap-3">
                            {['pending', 'in_progress', 'completed', 'cancelled'].map((status) => (
                                <Button
                                    key={status}
                                    variant={order.status === status ? 'default' : 'outline'}
                                    onClick={() => handleStatusUpdate(status)}
                                    disabled={updating}
                                    className="capitalize"
                                >
                                    {status.replace('_', ' ')}
                                </Button>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default VendorOrderDetails;
