"""Pytest configuration for the backend test suite.

Adds `core/` to sys.path so tests can `import main`, `import database`
without needing the package installed. Also pins a deterministic
`JWT_SECRET` for the whole test run.
"""

import os
import sys
from pathlib import Path

# Ensure deterministic JWT signing across the run.
os.environ.setdefault("JWT_SECRET", "test-secret-fixed")

# Make `main`, `database` importable from `core/tests/`.
CORE_DIR = Path(__file__).resolve().parents[1]
if str(CORE_DIR) not in sys.path:
    sys.path.insert(0, str(CORE_DIR))
