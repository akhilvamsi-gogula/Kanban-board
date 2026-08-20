# Script Guidance

This directory contains portable Bash entry points for the local services.

- `start.sh` builds and starts the Compose services.
- `stop.sh` stops and removes the Compose services.

Scripts should be safe to rerun, use strict Bash settings, resolve paths relative to the repository, and never contain secrets.

