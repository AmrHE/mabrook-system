import mongoose from "mongoose";

/**
 * Admin-added nationalities that aren't in the bundled dataset
 * ({@link ../utils/nationality/nationalities.data}). Holds only the deltas; the
 * base list stays static. The valid set exposed to the dropdown / validation is
 * (dataset ∪ these rows). `name` is the canonical feminine spelling; matching
 * folds it via `foldArabic`.
 */
const NationalityAdditionSchema = new mongoose.Schema({
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

export const NationalityAddition =
  mongoose.models.NationalityAddition ||
  mongoose.model("NationalityAddition", NationalityAdditionSchema);
