from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI()

# Serve static files (CSS, JS, images, data)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

# Templates
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.get("/")
async def home(request: Request):
    # 'request' must always be passed to Jinja2 templates
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "title": "Mapping Games",
        },
    )

@app.get("/debug")
def debug():
    return {
        "file": __file__,
        "base_dir": str(BASE_DIR),
        "templates_exists": (BASE_DIR / "templates").exists(),
        "static_exists": (BASE_DIR / "static").exists(),
    }


#
# if __name__ == "__main__":
#
#     # Use import string so reload works correctly
#     uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
