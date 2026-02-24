import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)

cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
origins = [o.strip() for o in cors_origins.split(",") if o.strip()]
CORS(app, origins=origins)

@app.route("/")
def index():
    return "Hello, World!"


@app.route("/health")
def health():
    return {"status": "ok"}, 200


if __name__ == "__main__":
    app.run(debug=True)