from PIL import Image
import numpy as np

img = Image.open('/home/z/my-project/public/logo-eurokappa.png').convert('RGBA')
data = np.array(img)
r, g, b, a = data[:,:,0].astype(np.float32), data[:,:,1].astype(np.float32), data[:,:,2].astype(np.float32), data[:,:,3].astype(np.float32)

# Reference blue bg color from previous analysis
BG_REF = np.array([48, 110, 204], dtype=np.float32)

# Calculate color distance from blue bg for each pixel
# Simple Euclidean distance in RGB space
dist = np.sqrt((r - BG_REF[0])**2 + (g - BG_REF[1])**2 + (b - BG_REF[2])**2)

# Pixels close to blue bg color are background
# Anti-aliased edges will have intermediate distances
is_bg = dist < 80  # threshold for background
is_text = ~is_bg

print(f"Total pixels: {data.shape[0] * data.shape[1]}")
print(f"Background pixels: {np.sum(is_bg)}")
print(f"Text pixels: {np.sum(is_text)}")
print(f"Text color range: R({int(r[is_text].min())}-{int(r[is_text].max())}), G({int(g[is_text].min())}-{int(g[is_text].max())}), B({int(b[is_text].min())}-{int(b[is_text].max())})")
print(f"Text brightness: avg R={r[is_text].mean():.0f} G={g[is_text].mean():.0f} B={b[is_text].mean():.0f}")

result = data.copy()

# Make text pixels bright white, fully opaque
result[is_text, 0] = 255
result[is_text, 1] = 255
result[is_text, 2] = 255
result[is_text, 3] = 255

# Make background transparent
result[is_bg, 3] = 0

result_img = Image.fromarray(result.astype(np.uint8), 'RGBA')
result_img.save('/home/z/my-project/public/logo-eurokappa-transparent.png')
print("\nSaved: logo-eurokappa-transparent.png")
