#!/usr/bin/env python3
"""Fail-closed OOXML reader for the approved registered-medicine workbook.

This intentionally supports only the small, auditable XLSX feature set present
in the approved source. Unsupported workbook features fail instead of being
silently coerced or ignored.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator
from xml.etree import ElementTree as ET
import re
import zipfile


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS, "p": PKG_REL_NS}
CELL_REF = re.compile(r"^([A-Z]+)([1-9][0-9]*)$")


class WorkbookFormatError(ValueError):
    """Raised when an XLSX feature cannot be interpreted safely."""


@dataclass(frozen=True)
class CellValue:
    value: str
    kind: str


@dataclass(frozen=True)
class WorkbookRows:
    sheet_name: str
    rows: tuple[tuple[CellValue, ...], ...]


def _column_index(reference: str) -> tuple[int, int]:
    match = CELL_REF.fullmatch(reference)
    if not match:
        raise WorkbookFormatError(f"invalid cell reference: {reference!r}")
    letters, row_text = match.groups()
    column = 0
    for char in letters:
        column = column * 26 + ord(char) - 64
    return column - 1, int(row_text)


def _text_content(element: ET.Element | None) -> str:
    if element is None:
        return ""
    return "".join(node.text or "" for node in element.iter(f"{{{MAIN_NS}}}t"))


def _shared_strings(archive: zipfile.ZipFile) -> tuple[str, ...]:
    path = "xl/sharedStrings.xml"
    if path not in archive.namelist():
        return ()
    root = ET.fromstring(archive.read(path))
    return tuple(_text_content(item) for item in root.findall("m:si", NS))


def _worksheet_path(archive: zipfile.ZipFile, expected_sheet: str) -> tuple[str, str]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheets = workbook.findall("m:sheets/m:sheet", NS)
    matching = [sheet for sheet in sheets if sheet.get("name") == expected_sheet]
    if len(matching) != 1:
        names = [sheet.get("name") for sheet in sheets]
        raise WorkbookFormatError(
            f"expected one sheet named {expected_sheet!r}; found {names!r}"
        )
    relationship_id = matching[0].get(f"{{{REL_NS}}}id")
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        rel.get("Id"): rel.get("Target")
        for rel in relationships.findall("p:Relationship", NS)
    }
    target = targets.get(relationship_id)
    if not target:
        raise WorkbookFormatError("worksheet relationship is missing")
    target = target.lstrip("/")
    path = target if target.startswith("xl/") else f"xl/{target}"
    if path not in archive.namelist():
        raise WorkbookFormatError(f"worksheet part is missing: {path}")
    return matching[0].get("name") or "", path


def read_workbook(
    path: str | Path,
    *,
    expected_sheet: str,
    expected_columns: int,
    expected_data_rows: int | None = None,
) -> WorkbookRows:
    """Read one worksheet while rejecting unsupported or lossy constructs."""
    source = Path(path)
    if not zipfile.is_zipfile(source):
        raise WorkbookFormatError(f"not an XLSX ZIP archive: {source}")

    with zipfile.ZipFile(source) as archive:
        for info in archive.infolist():
            if info.flag_bits & 0x1:
                raise WorkbookFormatError("encrypted ZIP entries are unsupported")

        required = {
            "[Content_Types].xml",
            "xl/workbook.xml",
            "xl/_rels/workbook.xml.rels",
        }
        missing = required.difference(archive.namelist())
        if missing:
            raise WorkbookFormatError(f"required XLSX parts are missing: {sorted(missing)}")

        shared = _shared_strings(archive)
        sheet_name, worksheet_path = _worksheet_path(archive, expected_sheet)
        root = ET.fromstring(archive.read(worksheet_path))

        if root.find("m:mergeCells", NS) is not None:
            raise WorkbookFormatError("merged worksheet cells are unsupported")

        rows: list[tuple[CellValue, ...]] = []
        expected_row_number = 1
        for row in root.findall("m:sheetData/m:row", NS):
            row_number = int(row.get("r", "0"))
            if row_number != expected_row_number:
                raise WorkbookFormatError(
                    f"unexpected worksheet row sequence: expected {expected_row_number}, got {row_number}"
                )
            expected_row_number += 1
            values = [CellValue("", "blank") for _ in range(expected_columns)]
            seen_columns: set[int] = set()
            for cell in row.findall("m:c", NS):
                reference = cell.get("r", "")
                column_index, referenced_row = _column_index(reference)
                if referenced_row != row_number:
                    raise WorkbookFormatError(f"cell {reference} is attached to the wrong row")
                if column_index >= expected_columns:
                    raise WorkbookFormatError(
                        f"unexpected column {reference}; expected {expected_columns} columns"
                    )
                if column_index in seen_columns:
                    raise WorkbookFormatError(f"duplicate cell at {reference}")
                seen_columns.add(column_index)

                if cell.find("m:f", NS) is not None:
                    raise WorkbookFormatError(f"formula cell is unsupported: {reference}")

                cell_type = cell.get("t")
                value_element = cell.find("m:v", NS)
                if cell_type == "s":
                    if value_element is None or value_element.text is None:
                        raise WorkbookFormatError(f"shared-string index missing at {reference}")
                    try:
                        value = shared[int(value_element.text)]
                    except (ValueError, IndexError) as error:
                        raise WorkbookFormatError(
                            f"invalid shared-string index at {reference}"
                        ) from error
                    parsed = CellValue(value, "text")
                elif cell_type == "inlineStr":
                    inline = cell.find("m:is", NS)
                    parsed = CellValue(_text_content(inline), "text")
                elif cell_type in (None, "n"):
                    value = "" if value_element is None else (value_element.text or "")
                    parsed = CellValue(value, "blank" if value == "" else "number")
                elif cell_type == "str":
                    value = "" if value_element is None else (value_element.text or "")
                    parsed = CellValue(value, "text")
                elif cell_type == "b":
                    value = "" if value_element is None else (value_element.text or "")
                    if value not in {"0", "1"}:
                        raise WorkbookFormatError(f"invalid boolean cell at {reference}")
                    parsed = CellValue("TRUE" if value == "1" else "FALSE", "boolean")
                else:
                    raise WorkbookFormatError(
                        f"unsupported cell type {cell_type!r} at {reference}"
                    )
                values[column_index] = parsed
            rows.append(tuple(values))

    if not rows:
        raise WorkbookFormatError("worksheet is empty")
    if expected_data_rows is not None and len(rows) - 1 != expected_data_rows:
        raise WorkbookFormatError(
            f"worksheet row-count drift: expected {expected_data_rows}, got {len(rows) - 1}"
        )
    return WorkbookRows(sheet_name=sheet_name, rows=tuple(rows))


def iter_values(workbook: WorkbookRows) -> Iterator[tuple[str, ...]]:
    for row in workbook.rows:
        yield tuple(cell.value for cell in row)
