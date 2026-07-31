import mongoose from "mongoose";

/**
 * Admin-added projects beyond the seeded base
 * ({@link ../utils/project/projects.server}). Holds only the *deltas* — "mabrook"
 * stays in the static base. The valid set exposed to the dropdown / validation is
 * (base ∪ these rows). `name` is the canonical display spelling; matching/dedup
 * folds it via `foldArabic`.
 */
const ProjectAdditionSchema = new mongoose.Schema({
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

export const ProjectAddition =
  mongoose.models.ProjectAddition ||
  mongoose.model("ProjectAddition", ProjectAdditionSchema);
