#!/usr/bin/env bash
# Builds cometix-native for the platforms whose Bun.ant members it implements
# — Windows, so far — into native/dist/cometix-native.<platform>.node, the
# name build-platform-package.mjs and the polyfill look for. Runs on a
# Windows host with the MSVC toolchain (the CI runners have both targets).
#
# x64 must build. A failed arm64 build is reported and skipped: that package
# then ships without the addon and the bundle keeps its fallbacks.
#
# NATIVE_ARCHES (default "x64 arm64") limits the build to the arches a
# release actually ships.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
declare -A TRIPLE=([x64]=x86_64-pc-windows-msvc [arm64]=aarch64-pc-windows-msvc)
ARCHES="${NATIVE_ARCHES:-x64 arm64}"
targets=()
for arch in $ARCHES; do targets+=("${TRIPLE[$arch]}"); done
rustup target add "${targets[@]}"
for arch in $ARCHES; do
  triple="${TRIPLE[$arch]}"
  if cargo build --locked --release --target "$triple"; then
    cp "target/$triple/release/cometix_native.dll" "dist/cometix-native.win32-$arch.node"
  elif [ "$arch" = x64 ]; then
    exit 1
  else
    echo "::warning::cometix-native did not build for win32-$arch; that package ships without it"
  fi
done
ls -l dist
