
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SAMPLES_DIR = path.join(
  ROOT,
  "public",
  "established-results",
  "samples"
);
const INDEX_FILE = path.join(
  ROOT,
  "public",
  "established-results",
  "index.json"
);

const REQUIRED_FIELDS = [
  "id",
  "title",
  "explanation",
  "disclaimer"
];

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await fs.mkdir(SAMPLES_DIR, { recursive: true });

  const entries = await fs.readdir(SAMPLES_DIR, {
    withFileTypes: true
  });

  const samples = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const id = entry.name;
    const folder = path.join(SAMPLES_DIR, id);
    const imageFile = path.join(folder, "image.jpg");
    const resultFile = path.join(folder, "result.json");

    if (!(await exists(imageFile)) || !(await exists(resultFile))) {
      console.warn(`Skipping incomplete sample: ${id}`);
      continue;
    }

    let result;

    try {
      result = JSON.parse(
        await fs.readFile(resultFile, "utf8")
      );
    } catch (error) {
      throw new Error(`Invalid JSON in ${id}/result.json: ${error.message}`);
    }

    if (result.id !== id) {
      throw new Error(
        `ID mismatch in ${id}/result.json. Expected "${id}", got "${result.id}".`
      );
    }

    for (const field of REQUIRED_FIELDS) {
      if (typeof result[field] !== "string" || !result[field].trim()) {
        throw new Error(
          `Missing or invalid "${field}" in ${id}/result.json`
        );
      }
    }

    samples.push({
      id,
      image: `samples/${id}/image.jpg`,
      result: `samples/${id}/result.json`
    });

    console.log(`Indexed: ${id}`);
  }

  samples.sort((a, b) => a.id.localeCompare(b.id));

  const index = {
    version: 1,
    samples
  };

  await fs.writeFile(
    INDEX_FILE,
    JSON.stringify(index, null, 2) + "\n"
  );

  console.log(`\nSuccessfully indexed ${samples.length} sample(s).`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
