import { getApiUrl } from "@/config/env";

const API_BASE = getApiUrl();

export const vendorService = {
  async login(vendor_id: string, password: string) {
    const resp = await fetch(`${API_BASE}/vendor/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_id, password }),
    });
    return resp.json();
  },

  async fetchAssignedOrders(status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    const resp = await fetch(`${API_BASE}/vendor/orders/assigned-orders${q}`, {
      headers: {
        ...(localStorage.getItem("laundrify_token")
          ? { Authorization: `Bearer ${localStorage.getItem("laundrify_token")}` }
          : {}),
      },
    });
    return resp.json();
  },

  async fetchOrder(orderId: string) {
    const resp = await fetch(`${API_BASE}/vendor/orders/${orderId}`, {
      headers: {
        ...(localStorage.getItem("laundrify_token")
          ? { Authorization: `Bearer ${localStorage.getItem("laundrify_token")}` }
          : {}),
      },
    });
    return resp.json();
  },

  async uploadItemsImage(orderId: string, file: File) {
    const form = new FormData();
    form.append("items_image", file);
    const resp = await fetch(`${API_BASE}/vendor/orders/${orderId}/upload-items-image`, {
      method: "POST",
      headers: {
        ...(localStorage.getItem("laundrify_token")
          ? { Authorization: `Bearer ${localStorage.getItem("laundrify_token")}` }
          : {}),
      },
      body: form,
    });
    return resp.json();
  },

  async updateOrderStatus(orderId: string, status: string) {
    const resp = await fetch(`${API_BASE}/vendor/orders/${orderId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(localStorage.getItem("laundrify_token")
          ? { Authorization: `Bearer ${localStorage.getItem("laundrify_token")}` }
          : {}),
      },
      body: JSON.stringify({ status }),
    });
    return resp.json();
  },
};
