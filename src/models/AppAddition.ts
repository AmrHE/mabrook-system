import mongoose from "mongoose";

/**
 * Admin-added app names for the `Mom.installedApp` picker. Mirrors
 * {@link ./ProjectAddition} — there is no bundled base list, so the valid set
 * exposed to the dropdown is exactly these rows ({@link ../utils/app/apps.server}).
 * `name` is the canonical display spelling; matching/dedup folds it via `foldArabic`.
 */
const AppAdditionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const AppAddition =
  mongoose.models.AppAddition || mongoose.model("AppAddition", AppAdditionSchema);
