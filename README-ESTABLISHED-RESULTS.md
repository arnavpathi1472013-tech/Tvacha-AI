# Tvacha AI — Established Results

This guide explains how to add a **dermatologist-reviewed reference image** and its accompanying educational record to Tvacha AI.

## Important: what an Established Result means

Established Results are reference records prepared or reviewed by a qualified dermatologist. The app only selects one when the visitor's uploaded file is **byte-for-byte identical** to a registered reference image.

A match does **not** establish that the visitor has the same condition. The app displays the dermatologist-reviewed notes as information about the reference image, with a clear limitation notice. It must not be presented as a diagnosis of the visitor.

The current matcher uses SHA-256 exact-file matching. A resized, cropped, edited, screenshot, or recompressed copy will normally not match. This conservative behaviour is intentional: visual resemblance alone must not be used to transfer a diagnosis from one person to another.

## 1. Folder structure

Place the registry and sample files inside `public`, because the current app serves static assets from that directory:

```text
public/
  established-results/
    index.json
    samples/
      sample-001/
        image.jpg
        result.json
      sample-002/
        image.png
        result.json
```

The browser loads the registry from:

```text
/established-results/index.json
```

Do not put this folder beside `public` at the repository root. In the current project layout, files outside `public` are not part of the static asset directory.

## 2. Register a sample in `index.json`

`public/established-results/index.json` is the list of reference samples. Keep `version` at `1`.

Example:

```json
{
  "version": 1,
  "samples": [
    {
      "id": "sample-001",
      "image": "samples/sample-001/image.jpg",
      "result": "samples/sample-001/result.json"
    },
    {
      "id": "sample-002",
      "image": "samples/sample-002/image.png",
      "result": "samples/sample-002/result.json"
    }
  ]
}
```

For each new sample:

1. Create a new folder under `samples/`, using a unique ID such as `sample-003`.
2. Put the reference image in that folder.
3. Put its result record in `result.json`.
4. Add one object to the `samples` array.
5. Make sure the `id` in the registry matches the `id` inside its result JSON.

Paths in the registry are relative to `public/established-results/`. Do not start them with `/` and do not use `..`.

## 3. Format of `result.json`

Use this structure:

```json
{
  "id": "sample-001",
  "title": "Dermatologist-reviewed reference: descriptive title",
  "referenceCondition": "Condition name as recorded by the reviewing dermatologist",
  "observations": [
    "Visible feature documented from this reference image",
    "Another documented observation"
  ],
  "explanation": "A concise explanation based on the dermatologist-reviewed notes. Describe the reference record, not the visitor.",
  "recommendations": [
    "General educational guidance approved for this reference record"
  ],
  "medicalAttention": "State the appropriate general advice about when an individual should seek professional assessment.",
  "disclaimer": "This record describes a dermatologist-reviewed reference image. It does not diagnose the person who uploaded a matching file. A qualified clinician must assess each individual.",
  "review": {
    "reviewerRole": "Dermatologist",
    "reviewDate": "YYYY-MM-DD",
    "source": "Describe the source of the notes or review"
  }
}
```

### Field guide

| Field | Required? | What to enter |
|---|---|---|
| `id` | Yes | Must exactly match the registry ID |
| `title` | Yes | Short, neutral heading |
| `referenceCondition` | No | Condition label from the reviewer |
| `observations` | No | Array of visible observations actually supported by the image/reviewer |
| `explanation` | Yes | Reviewer-approved educational explanation |
| `recommendations` | No | General, reviewer-approved guidance; no unsupervised prescription advice |
| `medicalAttention` | No | Appropriate general advice on seeking care |
| `disclaimer` | Yes | Keep the individual-assessment limitation explicit |
| `review` | No | Reviewer role, review date and source description |

Use valid JSON:
- Use double quotes around keys and string values.
- Separate array items with commas.
- Do not add comments.
- Do not leave a trailing comma after the final item.
- Use `[]` for an empty list and `""` for an intentionally empty string.

## 4. Add a dermatologist-reviewed image

1. Confirm that you have permission to use the image for this project and public demonstration.
2. Avoid images that identify a person. Do not include names, faces, contact details, or other identifying information.
3. Use a JPG, PNG, or WebP image.
4. Preserve the original file exactly. Do not edit, crop, resize, screenshot, or recompress it after registering it. The app compares exact file bytes.
5. Create a unique sample folder, for example `public/established-results/samples/sample-003/`.
6. Add the image as `image.jpg` (or the matching extension).
7. Add the reviewed record as `result.json`.
8. Add the sample to `public/established-results/index.json`.
9. Commit the files to GitHub and wait for the site deployment to finish.
10. Test by uploading that exact original image file. The result should say **ESTABLISHED REFERENCE MATCH** and show the limitation notice.

## 5. Example new sample

Folder:

```text
public/established-results/samples/sample-003/
  image.jpg
  result.json
```

Registry entry:

```json
{
  "id": "sample-003",
  "image": "samples/sample-003/image.jpg",
  "result": "samples/sample-003/result.json"
}
```

The contents of `result.json` should use the full schema in section 3, with actual reviewer-approved content. Do not copy placeholder medical content into a public demonstration.

## 6. What happens when there is no match?

- If the file exactly matches a registered sample, the app displays that sample's pre-established educational reference.
- If it does not match, the app continues to the existing `/api/analyze` workflow.
- If the reference registry cannot be loaded, the app logs the lookup problem and continues to the normal analysis path.
- If the visitor is offline and there is no available exact reference match, the normal online AI analysis cannot run; the app shows its offline screen.

The Established Results matcher does not use AI, does not decide whether two different-looking photos show the same condition, and does not infer a diagnosis from visual similarity.

## 7. Privacy and review checklist

Before using this feature with visitors:

- Obtain permission from the image owner and the appropriate parent/guardian or school authority where required.
- Obtain dermatologist review of the written record and the intended public wording.
- Use only images you are authorized to publish.
- Do not add patient names, dates of birth, phone numbers, addresses, or medical record numbers.
- Do not claim that an image match confirms a visitor's condition.
- Keep the normal safety checks and urgent-care guidance in place.
- Have a qualified adult supervise public demonstrations involving health information.

## 8. Troubleshooting

**The sample never matches**
- Make sure you upload the exact same file that is stored in the sample folder.
- Check the file extension and registry paths.
- Confirm that `index.json` is located at `public/established-results/index.json`.
- Confirm that the deployment includes the files under `public/`.

**The page reports that the registry is unavailable**
- Check that `/established-results/index.json` opens on the deployed site.
- Check that the JSON is valid.
- Check that the site has finished deploying.

**The result does not display**
- Confirm the `id` is identical in the registry and result JSON.
- Confirm `title`, `explanation`, and `disclaimer` are strings.
- Confirm that the result path points to the correct file.

---

This is an educational reference feature, not a diagnostic device or a substitute for an in-person medical assessment.
