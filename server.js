require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs/promises");
const path = require("path");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = process.env.PORT || 3000;
const dataDir = path.join(__dirname, "data");
const attendanceFile = path.join(dataDir, "attendance.json");
const submissionsFile = path.join(dataDir, "submissions.json");
const uploadsDir = path.join(__dirname, "uploads");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static(uploadsDir));

async function ensureJsonFile(filePath) {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf8");
  }
}

async function readJsonArray(filePath) {
  await ensureJsonFile(filePath);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

async function writeJsonArray(filePath, items) {
  await ensureJsonFile(filePath);
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), "utf8");
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function upsertById(filePath, id, payload) {
  const items = await readJsonArray(filePath);
  const nextItem = {
    ...payload,
    id,
    updatedAtIso: new Date().toISOString()
  };
  const index = items.findIndex((item) => item.id === id);
  if (index >= 0) {
    items[index] = { ...items[index], ...nextItem };
  } else {
    items.push(nextItem);
  }
  await writeJsonArray(filePath, items);
  return nextItem;
}

function sanitizeFilename(filename = "tep-dinh-kem") {
  const normalized = path.basename(filename).replace(/[^\w.\-]+/g, "-");
  return normalized.replace(/-+/g, "-").replace(/^-|-$/g, "") || "tep-dinh-kem";
}

function hasSubmissionPayload(payload = {}) {
  return Boolean(
    payload.assignmentId &&
    payload.studentId &&
    (String(payload.content || "").trim() || payload.attachmentUrl)
  );
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "MindX Quantum LMS API" });
});

app.get("/api/attendance", async (_req, res) => {
  try {
    const items = await readJsonArray(attendanceFile);
    res.json({ ok: true, items });
  } catch (error) {
    console.error("Attendance read error:", error);
    res.status(500).json({ ok: false, message: error.message || "Khong doc duoc diem danh." });
  }
});

app.put("/api/attendance/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    if (!payload.classId || !payload.date || !Array.isArray(payload.records)) {
      return res.status(400).json({ ok: false, message: "Du lieu diem danh khong hop le." });
    }

    const item = await upsertById(attendanceFile, id, {
      ...payload,
      savedAtIso: payload.savedAtIso || new Date().toISOString()
    });

    res.json({ ok: true, item });
  } catch (error) {
    console.error("Attendance write error:", error);
    res.status(500).json({ ok: false, message: error.message || "Khong luu duoc diem danh." });
  }
});

app.post("/api/attendance/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    if (!payload.classId || !payload.date || !Array.isArray(payload.records)) {
      return res.status(400).json({ ok: false, message: "Du lieu diem danh khong hop le." });
    }

    const item = await upsertById(attendanceFile, id, {
      ...payload,
      savedAtIso: payload.savedAtIso || new Date().toISOString()
    });

    res.json({ ok: true, item });
  } catch (error) {
    console.error("Attendance write error:", error);
    res.status(500).json({ ok: false, message: error.message || "Khong luu duoc diem danh." });
  }
});

app.get("/api/submissions", async (_req, res) => {
  try {
    const items = await readJsonArray(submissionsFile);
    res.json({ ok: true, items });
  } catch (error) {
    console.error("Submission read error:", error);
    res.status(500).json({ ok: false, message: error.message || "Khong doc duoc bai nop." });
  }
});

app.put("/api/submissions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    if (!hasSubmissionPayload(payload)) {
      return res.status(400).json({ ok: false, message: "D? li?u b?i n?p kh?ng h?p l?." });
    }

    const item = await upsertById(submissionsFile, id, {
      ...payload,
      submittedAtMs: payload.submittedAtMs || Date.now(),
      submittedAtIso: payload.submittedAtIso || new Date().toISOString(),
      submittedAtText: payload.submittedAtText || new Date().toLocaleString("vi-VN")
    });

    res.json({ ok: true, item });
  } catch (error) {
    console.error("Submission write error:", error);
    res.status(500).json({ ok: false, message: error.message || "Kh?ng l?u ???c b?i n?p." });
  }
});

app.post("/api/submissions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    if (!hasSubmissionPayload(payload)) {
      return res.status(400).json({ ok: false, message: "D? li?u b?i n?p kh?ng h?p l?." });
    }

    const item = await upsertById(submissionsFile, id, {
      ...payload,
      submittedAtMs: payload.submittedAtMs || Date.now(),
      submittedAtIso: payload.submittedAtIso || new Date().toISOString(),
      submittedAtText: payload.submittedAtText || new Date().toLocaleString("vi-VN")
    });

    res.json({ ok: true, item });
  } catch (error) {
    console.error("Submission write error:", error);
    res.status(500).json({ ok: false, message: error.message || "Kh?ng l?u ???c b?i n?p." });
  }
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "Thi?u file upload." });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      await ensureDir(uploadsDir);
      const safeName = sanitizeFilename(req.file.originalname);
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const localPath = path.join(uploadsDir, fileName);

      await fs.writeFile(localPath, req.file.buffer);

      return res.json({
        ok: true,
        url: `/uploads/${fileName}`,
        name: req.file.originalname || safeName,
        mimeType: req.file.mimetype,
        size: req.file.size,
        resourceType: "local"
      });
    }

    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: process.env.CLOUDINARY_FOLDER || "mindx-school-hub",
      resource_type: "auto"
    });

    res.json({
      ok: true,
      url: result.secure_url,
      name: req.file.originalname || path.basename(result.public_id),
      publicId: result.public_id,
      resourceType: result.resource_type,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ ok: false, message: error.message || "Upload th?t b?i." });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "home.html"));
});

app.get("/home", (_req, res) => {
  res.sendFile(path.join(__dirname, "home.html"));
});

app.get("/app", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.listen(port, () => {
  console.log(`MindX Quantum LMS server running at http://localhost:${port}`);
});
