# Vendored from ts-builder — logic only, deliberately frozen

These three files are **not** kept in sync with `ts-builder`, and that is on
purpose. The embed's code format is its own (see `README.md`), and the old
startup fetch overwrote these from the builder on every restart, silently
undoing that difference.

- `build-encoder.js`  <- ts-builder `shared/build-encoder.js`
- `calculations.js`   <- ts-builder `shared/calculations.js`
- `embedcode.js`      <- ts-builder `shared/embedcode.js`

Copied at ts-builder commit: 68f0af2.

The game data is **not** here. It lives in `vendor/game-data/`, a git
submodule of `ts-game-data`, shared with `ts-builder` and `ts-discord-bot`.
Run `git submodule update --init --recursive` after cloning.
