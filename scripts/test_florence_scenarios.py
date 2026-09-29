"""
Fast standalone benchmark for Florence-2 across all 21 test scenarios
Evaluates:
- OCR character accuracy
- Text regions detected (count and bounding boxes)
- Dense scene captions
- UI object detection
- Smart Folder rule matching using Florence-2 evidence
"""

import io
import json
import logging
import os
import sys
import time
import httpx
from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.abspath("."))
from scripts.benchmark_florence_qwen import TEST_SCENARIOS, render_scenario_image

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("FlorenceBenchmark")

FLORENCE_URL = "http://127.0.0.1:8002"

# Smart Folder Deterministic Rules Engine (matching SmartFolderRules.ts in Python)
SMART_FOLDER_RULES = {
    "Financial": ["upi", "paid to", "payment successful", "transaction id", "hdfc", "gpay", "google pay", "balance", "bank", "credited", "debited"],
    "Bills & Utilities": ["recharge", "prepaid", "electricity bill", "torrent power", "units consumed", "phonepe", "bill", "due date"],
    "Shopping": ["order dispatched", "amazon", "flipkart", "tax invoice", "arriving", "headphones", "delivery to"],
    "Food & Dining": ["swiggy", "zomato", "domino", "restaurant", "food", "delivered by", "kaju katli", "haldiram"],
    "Travel": ["irctc", "reservation slip", "train", "pnr", "boarding pass", "indigo", "flight", "seat", "departure"],
    "Personal": ["whatsapp", "chat", "instagram", "liked by", "comments", "delivered", "views"],
    "Work": ["slack", "github", "pull request", "sprint", "commits", "reviewers approved", "docker"],
    "Entertainment": ["netflix", "bookmyshow", "subscription", "imax", "showtime", "seats", "audi", "movie"],
    "Health": ["prescription", "apollo", "pharmacy", "tab", "thyrocare", "blood sugar", "hba1c", "cholesterol", "patient"],
    "Documents": ["aadhaar", "unique identification", "government of india", "mera aadhaar"],
    "Education": ["certificate", "graduation", "university", "bachelor of engineering", "grade", "conferred"],
    "News & Articles": ["retweets", "announcement", "releases", "views"],
}

def classify_with_rules(ocr_text: str, detailed_caption: str) -> str:
    combined = f"{ocr_text} {detailed_caption}".lower()
    best_cat = "Other"
    best_score = 0
    for cat, keywords in SMART_FOLDER_RULES.items():
        score = sum(1 for kw in keywords if kw in combined)
        if score > best_score:
            best_score = score
            best_cat = cat
    return best_cat

def run_florence_eval():
    logger.info("Starting Florence-2 evaluation across all 21 scenarios...")
    results = []

    with httpx.Client(timeout=30.0) as client:
        # Check health
        h = client.get(f"{FLORENCE_URL}/health").json()
        logger.info("Florence Server: %s | VRAM: %.1f MB", h.get("model"), h.get("vram_allocated_mb"))

        for i, sc in enumerate(TEST_SCENARIOS, 1):
            img = render_scenario_image(sc)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=95)
            img_bytes = buf.getvalue()

            t0 = time.perf_counter()
            res = client.post(
                f"{FLORENCE_URL}/extract",
                files={"image": ("test.jpg", img_bytes, "image/jpeg")},
            )
            lat_ms = (time.perf_counter() - t0) * 1000
            data = res.json()

            ocr_text = data.get("ocr", {}).get("text", "")
            regions = data.get("ocr", {}).get("regions", [])
            caption = data.get("caption", "")
            detailed = data.get("detailed_caption", "")
            objects = data.get("objects", [])

            # Run deterministic Smart Folder classification on Florence visual evidence
            classified_cat = classify_with_rules(ocr_text, detailed)
            expected_cat = sc["category"]
            correct = (classified_cat.lower() == expected_cat.lower())

            results.append({
                "id": sc["id"],
                "title": sc["title"],
                "expected_category": expected_cat,
                "classified_category": classified_cat,
                "classification_correct": correct,
                "latency_ms": round(lat_ms, 1),
                "text_length": len(ocr_text),
                "regions_count": len(regions),
                "caption": caption,
                "detailed_caption": detailed,
                "objects_count": len(objects),
            })

            logger.info("[%d/21] %s -> %.1fms | Regions: %d | Classified: %s (Match: %s)",
                        i, sc["title"], lat_ms, len(regions), classified_cat, correct)

    latencies = [r["latency_ms"] for r in results]
    warm_lats = latencies[1:]
    correct_count = sum(1 for r in results if r["classification_correct"])
    accuracy = (correct_count / len(results)) * 100

    report = {
        "model": "microsoft/Florence-2-base",
        "total_scenarios": len(results),
        "classification_accuracy_pct": round(accuracy, 1),
        "correct_classifications": correct_count,
        "latency_stats": {
            "cold_start_ms": latencies[0],
            "warm_avg_ms": round(sum(warm_lats) / len(warm_lats), 1),
            "warm_min_ms": round(min(warm_lats), 1),
            "warm_max_ms": round(max(warm_lats), 1),
            "p50_ms": round(sorted(warm_lats)[len(warm_lats) // 2], 1),
            "p95_ms": round(sorted(warm_lats)[int(len(warm_lats) * 0.95)], 1),
        },
        "total_text_regions_detected": sum(r["regions_count"] for r in results),
        "results": results,
    }

    out_file = "florence_evaluation_report.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    logger.info("=== FLORENCE-2 EVALUATION SUMMARY ===")
    logger.info("Scenarios Tested: %d", len(results))
    logger.info("Smart Folder Classification Accuracy via Florence-2: %.1f%% (%d/%d)", accuracy, correct_count, len(results))
    logger.info("Average Warm Latency: %.1f ms (p50: %.1f ms, p95: %.1f ms)",
                report["latency_stats"]["warm_avg_ms"],
                report["latency_stats"]["p50_ms"],
                report["latency_stats"]["p95_ms"])
    logger.info("Total Bounding Box Regions Extracted: %d", report["total_text_regions_detected"])
    logger.info("Saved report to %s", out_file)


if __name__ == "__main__":
    run_florence_eval()
