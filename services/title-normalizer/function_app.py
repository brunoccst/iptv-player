"""Azure Functions entry point (Python v2 programming model)."""

import json

import azure.functions as func

from title_normalizer.config import load_settings

app = func.FunctionApp()
settings = load_settings()


@app.route(route="health", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    body = {"status": "ok", "app": settings.app_name, "service": "title-normalizer"}
    return func.HttpResponse(json.dumps(body), mimetype="application/json")
