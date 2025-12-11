from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()

# Serve static files (CSS, JS, images, data)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")


@app.get("/")
async def home(request: Request):
    # 'request' must always be passed to Jinja2 templates
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "title": "Mapping Games",  # you can use this in the template if you want
        },
    )


if __name__ == "__main__":
    import uvicorn

    # Use import string so reload works correctly
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
