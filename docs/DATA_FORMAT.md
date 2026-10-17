# Data file format

The app ships empty. It becomes functional only after importing a JSON data
file, which is distributed manually and must **never** be committed to this
repository (see `.gitignore`).

## Schema v1

```json
{
  "schema": 1,
  "source": "drawing-reference-or-revision",
  "powerBlocks": {
    "PB01": {
      "inverters": {
        "1.1": ["SB25", "SB26", "SB27", "SB28", "SB29"],
        "1.2": ["SB03", "SB08", "SB09", "SB14", "SB30"]
      }
    },
    "PB02": {
      "inverters": {
        "2.1": ["SB01", "SB02", "SB05", "SB11", "SB12"]
      }
    }
  }
}
```

Notes:

- `powerBlocks` keys identify the transformer station (CT). The CT number is
  taken from the digits in the key (`PB01` → CT 1).
- `inverters` keys are the inverter identifiers as used on site (`1.1` =
  CT 1, inverter 1).
- Each inverter maps to the list of DC boxes (string boxes) connected to it.
  Numbering is per power block and is not necessarily contiguous per inverter.
- The example above is fictional.

## Planned extensions

- Schema v2: panel-row mapping (row → DC box / inverter / CT / NCU) to enable
  the reverse lookup on the Rows tab.
