from __future__ import annotations

import csv
from collections import Counter, defaultdict
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from scripts.medicine.pipeline import sha256_file


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "generated/medicine"


def records(name: str) -> list[dict[str, str]]:
    with (OUTPUT / name).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


class GeneratedCatalogueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not (OUTPUT / "output_manifest.csv").exists():
            raise unittest.SkipTest("generate the medicine catalogue before output tests")
        cls.medicines = records("medicines_clean.csv")
        cls.links = records("medicine_source_links.csv")

    def test_every_source_row_has_one_outcome_and_every_medicine_has_provenance(self) -> None:
        self.assertEqual(len(self.links), 57799)
        self.assertEqual(len({row["source_record_id"] for row in self.links}), 57799)
        linked = {row["medicine_id"] for row in self.links if row["medicine_id"]}
        self.assertEqual({row["medicine_id"] for row in self.medicines}, linked)
        self.assertEqual(sum(row["outcome"] == "INVALID" for row in self.links), 3)

    def test_cross_source_matches_are_one_canonical_row_with_two_source_sets(self) -> None:
        sources: dict[str, set[str]] = defaultdict(set)
        for row in self.links:
            sources[row["medicine_id"]].add(row["source_name"])
        tier_a = [row for row in self.medicines if row["tier"] == "A"]
        self.assertEqual(len(tier_a), 3399)
        self.assertTrue(all(sources[row["medicine_id"]] == {"MARKET", "REGISTERED"} for row in tier_a))
        identities = [(
            row["manufacturer_id"], row["brand_normalized"], row["generic_signature"],
            row["strength_signature"], row["dosage_form_id"], row["medicine_type"], row["intended_use"],
        ) for row in self.medicines]
        self.assertEqual(len(identities), len(set(identities)))

    def test_tier_and_price_safety_boundaries(self) -> None:
        prices = records("medicine_prices_clean.csv")
        self.assertTrue(all(row["structured_comparison_eligible"] == "0" for row in self.medicines if row["tier"] == "C"))
        self.assertTrue(all(row["savings_calculation_eligible"] == "0" for row in prices if row["price_source"] == "REGISTERED_DATASET_RAW"))
        self.assertFalse(any(row["amount"] == "0" for row in prices))
        self.assertTrue(all(row["source_verified"] == "0" and row["regulatory_verified"] == "0" for row in self.medicines))

    def test_required_conflicts_and_review_only_fuzzy_candidates_exist(self) -> None:
        conflicts = Counter(row["conflict_type"] for row in records("medicine_conflicts.csv"))
        self.assertGreater(conflicts["REGISTRATION_IDENTITY_CONFLICT"], 0)
        self.assertGreater(conflicts["HUMAN_VETERINARY_CONFLICT"], 0)
        self.assertGreater(conflicts["CROSS_SOURCE_INGREDIENT_CONFLICT"], 0)
        self.assertGreater(conflicts["AMBIGUOUS_SHARED_DENOMINATOR"], 0)
        candidates = records("medicine_possible_duplicates.csv")
        self.assertGreater(len(candidates), 0)
        self.assertTrue(all(row["final_status"] == "PENDING_REVIEW" for row in candidates))
        self.assertLessEqual(len(records("priority_review.csv")), 50)

    def test_same_brand_different_strength_or_form_remains_distinct(self) -> None:
        by_brand: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
        for row in self.medicines:
            by_brand[(row["manufacturer_id"], row["brand_normalized"])].append(row)
        self.assertTrue(any(len({row["strength_signature"] for row in rows}) > 1 for rows in by_brand.values()))
        self.assertTrue(any(len({row["dosage_form_id"] for row in rows}) > 1 for rows in by_brand.values()))

    def test_flat_preview_is_explicitly_denormalized(self) -> None:
        preview = records("medicine_catalog_flat_preview.csv")
        self.assertGreater(len(preview), len(self.medicines))
        self.assertTrue(all("consult a doctor or pharmacist" in row["warning"].lower() for row in preview))

    def test_pipeline_rerun_is_byte_deterministic(self) -> None:
        with tempfile.TemporaryDirectory(prefix="nationx-medicine-test-") as temporary:
            subprocess.run([
                sys.executable, "-m", "scripts.medicine.pipeline",
                "--market-csv", "dataset/medicine.csv",
                "--registered-xlsx", "dataset/bd_registered_drag_info.xlsx",
                "--output-dir", temporary,
            ], cwd=ROOT, check=True, capture_output=True, text=True)
            self.assertEqual(
                sha256_file(OUTPUT / "output_manifest.csv"),
                sha256_file(Path(temporary) / "output_manifest.csv"),
            )


if __name__ == "__main__":
    unittest.main()
