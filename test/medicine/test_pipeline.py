from __future__ import annotations

import csv
from pathlib import Path
import tempfile
import unittest
from zipfile import ZIP_DEFLATED, ZipFile

from scripts.medicine.pipeline import (
    APPROVED_MARKET_SHA,
    APPROVED_REGISTERED_SHA,
    SourceRow,
    normalized_form,
    normalized_manufacturer,
    parse_composition,
    parse_market_packages,
    sha256_file,
)
from scripts.medicine.xlsx_reader import WorkbookFormatError, read_workbook


ROOT = Path(__file__).resolve().parents[2]
MARKET = ROOT / "dataset/medicine.csv"
REGISTERED = ROOT / "dataset/bd_registered_drag_info.xlsx"


def synthetic_xlsx(path: Path, *, formula: bool = False, merged: bool = False, extra: bool = False) -> None:
    columns = 3 if extra else 2
    formula_cell = '<c r="B2"><f>1+1</f><v>2</v></c>' if formula else '<c r="B2"><v>7</v></c>'
    merge_xml = '<mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells>' if merged else ""
    extra_cell = '<c r="C2" t="inlineStr"><is><t>extra</t></is></c>' if extra else ""
    worksheet = f'''<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>label</t></is></c><c r="B1" t="inlineStr"><is><t>number</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>alpha</t></is></c>{formula_cell}{extra_cell}</row>
</sheetData>{merge_xml}</worksheet>'''
    workbook = '''<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Test" sheetId="1" r:id="rId1"/></sheets></workbook>'''
    relationships = '''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>'''
    content_types = '''<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'''
    with ZipFile(path, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("xl/workbook.xml", workbook)
        archive.writestr("xl/_rels/workbook.xml.rels", relationships)
        archive.writestr("xl/worksheets/sheet1.xml", worksheet)


class WorkbookReaderTests(unittest.TestCase):
    def test_approved_source_hashes_and_dimensions(self) -> None:
        self.assertEqual(sha256_file(MARKET), APPROVED_MARKET_SHA)
        self.assertEqual(sha256_file(REGISTERED), APPROVED_REGISTERED_SHA)
        workbook = read_workbook(
            REGISTERED,
            expected_sheet="bd_registered_drag",
            expected_columns=9,
            expected_data_rows=36085,
        )
        self.assertEqual(len(workbook.rows), 36086)
        self.assertTrue(all(len(row) == 9 for row in workbook.rows))
        # The source stores even the logical integer `sl` column as shared text;
        # the reader must preserve that physical distinction rather than coerce it.
        self.assertEqual(workbook.rows[1][0].kind, "text")
        self.assertEqual(workbook.rows[1][1].kind, "text")

    def test_inline_strings_and_numeric_cells_are_distinct(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "inline.xlsx"
            synthetic_xlsx(path)
            workbook = read_workbook(path, expected_sheet="Test", expected_columns=2, expected_data_rows=1)
            self.assertEqual(workbook.rows[1][0].value, "alpha")
            self.assertEqual(workbook.rows[1][0].kind, "text")
            self.assertEqual(workbook.rows[1][1].value, "7")
            self.assertEqual(workbook.rows[1][1].kind, "number")

    def test_formula_merged_and_unexpected_cells_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            for name, options in (
                ("formula", {"formula": True}),
                ("merged", {"merged": True}),
                ("extra", {"extra": True}),
            ):
                path = Path(temporary) / f"{name}.xlsx"
                synthetic_xlsx(path, **options)
                with self.assertRaises(WorkbookFormatError):
                    read_workbook(path, expected_sheet="Test", expected_columns=2, expected_data_rows=1)


class PharmaceuticalParsingTests(unittest.TestCase):
    def test_single_ingredient_tablet(self) -> None:
        parsed = parse_composition("Paracetamol", "500 mg")
        self.assertEqual(parsed.status, "PARSED")
        self.assertEqual(parsed.strengths[0].value, "500")

    def test_combination_and_shared_liquid_concentration(self) -> None:
        parsed = parse_composition(
            "Dextromethorphan + Pseudoephedrine + Triprolidine",
            "(10 mg+30 mg+1.25 mg)/5 ml",
        )
        self.assertEqual(parsed.status, "PARSED")
        self.assertEqual(len(parsed.strengths), 3)
        self.assertTrue(all(part.denominator_value == "5" for part in parsed.strengths))
        self.assertTrue(all(part.denominator_unit == "ml" for part in parsed.strengths))

    def test_unparenthesized_combination_denominator_is_ambiguous(self) -> None:
        parsed = parse_composition("A + B", "10 mg + 20 mg/5 ml")
        self.assertEqual(parsed.status, "AMBIGUOUS")
        self.assertEqual(parsed.reason, "AMBIGUOUS_SHARED_DENOMINATOR")

    def test_injection_vial(self) -> None:
        parsed = parse_composition("Cloxacillin Sodium", "500 mg/vial")
        self.assertEqual(parsed.status, "PARSED")
        self.assertEqual(parsed.strengths[0].denominator_unit, "vial")

    def test_missing_and_unsupported_strengths_do_not_get_invented(self) -> None:
        self.assertEqual(parse_composition("Herbal preparation", "").status, "FAILED")
        self.assertEqual(parse_composition("Insulin", "6000 Anti-Xa IU/0.6 ml").status, "FAILED")

    def test_safe_manufacturer_alias_and_form_normalization(self) -> None:
        self.assertEqual(normalized_manufacturer("ACME Laboratories Ltd."), "acme laboratories limited")
        self.assertEqual(normalized_manufacturer("ACME Laboratories Limited"), "acme laboratories limited")
        self.assertEqual(normalized_form("Powder For Suspension"), "powder for suspension")
        self.assertNotEqual(normalized_form("Tablet"), normalized_form("Capsule"))
        self.assertNotEqual(normalized_form("Syrup"), normalized_form("Suspension"))

    def test_multiple_packages_and_exact_decimal_prices(self) -> None:
        composition = parse_composition("Paracetamol", "500 mg")
        row = SourceRow(
            source="MARKET", row_number=2, source_key="1",
            values={
                "package container": "100 ml bottle: ৳ 40.12,200 ml bottle: ৳ 60.00",
                "Package Size": "", "brand name": "P", "manufacturer": "M",
                "generic": "Paracetamol", "strength": "500 mg", "dosage form": "Tablet",
                "type": "allopathic", "brand id": "1", "slug": "p",
            },
            cell_kinds={}, source_record_id="SRC", row_sha256="x",
            brand_normalized="p", manufacturer_normalized="m",
            generic_signature="paracetamol", strength_normalized="500 mg",
            dosage_form_normalized="tablet", medicine_type="allopathic",
            intended_use="unknown", composition=composition,
        )
        packages = parse_market_packages(row)
        self.assertEqual([item["amount"] for item in packages], [__import__("decimal").Decimal("40.12"), __import__("decimal").Decimal("60.00")])
        self.assertTrue(all(item["parse_status"] == "PARSED" for item in packages))

    def test_zero_and_unparseable_prices_are_not_package_prices(self) -> None:
        composition = parse_composition("Paracetamol", "500 mg")
        values = {
            "package container": "Price Unavailable", "Package Size": "", "brand name": "P",
            "manufacturer": "M", "generic": "Paracetamol", "strength": "500 mg",
            "dosage form": "Tablet", "type": "allopathic", "brand id": "1", "slug": "p",
        }
        row = SourceRow("MARKET", 2, "1", values, {}, "SRC", "x", "p", "m", "paracetamol", "500 mg", "tablet", "allopathic", "unknown", composition)
        packages = parse_market_packages(row)
        self.assertIsNone(packages[0]["amount"])
        self.assertEqual(packages[0]["parse_status"], "UNRESOLVED")


if __name__ == "__main__":
    unittest.main()
