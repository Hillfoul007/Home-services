const express = require("express");
const School = require("../models/School");
const SchoolMember = require("../models/SchoolMember");

const router = express.Router();

// Middleware to verify admin access
const verifyAdminAccess = (req, res, next) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    if (process.env.NODE_ENV === "production") {
      return res.status(500).json({ success: false, message: "Admin access not configured" });
    }
    return next();
  }
  const providedToken =
    req.headers["admin-token"] ||
    (req.headers["authorization"] || "").replace("Bearer ", "");
  if (!providedToken || providedToken !== adminSecret) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};

// ========== SCHOOL CRUD ==========

// GET all schools
router.get("/", verifyAdminAccess, async (req, res) => {
  try {
    const schools = await School.find()
      .select("-manager_password")
      .sort({ school_code: 1 });
    res.json({ success: true, data: schools });
  } catch (err) {
    console.error("Error fetching schools:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single school
router.get("/:schoolId", verifyAdminAccess, async (req, res) => {
  try {
    const school = await School.findById(req.params.schoolId).select("-manager_password");
    if (!school) return res.status(404).json({ success: false, error: "School not found" });
    res.json({ success: true, data: school });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create school
router.post("/", verifyAdminAccess, async (req, res) => {
  try {
    const {
      name,
      address,
      phone_number,
      contact_person,
      manager_username,
      manager_password,
      pricing,
    } = req.body;

    if (!name || !manager_username || !manager_password) {
      return res.status(400).json({
        success: false,
        error: "name, manager_username, and manager_password are required",
      });
    }

    // Check username uniqueness
    const existingSchool = await School.findOne({ manager_username: manager_username.trim() });
    if (existingSchool) {
      return res.status(409).json({ success: false, error: "Manager username already exists" });
    }

    const school_code = await School.generateSchoolCode();

    const school = new School({
      name: name.trim(),
      school_code,
      address: address || "",
      phone_number: phone_number || "",
      contact_person: contact_person || "",
      manager_username: manager_username.trim(),
      manager_password: manager_password,
      pricing: {
        wash_and_iron: pricing?.wash_and_iron ?? 20,
        wash_and_fold: pricing?.wash_and_fold ?? 15,
      },
    });

    await school.save();

    const result = school.toObject();
    delete result.manager_password;

    console.log(`✅ School created: ${school.name} (${school.school_code})`);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("Error creating school:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update school
router.put("/:schoolId", verifyAdminAccess, async (req, res) => {
  try {
    const { name, address, phone_number, contact_person, manager_username, manager_password, pricing, is_active } = req.body;

    const school = await School.findById(req.params.schoolId);
    if (!school) return res.status(404).json({ success: false, error: "School not found" });

    if (name) school.name = name.trim();
    if (address !== undefined) school.address = address;
    if (phone_number !== undefined) school.phone_number = phone_number;
    if (contact_person !== undefined) school.contact_person = contact_person;
    if (is_active !== undefined) school.is_active = is_active;

    if (manager_username) {
      const conflict = await School.findOne({
        manager_username: manager_username.trim(),
        _id: { $ne: school._id },
      });
      if (conflict) return res.status(409).json({ success: false, error: "Manager username already exists" });
      school.manager_username = manager_username.trim();
    }

    if (manager_password) {
      school.manager_password = manager_password;
    }

    if (pricing) {
      if (pricing.wash_and_iron !== undefined) school.pricing.wash_and_iron = pricing.wash_and_iron;
      if (pricing.wash_and_fold !== undefined) school.pricing.wash_and_fold = pricing.wash_and_fold;
    }

    await school.save();
    const result = school.toObject();
    delete result.manager_password;

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Error updating school:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE school
router.delete("/:schoolId", verifyAdminAccess, async (req, res) => {
  try {
    const school = await School.findByIdAndDelete(req.params.schoolId);
    if (!school) return res.status(404).json({ success: false, error: "School not found" });
    // Also delete members
    await SchoolMember.deleteMany({ school_id: req.params.schoolId });
    res.json({ success: true, message: "School and its members deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== SCHOOL MEMBER CRUD ==========

// GET all members of a school
router.get("/:schoolId/members", verifyAdminAccess, async (req, res) => {
  try {
    const { search } = req.query;
    const query = { school_id: req.params.schoolId };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { member_id: { $regex: search, $options: "i" } },
      ];
    }
    const members = await SchoolMember.find(query).sort({ member_id: 1 });
    res.json({ success: true, data: members });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create member
router.post("/:schoolId/members", verifyAdminAccess, async (req, res) => {
  try {
    const { name, member_id, phone, class_section } = req.body;

    if (!name || !member_id) {
      return res.status(400).json({ success: false, error: "name and member_id are required" });
    }

    // Validate member_id format: 2 letters + 4 digits
    if (!/^[A-Za-z]{2}[0-9]{4}$/.test(member_id)) {
      return res.status(400).json({
        success: false,
        error: "member_id must be 2 letters followed by 4 digits (e.g. AA1234)",
      });
    }

    // Check if school exists
    const school = await School.findById(req.params.schoolId);
    if (!school) return res.status(404).json({ success: false, error: "School not found" });

    // Check uniqueness
    const existing = await SchoolMember.findOne({ member_id: member_id.toUpperCase() });
    if (existing) {
      return res.status(409).json({ success: false, error: "Member ID already exists" });
    }

    const member = new SchoolMember({
      school_id: req.params.schoolId,
      name: name.trim(),
      member_id: member_id.toUpperCase(),
      phone: phone || "",
      class_section: class_section || "",
    });

    await member.save();
    console.log(`✅ School member created: ${member.name} (${member.member_id}) for school ${school.name}`);
    res.status(201).json({ success: true, data: member });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: "Member ID already exists" });
    }
    console.error("Error creating school member:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update member
router.put("/:schoolId/members/:memberId", verifyAdminAccess, async (req, res) => {
  try {
    const { name, phone, class_section, is_active } = req.body;
    const member = await SchoolMember.findOne({
      _id: req.params.memberId,
      school_id: req.params.schoolId,
    });
    if (!member) return res.status(404).json({ success: false, error: "Member not found" });

    if (name) member.name = name.trim();
    if (phone !== undefined) member.phone = phone;
    if (class_section !== undefined) member.class_section = class_section;
    if (is_active !== undefined) member.is_active = is_active;

    await member.save();
    res.json({ success: true, data: member });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE member
router.delete("/:schoolId/members/:memberId", verifyAdminAccess, async (req, res) => {
  try {
    const member = await SchoolMember.findOneAndDelete({
      _id: req.params.memberId,
      school_id: req.params.schoolId,
    });
    if (!member) return res.status(404).json({ success: false, error: "Member not found" });
    res.json({ success: true, message: "Member deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
