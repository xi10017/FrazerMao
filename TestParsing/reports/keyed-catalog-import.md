# Answer-key catalog import

Added **545 tests**, increasing the catalog from **335 to 880**:

| Competition | Added |
| --- | ---: |
| Regional | 25 |
| Invitational | 36 |
| States | 243 |
| Nationals | 241 |

All original catalog records were preserved. Each addition has a complete 30-question key and a matching official test and solution document. Explicitly combined test/solution files serve both roles. One missing spreadsheet answer was checked against the official solution; its provenance is in `../imports/verified_key_repairs.json`.

80 additional keyed tests lacked a matching document pair; one further pair had a broken solution link. Thirteen unrecognized spreadsheet headers were left unresolved. These are recorded in `keyed-catalog-import.json`.

Non-Drive links were checked by downloading a small byte range and verifying document signatures. Google Drive IDs were checked against official public-folder inventories; their PDF contents were not individually downloaded. Link checks are a point-in-time check, not a guarantee of future availability.

## Reproduce

From the repository root, run:

```sh
python3 TestParsing/import_keyed_catalog.py --verify-links --apply
```

The importer uses the workbooks in `regular season`, `states`, and `nationals`, archived metadata in `imports`, and the FAMAT public archive. It only adds catalog entries that are not already present. Each run replaces the JSON audit report, so preserve the report separately when comparing imports. No spreadsheet or existing catalog answer is overwritten.

The library now includes a format/topic filter and displays cards in batches of 24.
