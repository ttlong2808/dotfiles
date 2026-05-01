#!/bin/bash
# postinst — automatically install missing dependencies after dpkg unpacks the .deb
# This runs as root during package installation.

apt-get update -qq
apt-get install -f -y --no-install-recommends
