Yes. I understand exactly what you're trying to build, and I think you should build this as a **specialized production tool**, not a generic AI chat application.

Your application has only **two jobs**:

1. **IRIS Code Extraction (Bank Statements)**
2. **Nominal Code (N/C) Extraction (Purchase Day Books / Expense Sheets)**

Everything in the application should be optimized around those two workflows.

---

# Project Goal

Create a lightweight internal web application that accountants can use to upload multiple Excel/CSV files and automatically generate a single output file with IRIS codes or N/C codes.

No authentication.

No chat interface.

No general AI.

Just two AI-powered extraction services.

---

# Recommended Tech Stack

## Frontend

* Next.js 16 (App Router)
* TypeScript
* TailwindCSS
* shadcn/ui
* React Hook Form
* TanStack Table
* react-dropzone

---

## Backend

Use Next.js Route Handlers.

No separate backend.

```
app/api/iris
app/api/nc
```

---

## AI

Claude API

Each service has its own prompt.

```
IRIS Service
↓

Bank Statement

↓

Claude

↓

IRIS Codes

------------------

NC Service

↓

Purchase Day Book

↓

Claude

↓

Nominal Codes
```

Never mix the prompts.

---

## Storage

No database.

Only temporary processing.

Upload

↓

Process

↓

Return Excel

↓

Delete temporary files

Nothing is stored.

---

# Application Layout

```
Sidebar

📄 IRIS Extractor

📄 Nominal Code Extractor

⚙ Settings
```

Settings only contains

* Claude API Key
* Default output format
* Version

Nothing else.

---

# Service 1

# IRIS Extractor

Purpose

Upload Year End bank workbook(s).

Example

```
YE_7033_Forest Car Company Ltd_30.11.23 2.xlsx
```

The application should automatically detect all bank sheets.

Examples

```
Barclays Bank Ac -30470120

Barclays Bank Ac 50237620

Lloyds

HSBC

Natwest
```

Ignore non-bank sheets.

---

## Accepted Input

```
xlsx

xls

csv
```

Multiple upload

```
✔ file1.xlsx

✔ file2.xlsx

✔ file3.xlsx
```

---

## Skill Base

Exactly as you've already designed.

Required columns

```
Particular

IRIS Code
```

Accepted headers

```
Particular

Description

Narrative

Details

Payee
```

IRIS

```
IRIS Code

IRIS CODE

iris code

anything containing

iris

code
```

Optional

```
Type

Notes
```

---

## AI Workflow

Upload workbook

↓

Find bank sheets

↓

Read rows

↓

Normalize Particulars

↓

Search IRIS Skill Base

↓

Claude only resolves uncertain matches

↓

Generate output

---

Output

```
Original workbook

+

IRIS Code column

+

Confidence

(optional)
```

---

# Service 2

# Nominal Code Extractor

Input

```
Expense workbook

Purchase Day Book

CSV

Excel
```

Example

```
feb 2024 - expense client sheet 7033.xlsx
```

Automatically detect

```
Expense

PDB

Purchase

Invoices
```

Ignore unrelated sheets.

---

Skill Base

Exactly

```
Details

N/C
```

Accepted headers

```
Details

Particular

Description

Narrative

Payee
```

NC headers

```
N/C

NC

Nominal Code

Nominal

Code
```

---

Workflow

Upload

↓

Read Expense sheet

↓

Normalize Details

↓

Search N/C Skill Base

↓

Claude resolves uncertain matches

↓

Return Excel

---

# Multi-file Processing

The application should support uploading many client files simultaneously.

Example

```
Client1.xlsx

Client2.xlsx

Client3.xlsx

Client4.xlsx
```

Each file is processed independently.

When complete

Generate

```
Client1_IRIS.xlsx

Client2_IRIS.xlsx

Client3_IRIS.xlsx

Client4_IRIS.xlsx
```

and optionally

```
Download All.zip
```

Same for NC.

---

# Skill Base Management

Separate page.

```
Sidebar

Skill Bases

├── IRIS

└── Nominal Codes
```

Upload

```
xlsx

xls

csv
```

The application builds the searchable knowledge base automatically.

---

IRIS Skill Base

```
Particular

IRIS Code

Type

Notes
```

---

NC Skill Base

```
Details

N/C
```

Duplicates automatically merged.

---

# AI Pipeline

```
Workbook

↓

Sheet Detection

↓

Column Detection

↓

Row Extraction

↓

Text Cleaning

↓

Knowledge Base Lookup

↓

Claude Verification

↓

IRIS/NC Selection

↓

Output Workbook
```

Claude should **not** process every row. It should only be invoked when the local knowledge base cannot determine a high-confidence match. This hybrid approach is faster, cheaper, and more consistent than sending every row to the model.

---

# Folder Structure

```
app/

    iris/

    nc/

    settings/

    api/

components/

    upload/

    tables/

    sidebar/

lib/

    excel/

    ai/

    iris/

    nc/

    parser/

    output/

    matching/

    normalization/

knowledge-base/

    iris.json

    nc.json

types/

public/
```

---

# Export Format

Always preserve the client's workbook.

Only append new columns.

IRIS

```
Particular

Money In

Money Out

Balance

IRIS Code
```

NC

```
Date

Supplier

Details

Amount

N/C
```

No existing formatting should be lost.

---

# Production Features

* Drag-and-drop upload with support for multiple files.
* Queue processing with progress indicators.
* Sheet auto-detection based on expected headers.
* Automatic header normalization (e.g., `Particular`, `Description`, `Narrative` all map to the same logical field).
* Fast hybrid matching (knowledge base first, AI only for uncertain rows).
* Download processed files individually or as a ZIP.
* Error report for skipped sheets or rows with missing required columns.
* Detailed processing log (rows processed, matched locally, matched by AI, unresolved).
* Configurable confidence threshold for AI fallback.
* Temporary file cleanup after processing.

---

## Future Phase (Optional)

Once the core application is stable, you can extend it with:

* Company-specific knowledge bases.
* Automatic knowledge base learning from accountant corrections.
* Batch processing of hundreds of files.
* OCR support for scanned PDFs.
* Invoice extraction and year-end document processing.
* Background job queue (e.g., BullMQ + Redis) for very large workloads.
* Audit history and versioned knowledge bases.

This architecture keeps the application focused, maintainable, and optimized for your accounting workflow rather than becoming a general-purpose AI system. One important security note: do **not** hardcode or commit your Claude API key into the project. Store it in environment variables on the deployment platform so it remains private.
