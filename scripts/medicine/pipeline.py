#!/usr/bin/env python3
"""Deterministic, conservative NationX medicine catalogue builder."""

from __future__ import annotations

import argparse
import csv
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
import difflib
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata
from typing import Iterable

from scripts.medicine.xlsx_reader import CellValue, WorkbookFormatError, read_workbook


PIPELINE_VERSION = "nationx-medicine-v1"
APPROVED_MARKET_SHA = "fa0767285719e093b124a2e68958e86afab9619e499a79e466024f095b0b8791"
APPROVED_REGISTERED_SHA = "9ef9f366426757948d24c7a0326b9838771bd524076429c077e6c103cb1b3015"
MARKET_HEADERS = (
    "brand id", "brand name", "type", "slug", "dosage form", "generic",
    "strength", "manufacturer", "package container", "Package Size",
)
REGISTERED_HEADERS = (
    "sl", "pharmaceutical", "name", "generic_name", "strength", "dosages",
    "price", "use_for", "dar",
)
MONEY = re.compile(r"(?P<amount>(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)")
PACKAGE_PRICE = re.compile(
    r"(?:^|,)\s*\(?\s*(?P<label>[^,:]+?)\s*:\s*৳\s*"
    r"(?P<amount>(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*\)?",
    re.IGNORECASE,
)
REGISTERED_PRICE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(?:Tk)?\s*$", re.IGNORECASE)
DAR_FORMAT = re.compile(r"^\d{3}-\d{4}-\d{3}$")
NUMBER_UNIT = re.compile(
    r"^(?P<value>(?:\d+(?:\.\d+)?|\.\d+))\s*"
    r"(?P<unit>mg|g|kg|ug|ng|ml|l|iu|miu|unit|units|%|mmol|meq|billion|million|cfu|lac iu)"
    r"(?:\s*(?P<ratio>w/w|w/v|v/v))?"
    r"(?:/(?:(?P<den_value>\d+(?:\.\d+)?)\s*)?"
    r"(?P<den_unit>ml|l|g|kg|vial|ampoule|ampule|dose|tablet|capsule|actuation|metered inhalation|spray|puff|sachet))?$",
    re.IGNORECASE,
)


class PipelineError(RuntimeError):
    pass


def log(event: str, **values: object) -> None:
    print(json.dumps({"event": event, **values}, ensure_ascii=False, sort_keys=True))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def stable_id(prefix: str, *parts: str) -> str:
    payload = "\x1f".join(parts).encode("utf-8")
    return f"{prefix}-{hashlib.sha256(payload).hexdigest()[:24]}"


def normalized_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold()
    value = value.replace("–", "-").replace("—", "-").replace("’", "'")
    value = re.sub(r"[®™]", "", value)
    return re.sub(r"\s+", " ", value).strip()


def normalized_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", normalized_text(value)).strip()


def normalized_manufacturer(value: str) -> str:
    value = normalized_name(value)
    replacements = (
        (r"\b(?:ltd|limited)\b", "limited"),
        (r"\b(?:pharmaceutical|pharmaceuticals)\b", "pharmaceuticals"),
        (r"\b(?:laboratory|laboratories|labs)\b", "laboratories"),
        (r"\b(?:pvt|private)\b", "private"),
    )
    for pattern, replacement in replacements:
        value = re.sub(pattern, replacement, value)
    return re.sub(r"\s+", " ", value).strip()


def normalized_form(value: str) -> str:
    value = normalized_name(value).replace("paediatric", "pediatric")
    safe_aliases = {
        "powder for susp": "powder for suspension",
        "powder for suspension": "powder for suspension",
    }
    return safe_aliases.get(value, value)


def normalized_strength(value: str) -> str:
    value = normalized_text(value).replace("μ", "µ")
    value = re.sub(r"\bmcg\b|µg", "ug", value)
    value = re.sub(r"\bgm\b", "g", value)
    value = re.sub(r"\s*([+/(),%])\s*", r"\1", value)
    value = re.sub(r"(?<=\d)\s+(?=[a-z%])", " ", value)
    match = re.fullmatch(r"\((.+)\)/(.*)", value)
    if match:
        value = f"{match.group(1)}/{match.group(2)}"
    return value


def ingredient_tokens(value: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in re.split(r"\s*\+\s*", value) if part.strip())


def normalized_ingredients(value: str) -> tuple[str, ...]:
    return tuple(sorted(normalized_name(part) for part in ingredient_tokens(value)))


@dataclass(frozen=True)
class StrengthPart:
    original: str
    value: str
    unit: str
    denominator_value: str
    denominator_unit: str


@dataclass(frozen=True)
class ParsedComposition:
    ingredients_original: tuple[str, ...]
    ingredients_normalized: tuple[str, ...]
    strengths: tuple[StrengthPart, ...]
    status: str
    reason: str


def parse_composition(generic: str, strength: str) -> ParsedComposition:
    originals = ingredient_tokens(generic)
    normalized = tuple(normalized_name(item) for item in originals)
    if not originals:
        return ParsedComposition((), (), (), "FAILED", "MISSING_INGREDIENT")
    if re.search(r"\s(?:and|&)\s", generic, re.IGNORECASE) and len(originals) == 1:
        return ParsedComposition(originals, normalized, (), "AMBIGUOUS", "AMBIGUOUS_INGREDIENT_SEPARATOR")
    if not strength.strip():
        reason = "AMBIGUOUS_COMBINATION_STRENGTH" if len(originals) > 1 else "MISSING_STRENGTH"
        status = "AMBIGUOUS" if len(originals) > 1 else "FAILED"
        return ParsedComposition(originals, normalized, (), status, reason)

    source = normalized_text(strength).replace("μ", "µ")
    source = re.sub(r"\bmcg\b|µg", "ug", source)
    source = re.sub(r"\bgm\b", "g", source)
    grouped = re.fullmatch(r"\((.+)\)\s*/\s*(.+)", source)
    if grouped:
        body, shared_denominator = grouped.groups()
        strength_texts = re.split(r"\s*\+\s*", body)
        strength_texts = [f"{part}/{shared_denominator}" for part in strength_texts]
    else:
        strength_texts = re.split(r"\s*\+\s*", source)
        if len(strength_texts) > 1 and "/" in strength_texts[-1]:
            # Without parentheses it is unsafe to decide whether the denominator
            # belongs to the final ingredient or to the entire composition.
            return ParsedComposition(
                originals, normalized, (), "AMBIGUOUS", "AMBIGUOUS_SHARED_DENOMINATOR"
            )
    if len(strength_texts) != len(originals):
        return ParsedComposition(
            originals, normalized, (), "AMBIGUOUS", "INGREDIENT_STRENGTH_COUNT_MISMATCH"
        )

    parsed: list[StrengthPart] = []
    for text in strength_texts:
        compact = re.sub(r"\s*([/%])\s*", r"\1", text.strip())
        compact = re.sub(r"(?<=\d)(?=[a-zA-Z])", " ", compact)
        match = NUMBER_UNIT.fullmatch(compact)
        if not match:
            return ParsedComposition(
                originals, normalized, (), "FAILED", "UNSUPPORTED_STRENGTH_PATTERN"
            )
        unit = match.group("unit").lower()
        if unit == "units":
            unit = "unit"
        parsed.append(
            StrengthPart(
                original=text.strip(),
                value=str(Decimal(match.group("value"))),
                unit=unit,
                denominator_value=match.group("den_value") or "",
                denominator_unit=(match.group("den_unit") or match.group("ratio") or "").lower(),
            )
        )
    return ParsedComposition(originals, normalized, tuple(parsed), "PARSED", "")


def registered_brand(row: dict[str, str]) -> tuple[str, bool]:
    name = normalized_name(row["name"])
    numbers = re.findall(r"(?<![a-z])\d+(?:\.\d+)?", normalized_strength(row["strength"]))
    if numbers:
        suffix = normalized_name(numbers[0])
        if suffix and name.endswith(f" {suffix}"):
            return name[: -(len(suffix) + 1)].strip(), True
    return name, False


@dataclass
class SourceRow:
    source: str
    row_number: int
    source_key: str
    values: dict[str, str]
    cell_kinds: dict[str, str]
    source_record_id: str
    row_sha256: str
    brand_normalized: str
    manufacturer_normalized: str
    generic_signature: str
    strength_normalized: str
    dosage_form_normalized: str
    medicine_type: str
    intended_use: str
    composition: ParsedComposition
    brand_suffix_derived: bool = False
    reasons: set[str] = field(default_factory=set)
    outcome: str = "UNMATCHED_VALID"
    medicine_id: str = ""

    @property
    def identity5(self) -> tuple[str, str, str, str, str]:
        return (
            self.manufacturer_normalized,
            self.brand_normalized,
            self.generic_signature,
            self.strength_normalized,
            self.dosage_form_normalized,
        )

    @property
    def parse_complete(self) -> bool:
        return self.composition.status == "PARSED"


def row_hash(headers: Iterable[str], values: dict[str, str]) -> str:
    payload = "\x1e".join(values[header] for header in headers)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def load_market(path: Path, file_hash: str, expected_rows: int) -> list[SourceRow]:
    rows: list[SourceRow] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if tuple(reader.fieldnames or ()) != MARKET_HEADERS:
            raise PipelineError(f"unexpected market headers: {reader.fieldnames!r}")
        for row_number, values in enumerate(reader, 2):
            if None in values:
                raise PipelineError(f"market row {row_number} has extra columns")
            if not any(value.strip() for value in values.values()):
                raise PipelineError(f"market row {row_number} is unexpectedly empty")
            composition = parse_composition(values["generic"], values["strength"])
            source_record_id = stable_id("SRCM", file_hash, str(row_number))
            row = SourceRow(
                source="MARKET",
                row_number=row_number,
                source_key=values["brand id"],
                values=values,
                cell_kinds={header: "text" for header in MARKET_HEADERS},
                source_record_id=source_record_id,
                row_sha256=row_hash(MARKET_HEADERS, values),
                brand_normalized=normalized_name(values["brand name"]),
                manufacturer_normalized=normalized_manufacturer(values["manufacturer"]),
                generic_signature=" + ".join(normalized_ingredients(values["generic"])),
                strength_normalized=normalized_strength(values["strength"]),
                dosage_form_normalized=normalized_form(values["dosage form"]),
                medicine_type=normalized_text(values["type"]) or "unknown",
                intended_use="unknown",
                composition=composition,
            )
            if composition.status == "AMBIGUOUS":
                row.reasons.add(composition.reason)
            if normalized_text(values["brand name"]) in {"nan", "n/a", "null", "none"}:
                row.reasons.add("SUSPICIOUS_BRAND_NAME")
            rows.append(row)
    if len(rows) != expected_rows:
        raise PipelineError(f"market row-count drift: expected {expected_rows}, got {len(rows)}")
    return rows


def load_registered(path: Path, file_hash: str, expected_rows: int) -> list[SourceRow]:
    workbook = read_workbook(
        path,
        expected_sheet="bd_registered_drag",
        expected_columns=len(REGISTERED_HEADERS),
        expected_data_rows=expected_rows,
    )
    header = tuple(cell.value for cell in workbook.rows[0])
    if header != REGISTERED_HEADERS:
        raise PipelineError(f"unexpected registered headers: {header!r}")
    rows: list[SourceRow] = []
    for row_number, cells in enumerate(workbook.rows[1:], 2):
        values = {header: cells[index].value for index, header in enumerate(REGISTERED_HEADERS)}
        kinds = {header: cells[index].kind for index, header in enumerate(REGISTERED_HEADERS)}
        brand, derived = registered_brand(values)
        composition = parse_composition(values["generic_name"], values["strength"])
        source_record_id = stable_id("SRCR", file_hash, str(row_number))
        row = SourceRow(
            source="REGISTERED",
            row_number=row_number,
            source_key=values["sl"],
            values=values,
            cell_kinds=kinds,
            source_record_id=source_record_id,
            row_sha256=row_hash(REGISTERED_HEADERS, values),
            brand_normalized=brand,
            manufacturer_normalized=normalized_manufacturer(values["pharmaceutical"]),
            generic_signature=" + ".join(normalized_ingredients(values["generic_name"])),
            strength_normalized=normalized_strength(values["strength"]),
            dosage_form_normalized=normalized_form(values["dosages"]),
            medicine_type="unknown",
            intended_use=normalized_text(values["use_for"]) or "unknown",
            composition=composition,
            brand_suffix_derived=derived,
        )
        if not values["name"].strip():
            row.reasons.add("MISSING_BRAND")
            row.outcome = "INVALID"
        elif re.fullmatch(r"\d+(?:\.\d+)?", values["name"].strip()):
            row.reasons.add("SUSPICIOUS_NUMERIC_BRAND")
        if composition.status == "AMBIGUOUS":
            row.reasons.add(composition.reason)
        if row.intended_use == "veterinary":
            row.reasons.add("VETERINARY_ONLY")
        elif row.intended_use not in {"human", "veterinary"}:
            row.reasons.add("UNKNOWN_INTENDED_USE")
        if not DAR_FORMAT.fullmatch(values["dar"]):
            row.reasons.add("NONSTANDARD_REGISTRATION_REFERENCE")
        rows.append(row)
    return rows


def group_rows(rows: Iterable[SourceRow]) -> dict[tuple[str, ...], list[SourceRow]]:
    groups: dict[tuple[str, ...], list[SourceRow]] = defaultdict(list)
    for row in rows:
        if row.source == "MARKET":
            key = (*row.identity5, row.medicine_type)
        else:
            key = (*row.identity5, row.intended_use)
        groups[key].append(row)
    return dict(groups)


def mark_conflicts(market: list[SourceRow], registered: list[SourceRow]) -> None:
    registrations: dict[str, list[SourceRow]] = defaultdict(list)
    for row in registered:
        registrations[normalized_text(row.values["dar"])].append(row)
    for values in registrations.values():
        identities = {(*row.identity5, row.intended_use) for row in values}
        if len(identities) > 1:
            for row in values:
                row.reasons.add("REGISTRATION_IDENTITY_CONFLICT")

    species: dict[tuple[str, ...], set[str]] = defaultdict(set)
    species_rows: dict[tuple[str, ...], list[SourceRow]] = defaultdict(list)
    for row in registered:
        species[row.identity5].add(row.intended_use)
        species_rows[row.identity5].append(row)
    for key, uses in species.items():
        if {"human", "veterinary"}.issubset(uses):
            for row in species_rows[key]:
                row.reasons.add("HUMAN_VETERINARY_CONFLICT")

    market_blocks: dict[tuple[str, str, str, str], list[SourceRow]] = defaultdict(list)
    registered_blocks: dict[tuple[str, str, str, str], list[SourceRow]] = defaultdict(list)
    for row in market:
        market_blocks[(row.manufacturer_normalized, row.brand_normalized,
                       row.strength_normalized, row.dosage_form_normalized)].append(row)
    for row in registered:
        registered_blocks[(row.manufacturer_normalized, row.brand_normalized,
                           row.strength_normalized, row.dosage_form_normalized)].append(row)
    for block in market_blocks.keys() & registered_blocks.keys():
        for market_row in market_blocks[block]:
            for registered_row in registered_blocks[block]:
                if market_row.generic_signature != registered_row.generic_signature:
                    market_row.reasons.add("CROSS_SOURCE_INGREDIENT_CONFLICT")
                    registered_row.reasons.add("CROSS_SOURCE_INGREDIENT_CONFLICT")


CRITICAL_QUARANTINE_REASONS = {
    "AMBIGUOUS_INGREDIENT_SEPARATOR",
    "AMBIGUOUS_COMBINATION_STRENGTH",
    "AMBIGUOUS_SHARED_DENOMINATOR",
    "INGREDIENT_STRENGTH_COUNT_MISMATCH",
    "REGISTRATION_IDENTITY_CONFLICT",
    "HUMAN_VETERINARY_CONFLICT",
    "CROSS_SOURCE_INGREDIENT_CONFLICT",
    "SUSPICIOUS_BRAND_NAME",
    "SUSPICIOUS_NUMERIC_BRAND",
}


@dataclass
class Medicine:
    medicine_id: str
    representative: SourceRow
    source_rows: list[SourceRow]
    tier: str
    status: str
    medicine_type: str
    intended_use: str
    reasons: set[str]
    manufacturer_id: str
    dosage_form_id: str
    identification_eligible: bool
    structured_comparison_eligible: bool
    price_comparison_eligible: bool = False
    savings_calculation_eligible: bool = False


def group_quarantined(group: list[SourceRow]) -> bool:
    return any(row.reasons & CRITICAL_QUARANTINE_REASONS for row in group)


def build_medicines(
    market_groups: dict[tuple[str, ...], list[SourceRow]],
    registered_groups: dict[tuple[str, ...], list[SourceRow]],
) -> tuple[list[Medicine], list[tuple[tuple[str, ...], tuple[str, ...]]]]:
    market_by5: dict[tuple[str, ...], list[tuple[str, ...]]] = defaultdict(list)
    registered_human_by5: dict[tuple[str, ...], list[tuple[str, ...]]] = defaultdict(list)
    for key in market_groups:
        market_by5[key[:5]].append(key)
    for key in registered_groups:
        if key[5] == "human":
            registered_human_by5[key[:5]].append(key)

    merges: list[tuple[tuple[str, ...], tuple[str, ...]]] = []
    used_market: set[tuple[str, ...]] = set()
    used_registered: set[tuple[str, ...]] = set()
    for identity in sorted(market_by5.keys() & registered_human_by5.keys()):
        market_keys = market_by5[identity]
        registered_keys = registered_human_by5[identity]
        if len(market_keys) != 1 or len(registered_keys) != 1:
            continue
        market_key, registered_key = market_keys[0], registered_keys[0]
        market_rows = market_groups[market_key]
        registered_rows = registered_groups[registered_key]
        if group_quarantined(market_rows) or group_quarantined(registered_rows):
            continue
        if not all(row.parse_complete for row in market_rows + registered_rows):
            continue
        if not all(DAR_FORMAT.fullmatch(row.values["dar"]) for row in registered_rows):
            continue
        merges.append((market_key, registered_key))
        used_market.add(market_key)
        used_registered.add(registered_key)

    medicines: list[Medicine] = []

    def create(
        source_rows: list[SourceRow], representative: SourceRow, tier: str, status: str,
        medicine_type: str, intended_use: str, reasons: set[str]
    ) -> Medicine:
        signature = "|".join((*representative.identity5, medicine_type, intended_use))
        medicine_id = stable_id("MED", PIPELINE_VERSION, signature)
        manufacturer_id = stable_id("MFR", representative.manufacturer_normalized)
        dosage_form_id = stable_id("DOSE", representative.dosage_form_normalized)
        identification = tier != "C" and intended_use not in {"veterinary", "r"}
        structured = tier == "A"
        medicine = Medicine(
            medicine_id=medicine_id,
            representative=representative,
            source_rows=source_rows,
            tier=tier,
            status=status,
            medicine_type=medicine_type,
            intended_use=intended_use,
            reasons=reasons,
            manufacturer_id=manufacturer_id,
            dosage_form_id=dosage_form_id,
            identification_eligible=identification,
            structured_comparison_eligible=structured,
        )
        for row in source_rows:
            row.medicine_id = medicine_id
            row.outcome = "MATCHED" if status == "STRUCTURED_MATCHED" else (
                "CONFLICT" if tier == "C" else row.outcome
            )
        return medicine

    for market_key, registered_key in merges:
        market_rows = market_groups[market_key]
        registered_rows = registered_groups[registered_key]
        reasons = {"STRUCTURED_MATCHED", "UNVERIFIED_SOURCE", "UNVERIFIED_REGULATORY_STATUS"}
        if any(row.brand_suffix_derived for row in registered_rows):
            reasons.add("BRAND_STRENGTH_SUFFIX_DERIVED")
        medicines.append(create(
            market_rows + registered_rows, market_rows[0], "A", "STRUCTURED_MATCHED",
            market_key[5], "human", reasons,
        ))

    for key in sorted(market_groups):
        if key in used_market:
            continue
        rows = market_groups[key]
        reasons = set().union(*(row.reasons for row in rows))
        tier = "C" if group_quarantined(rows) else "B"
        reasons.add("MARKET_ONLY_UNKNOWN_HUMAN_USE")
        status = "QUARANTINED" if tier == "C" else "IDENTIFICATION_ONLY"
        medicines.append(create(rows, rows[0], tier, status, key[5], "unknown", reasons))

    for key in sorted(registered_groups):
        if key in used_registered:
            continue
        rows = registered_groups[key]
        valid_rows = [row for row in rows if row.outcome != "INVALID"]
        if not valid_rows:
            continue
        reasons = set().union(*(row.reasons for row in valid_rows))
        tier = "C" if group_quarantined(valid_rows) else "B"
        reasons.add("REGISTERED_ONLY_UNKNOWN_MEDICINE_TYPE")
        status = "QUARANTINED" if tier == "C" else "IDENTIFICATION_ONLY"
        medicines.append(create(valid_rows, valid_rows[0], tier, status, "unknown", key[5], reasons))

    ids = [medicine.medicine_id for medicine in medicines]
    if len(ids) != len(set(ids)):
        raise PipelineError("stable canonical medicine identifier collision")
    return sorted(medicines, key=lambda item: item.medicine_id), merges


def parse_market_packages(row: SourceRow) -> list[dict[str, object]]:
    raw = row.values["package container"].strip()
    results: list[dict[str, object]] = []
    for match in PACKAGE_PRICE.finditer(raw):
        label = match.group("label").strip().strip("()")
        amount = Decimal(match.group("amount").replace(",", ""))
        normalized = normalized_text(label)
        quantity = ""
        package_unit = ""
        container_type = ""
        units_per_package = ""
        price_basis = "UNKNOWN"
        status = "PARSED"
        reason = ""
        if normalized == "unit price":
            quantity, package_unit, container_type, units_per_package = "1", "dosage_unit", "unit", "1"
            price_basis = "UNIT"
        else:
            pack = re.fullmatch(r"(\d+)\s*'?s\s+pack", normalized)
            measured = re.fullmatch(
                r"((?:\d+(?:\.\d+)?|\.\d+))\s*(ml|l|mg|g|kg)\s+([a-z][a-z -]*)",
                normalized,
            )
            count_container = re.fullmatch(r"(\d+)\s*(tablet|capsule|vial|ampoule|ampule|sachet)s?", normalized)
            if pack:
                quantity, package_unit, container_type = pack.group(1), "count", "pack"
                units_per_package, price_basis = pack.group(1), "PACKAGE"
            elif measured:
                quantity, package_unit = measured.group(1), measured.group(2)
                container_type, units_per_package, price_basis = measured.group(3), "1", "PACKAGE"
            elif count_container:
                quantity, package_unit = count_container.group(1), "count"
                container_type, units_per_package, price_basis = count_container.group(2), count_container.group(1), "PACKAGE"
            else:
                status, reason = "UNRESOLVED", "UNPARSEABLE_PACKAGE_DESCRIPTION"
        results.append({
            "label": label,
            "quantity": quantity,
            "package_unit": package_unit,
            "container_type": container_type,
            "units_per_package": units_per_package,
            "amount": amount,
            "price_basis": price_basis,
            "parse_status": status,
            "parse_reason": reason,
        })
    if not results:
        results.append({
            "label": raw,
            "quantity": "",
            "package_unit": "",
            "container_type": "",
            "units_per_package": "",
            "amount": None,
            "price_basis": "UNKNOWN",
            "parse_status": "MISSING" if not raw else "UNRESOLVED",
            "parse_reason": "MISSING_PACKAGE_PRICE" if not raw else "UNPARSEABLE_PACKAGE_PRICE",
        })
    return results


def decimal_text(value: Decimal | None) -> str:
    return "" if value is None else format(value, "f")


def write_csv(path: Path, fieldnames: list[str], rows: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n", extrasaction="raise")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def boolean(value: bool) -> str:
    return "1" if value else "0"


def generate_outputs(
    output_dir: Path,
    market_path: Path,
    registered_path: Path,
    market_hash: str,
    registered_hash: str,
    market: list[SourceRow],
    registered: list[SourceRow],
    medicines: list[Medicine],
    merges: list[tuple[tuple[str, ...], tuple[str, ...]]],
    review_limit: int,
) -> dict[str, int]:
    batch_id = stable_id("BATCH", PIPELINE_VERSION, market_hash, registered_hash)
    medicine_by_id = {item.medicine_id: item for item in medicines}
    all_rows = sorted(market + registered, key=lambda row: (row.source, row.row_number))

    manufacturers: dict[str, dict[str, object]] = {}
    aliases: dict[tuple[str, str], dict[str, object]] = {}
    dosage_forms: dict[str, dict[str, object]] = {}
    ingredients: dict[str, dict[str, object]] = {}
    product_ingredients: list[dict[str, object]] = []
    packages: list[dict[str, object]] = []
    prices: list[dict[str, object]] = []
    registrations: list[dict[str, object]] = []
    provenance: list[dict[str, object]] = []

    for medicine in medicines:
        rep = medicine.representative
        manufacturer_display = rep.values["manufacturer"] if rep.source == "MARKET" else rep.values["pharmaceutical"]
        manufacturers.setdefault(medicine.manufacturer_id, {
            "manufacturer_id": medicine.manufacturer_id,
            "display_name": manufacturer_display,
            "normalized_name": rep.manufacturer_normalized,
            "source_verified": "0",
        })
        form_display = rep.values["dosage form"] if rep.source == "MARKET" else rep.values["dosages"]
        dosage_forms.setdefault(medicine.dosage_form_id, {
            "dosage_form_id": medicine.dosage_form_id,
            "display_name": form_display,
            "normalized_name": rep.dosage_form_normalized,
        })

        composition = rep.composition
        for index, original in enumerate(composition.ingredients_original, 1):
            normalized = normalized_name(original)
            ingredient_id = stable_id("ING", normalized)
            ingredients.setdefault(ingredient_id, {
                "ingredient_id": ingredient_id,
                "display_name": original,
                "normalized_name": normalized,
            })
            strength = composition.strengths[index - 1] if index <= len(composition.strengths) else None
            relation_id = stable_id("MING", medicine.medicine_id, ingredient_id, str(index))
            product_ingredients.append({
                "medicine_ingredient_id": relation_id,
                "medicine_id": medicine.medicine_id,
                "ingredient_id": ingredient_id,
                "ingredient_order": index,
                "strength_value": "" if strength is None else strength.value,
                "strength_unit": "" if strength is None else strength.unit,
                "denominator_value": "" if strength is None else strength.denominator_value,
                "denominator_unit": "" if strength is None else strength.denominator_unit,
                "strength_original": "" if strength is None else strength.original,
                "parse_status": composition.status,
                "parse_reason": composition.reason,
            })

        for source_row in medicine.source_rows:
            manufacturer_value = source_row.values["manufacturer"] if source_row.source == "MARKET" else source_row.values["pharmaceutical"]
            alias_key = (medicine.manufacturer_id, normalized_text(manufacturer_value))
            aliases.setdefault(alias_key, {
                "manufacturer_alias_id": stable_id("MFRA", medicine.manufacturer_id, normalized_text(manufacturer_value)),
                "manufacturer_id": medicine.manufacturer_id,
                "alias_original": manufacturer_value,
                "alias_normalized": normalized_manufacturer(manufacturer_value),
                "source_record_id": source_row.source_record_id,
                "match_method": "DETERMINISTIC_NORMALIZATION",
            })

            identity_fields = (
                ("brand", source_row.values["brand name"] if source_row.source == "MARKET" else source_row.values["name"]),
                ("manufacturer", manufacturer_value),
                ("generic", source_row.values["generic"] if source_row.source == "MARKET" else source_row.values["generic_name"]),
                ("strength", source_row.values["strength"]),
                ("dosage_form", source_row.values["dosage form"] if source_row.source == "MARKET" else source_row.values["dosages"]),
                ("medicine_type", source_row.values["type"] if source_row.source == "MARKET" else ""),
                ("intended_use", source_row.values["use_for"] if source_row.source == "REGISTERED" else ""),
                ("registration_reference", source_row.values["dar"] if source_row.source == "REGISTERED" else ""),
            )
            for field_name, original_value in identity_fields:
                provenance.append({
                    "field_provenance_id": stable_id("PROV", medicine.medicine_id, source_row.source_record_id, field_name),
                    "medicine_id": medicine.medicine_id,
                    "field_name": field_name,
                    "source_record_id": source_row.source_record_id,
                    "original_value": original_value,
                    "normalized_value": normalized_text(original_value),
                    "authority_decision": "SOURCE_PRESERVED",
                })

            if source_row.source == "MARKET":
                for package_index, package in enumerate(parse_market_packages(source_row), 1):
                    package_id = stable_id("PKG", medicine.medicine_id, source_row.source_record_id, str(package_index), str(package["label"]))
                    packages.append({
                        "package_id": package_id,
                        "medicine_id": medicine.medicine_id,
                        "container_type": package["container_type"],
                        "package_quantity": package["quantity"],
                        "package_unit": package["package_unit"],
                        "units_per_package": package["units_per_package"],
                        "package_original": package["label"],
                        "source_record_id": source_row.source_record_id,
                        "parse_status": package["parse_status"],
                        "parse_reason": package["parse_reason"],
                    })
                    amount = package["amount"]
                    eligible = bool(
                        medicine.tier == "A"
                        and package["parse_status"] == "PARSED"
                        and isinstance(amount, Decimal)
                        and amount > 0
                    )
                    price_id = stable_id("PRICE", package_id, decimal_text(amount))
                    prices.append({
                        "price_id": price_id,
                        "medicine_id": medicine.medicine_id,
                        "package_id": package_id,
                        "amount": decimal_text(amount),
                        "currency": "BDT" if amount is not None else "",
                        "price_basis": package["price_basis"],
                        "price_original": source_row.values["package container"],
                        "source_record_id": source_row.source_record_id,
                        "price_source": "MARKET_DATASET",
                        "price_status": "DATASET_DERIVED" if amount is not None else "MISSING",
                        "price_basis_verified": "1" if package["parse_status"] == "PARSED" else "0",
                        "price_current_verified": "0",
                        "price_comparison_eligible": boolean(eligible),
                        "savings_calculation_eligible": boolean(eligible),
                    })
                    if eligible:
                        medicine.price_comparison_eligible = True
                        medicine.savings_calculation_eligible = True
            else:
                raw_price = source_row.values["price"]
                match = REGISTERED_PRICE.fullmatch(raw_price)
                amount = Decimal(match.group(1)) if match else None
                if amount is not None and amount == 0:
                    amount = None
                price_id = stable_id("PRICE", medicine.medicine_id, source_row.source_record_id, "registered")
                prices.append({
                    "price_id": price_id,
                    "medicine_id": medicine.medicine_id,
                    "package_id": "",
                    "amount": decimal_text(amount),
                    "currency": "BDT" if amount is not None else "",
                    "price_basis": "UNKNOWN",
                    "price_original": raw_price,
                    "source_record_id": source_row.source_record_id,
                    "price_source": "REGISTERED_DATASET_RAW",
                    "price_status": "UNVERIFIED_BASIS" if amount is not None else "MISSING",
                    "price_basis_verified": "0",
                    "price_current_verified": "0",
                    "price_comparison_eligible": "0",
                    "savings_calculation_eligible": "0",
                })
                registrations.append({
                    "registration_id": stable_id("REG", medicine.medicine_id, source_row.source_record_id),
                    "medicine_id": medicine.medicine_id,
                    "registration_reference": source_row.values["dar"],
                    "registration_kind": "SOURCE_PROVIDED_DAR",
                    "source_record_id": source_row.source_record_id,
                    "format_status": "DOMINANT_PATTERN" if DAR_FORMAT.fullmatch(source_row.values["dar"]) else "NONSTANDARD_PATTERN",
                    "source_verified": "0",
                    "regulatory_verified": "0",
                })

    source_links = [{
        "source_link_id": stable_id("LINK", row.source_record_id),
        "medicine_id": row.medicine_id,
        "source_record_id": row.source_record_id,
        "source_name": row.source,
        "source_row_number": row.row_number,
        "source_record_key": row.source_key,
        "outcome": row.outcome,
        "match_method": "EXACT_STRUCTURED_IDENTITY" if row.outcome == "MATCHED" else "SOURCE_IDENTITY",
        "reason_codes": ";".join(sorted(row.reasons)),
    } for row in all_rows]

    medicine_rows = []
    tier_rows = []
    for medicine in medicines:
        rep = medicine.representative
        brand = rep.values["brand name"] if rep.source == "MARKET" else rep.values["name"]
        generic = rep.values["generic"] if rep.source == "MARKET" else rep.values["generic_name"]
        medicine_row = {
            "medicine_id": medicine.medicine_id,
            "manufacturer_id": medicine.manufacturer_id,
            "brand_name": brand,
            "brand_normalized": rep.brand_normalized,
            "generic_original": generic,
            "generic_signature": rep.generic_signature,
            "strength_original": rep.values["strength"],
            "strength_signature": rep.strength_normalized,
            "dosage_form_id": medicine.dosage_form_id,
            "release_type": "",
            "medicine_type": medicine.medicine_type,
            "intended_use": medicine.intended_use,
            "tier": medicine.tier,
            "catalogue_status": medicine.status,
            "reason_codes": ";".join(sorted(medicine.reasons)),
            "identification_eligible": boolean(medicine.identification_eligible),
            "structured_comparison_eligible": boolean(medicine.structured_comparison_eligible),
            "price_comparison_eligible": boolean(medicine.price_comparison_eligible),
            "savings_calculation_eligible": boolean(medicine.savings_calculation_eligible),
            "requires_professional_confirmation": "1",
            "source_verified": "0",
            "regulatory_verified": "0",
            "import_batch_id": batch_id,
        }
        medicine_rows.append(medicine_row)
        tier_rows.append({
            "medicine_id": medicine.medicine_id,
            "tier": medicine.tier,
            "catalogue_status": medicine.status,
            "reason_codes": medicine_row["reason_codes"],
            "identification_eligible": medicine_row["identification_eligible"],
            "structured_comparison_eligible": medicine_row["structured_comparison_eligible"],
            "price_comparison_eligible": medicine_row["price_comparison_eligible"],
            "savings_calculation_eligible": medicine_row["savings_calculation_eligible"],
        })

    # Fuzzy evidence is review-only and never changes canonical membership.
    possible: list[dict[str, object]] = []
    market_nodes = {key: rows[0].medicine_id for key, rows in group_rows(market).items() if rows[0].medicine_id}
    registered_nodes = {key: rows[0].medicine_id for key, rows in group_rows(registered).items() if rows[0].medicine_id}
    brand_market: dict[tuple[str, str, str, str], set[tuple[str, str]]] = defaultdict(set)
    brand_registered: dict[tuple[str, str, str, str], set[tuple[str, str]]] = defaultdict(set)
    for key, medicine_id in market_nodes.items():
        brand_market[(key[0], key[2], key[3], key[4])].add((key[1], medicine_id))
    for key, medicine_id in registered_nodes.items():
        brand_registered[(key[0], key[2], key[3], key[4])].add((key[1], medicine_id))
    for block in sorted(brand_market.keys() & brand_registered.keys()):
        for left_brand, left_id in sorted(brand_market[block]):
            for right_brand, right_id in sorted(brand_registered[block]):
                if left_brand == right_brand or left_id == right_id:
                    continue
                similarity = Decimal(str(difflib.SequenceMatcher(None, left_brand, right_brand).ratio()))
                if similarity >= Decimal("0.88"):
                    pair = tuple(sorted((left_id, right_id)))
                    possible.append({
                        "possible_duplicate_id": stable_id("DUP", *pair, "BRAND"),
                        "left_medicine_id": pair[0],
                        "right_medicine_id": pair[1],
                        "matching_fields": "manufacturer;ingredients;strength;dosage_form",
                        "conflicting_fields": "brand",
                        "similarity_evidence": format(similarity.quantize(Decimal("0.0001")), "f"),
                        "reason_code": "FUZZY_BRAND_ONLY",
                        "review_priority": "MEDIUM",
                        "final_status": "PENDING_REVIEW",
                    })
    possible = sorted({row["possible_duplicate_id"]: row for row in possible}.values(), key=lambda row: str(row["possible_duplicate_id"]))
    possible_ids = {str(row["left_medicine_id"]) for row in possible} | {str(row["right_medicine_id"]) for row in possible}
    for row in all_rows:
        if row.medicine_id in possible_ids and row.outcome == "UNMATCHED_VALID":
            row.outcome = "POSSIBLE_DUPLICATE"
    source_by_id = {row.source_record_id: row for row in all_rows}
    for link in source_links:
        link["outcome"] = source_by_id[str(link["source_record_id"])].outcome

    conflicts = []
    for medicine in medicines:
        for reason in sorted(medicine.reasons & CRITICAL_QUARANTINE_REASONS):
            conflicts.append({
                "conflict_id": stable_id("CONFLICT", medicine.medicine_id, reason),
                "medicine_id": medicine.medicine_id,
                "conflict_type": reason,
                "source_record_ids": ";".join(sorted(row.source_record_id for row in medicine.source_rows)),
                "details": "Critical source evidence was preserved without automatic resolution.",
                "status": "QUARANTINED",
            })

    unmatched = [{
        "source_record_id": row.source_record_id,
        "medicine_id": row.medicine_id,
        "source_name": row.source,
        "source_row_number": row.row_number,
        "outcome": row.outcome,
        "reason_codes": ";".join(sorted(row.reasons)),
    } for row in all_rows if row.outcome in {"UNMATCHED_VALID", "POSSIBLE_DUPLICATE", "REQUIRES_REVIEW"}]
    invalid = [{
        "source_record_id": row.source_record_id,
        "source_name": row.source,
        "source_row_number": row.row_number,
        "source_record_key": row.source_key,
        "reason_codes": ";".join(sorted(row.reasons)),
    } for row in all_rows if row.outcome == "INVALID"]
    parse_failures = [{
        "source_record_id": row.source_record_id,
        "source_name": row.source,
        "source_row_number": row.row_number,
        "generic_original": row.values["generic"] if row.source == "MARKET" else row.values["generic_name"],
        "strength_original": row.values["strength"],
        "parse_status": row.composition.status,
        "parse_reason": row.composition.reason,
    } for row in all_rows if row.composition.status != "PARSED"]
    missing_prices = []
    for row in market:
        parsed = parse_market_packages(row)
        if not any(isinstance(item["amount"], Decimal) and item["amount"] > 0 for item in parsed):
            missing_prices.append({"source_record_id": row.source_record_id, "source_name": row.source, "source_row_number": row.row_number, "price_original": row.values["package container"], "reason_code": "MISSING_OR_UNRESOLVED_PRICE"})
    for row in registered:
        match = REGISTERED_PRICE.fullmatch(row.values["price"])
        if not match or Decimal(match.group(1)) <= 0:
            missing_prices.append({"source_record_id": row.source_record_id, "source_name": row.source, "source_row_number": row.row_number, "price_original": row.values["price"], "reason_code": "ZERO_OR_UNRESOLVED_REGISTERED_PRICE"})

    exact_matches = [{
        "medicine_id": medicine.medicine_id,
        "market_source_records": ";".join(sorted(row.source_record_id for row in medicine.source_rows if row.source == "MARKET")),
        "registered_source_records": ";".join(sorted(row.source_record_id for row in medicine.source_rows if row.source == "REGISTERED")),
        "match_method": "EXACT_STRUCTURED_IDENTITY",
        "tier": medicine.tier,
    } for medicine in medicines if medicine.status == "STRUCTURED_MATCHED"]

    priority_candidates = []
    for conflict in conflicts:
        medicine = medicine_by_id[conflict["medicine_id"]]
        score = 100
        if medicine.price_comparison_eligible:
            score += 20
        if any(row.source == "REGISTERED" for row in medicine.source_rows):
            score += 10
        priority_candidates.append((score, str(conflict["conflict_id"]), {
            "rank": 0,
            "review_type": "CONFLICT",
            "medicine_id": medicine.medicine_id,
            "related_medicine_id": "",
            "reason_code": conflict["conflict_type"],
            "priority_score": score,
            "status": "PENDING_REVIEW",
        }))
    for candidate in possible:
        score = 50 + int(Decimal(str(candidate["similarity_evidence"])) * 20)
        priority_candidates.append((score, str(candidate["possible_duplicate_id"]), {
            "rank": 0,
            "review_type": "POSSIBLE_DUPLICATE",
            "medicine_id": candidate["left_medicine_id"],
            "related_medicine_id": candidate["right_medicine_id"],
            "reason_code": candidate["reason_code"],
            "priority_score": score,
            "status": "PENDING_REVIEW",
        }))
    priority = []
    for rank, (_, _, row) in enumerate(sorted(priority_candidates, key=lambda item: (-item[0], item[1]))[:review_limit], 1):
        row["rank"] = rank
        priority.append(row)

    source_file_rows = [
        {"source_file_id": "MARKET", "filename": market_path.name, "sha256": market_hash, "file_size": market_path.stat().st_size, "format": "CSV", "encoding": "UTF-8", "data_row_count": len(market), "dataset_version": batch_id, "source_verified": "0", "licence_status": "UNKNOWN", "import_date": ""},
        {"source_file_id": "REGISTERED", "filename": registered_path.name, "sha256": registered_hash, "file_size": registered_path.stat().st_size, "format": "XLSX", "encoding": "OOXML_UTF8", "data_row_count": len(registered), "dataset_version": batch_id, "source_verified": "0", "licence_status": "UNKNOWN", "import_date": ""},
    ]
    source_record_rows = [{
        "source_record_id": row.source_record_id,
        "source_file_id": row.source,
        "source_row_number": row.row_number,
        "source_record_key": row.source_key,
        "row_sha256": row.row_sha256,
        "cell_types": json.dumps(row.cell_kinds, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        "outcome": row.outcome,
        "import_batch_id": batch_id,
    } for row in all_rows]
    market_raw = [{"source_record_id": row.source_record_id, **row.values} for row in market]
    registered_raw = [{"source_record_id": row.source_record_id, **row.values} for row in registered]

    summary = {
        "source_rows": len(all_rows),
        "market_rows": len(market),
        "registered_rows": len(registered),
        "canonical_medicines": len(medicines),
        "tier_a": sum(item.tier == "A" for item in medicines),
        "tier_b": sum(item.tier == "B" for item in medicines),
        "tier_c": sum(item.tier == "C" for item in medicines),
        "cross_source_merges": len(merges),
        "source_links": len(source_links),
        "manufacturers": len(manufacturers),
        "ingredients": len(ingredients),
        "medicine_ingredients": len(product_ingredients),
        "packages": len(packages),
        "prices": len(prices),
        "registrations": len(registrations),
        "savings_eligible_medicines": sum(item.savings_calculation_eligible for item in medicines),
        "conflicts": len(conflicts),
        "possible_duplicates": len(possible),
        "unmatched_source_rows": len(unmatched),
        "invalid_rows": len(invalid),
        "parse_failures": len(parse_failures),
        "missing_or_unresolved_prices": len(missing_prices),
        "priority_review_rows": len(priority),
    }

    # Fail closed on catalogue-wide invariants before any output is published.
    if len(source_links) != len(all_rows):
        raise PipelineError("a source record disappeared before source-link output")
    if any(not item.source_rows for item in medicines):
        raise PipelineError("canonical medicine without provenance")
    if any(item.tier == "C" and item.structured_comparison_eligible for item in medicines):
        raise PipelineError("Tier C medicine became comparison eligible")
    if any(row["price_source"] == "REGISTERED_DATASET_RAW" and row["savings_calculation_eligible"] == "1" for row in prices):
        raise PipelineError("registered-source price became savings eligible")
    if any(row["amount"] == "0" for row in prices):
        raise PipelineError("zero price was emitted as a price")

    outputs: list[tuple[str, list[str], Iterable[dict[str, object]]]] = [
        ("medicine_source_files.csv", list(source_file_rows[0]), source_file_rows),
        ("medicine_source_records.csv", list(source_record_rows[0]), source_record_rows),
        ("medicine_market_raw.csv", ["source_record_id", *MARKET_HEADERS], market_raw),
        ("registered_drug_raw.csv", ["source_record_id", *REGISTERED_HEADERS], registered_raw),
        ("medicines_clean.csv", list(medicine_rows[0]), sorted(medicine_rows, key=lambda row: str(row["medicine_id"]))),
        ("manufacturers_clean.csv", ["manufacturer_id", "display_name", "normalized_name", "source_verified"], sorted(manufacturers.values(), key=lambda row: str(row["manufacturer_id"]))),
        ("manufacturer_aliases_clean.csv", ["manufacturer_alias_id", "manufacturer_id", "alias_original", "alias_normalized", "source_record_id", "match_method"], sorted(aliases.values(), key=lambda row: str(row["manufacturer_alias_id"]))),
        ("ingredients_clean.csv", ["ingredient_id", "display_name", "normalized_name"], sorted(ingredients.values(), key=lambda row: str(row["ingredient_id"]))),
        ("medicine_ingredients_clean.csv", list(product_ingredients[0]), sorted(product_ingredients, key=lambda row: str(row["medicine_ingredient_id"]))),
        ("dosage_forms_clean.csv", ["dosage_form_id", "display_name", "normalized_name"], sorted(dosage_forms.values(), key=lambda row: str(row["dosage_form_id"]))),
        ("medicine_packages_clean.csv", list(packages[0]), sorted(packages, key=lambda row: str(row["package_id"]))),
        ("medicine_prices_clean.csv", list(prices[0]), sorted(prices, key=lambda row: str(row["price_id"]))),
        ("medicine_registrations_clean.csv", list(registrations[0]), sorted(registrations, key=lambda row: str(row["registration_id"]))),
        ("medicine_source_links.csv", list(source_links[0]), sorted(source_links, key=lambda row: str(row["source_link_id"]))),
        ("medicine_field_provenance.csv", list(provenance[0]), sorted(provenance, key=lambda row: str(row["field_provenance_id"]))),
        ("medicine_conflicts.csv", ["conflict_id", "medicine_id", "conflict_type", "source_record_ids", "details", "status"], sorted(conflicts, key=lambda row: str(row["conflict_id"]))),
        ("medicine_possible_duplicates.csv", ["possible_duplicate_id", "left_medicine_id", "right_medicine_id", "matching_fields", "conflicting_fields", "similarity_evidence", "reason_code", "review_priority", "final_status"], possible),
        ("medicine_unmatched.csv", ["source_record_id", "medicine_id", "source_name", "source_row_number", "outcome", "reason_codes"], unmatched),
        ("medicine_invalid_rows.csv", ["source_record_id", "source_name", "source_row_number", "source_record_key", "reason_codes"], invalid),
        ("medicine_tier_report.csv", list(tier_rows[0]), sorted(tier_rows, key=lambda row: str(row["medicine_id"]))),
        ("priority_review.csv", ["rank", "review_type", "medicine_id", "related_medicine_id", "reason_code", "priority_score", "status"], priority),
        ("medicine_exact_matches.csv", ["medicine_id", "market_source_records", "registered_source_records", "match_method", "tier"], exact_matches),
        ("medicine_parse_failures.csv", ["source_record_id", "source_name", "source_row_number", "generic_original", "strength_original", "parse_status", "parse_reason"], parse_failures),
        ("medicine_missing_prices.csv", ["source_record_id", "source_name", "source_row_number", "price_original", "reason_code"], missing_prices),
    ]
    summary_rows = [{"metric": key, "value": value} for key, value in sorted(summary.items())]
    outputs.append(("medicine_import_summary.csv", ["metric", "value"], summary_rows))

    package_by_medicine: dict[str, list[dict[str, object]]] = defaultdict(list)
    price_by_package = {str(row["package_id"]): row for row in prices if row["package_id"]}
    for package in packages:
        package_by_medicine[str(package["medicine_id"])].append(package)
    preview = []
    for medicine in sorted(medicine_rows, key=lambda row: str(row["medicine_id"])):
        medicine_packages = package_by_medicine.get(str(medicine["medicine_id"])) or [None]
        for package in medicine_packages:
            price = price_by_package.get(str(package["package_id"])) if package else None
            preview.append({
                "medicine_id": medicine["medicine_id"],
                "brand_name": medicine["brand_name"],
                "manufacturer": manufacturers[str(medicine["manufacturer_id"])]["display_name"],
                "generic_original": medicine["generic_original"],
                "strength_original": medicine["strength_original"],
                "dosage_form": dosage_forms[str(medicine["dosage_form_id"])]["display_name"],
                "medicine_type": medicine["medicine_type"],
                "intended_use": medicine["intended_use"],
                "tier": medicine["tier"],
                "package_original": "" if package is None else package["package_original"],
                "dataset_price_bdt": "" if price is None else price["amount"],
                "savings_calculation_eligible": "0" if price is None else price["savings_calculation_eligible"],
                "warning": "Estimated dataset price; verify price and regulatory status; consult a doctor or pharmacist.",
            })
    outputs.append(("medicine_catalog_flat_preview.csv", list(preview[0]), preview))

    for filename, fields, rows in outputs:
        write_csv(output_dir / filename, fields, rows)

    manifest = []
    for path in sorted(output_dir.glob("*.csv")):
        manifest.append({"filename": path.name, "sha256": sha256_file(path), "size_bytes": path.stat().st_size})
    write_csv(output_dir / "output_manifest.csv", ["filename", "sha256", "size_bytes"], manifest)
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--market-csv", required=True, type=Path)
    parser.add_argument("--registered-xlsx", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--expected-market-rows", type=int, default=21714)
    parser.add_argument("--expected-registered-rows", type=int, default=36085)
    parser.add_argument("--expected-market-sha", default=APPROVED_MARKET_SHA)
    parser.add_argument("--expected-registered-sha", default=APPROVED_REGISTERED_SHA)
    parser.add_argument("--review-limit", type=int, default=50)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.review_limit < 1 or args.review_limit > 50:
        raise PipelineError("review-limit must be between 1 and 50")
    market_hash = sha256_file(args.market_csv)
    registered_hash = sha256_file(args.registered_xlsx)
    if market_hash != args.expected_market_sha:
        raise PipelineError(f"market source hash mismatch: {market_hash}")
    if registered_hash != args.expected_registered_sha:
        raise PipelineError(f"registered source hash mismatch: {registered_hash}")
    log("sources_verified", market_sha256=market_hash, registered_sha256=registered_hash)

    market = load_market(args.market_csv, market_hash, args.expected_market_rows)
    registered = load_registered(args.registered_xlsx, registered_hash, args.expected_registered_rows)
    if sha256_file(args.market_csv) != market_hash or sha256_file(args.registered_xlsx) != registered_hash:
        raise PipelineError("source file changed while it was being processed")
    log("sources_loaded", market_rows=len(market), registered_rows=len(registered))

    mark_conflicts(market, registered)
    market_groups = group_rows(market)
    registered_groups = group_rows(registered)
    medicines, merges = build_medicines(market_groups, registered_groups)
    log("catalogue_built", medicines=len(medicines), cross_source_merges=len(merges))
    if args.dry_run:
        return 0

    args.output_dir.mkdir(parents=True, exist_ok=True)
    if any(args.output_dir.iterdir()):
        raise PipelineError(f"output directory must be empty: {args.output_dir}")
    summary = generate_outputs(
        args.output_dir, args.market_csv, args.registered_xlsx,
        market_hash, registered_hash, market, registered, medicines, merges, args.review_limit,
    )
    log("outputs_written", output_dir=str(args.output_dir), **summary)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (PipelineError, WorkbookFormatError, InvalidOperation, OSError, csv.Error) as error:
        log("pipeline_failed", error=str(error))
        raise SystemExit(1)
