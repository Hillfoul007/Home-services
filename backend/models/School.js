const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    school_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      // Auto-generated 2-digit code e.g. "01", "02"
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    phone_number: {
      type: String,
      trim: true,
      default: "",
    },
    contact_person: {
      type: String,
      trim: true,
      default: "",
    },

    // Manager login credentials
    manager_username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    manager_password: {
      type: String,
      required: true,
    },

    // Custom pricing for this school
    pricing: {
      wash_and_iron: {
        type: Number,
        default: 20,
        min: 0,
      },
      wash_and_fold: {
        type: Number,
        default: 15,
        min: 0,
      },
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

// Hash password before save
schoolSchema.pre("save", async function (next) {
  if (!this.isModified("manager_password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.manager_password = await bcrypt.hash(this.manager_password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password
schoolSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.manager_password);
};

// Auto-generate school_code before creation
schoolSchema.statics.generateSchoolCode = async function () {
  const lastSchool = await this.findOne(
    { school_code: { $exists: true } },
    null,
    { sort: { school_code: -1 } }
  );

  if (!lastSchool || !lastSchool.school_code) {
    return "01";
  }

  const lastCode = parseInt(lastSchool.school_code, 10);
  if (isNaN(lastCode)) return "01";
  return String(lastCode + 1).padStart(2, "0");
};

module.exports = mongoose.model("School", schoolSchema);
