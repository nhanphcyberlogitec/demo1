"""Shared pytest fixtures for the core/ test suite.

Adds the parent ``core/`` directory to ``sys.path`` so tests can ``import main``
without the project being installed as a package.
"""

from __future__ import annotations

import os
import sys

# core/ → project parent on sys.path
_HERE = os.path.dirname(__file__)
_CORE = os.path.abspath(os.path.join(_HERE, ".."))
if _CORE not in sys.path:
    sys.path.insert(0, _CORE)
