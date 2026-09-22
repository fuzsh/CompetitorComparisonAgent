---
name: selecting-schema
description: Builds the ordered comparison field set by merging the core universal fields with an industry preset and any user-defined custom rows, de-duplicated by id. Use after segmentation and before extraction to decide which rows the table will have; never hardcode competitor-specific rows.
---
# Selecting schema

## Steps (deterministic; `backend/pipeline.py::select_schema`)
1. Always include `presets/core_fields.json`: starting_price, key_features, target_audience, positioning_angle, notable_weakness.
2. Append `presets/<industry>.json` when it exists (saas, consumer, services, hardware); `generic` adds nothing.
3. Append user custom rows validated against `schemas/FieldDefinition.json`, flagged `custom: true`.
4. De-duplicate by id, keeping first occurrence so table order is reproducible.

## Output
An ordered array of FieldDefinition objects. Adding a preset file or a custom row changes the table with no code change.
