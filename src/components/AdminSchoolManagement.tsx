import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Edit, Trash2, Users, AlertCircle, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface School {
  _id: string;
  name: string;
  school_code: string;
  address: string;
  phone_number: string;
  contact_person: string;
  manager_username: string;
  pricing: { wash_and_iron: number; wash_and_fold: number };
  is_active: boolean;
  created_at: string;
}

interface SchoolMember {
  _id: string;
  school_id: string;
  name: string;
  member_id: string;
  phone: string;
  class_section: string;
  is_active: boolean;
}

interface SchoolFormData {
  name: string;
  address: string;
  phone_number: string;
  contact_person: string;
  manager_username: string;
  manager_password: string;
  wash_and_iron: string;
  wash_and_fold: string;
}

interface MemberFormData {
  name: string;
  member_id: string;
  phone: string;
  class_section: string;
}

const emptySchoolForm: SchoolFormData = {
  name: "",
  address: "",
  phone_number: "",
  contact_person: "",
  manager_username: "",
  manager_password: "",
  wash_and_iron: "20",
  wash_and_fold: "15",
};

const emptyMemberForm: MemberFormData = {
  name: "",
  member_id: "",
  phone: "",
  class_section: "",
};

const AdminSchoolManagement: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // School dialogs
  const [showSchoolDialog, setShowSchoolDialog] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [schoolForm, setSchoolForm] = useState<SchoolFormData>(emptySchoolForm);
  const [showPassword, setShowPassword] = useState(false);
  const [savingSchool, setSavingSchool] = useState(false);

  // Member management
  const [expandedSchoolId, setExpandedSchoolId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, SchoolMember[]>>({});
  const [memberSearch, setMemberSearch] = useState<Record<string, string>>({});
  const [loadingMembers, setLoadingMembers] = useState<string | null>(null);

  // Member dialogs
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<SchoolMember | null>(null);
  const [currentSchoolForMember, setCurrentSchoolForMember] = useState<School | null>(null);
  const [memberForm, setMemberForm] = useState<MemberFormData>(emptyMemberForm);
  const [savingMember, setSavingMember] = useState(false);

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.adminRequest<any>("/school-management");
      if (res.data?.success) {
        setSchools(res.data.data || []);
      } else {
        setError(res.data?.error || "Failed to load schools");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load schools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const fetchMembers = async (schoolId: string, search = "") => {
    setLoadingMembers(schoolId);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await apiClient.adminRequest<any>(`/school-management/${schoolId}/members${params}`);
      if (res.data?.success) {
        setMembers((prev) => ({ ...prev, [schoolId]: res.data.data || [] }));
      }
    } catch (err) {
      toast.error("Failed to load members");
    } finally {
      setLoadingMembers(null);
    }
  };

  const toggleMembers = (schoolId: string) => {
    if (expandedSchoolId === schoolId) {
      setExpandedSchoolId(null);
    } else {
      setExpandedSchoolId(schoolId);
      fetchMembers(schoolId);
    }
  };

  // -------- School CRUD --------

  const openAddSchool = () => {
    setEditingSchool(null);
    setSchoolForm(emptySchoolForm);
    setShowPassword(false);
    setShowSchoolDialog(true);
  };

  const openEditSchool = (school: School) => {
    setEditingSchool(school);
    setSchoolForm({
      name: school.name,
      address: school.address,
      phone_number: school.phone_number,
      contact_person: school.contact_person,
      manager_username: school.manager_username,
      manager_password: "",
      wash_and_iron: String(school.pricing.wash_and_iron),
      wash_and_fold: String(school.pricing.wash_and_fold),
    });
    setShowPassword(false);
    setShowSchoolDialog(true);
  };

  const saveSchool = async () => {
    if (!schoolForm.name.trim() || !schoolForm.manager_username.trim()) {
      toast.error("School name and manager username are required");
      return;
    }
    if (!editingSchool && !schoolForm.manager_password.trim()) {
      toast.error("Manager password is required for new schools");
      return;
    }

    setSavingSchool(true);
    try {
      const payload: any = {
        name: schoolForm.name.trim(),
        address: schoolForm.address.trim(),
        phone_number: schoolForm.phone_number.trim(),
        contact_person: schoolForm.contact_person.trim(),
        manager_username: schoolForm.manager_username.trim(),
        pricing: {
          wash_and_iron: parseFloat(schoolForm.wash_and_iron) || 0,
          wash_and_fold: parseFloat(schoolForm.wash_and_fold) || 0,
        },
      };
      if (schoolForm.manager_password.trim()) {
        payload.manager_password = schoolForm.manager_password;
      }

      let res;
      if (editingSchool) {
        res = await apiClient.adminRequest<any>(`/school-management/${editingSchool._id}`, {
          method: "PUT",
          body: payload,
        });
      } else {
        res = await apiClient.adminRequest<any>("/school-management", {
          method: "POST",
          body: payload,
        });
      }

      if (res.data?.success) {
        toast.success(editingSchool ? "School updated" : "School created");
        setShowSchoolDialog(false);
        fetchSchools();
      } else {
        toast.error(res.data?.error || "Failed to save school");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save school");
    } finally {
      setSavingSchool(false);
    }
  };

  const deleteSchool = async (school: School) => {
    if (!confirm(`Delete school "${school.name}" and all its members? This cannot be undone.`)) return;
    try {
      const res = await apiClient.adminRequest<any>(`/school-management/${school._id}`, {
        method: "DELETE",
      });
      if (res.data?.success) {
        toast.success("School deleted");
        fetchSchools();
      } else {
        toast.error(res.data?.error || "Failed to delete");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  // -------- Member CRUD --------

  const openAddMember = (school: School) => {
    setEditingMember(null);
    setCurrentSchoolForMember(school);
    setMemberForm(emptyMemberForm);
    setShowMemberDialog(true);
  };

  const openEditMember = (school: School, member: SchoolMember) => {
    setEditingMember(member);
    setCurrentSchoolForMember(school);
    setMemberForm({
      name: member.name,
      member_id: member.member_id,
      phone: member.phone,
      class_section: member.class_section,
    });
    setShowMemberDialog(true);
  };

  const saveMember = async () => {
    if (!memberForm.name.trim() || !memberForm.member_id.trim()) {
      toast.error("Name and Member ID are required");
      return;
    }
    if (!/^[A-Za-z]{2}[0-9]{4}$/.test(memberForm.member_id)) {
      toast.error("Member ID must be 2 letters + 4 digits (e.g. AA1234)");
      return;
    }
    if (!currentSchoolForMember) return;

    setSavingMember(true);
    try {
      const payload = {
        name: memberForm.name.trim(),
        member_id: memberForm.member_id.toUpperCase(),
        phone: memberForm.phone.trim(),
        class_section: memberForm.class_section.trim(),
      };

      let res;
      if (editingMember) {
        res = await apiClient.adminRequest<any>(
          `/school-management/${currentSchoolForMember._id}/members/${editingMember._id}`,
          { method: "PUT", body: payload }
        );
      } else {
        res = await apiClient.adminRequest<any>(
          `/school-management/${currentSchoolForMember._id}/members`,
          { method: "POST", body: payload }
        );
      }

      if (res.data?.success) {
        toast.success(editingMember ? "Member updated" : "Member added");
        setShowMemberDialog(false);
        fetchMembers(currentSchoolForMember._id, memberSearch[currentSchoolForMember._id] || "");
      } else {
        toast.error(res.data?.error || "Failed to save member");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save member");
    } finally {
      setSavingMember(false);
    }
  };

  const deleteMember = async (school: School, member: SchoolMember) => {
    if (!confirm(`Remove member "${member.name}" (${member.member_id})?`)) return;
    try {
      const res = await apiClient.adminRequest<any>(
        `/school-management/${school._id}/members/${member._id}`,
        { method: "DELETE" }
      );
      if (res.data?.success) {
        toast.success("Member removed");
        fetchMembers(school._id, memberSearch[school._id] || "");
      } else {
        toast.error(res.data?.error || "Failed to delete member");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete member");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
        <span className="text-gray-600">Loading schools...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">School Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage schools, their members and custom pricing. Order IDs: SCH{"{code}"}-MMYY-0001
          </p>
        </div>
        <Button onClick={openAddSchool} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add School
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {schools.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            No schools added yet. Click "Add School" to create the first one.
          </CardContent>
        </Card>
      )}

      {/* Schools list */}
      {schools.map((school) => (
        <Card key={school._id} className="border border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-700 font-bold text-sm">{school.school_code}</span>
                </div>
                <div>
                  <CardTitle className="text-base">{school.name}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Login: <span className="font-mono text-gray-700">{school.manager_username}</span>
                    {school.contact_person && ` • ${school.contact_person}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={school.is_active ? "default" : "secondary"} className="text-xs">
                  {school.is_active ? "Active" : "Inactive"}
                </Badge>
                <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200">
                  Iron: ₹{school.pricing.wash_and_iron}/item
                </span>
                <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-200">
                  Fold: ₹{school.pricing.wash_and_fold}/item
                </span>
                <Button size="sm" variant="outline" onClick={() => openEditSchool(school)}>
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => deleteSchool(school)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleMembers(school._id)}
                  className="flex items-center gap-1"
                >
                  <Users className="w-3 h-3" />
                  Members
                  {expandedSchoolId === school._id ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Members section */}
          {expandedSchoolId === school._id && (
            <CardContent className="border-t pt-4">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <Input
                  placeholder="Search by name or member ID..."
                  className="max-w-xs text-sm"
                  value={memberSearch[school._id] || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMemberSearch((prev) => ({ ...prev, [school._id]: v }));
                    fetchMembers(school._id, v);
                  }}
                />
                <Button size="sm" onClick={() => openAddMember(school)} className="flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  Add Member
                </Button>
              </div>

              {loadingMembers === school._id ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                  <span className="text-sm text-gray-500">Loading members...</span>
                </div>
              ) : (members[school._id] || []).length === 0 ? (
                <p className="text-sm text-gray-400 py-2 text-center">No members found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 pr-4 font-medium">Member ID</th>
                        <th className="pb-2 pr-4 font-medium">Name</th>
                        <th className="pb-2 pr-4 font-medium">Class/Section</th>
                        <th className="pb-2 pr-4 font-medium">Phone</th>
                        <th className="pb-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(members[school._id] || []).map((m) => (
                        <tr key={m._id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2 pr-4">
                            <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                              {m.member_id}
                            </span>
                          </td>
                          <td className="py-2 pr-4 font-medium">{m.name}</td>
                          <td className="py-2 pr-4 text-gray-500">{m.class_section || "—"}</td>
                          <td className="py-2 pr-4 text-gray-500">{m.phone || "—"}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => openEditMember(school, m)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-red-500 hover:text-red-700"
                                onClick={() => deleteMember(school, m)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}

      {/* School Dialog */}
      <Dialog open={showSchoolDialog} onOpenChange={setShowSchoolDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSchool ? "Edit School" : "Add School"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">School Name *</label>
                <Input
                  value={schoolForm.name}
                  onChange={(e) => setSchoolForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Delhi Public School"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Address</label>
                <Input
                  value={schoolForm.address}
                  onChange={(e) => setSchoolForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="School address"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <Input
                    value={schoolForm.phone_number}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, phone_number: e.target.value }))}
                    placeholder="Phone number"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Contact Person</label>
                  <Input
                    value={schoolForm.contact_person}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, contact_person: e.target.value }))}
                    placeholder="Manager name"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">Manager Login Credentials</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Username *</label>
                  <Input
                    value={schoolForm.manager_username}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, manager_username: e.target.value }))}
                    placeholder="e.g. dps_manager"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Password {editingSchool ? "(leave blank to keep)" : "*"}
                  </label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={schoolForm.manager_password}
                      onChange={(e) => setSchoolForm((p) => ({ ...p, manager_password: e.target.value }))}
                      placeholder={editingSchool ? "New password (optional)" : "Password"}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">Custom Pricing (per item)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Wash & Iron (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    value={schoolForm.wash_and_iron}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, wash_and_iron: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Wash & Fold (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    value={schoolForm.wash_and_fold}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, wash_and_fold: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSchoolDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveSchool} disabled={savingSchool}>
              {savingSchool ? "Saving..." : editingSchool ? "Update School" : "Create School"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Dialog */}
      <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Edit Member" : "Add Member"}{" "}
              {currentSchoolForMember && (
                <span className="text-sm font-normal text-gray-500">— {currentSchoolForMember.name}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Student Name *</label>
              <Input
                value={memberForm.name}
                onChange={(e) => setMemberForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Member ID * <span className="text-gray-400 font-normal text-xs">(2 letters + 4 digits, e.g. AA1234)</span>
              </label>
              <Input
                value={memberForm.member_id}
                onChange={(e) => setMemberForm((p) => ({ ...p, member_id: e.target.value.toUpperCase() }))}
                placeholder="AA1234"
                maxLength={6}
                className="mt-1 font-mono"
                disabled={!!editingMember}
              />
              {editingMember && (
                <p className="text-xs text-gray-400 mt-1">Member ID cannot be changed after creation.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Class/Section</label>
                <Input
                  value={memberForm.class_section}
                  onChange={(e) => setMemberForm((p) => ({ ...p, class_section: e.target.value }))}
                  placeholder="e.g. 10-A"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Phone</label>
                <Input
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Contact number"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMemberDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveMember} disabled={savingMember}>
              {savingMember ? "Saving..." : editingMember ? "Update Member" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSchoolManagement;
