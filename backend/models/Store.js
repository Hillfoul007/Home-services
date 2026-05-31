const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");

const storeSchema = new mongoose.Schema(
  {
    store_id: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    store_code: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      maxlength: 5,
      minlength: 5,
    },
    password_hash: {
      type: String,
      required: true,
      select: false,
    },
    temp_password: {
      type: String,
      select: false,
    },
    store_name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Order sequence tracking per month
    order_sequence: {
      type: Number,
      default: 0,
    },
    order_letter: {
      type: String,
      default: "A",
    },
    order_month: {
      type: String,
      default: "",
    },
    created_by: mongoose.Schema.Types.ObjectId,
    last_login: Date,
    created_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    },
    updated_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    },
  },
  {
    timestamps: true,
    collection: "stores",
  }
);

storeSchema.index({ store_id: 1 });
storeSchema.index({ is_active: 1, created_at: -1 });

// Generate unique 5-letter store code from store name
storeSchema.statics.generateStoreCode = async function (storeName) {
  const base = (storeName || "STORE")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 5)
    .padEnd(5, "X");

  let code = base;
  let suffix = 0;

  while (await this.findOne({ store_code: code })) {
    suffix++;
    const suffixStr = suffix.toString().slice(-1);
    code = base.slice(0, 4) + suffixStr;
  }

  return code;
};

// Generate unique store_id
storeSchema.statics.generateStoreId = function () {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `STR${timestamp}${random}`;
};

// Generate next store order ID: STORE{code}{Mon}{letter}{0001}
storeSchema.methods.nextOrderId = async function () {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = `${months[now.getMonth()]}${now.getFullYear()}`;

  if (this.order_month !== currentMonth) {
    this.order_sequence = 0;
    this.order_letter = "A";
    this.order_month = currentMonth;
  }

  this.order_sequence += 1;

  if (this.order_sequence > 9999) {
    this.order_sequence = 1;
    const nextLetterCode = this.order_letter.charCodeAt(0) + 1;
    this.order_letter = nextLetterCode > 90 ? "A" : String.fromCharCode(nextLetterCode);
  }

  await this.save();

  const seq = String(this.order_sequence).padStart(4, "0");
  const mon = months[now.getMonth()];
  return `STORE${this.store_code}${mon}${this.order_letter}${seq}`;
};

storeSchema.pre("save", async function (next) {
  if (!this.store_id) {
    this.store_id = this.constructor.generateStoreId();
  }

  if (!this.store_code) {
    this.store_code = await this.constructor.generateStoreCode(this.store_name);
  }

  if (this.isModified("password_hash") && this.password_hash && !/^\$2[aby]\$/.test(this.password_hash)) {
    const salt = await bcryptjs.genSalt(10);
    this.password_hash = await bcryptjs.hash(this.password_hash, salt);
  }

  next();
});

storeSchema.methods.comparePassword = async function (plain) {
  return bcryptjs.compare(plain, this.password_hash);
};

storeSchema.methods.setPassword = async function (newPassword) {
  const salt = await bcryptjs.genSalt(10);
  this.password_hash = await bcryptjs.hash(newPassword, salt);
  this.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return this.save();
};

module.exports = mongoose.model("Store", storeSchema);
