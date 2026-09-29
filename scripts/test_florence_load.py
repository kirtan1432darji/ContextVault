import time
import torch
from PIL import Image, ImageDraw
import sys

# Set stdout encoding for Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Target device: {device}")

initial_vram = (torch.cuda.memory_allocated() / (1024 ** 2)) if torch.cuda.is_available() else 0
print(f"Initial VRAM allocated: {initial_vram:.1f} MB")

model_id = "microsoft/Florence-2-base"
print(f"Loading {model_id}...")

start_load = time.perf_counter()

from transformers import AutoProcessor, AutoModelForCausalLM

processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    torch_dtype=torch.float16 if device == "cuda" else torch.float32,
    trust_remote_code=True
).to(device)

load_time = time.perf_counter() - start_load
post_load_vram = (torch.cuda.memory_allocated() / (1024 ** 2)) if torch.cuda.is_available() else 0
model_vram = post_load_vram - initial_vram

print(f"Model loaded in: {load_time:.2f}s")
print(f"Current VRAM allocated: {post_load_vram:.1f} MB (Florence-2 footprint: {model_vram:.1f} MB)")

# Create synthetic sample screenshot (800x600 image with text and button)
img = Image.new('RGB', (800, 600), color='#1E293B')
draw = ImageDraw.Draw(img)
draw.rectangle([50, 50, 750, 150], fill='#334155', outline='#64748B', width=2)
draw.text((70, 80), "ContextVault - Payment Successful to Starbucks", fill='#F8FAFC')
draw.text((70, 110), "Amount: INR 450.00 | Transaction ID: UPI/1234567890", fill='#10B981')
draw.rectangle([250, 450, 550, 520], fill='#3B82F6', outline='#60A5FA', width=2)
draw.text((320, 475), "Done / Back to Home", fill='#FFFFFF')

def run_task(task_prompt, text_input=None):
    prompt = task_prompt if text_input is None else task_prompt + text_input
    t0 = time.perf_counter()
    inputs = processor(text=prompt, images=img, return_tensors="pt").to(device, torch.float16 if device == "cuda" else torch.float32)
    with torch.no_grad():
        generated_ids = model.generate(
            input_ids=inputs["input_ids"],
            pixel_values=inputs["pixel_values"],
            max_new_tokens=1024,
            num_beams=3
        )
    generated_text = processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
    parsed_answer = processor.post_process_generation(generated_text, task=task_prompt, image_size=(img.width, img.height))
    elapsed = (time.perf_counter() - t0) * 1000
    return parsed_answer, elapsed

tasks = [
    ("<CAPTION>", "Basic Caption"),
    ("<DETAILED_CAPTION>", "Detailed Caption"),
    ("<MORE_DETAILED_CAPTION>", "More Detailed Caption"),
    ("<OCR>", "OCR Text"),
    ("<OCR_WITH_REGION>", "OCR with Text Bounding Boxes"),
    ("<OD>", "Object Detection (UI elements)")
]

print("\n--- Running Florence-2 Task Benchmark ---")
for task_tag, label in tasks:
    try:
        ans, ms = run_task(task_tag)
        print(f"Task: {label} [{task_tag}] -> {ms:.1f}ms")
        print(f"Output: {ans}\n")
    except Exception as e:
        print(f"Task {task_tag} error: {e}")

peak_vram = (torch.cuda.max_memory_allocated() / (1024 ** 2)) if torch.cuda.is_available() else 0
print(f"Peak VRAM during inference: {peak_vram:.1f} MB")
