from __future__ import annotations

from pathlib import Path
import sys


backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from rlc_symbolic_solver.main import run


if __name__ == "__main__":
    run()
