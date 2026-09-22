"""Run the backend: `python main.py` (then `npm run dev` in frontend/)."""
import os
import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=int(os.environ.get("PORT", "8010")), reload=True)
