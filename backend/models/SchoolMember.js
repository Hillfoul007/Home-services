const mongoose = require("mongoose");

const schoolMemberSchema = new mongoose.Schema(
  {
    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // Format: 2 uppercase letters + 4 digits e.g. AA1111, BC2345
    member_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      validate: {
        validator: function (v) {
          return /^[A-Z]{2}[0-9]{4}$/.test(v);
        },
        message: "Member ID must be 2 uppercase letters followed by 4 digits (e.g. AA1234)",
      },
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    class_section: {
      type: String,
      trim: true,
      default: "",
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Compound index: member_id unique within a school (member_id is globally unique anyway)
schoolMemberSchema.index({ school_id: 1, member_id: 1 }, { unique: true });

module.exports = mongoose.model("SchoolMember", schoolMemberSchema);
