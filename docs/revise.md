Yes, this is actually a **bug in the skill base generation**, not in the extraction.

From your screenshots:

* Your source Excel (`test7033.xlsx`) contains many different IRIS codes:

  * 54
  * 92
  * 235
  * 261
  * 265
  * 378
  * 586
  * 586.1
  * 668
  * 727
  * ...and others.

* But after generating the skill base, it only contains:

  * 692
  * 727

That means the **skill base builder is incorrectly filtering or overwriting records** before they are saved.

---

# The skill base generation logic should be changed

Instead of simply reading rows and saving them, it should build the skill base like this:

```
Read every row

↓

Normalize Particular

↓

Group by Normalized Particular

↓

Collect ALL unique IRIS codes

↓

Merge duplicates

↓

Save JSON
```

---

# Example

Suppose the bank contains

| Particular | IRIS |
| ---------- | ---- |
| Ebay       | 54   |
| Ebay       | 54   |
| Ebay       | 235  |
| Ebay       | 378  |
| Ebay       | 378  |

The generated skill base should become

```json
{
  "particular": "EBAY",
  "irisCodes": [
    "54",
    "235",
    "378"
  ]
}
```

or

```json
{
  "particular": "EBAY",
  "irisCode": "54/235/378"
}
```

depending on your storage format.

---

# This is exactly the condition you mentioned

> if one particular has different iris code then add a slash and store both code

I completely agree.

For example

Input

| Particular | IRIS |
| ---------- | ---- |
| HMRC VAT   | 735  |
| HMRC VAT   | 755  |
| HMRC VAT   | 607  |

Store

```
735/755/607
```

NOT

```
735
```

and NOT

```
755
```

---

# Even better (recommended)

Instead of storing

```
735/755/607
```

inside JSON

store

```json
{
    "particular": "HMRC VAT",
    "irisCodes": [
        "735",
        "755",
        "607"
    ]
}
```

Then while exporting to Excel

display

```
735/755/607
```

This is much easier to work with later.

---

# Deduplication Rules

The builder should follow these rules:

### Case 1

Same Particular

Same IRIS

```
EBAY -> 54
EBAY -> 54
EBAY -> 54
```

Save

```
54
```

---

### Case 2

Same Particular

Different IRIS

```
EBAY -> 54
EBAY -> 235
EBAY -> 378
```

Save

```
54/235/378
```

---

### Case 3

Different formatting

```
EBAY
```

```
Ebay
```

```
ebay
```

Normalize all to

```
EBAY
```

before grouping.

---

# Also fix this

The current matching probably does

```
normalize()

↓

Map<String,String>
```

It should become

```
normalize()

↓

Map<String, Set<String>>
```

Example

```ts
Map<
    normalizedParticular,
    Set<irisCodes>
>
```

Then

```
EBAY

↓

{
54,
235,
378
}
```

instead of

```
EBAY

↓

54
```

---

# Another thing I would change

When generating the skill base, don't just save the IRIS code.

Save how many times each code appeared.

Example

```json
{
  "particular": "EBAY",
  "codes": [
    {
      "code": "54",
      "count": 128
    },
    {
      "code": "235",
      "count": 7
    },
    {
      "code": "378",
      "count": 2
    }
  ]
}
```

This is extremely useful later.

When extracting, you can automatically prioritize

```
54
```

because it occurred

```
128 times
```

instead of

```
378
```

which only appeared

```
2 times
```

The AI can also use these frequencies as additional context when deciding between multiple valid codes.

---

## I would update the skill base generation rules to this:

1. Read every row from the uploaded file.
2. Normalize the `Particular` value.
3. Group rows by the normalized `Particular`.
4. Collect **all unique IRIS codes** for each group.
5. Remove duplicate IRIS codes.
6. Store all unique codes (preferably as an array in JSON).
7. Track how many times each code appears for that `Particular`.
8. During extraction, use the most frequent code by default, but if multiple valid codes exist, expose all of them (e.g. `54/235/378`) so the accountant can choose the correct one if needed.

This change will fix the issue you're seeing where the generated skill base contains only `692` and `727` despite the source workbook having many more IRIS codes.
