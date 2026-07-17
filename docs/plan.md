Yes. I actually think this is a **major improvement** to the application, not just a UI change. I would change the architecture to be **company-first** instead of **file-first**.

---

# New Flow

Instead of

```text
IRIS
↓

Upload File
↓

Extract
```

it becomes

```text
IRIS

↓

Select Company

↓

Upload File

↓

Extract
```

Exactly the same for N/C.

---

# Company becomes the root of the application

Instead of this sidebar

```text
IRIS Extractor

Nominal Code Extractor

Skill Bases

Settings
```

I would make it

```text
Companies

IRIS Extractor

Nominal Code Extractor

Skill Bases

Settings
```

---

# IRIS Extractor

Instead of immediately showing the upload area

show

```text
Company

[ Forest Car                     ▼ ]

                      [+]

-------------------------------------

Upload Files
```

If no company exists

show

```text
No company selected.

Create a company first.

        [+ New Company]
```

Only after selecting a company

```text
Forest Car

↓

Upload

↓

Extract
```

---

# Same for NC

Exactly identical.

```text
Company

[ Forest Car ▼ ]

Upload

↓

Extract
```

---

# Skill Base should also become company based

Current

```text
Skill Bases

IRIS

NC
```

I would change to

```text
Company

Forest Car

↓

IRIS Skill Base

↓

NC Skill Base
```

Each company has

```text
Forest Car

IRIS Skill Base

NC Skill Base
```

Another company

```text
ABC Ltd

IRIS Skill Base

NC Skill Base
```

Much cleaner.

---

# Folder structure

Instead of

```text
knowledge-base/

iris.json

nc.json
```

make

```text
data/

companies/

    forest-car/

        company.json

        iris.json

        nc.json

    xyz-ltd/

        company.json

        iris.json

        nc.json
```

Example

```text
companies/

    7033/

        company.json

        iris.json

        nc.json
```

Later you can add

```json
{
  "id": "7033",
  "name": "Forest Car Company Ltd",
  "createdAt": "...",
  "updatedAt": "..."
}
```

without changing anything.

---

# Skill Base Upload

Current

```text
Upload IRIS Skill Base
```

becomes

```text
Company

[ Forest Car ▼ ]

Upload IRIS Skill Base
```

Same for NC.

---

# Extractor

Current

```text
Upload File

↓

Extract
```

becomes

```text
Select Company

↓

Load Company KB

↓

Upload File

↓

Extract

↓

Download
```

---

# Company Creation

Exactly like you described.

Top

```text
Company

[ Forest Car ▼ ]

             [+]
```

Click +

Opens

```text
Create Company

Company Name

______________

Save
```

Done.

---

# Another BIG improvement

I actually like your simplification.

Originally we were detecting

* multiple sheets
* bank sheets
* expense sheets
* header rows

Now

every uploaded file is guaranteed to be

```
ONE SHEET
```

and

```
ROW 1 = HEADERS
```

That removes about **40%** of the complexity.

Instead of

```text
Detect Sheet

↓

Find Header

↓

Read Data
```

you simply do

```text
Workbook

↓

First Sheet

↓

Row 1

↓

Read
```

Much cleaner.

---

# Header detection also becomes much simpler

For IRIS

Required

```text
Particulars
```

Aliases

```text
Particular

Particulars

Description

Narrative
```

IRIS column

```text
IRIS

IRIS Code
```

That's it.

No scanning row 1–25.

No metadata detection.

---

NC

Exactly the same.

Row 1

Headers

Done.

---

# Processing

Company selected

↓

Load

```
companies/

7033/

iris.json
```

↓

Normalize

↓

Match

↓

Claude if required

↓

Download

---

# Future

Later if you have

```
100 companies
```

you only load

```
Company 7033
```

instead of

```
100-company knowledge base
```

Huge performance improvement.

---

## One more major change I would make

Instead of naming the folder with the company name, use a **stable company ID** and keep the display name in `company.json`.

For example:

```text
data/
  companies/
    7033/
      company.json
      iris.json
      nc.json
    7547/
      company.json
      iris.json
      nc.json
```

`company.json`

```json
{
  "id": "7033",
  "name": "Forest Car Company Ltd"
}
```

This avoids problems if a company is renamed later—you only update the name in `company.json`, while all paths and references remain stable.

## Overall

I think these are **excellent architectural changes**. Making the application **company-first** and standardizing the input format to **one sheet with row 1 as headers** significantly simplifies the implementation while making it much easier to scale as you add more companies and larger knowledge bases. I would incorporate these changes before building the application rather than trying to retrofit them later.
