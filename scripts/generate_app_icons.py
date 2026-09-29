import os
import shutil
from PIL import Image, ImageDraw

src_logo = r"C:\Users\kirta\.gemini\antigravity\brain\e7a2d75f-0b8f-4a1a-91d5-d83cf96ccc53\candidate_logo1.png"
project_root = r"c:\Kirtan_Darji\AI_Projects\ContextVault"

# 1. Save master assets
frontend_assets = os.path.join(project_root, "frontend", "src", "assets")
os.makedirs(frontend_assets, exist_ok=True)
dest_master = os.path.join(frontend_assets, "logo.png")
shutil.copyfile(src_logo, dest_master)
print(f"Master logo saved to {dest_master}")

# Also copy to web-client public and assets if exists
web_public = os.path.join(project_root, "web-client", "public")
os.makedirs(web_public, exist_ok=True)
shutil.copyfile(src_logo, os.path.join(web_public, "logo.png"))

# 2. Open image in RGBA
base_img = Image.open(src_logo).convert("RGBA")

# Mipmap specifications (density, size_px)
densities = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

res_dir = os.path.join(project_root, "frontend", "android", "app", "src", "main", "res")

for folder, size in densities.items():
    target_dir = os.path.join(res_dir, folder)
    os.makedirs(target_dir, exist_ok=True)

    # 2a. Square Launcher Icon (ic_launcher.png)
    square_img = base_img.resize((size, size), Image.Resampling.LANCZOS)
    square_path = os.path.join(target_dir, "ic_launcher.png")
    square_img.save(square_path, "PNG")

    # 2b. Round Launcher Icon (ic_launcher_round.png)
    # Create antialiased circle mask at 4x resolution then downscale for super crisp edge
    hi_size = size * 4
    hi_img = base_img.resize((hi_size, hi_size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (hi_size, hi_size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, hi_size - 1, hi_size - 1), fill=255)
    
    round_hi = Image.new("RGBA", (hi_size, hi_size), (0, 0, 0, 0))
    round_hi.paste(hi_img, (0, 0), mask)
    round_img = round_hi.resize((size, size), Image.Resampling.LANCZOS)
    
    round_path = os.path.join(target_dir, "ic_launcher_round.png")
    round_img.save(round_path, "PNG")

    print(f"Generated {folder}: {size}x{size} (square & round)")

print("All Android launcher icons successfully generated!")
