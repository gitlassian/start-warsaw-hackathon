"""Bundle the editable pitch sources into one offline HTML file."""

from base64 import b64encode
from mimetypes import guess_type
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent


def asset_url(name: str) -> str:
    data = (ROOT / name).read_bytes()
    mime = guess_type(name)[0] or "application/octet-stream"
    return f"data:{mime};base64,{b64encode(data).decode()}"


html = (ROOT / "index.html").read_text()
css = (ROOT / "pitch.css").read_text()
js = (ROOT / "pitch.js").read_text()
css = re.sub(r"url\('([^']+)'\)", lambda match: f"url('{asset_url(match[1])}')", css)
html = html.replace('<link rel="stylesheet" href="pitch.css">', f"<style>{css}</style>")
html = html.replace('<script src="pitch.js"></script>', f"<script>{js}</script>")
html = re.sub(r'(?:src|href)="(assets/[^\"]+)"', lambda match: match[0].replace(match[1], asset_url(match[1])), html)
target = ROOT / "rollcall-pitch.html"
target.write_text(html)
print(f"Built {target.name} ({target.stat().st_size:,} bytes)")
