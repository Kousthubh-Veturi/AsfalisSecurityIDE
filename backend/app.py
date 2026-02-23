import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
CORS(app, origins=[frontend_url])

@app.route("/")
def index():
    return "Hello, World!"


@app.route("/health")
def health():
    return {"status": "ok"}, 200


if __name__ == "__main__":
    app.run(debug=True)