import mongoose, { Schema, Document } from "mongoose";

export interface User extends Document {
  _id: string;
  id: string;
  uid: string;
  email: string;
  password: string;
  full_name: string;
  phone: string;
  user_type: "customer" | "provider" | "rider";
  created_at: Date;
  updated_at: Date;
  profile_image?: string;
  is_verified?: boolean;
  address?: string;
  preferences?: Record<string, any>;
}

const userSchema = new Schema<User>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  full_name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  user_type: {
    type: String,
    enum: ["customer", "provider", "rider"],
    default: "customer",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  profile_image: {
    type: String,
    default: "",
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  address: {
    type: String,
    default: "",
  },
  preferences: {
    type: Schema.Types.Mixed,
    default: {},
  },
});

// Update the updated_at field before saving
userSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Create indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ user_type: 1 });

export const UserModel = mongoose.model<User>("User", userSchema);
