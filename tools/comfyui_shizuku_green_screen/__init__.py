import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryFile

import numpy as np
import torch


class ShizukuGreenScreen:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"images": ("IMAGE",)},
            "optional": {
                "green_level": ("INT", {"default": 0, "min": 0, "max": 255, "tooltip": "0 = automatic side sampling; otherwise 100–255."}),
                "edge_start": ("FLOAT", {"default": 0.03, "min": 0.0, "max": 1.0, "step": 0.01}),
                "clear": ("FLOAT", {"default": 0.89, "min": 0.01, "max": 1.0, "step": 0.01}),
                "trim_sides": ("INT", {"default": 0, "min": 0, "max": 32, "tooltip": "Clear only these many pixels from the left and right edges. Use 8 to match the previous MiniMax export."}),
            },
        }

    RETURN_TYPES = ("IMAGE", "IMAGE", "MASK")
    RETURN_NAMES = ("rgba_images", "rgb_images", "background_mask")
    FUNCTION = "key"
    CATEGORY = "Shizuku/Image"
    SEARCH_ALIASES = ["green screen", "chroma key", "despill"]

    def key(self, images, green_level=0, edge_start=0.03, clear=0.89, trim_sides=0):
        if images.ndim != 4 or images.shape[-1] not in (3, 4) or min(images.shape) == 0:
            raise ValueError("Expected a nonempty ComfyUI IMAGE batch in [B,H,W,3 or 4] format.")
        count, height, width, channels = images.shape
        if green_level != 0 and not 100 <= green_level <= 255:
            raise ValueError("green_level must be 0 (auto) or 100–255.")
        if not 0 <= edge_start < clear <= 1:
            raise ValueError("Set edge_start lower than clear, with both between 0 and 1.")
        if trim_sides < 0 or trim_sides * 2 >= width:
            raise ValueError("trim_sides must leave visible space between the two edges.")

        node = shutil.which("node")
        if node is None:
            raise RuntimeError("Shizuku Green Screen requires Node.js on the PATH used to start ComfyUI.")
        command = [
            node, str(Path(__file__).with_name("worker.mjs")), str(width), str(height),
            str(green_level), str(edge_start), str(clear), str(trim_sides),
        ]
        rgba = torch.empty((count, height, width, 4), dtype=torch.float32, device="cpu")
        incoming = np.empty((height, width, 4), dtype=np.uint8)
        if channels == 3:
            incoming[..., 3] = 255
        frame_bytes = incoming.nbytes

        with TemporaryFile() as errors:
            with subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors,
                                  creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)) as worker:
                try:
                    for index, image in enumerate(images):
                        pixels = image.detach().to(device="cpu", dtype=torch.float32)
                        pixels = pixels.clamp(0, 1).mul_(255).round_().to(torch.uint8).numpy()
                        np.copyto(incoming[..., :channels], pixels)
                        worker.stdin.write(incoming.tobytes())
                        worker.stdin.flush()
                        result = worker.stdout.read(frame_bytes)
                        if len(result) != frame_bytes:
                            raise EOFError("The worker returned an incomplete frame.")
                        output = np.frombuffer(result, dtype=np.uint8).copy().reshape(height, width, 4)
                        rgba[index].copy_(torch.from_numpy(output)).div_(255)
                    worker.stdin.close()
                    if worker.wait():
                        raise RuntimeError("The worker exited unexpectedly.")
                except (BrokenPipeError, EOFError, RuntimeError) as error:
                    errors.seek(0)
                    detail = errors.read().decode("utf-8", errors="replace").strip()
                    raise RuntimeError(f"Shizuku Green Screen failed: {detail or error}") from error
                finally:
                    if worker.poll() is None:
                        worker.kill()

        return rgba, rgba[..., :3], 1.0 - rgba[..., 3]


NODE_CLASS_MAPPINGS = {"ShizukuGreenScreen": ShizukuGreenScreen}
NODE_DISPLAY_NAME_MAPPINGS = {"ShizukuGreenScreen": "Shizuku Green Screen"}
