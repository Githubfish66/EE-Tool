from __future__ import annotations

import os

import uvicorn


def run() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("rlc_symbolic_solver.api:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()
