import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  version: { type: Number, default: 1 },
  size: { type: Number, required: true },
  mimetype: { type: String, required: true },
  path: { type: String, required: true }, // MinIO object path
  isCurrent: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const fileModel = mongoose.model("file",fileSchema)

export default fileModel