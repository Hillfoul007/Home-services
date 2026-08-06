import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit3, Trash2, RefreshCw, Copy, Store, Eye, EyeOff, MapPin } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { resolveAndParseGoogleMapsLink } from "@/utils/mapsLinkParser";

interface StoreRecord {
  _id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  phone: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  is_active: boolean;
  temp_password?: string;
  created_at: string;
  last_login?: string;
  order_sequence?: number;
  order_letter?: string;
  order_month?: string;
}

export default function AdminStoreManagement() {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  // Form state
  const [form, setForm] = useState({ store_name: "", phone: "", address: "", password: "", googleMapsLink: "", lat: "", lng: "" });
  const [saving, setSaving] = useState(false);
  const [resolvingMapsLink, setResolvingMapsLink] = useState(false);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const res = await apiClient.adminRequest<any>("/store/admin/stores");
      if (res.data?.success) {
        setStores(res.data.stores || []);
      }
    } catch (err: any) {
      toast.error("Failed to load stores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const openCreate = () => {
    setEditingStore(null);
    setForm({ store_name: "", phone: "", address: "", password: "", googleMapsLink: "", lat: "", lng: "" });
    setShowCreateDialog(true);
  };

  const openEdit = (store: StoreRecord) => {
    setEditingStore(store);
    setForm({
      store_name: store.store_name,
      phone: store.phone,
      address: store.address,
      password: "",
      googleMapsLink: "",
      lat: store.coordinates?.lat != null ? String(store.coordinates.lat) : "",
      lng: store.coordinates?.lng != null ? String(store.coordinates.lng) : "",
    });
    setShowCreateDialog(true);
  };

  const handleGoogleMapsLinkChange = async (link: string) => {
    setForm((prev) => ({ ...prev, googleMapsLink: link }));
    if (!link.trim()) return;

    setResolvingMapsLink(true);
    try {
      const parsed = await resolveAndParseGoogleMapsLink(link);
      if (parsed.error) {
        toast.error(parsed.error);
        return;
      }
      if (parsed.coordinates) {
        setForm((prev) => ({ ...prev, lat: parsed.coordinates!.lat.toString(), lng: parsed.coordinates!.lng.toString() }));
        toast.success("Location coordinates extracted");
      }
    } finally {
      setResolvingMapsLink(false);
    }
  };

  const handleSave = async () => {
    if (!form.store_name) {
      toast.error("Store name is required");
      return;
    }
    if (!editingStore && !form.password) {
      toast.error("Password is required for new stores");
      return;
    }

    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    const coordinates = !isNaN(lat) && !isNaN(lng) ? { lat, lng } : undefined;

    setSaving(true);
    try {
      if (editingStore) {
        const body: any = { store_name: form.store_name, phone: form.phone, address: form.address, coordinates };
        if (form.password) body.password = form.password;
        const res = await apiClient.adminRequest<any>(`/store/admin/stores/${editingStore._id}`, {
          method: "PUT",
          body,
        });
        if (res.data?.success) {
          toast.success("Store updated");
          setShowCreateDialog(false);
          fetchStores();
        } else {
          toast.error(res.data?.error || "Failed to update");
        }
      } else {
        const res = await apiClient.adminRequest<any>("/store/admin/stores", {
          method: "POST",
          body: { store_name: form.store_name, phone: form.phone, address: form.address, password: form.password, coordinates },
        });
        if (res.data?.success) {
          toast.success(`Store created! ID: ${res.data.store.store_id} | Code: ${res.data.store.store_code}`);
          setShowCreateDialog(false);
          fetchStores();
        } else {
          toast.error(res.data?.error || "Failed to create");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Error saving store");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (store: StoreRecord) => {
    try {
      const res = await apiClient.adminRequest<any>(`/store/admin/stores/${store._id}`, {
        method: "PUT",
        body: { is_active: !store.is_active },
      });
      if (res.data?.success) {
        toast.success(`Store ${!store.is_active ? "activated" : "deactivated"}`);
        fetchStores();
      }
    } catch {
      toast.error("Failed to toggle status");
    }
  };

  const handleDelete = async (store: StoreRecord) => {
    if (!window.confirm(`Delete store "${store.store_name}"? This cannot be undone.`)) return;
    try {
      const res = await apiClient.adminRequest<any>(`/store/admin/stores/${store._id}`, { method: "DELETE" });
      if (res.data?.success) {
        toast.success("Store deleted");
        fetchStores();
      }
    } catch {
      toast.error("Failed to delete store");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const toggleShowPassword = (id: string) =>
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Store Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage store accounts. Each store gets a unique Store ID and 5-letter code for order tracking.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStores} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Add Store
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>🏪 Store Order ID Format:</strong>{" "}
          <code className="bg-blue-100 px-1 rounded">STORE{"{CODE}"}Jan A0001</code> — Orders use the store's 5-letter code, month, and a sequential counter.
          After 9999, the letter increments (A → B → C…).
        </p>
      </div>

      {/* Stores List */}
      {loading ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">Loading stores...</p>
        </Card>
      ) : stores.length === 0 ? (
        <Card className="p-12 text-center">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No stores created yet</p>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Create First Store
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {stores.map((store) => (
            <Card key={store._id} className={`p-5 ${!store.is_active ? "opacity-60" : ""}`}>
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Left: store info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Store className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">{store.store_name}</h3>
                        <Badge variant={store.is_active ? "default" : "secondary"}>
                          {store.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {store.address && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          {store.address}
                          {store.coordinates?.lat != null && (
                            <MapPin className="w-3 h-3 text-green-600 flex-shrink-0" aria-label="Location set" />
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Credentials grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    {/* Store ID */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Store ID (login)</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-bold text-gray-800 flex-1">{store.store_id}</code>
                        <button
                          onClick={() => copyToClipboard(store.store_id, "Store ID")}
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Store Code */}
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Store Code (order IDs)</p>
                      <code className="text-base font-mono font-bold text-blue-700">{store.store_code}</code>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Next: STORE{store.store_code}{(store.order_month || "").slice(0, 3) || "Jan"}{store.order_letter || "A"}{String((store.order_sequence || 0) + 1).padStart(4, "0")}
                      </p>
                    </div>

                    {/* Password */}
                    {store.temp_password && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Password</p>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-bold text-yellow-800 flex-1">
                            {showPassword[store._id] ? store.temp_password : "••••••••"}
                          </code>
                          <button onClick={() => toggleShowPassword(store._id)} className="text-gray-400 hover:text-yellow-600">
                            {showPassword[store._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          {showPassword[store._id] && (
                            <button onClick={() => copyToClipboard(store.temp_password!, "Password")} className="text-gray-400 hover:text-blue-600">
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex gap-4 mt-3 text-xs text-gray-400">
                    {store.phone && <span>📞 {store.phone}</span>}
                    <span>Created: {new Date(store.created_at).toLocaleDateString("en-IN")}</span>
                    {store.last_login && <span>Last login: {new Date(store.last_login).toLocaleDateString("en-IN")}</span>}
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex md:flex-col gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(store)} className="flex items-center gap-1">
                    <Edit3 className="w-3 h-3" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(store)}
                    className={`flex items-center gap-1 ${store.is_active ? "text-orange-600 border-orange-200 hover:bg-orange-50" : "text-green-600 border-green-200 hover:bg-green-50"}`}
                  >
                    {store.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(store)}
                    className="flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStore ? "Edit Store" : "Create New Store"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
              <Input
                placeholder="e.g. Laundrify Sector 15"
                value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value })}
              />
              {!editingStore && form.store_name && (
                <p className="text-xs text-gray-400 mt-1">
                  Code will be: {form.store_name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5).padEnd(5, "X")}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input
                placeholder="Store phone number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <Input
                placeholder="Store address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Link</label>
              <Input
                placeholder="Paste a Google Maps link to auto-fill coordinates"
                value={form.googleMapsLink}
                onChange={(e) => handleGoogleMapsLinkChange(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                {resolvingMapsLink ? "Resolving link…" : "Used so this store can show distance in vendor/store assignment screens."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <Input
                  type="number" step="0.0001"
                  placeholder="e.g. 28.4595"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <Input
                  type="number" step="0.0001"
                  placeholder="e.g. 77.0266"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {editingStore ? "(leave blank to keep current)" : "*"}
              </label>
              <Input
                type="text"
                placeholder={editingStore ? "New password (optional)" : "Set login password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingStore ? "Update Store" : "Create Store"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
