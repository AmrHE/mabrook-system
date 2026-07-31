import mongoose from "mongoose";

/**
 * Admin-added city/district entries that aren't in the bundled national dataset
 * ({@link ../utils/geo/saudiLocations.data}). Holds only the *deltas* — the base
 * list stays static and server-only. The valid-options set exposed to the
 * dropdowns is (static dataset ∪ these rows). Names are stored in their canonical
 * display spelling; matching/dedup folds them via `foldArabic`.
 */
const LocationAdditionSchema = new mongoose.Schema({
  // "city" additions have no parent; "district" additions belong to a city (by name).
  kind: {
    type: String,
    enum: ["city", "district"],
    required: true,
  },

  // Canonical display name of the added city or district.
  name: {
    type: String,
    required: true,
    trim: true,
  },

  // Parent city name — required for kind === "district", unused for "city".
  city: {
    type: String,
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

export const LocationAddition =
  mongoose.models.LocationAddition ||
  mongoose.model("LocationAddition", LocationAdditionSchema);
