"""
ContextVault - Standalone Local Florence-2 Vision AI Server
Specialist visual extraction server (OCR with regions, dense captions, UI object detection)
Runs locally on NVIDIA GeForce RTX 4050 GPU (or CPU fallback) alongside Qwen2.5-VL-3B.
Default port: 8002 (Qwen runs on 8001).
"""

import io
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile, status, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel

# Ensure stdout uses UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("FlorenceServer")

app = FastAPI(
    title="ContextVault Local Florence-2 Vision AI Server",
    description="Dedicated specialist visual extraction server powered by Microsoft Florence-2-base",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration from environment
MODEL_ID = os.getenv("FLORENCE_MODEL", "microsoft/Florence-2-base")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32
PORT = int(os.getenv("FLORENCE_PORT", "8002"))
HOST = os.getenv("FLORENCE_HOST", "0.0.0.0")

model = None
processor = None
load_duration_s = 0.0


def load_model():
    """Loads Florence-2 model and processor with GPU optimization and weight tying verification."""
    global model, processor, load_duration_s
    if model is not None and processor is not None:
        return

    logger.info("Initializing Florence-2 (%s) on %s (%s)...", MODEL_ID, DEVICE, DTYPE)
    start_t = time.perf_counter()

    from transformers import AutoProcessor, AutoModelForCausalLM

    processor = AutoProcessor.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
    )

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        torch_dtype=DTYPE,
        trust_remote_code=True,
    ).to(DEVICE)

    # Defensive check: ensure tied weights are active
    if hasattr(model, "language_model") and hasattr(model.language_model, "_tie_weights"):
        model.language_model._tie_weights()

    model.eval()
    load_duration_s = time.perf_counter() - start_t
    vram_mb = torch.cuda.memory_allocated() / (1024 * 1024) if torch.cuda.is_available() else 0
    logger.info("Florence-2 loaded successfully in %.2fs. VRAM Allocated: %.1f MB", load_duration_s, vram_mb)


@app.on_event("startup")
async def startup_event():
    load_model()


@app.get("/")
async def root():
    vram_mb = torch.cuda.memory_allocated() / (1024 * 1024) if torch.cuda.is_available() else 0
    return {
        "service": "ContextVault Local Florence-2 Vision AI Server",
        "status": "online",
        "model": MODEL_ID,
        "device": str(DEVICE),
        "dtype": str(DTYPE),
        "vram_allocated_mb": round(vram_mb, 1),
        "load_time_seconds": round(load_duration_s, 2),
    }


@app.get("/health")
@app.get("/api/florence/health")
async def health():
    is_loaded = model is not None and processor is not None
    vram_mb = torch.cuda.memory_allocated() / (1024 * 1024) if torch.cuda.is_available() else 0
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    return {
        "status": "healthy" if is_loaded else "loading",
        "online": True,
        "modelLoaded": is_loaded,
        "model": MODEL_ID,
        "gpu": gpu_name,
        "vram_allocated_mb": round(vram_mb, 1),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/model-info")
@app.get("/api/florence/model-info")
async def model_info():
    vram_gb = (torch.cuda.memory_allocated() / (1024 ** 3)) if torch.cuda.is_available() else 0
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    return {
        "model": MODEL_ID,
        "provider": "local_florence_2",
        "precision": "float16" if DEVICE == "cuda" else "float32",
        "version": "1.0.0",
        "vram_allocated_gb": f"{round(vram_gb, 2)} GB",
        "vram_allocated_mb": round(vram_gb * 1024, 1),
        "gpu": gpu_name,
        "tasks_supported": [
            "<OCR>",
            "<OCR_WITH_REGION>",
            "<CAPTION>",
            "<DETAILED_CAPTION>",
            "<MORE_DETAILED_CAPTION>",
            "<OD>",
            "<DENSE_REGION_CAPTION>",
            "<REGION_PROPOSAL>",
        ],
        "specialization": "Specialist visual extraction (OCR, bounding boxes, dense captions, UI elements)",
    }


def execute_task(task_tag: str, img: Image.Image, text_input: Optional[str] = None) -> Any:
    """Executes a single Florence-2 vision-language task."""
    prompt = task_tag if text_input is None else task_tag + text_input
    inputs = processor(
        text=prompt,
        images=img,
        return_tensors="pt"
    ).to(DEVICE, DTYPE)

    with torch.no_grad():
        generated_ids = model.generate(
            input_ids=inputs["input_ids"],
            pixel_values=inputs["pixel_values"],
            max_new_tokens=1024,
            num_beams=3,
        )

    generated_text = processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
    parsed_answer = processor.post_process_generation(
        generated_text,
        task=task_tag,
        image_size=(img.width, img.height),
    )
    return parsed_answer.get(task_tag, parsed_answer)


def extract_image_from_request(
    file_bytes: Optional[bytes] = None,
    base64_str: Optional[str] = None,
) -> Image.Image:
    """Decodes image from raw bytes or base64 string safely."""
    try:
        if file_bytes:
            img = Image.open(io.BytesIO(file_bytes))
        elif base64_str:
            import base64
            clean_b64 = re.sub(r"^data:image\/[a-zA-Z]+;base64,", "", base64_str)
            raw = base64.b64decode(clean_b64)
            img = Image.open(io.BytesIO(raw))
        else:
            raise ValueError("No image provided.")

        if img.mode != "RGB":
            img = img.convert("RGB")
        return img
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to decode image: {str(e)}",
        )


class Base64Payload(BaseModel):
    image: Optional[str] = None
    file: Optional[str] = None


@app.post("/extract")
@app.post("/api/florence/extract")
async def extract_visual_evidence(
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    payload: Optional[Base64Payload] = Body(None),
):
    """
    Main extraction endpoint combining OCR with regions, dense captions, and UI object detection.
    Produces high-density structured visual evidence for ContextVault Smart Folders and Qwen reasoning.
    """
    t0 = time.perf_counter()
    target_upload = image or file

    if target_upload:
        raw_bytes = await target_upload.read()
        img = extract_image_from_request(file_bytes=raw_bytes)
        await target_upload.close()
    elif payload and (payload.image or payload.file):
        b64 = payload.image or payload.file
        img = extract_image_from_request(base64_str=b64)
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing image data. Provide multipart form 'image'/'file' or JSON 'image' base64.",
        )

    # 1. OCR with Region
    ocr_raw = execute_task("<OCR_WITH_REGION>", img)
    text_regions = []
    full_ocr_lines = []

    if isinstance(ocr_raw, dict):
        quad_boxes = ocr_raw.get("quad_boxes", [])
        labels = ocr_raw.get("labels", [])
        for qbox, lbl in zip(quad_boxes, labels):
            clean_lbl = lbl.replace("</s>", "").strip()
            if not clean_lbl:
                continue
            full_ocr_lines.append(clean_lbl)
            # Normalize quad box [x1,y1, x2,y1, x2,y2, x1,y2] to [x1, y1, x2, y2]
            if len(qbox) == 8:
                xs = [qbox[0], qbox[2], qbox[4], qbox[6]]
                ys = [qbox[1], qbox[3], qbox[5], qbox[7]]
                bbox = [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)]
            elif len(qbox) == 4:
                bbox = [round(v, 1) for v in qbox]
            else:
                bbox = qbox
            text_regions.append({
                "text": clean_lbl,
                "box_2d": bbox,
            })

    full_ocr_text = "\n".join(full_ocr_lines)
    if not full_ocr_text:
        # Fallback to plain OCR task if with_region was empty
        plain_ocr = execute_task("<OCR>", img)
        if isinstance(plain_ocr, str):
            full_ocr_text = plain_ocr.replace("</s>", "").strip()

    # 2. Detailed Caption
    detailed_caption = execute_task("<DETAILED_CAPTION>", img)
    if isinstance(detailed_caption, str):
        detailed_caption = detailed_caption.replace("</s>", "").strip()
    else:
        detailed_caption = str(detailed_caption)

    # 3. Basic Caption
    caption = execute_task("<CAPTION>", img)
    if isinstance(caption, str):
        caption = caption.replace("</s>", "").strip()
    else:
        caption = str(caption)

    # 4. Object Detection (UI Elements / Controls)
    od_raw = execute_task("<OD>", img)
    detected_elements = []
    if isinstance(od_raw, dict):
        bboxes = od_raw.get("bboxes", [])
        labels = od_raw.get("labels", [])
        for b, l in zip(bboxes, labels):
            detected_elements.append({
                "label": l.replace("</s>", "").strip(),
                "box_2d": [round(float(v), 1) for v in b],
            })

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

    return {
        "success": True,
        "model": MODEL_ID,
        "processing_time_ms": elapsed_ms,
        "ocr": {
            "text": full_ocr_text,
            "regions": text_regions,
            "region_count": len(text_regions),
        },
        "caption": caption,
        "detailed_caption": detailed_caption,
        "objects": detected_elements,
        "visual_evidence": {
            "caption": caption,
            "detailedDescription": detailed_caption,
            "ocrText": full_ocr_text,
            "textRegions": text_regions,
            "detectedElements": detected_elements,
            "imageSize": {"width": img.width, "height": img.height},
            "processingTimeMs": elapsed_ms,
        },
    }


@app.post("/ocr")
@app.post("/api/florence/ocr")
async def extract_ocr(
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    payload: Optional[Base64Payload] = Body(None),
):
    """Fast OCR-only endpoint using Florence-2."""
    t0 = time.perf_counter()
    target_upload = image or file

    if target_upload:
        raw_bytes = await target_upload.read()
        img = extract_image_from_request(file_bytes=raw_bytes)
        await target_upload.close()
    elif payload and (payload.image or payload.file):
        b64 = payload.image or payload.file
        img = extract_image_from_request(base64_str=b64)
    else:
        raise HTTPException(status_code=422, detail="Missing image data.")

    ocr_raw = execute_task("<OCR_WITH_REGION>", img)
    text_regions = []
    lines = []
    if isinstance(ocr_raw, dict):
        quad_boxes = ocr_raw.get("quad_boxes", [])
        labels = ocr_raw.get("labels", [])
        for qbox, lbl in zip(quad_boxes, labels):
            clean = lbl.replace("</s>", "").strip()
            if clean:
                lines.append(clean)
                text_regions.append({"text": clean, "box_2d": qbox})

    full_text = "\n".join(lines)
    if not full_text:
        plain = execute_task("<OCR>", img)
        full_text = plain.replace("</s>", "").strip() if isinstance(plain, str) else str(plain)

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
    return {
        "success": True,
        "model": MODEL_ID,
        "processing_time_ms": elapsed_ms,
        "text": full_text,
        "regions": text_regions,
    }


@app.post("/describe")
@app.post("/api/florence/describe")
async def extract_description(
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    payload: Optional[Base64Payload] = Body(None),
):
    """Fast caption / description endpoint using Florence-2."""
    t0 = time.perf_counter()
    target_upload = image or file

    if target_upload:
        raw_bytes = await target_upload.read()
        img = extract_image_from_request(file_bytes=raw_bytes)
        await target_upload.close()
    elif payload and (payload.image or payload.file):
        b64 = payload.image or payload.file
        img = extract_image_from_request(base64_str=b64)
    else:
        raise HTTPException(status_code=422, detail="Missing image data.")

    caption = execute_task("<CAPTION>", img)
    detailed = execute_task("<DETAILED_CAPTION>", img)

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
    return {
        "success": True,
        "model": MODEL_ID,
        "processing_time_ms": elapsed_ms,
        "caption": caption.replace("</s>", "").strip() if isinstance(caption, str) else str(caption),
        "detailed_caption": detailed.replace("</s>", "").strip() if isinstance(detailed, str) else str(detailed),
    }


@app.post("/regions")
@app.post("/api/florence/regions")
async def extract_regions(
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    payload: Optional[Base64Payload] = Body(None),
):
    """Fast UI region & object detection endpoint."""
    t0 = time.perf_counter()
    target_upload = image or file

    if target_upload:
        raw_bytes = await target_upload.read()
        img = extract_image_from_request(file_bytes=raw_bytes)
        await target_upload.close()
    elif payload and (payload.image or payload.file):
        b64 = payload.image or payload.file
        img = extract_image_from_request(base64_str=b64)
    else:
        raise HTTPException(status_code=422, detail="Missing image data.")

    od_raw = execute_task("<OD>", img)
    elements = []
    if isinstance(od_raw, dict):
        bboxes = od_raw.get("bboxes", [])
        labels = od_raw.get("labels", [])
        for b, l in zip(bboxes, labels):
            elements.append({
                "label": l.replace("</s>", "").strip(),
                "box_2d": [round(float(v), 1) for v in b],
            })

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
    return {
        "success": True,
        "model": MODEL_ID,
        "processing_time_ms": elapsed_ms,
        "elements": elements,
        "count": len(elements),
    }


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting ContextVault Florence-2 Vision AI Server on %s:%d...", HOST, PORT)
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
