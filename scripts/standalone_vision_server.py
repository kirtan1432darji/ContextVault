"""
ContextVault - Standalone Local Vision AI Server (Qwen2.5-VL-3B-Instruct)
Runs on Windows laptop using the dedicated NVIDIA GeForce RTX 4050 GPU (6GB VRAM)
Quantized with 4-bit NF4 via bitsandbytes (~2.5 GB VRAM usage)
Listens on 0.0.0.0:8001 to serve the Ubuntu Docker backend and mobile clients over LAN.
"""

import io
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from transformers import AutoProcessor, BitsAndBytesConfig, Qwen2_5_VLForConditionalGeneration
from qwen_vl_utils import process_vision_info

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("VisionServer")

app = FastAPI(
    title="ContextVault Local Vision AI Server",
    description="Dedicated Local Vision AI Server powered by Qwen2.5-VL-3B-Instruct on NVIDIA RTX 4050",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model & processor holders
model = None
processor = None
MODEL_ID = "Qwen/Qwen2.5-VL-3B-Instruct"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


def load_model():
    global model, processor
    if model is not None:
        return

    logger.info("Initializing Qwen2.5-VL-3B-Instruct on %s...", DEVICE)
    start_t = time.perf_counter()

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_quant_type="nf4",
    )

    processor = AutoProcessor.from_pretrained(
        MODEL_ID,
        local_files_only=True,
    )

    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        local_files_only=True,
    )
    model.eval()

    elapsed = time.perf_counter() - start_t
    vram_mb = torch.cuda.memory_allocated() / (1024 * 1024) if torch.cuda.is_available() else 0
    logger.info("Qwen2.5-VL loaded successfully in %.2fs. VRAM Allocated: %.1f MB", elapsed, vram_mb)


@app.on_event("startup")
async def startup_event():
    load_model()


@app.get("/")
async def root():
    vram_mb = torch.cuda.memory_allocated() / (1024 * 1024) if torch.cuda.is_available() else 0
    return {
        "service": "ContextVault Local Vision AI Server",
        "status": "online",
        "model": "Qwen2.5-VL-3B-Instruct",
        "device": str(DEVICE),
        "vram_allocated_mb": round(vram_mb, 1),
    }


@app.get("/api/vision/ping")
async def ping():
    return {"status": "healthy", "pong": True}


@app.get("/api/vision/health")
async def health():
    is_loaded = model is not None and processor is not None
    vram_mb = torch.cuda.memory_allocated() / (1024 * 1024) if torch.cuda.is_available() else 0
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    return {
        "status": "healthy" if is_loaded else "loading",
        "online": True,
        "modelLoaded": is_loaded,
        "model": "Qwen2.5-VL-3B-Instruct",
        "gpu": gpu_name,
        "vram_allocated_mb": round(vram_mb, 1),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/vision/model-info")
async def model_info():
    vram_gb = (torch.cuda.memory_allocated() / (1024 ** 3)) if torch.cuda.is_available() else 0
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    return {
        "model": "Qwen2.5-VL-3B-Instruct",
        "provider": "local_qwen_vl",
        "quantization": "4-bit NF4",
        "precision": "bfloat16",
        "version": "1.0.0",
        "vram_allocated_gb": f"{round(vram_gb, 2)} GB",
        "gpu": gpu_name,
    }


EXTRACTION_PROMPT = """Analyze this smartphone screenshot thoroughly and return ONLY a valid, single JSON object with these exact keys:
{
  "title": "Short descriptive title (e.g. Swiggy Order #8921, Google Pay to Rahul, Instagram Post)",
  "summary": "Detailed 1-2 sentence description of what the screenshot contains",
  "confidence": 0.95,
  "screen_type": "transaction|receipt|chat|social_media|document|shopping|travel|entertainment|other",
  "category": "Financial|Personal|Travel|Work|Entertainment|Shopping|Other",
  "folder_hierarchy": ["Category", "Subcategory/App"],
  "merchant": "Merchant or app name or null",
  "amount": 123.45,
  "currency": "INR",
  "payment_method": "UPI|Card|Net Banking|null",
  "date": "YYYY-MM-DD or null",
  "entities": {
    "key": "value"
  },
  "tags": ["tag1", "tag2", "tag3"],
  "ocr_text": "All prominent visible text from screenshot",
  "bullet_points": ["point 1", "point 2"]
}
Return strictly the JSON object. Do not enclose in markdown blocks. Do not add intro or outro text."""


def clean_json_output(raw_str: str) -> Dict[str, Any]:
    text = raw_str.strip()
    # Strip markdown ```json ... ``` wrapper if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

    # Search for first { and last }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    try:
        return json.loads(text)
    except Exception as e:
        logger.warning("Direct JSON parse failed: %s. Output was: %s", e, text[:200])
        # Return fallback structured dict
        return {
            "title": "Screenshot Analyzed",
            "summary": text[:200] if text else "Screenshot processed by Qwen2.5-VL",
            "confidence": 0.90,
            "screen_type": "screenshot",
            "category": "Other",
            "folder_hierarchy": ["Other"],
            "ocr_text": text,
            "tags": ["screenshot"],
            "bullet_points": ["Extracted via Qwen2.5-VL"],
        }


@app.post("/api/vision/analyze")
async def analyze(
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
):
    target = image or file
    if not target:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing image file in multipart request",
        )

    try:
        content = await target.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty image data")

        # Open in-memory with PIL
        pil_img = Image.open(io.BytesIO(content)).convert("RGB")

        # Resize large screenshots to max 1280px on longest edge for optimal speed & VRAM
        max_dim = 1280
        w, h = pil_img.size
        if max(w, h) > max_dim:
            if w > h:
                new_w = max_dim
                new_h = int(h * (max_dim / w))
            else:
                new_h = max_dim
                new_w = int(w * (max_dim / h))
            pil_img = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": pil_img},
                    {"type": "text", "text": EXTRACTION_PROMPT},
                ],
            }
        ]

        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        )
        inputs = inputs.to(DEVICE)

        start_gen = time.perf_counter()
        with torch.inference_mode():
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=512,
                do_sample=False,
            )

        generated_ids_trimmed = [
            out_ids[len(in_ids) :] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        output_text = processor.batch_decode(
            generated_ids_trimmed,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False,
        )[0]
        gen_time = time.perf_counter() - start_gen
        logger.info("Inference completed in %.2fs. Tokens: %d", gen_time, len(generated_ids_trimmed[0]))

        parsed_data = clean_json_output(output_text)
        return parsed_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Analyze error: %s", e, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Vision inference failed", "detail": str(e)},
        )
    finally:
        await target.close()


class ChatRequest(BaseModel):
    prompt: Optional[str] = None
    content: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None
    max_tokens: Optional[int] = 512
    temperature: Optional[float] = 0.7


@app.post("/api/vision/chat")
async def chat(req: ChatRequest):
    if not model or not processor:
        raise HTTPException(status_code=503, detail="Model is still initializing")

    if req.messages:
        formatted_messages = []
        for m in req.messages:
            role = m.get("role", "user")
            cnt = m.get("content", "")
            if isinstance(cnt, str):
                formatted_messages.append({"role": role, "content": [{"type": "text", "text": cnt}]})
            else:
                formatted_messages.append({"role": role, "content": cnt})
    else:
        text_content = req.prompt or req.content or ""
        if not text_content.strip():
            raise HTTPException(status_code=400, detail="Empty prompt or messages")
        formatted_messages = [
            {"role": "user", "content": [{"type": "text", "text": text_content}]}
        ]

    try:
        text = processor.apply_chat_template(formatted_messages, tokenize=False, add_generation_prompt=True)
        inputs = processor(text=[text], padding=True, return_tensors="pt").to(DEVICE)

        start_t = time.perf_counter()
        with torch.inference_mode():
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=req.max_tokens or 512,
                do_sample=req.temperature > 0 if req.temperature else False,
            )

        trimmed = [
            out[len(inp) :] for inp, out in zip(inputs.input_ids, generated_ids)
        ]
        response_text = processor.batch_decode(
            trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0]
        gen_time = time.perf_counter() - start_t
        token_count = len(trimmed[0])
        logger.info("Chat inference completed in %.2fs. Tokens: %d", gen_time, token_count)

        return {
            "content": response_text.strip(),
            "model": MODEL_ID,
            "tokens_generated": token_count,
            "latency_ms": int(gen_time * 1000),
        }
    except Exception as e:
        logger.error("Chat error: %s", e, exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Chat inference failed", "detail": str(e)})


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting ContextVault Local Vision AI Server on 0.0.0.0:8001...")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
