#!/usr/bin/env python3
import json
import mimetypes
import secrets
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).parent
PUBLIC = ROOT / "public"
DATA = ROOT / "data" / "strategies.json"
BASE_ARR = 2.84


class ScaleHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[SCALE/OS] {self.address_string()} {fmt % args}")

    def send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 100_000:
                raise ValueError("Payload jest zbyt duży.")
            return json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError) as error:
            raise ValueError("Nieprawidłowe dane JSON.") from error

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            return self.send_json({"status": "ok", "system": "scale-os"})
        if path == "/api/metrics":
            return self.send_json({
                "arr": BASE_ARR,
                "readiness": 84.7,
                "retention": 87,
                "margin": 64.8,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
        return self.serve_static(path)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            payload = self.read_json()
            if path == "/api/simulate":
                return self.simulate(payload)
            if path == "/api/strategies":
                return self.save_strategy(payload)
            self.send_json({"error": "Nie znaleziono endpointu."}, HTTPStatus.NOT_FOUND)
        except ValueError as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)

    def simulate(self, payload):
        try:
            marketing = float(payload.get("marketing", 0))
            price = float(payload.get("price", 0))
            hires = int(payload.get("hires", 0))
            churn = float(payload.get("churn", 0)) / 10
        except (TypeError, ValueError) as error:
            raise ValueError("Parametry muszą być liczbami.") from error
        if not (-20 <= marketing <= 80 and -10 <= price <= 30 and 0 <= hires <= 12 and 0 <= churn <= 5):
            raise ValueError("Parametr wykracza poza dozwolony zakres.")
        growth = 16 + marketing * .28 + price * .75 + hires * 2.6 + churn * 3.2
        projected = BASE_ARR * (1 + growth / 100)
        margin = min(82, 64.8 + price * .42 - marketing * .035 + churn * .9)
        runway = max(6, 19.4 - hires * .38 - marketing * .035 + margin * .09)
        confidence = max(58, min(94, round(90 - abs(marketing - 20) * .12 - hires * .5)))
        self.send_json({
            "projected_arr": round(projected, 2),
            "growth": round(growth, 1),
            "margin": round(margin, 1),
            "runway": round(runway, 1),
            "confidence": confidence,
        })

    def save_strategy(self, payload):
        if not isinstance(payload.get("inputs"), dict) or not isinstance(payload.get("result"), dict):
            raise ValueError("Najpierw uruchom poprawną symulację.")
        DATA.parent.mkdir(exist_ok=True)
        try:
            strategies = json.loads(DATA.read_text()) if DATA.exists() else []
        except json.JSONDecodeError:
            strategies = []
        reference = f"SCL-{datetime.now():%y%m%d}-{secrets.token_hex(2).upper()}"
        strategies.append({
            "reference": reference,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "inputs": payload["inputs"],
            "result": payload["result"],
        })
        DATA.write_text(json.dumps(strategies, ensure_ascii=False, indent=2))
        self.send_json({"ok": True, "reference": reference}, HTTPStatus.CREATED)

    def serve_static(self, path):
        relative = "index.html" if path == "/" else path.lstrip("/")
        target = (PUBLIC / relative).resolve()
        if PUBLIC.resolve() not in target.parents and target != PUBLIC.resolve():
            return self.send_error(HTTPStatus.FORBIDDEN)
        if not target.is_file():
            return self.send_error(HTTPStatus.NOT_FOUND)
        body = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = 8001
    print(f"SCALE/OS running at http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), ScaleHandler).serve_forever()
