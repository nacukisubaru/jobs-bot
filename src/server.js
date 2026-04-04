import express from "express";
import multer from "multer";
import fs from "fs";
import unzipper from "unzipper";
import path from "path";

const app = express();
const upload = multer({ dest: "tmp/" });
const PROFILE_PATH = "./hh-profile";

// Статика для верстки
app.use(express.static("public"));

// Обработка загрузки
app.post("/upload", upload.single("profile"), async (req, res) => {
  try {
    const filePath = req.file.path;

    if (fs.existsSync(PROFILE_PATH)) {
      fs.rmSync(PROFILE_PATH, { recursive: true, force: true });
    }

    await fs
      .createReadStream(filePath)
      .pipe(unzipper.Extract({ path: PROFILE_PATH }))
      .promise();

    res.send("✅ Profile uploaded successfully!");
    console.log("Profile updated");

  } catch (err) {
    console.error(err);
    res.status(500).send("Error uploading profile");
  }
});

app.listen(3000, () => {
  console.log("Upload server running at http://localhost:3000");
});