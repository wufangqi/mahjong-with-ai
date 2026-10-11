#!/usr/bin/env bash
# Grant the current uid rw on /dev/dri render/card nodes via privileged Docker.
# Needed when the user is not in the render/video groups (common on agent hosts).
set -euo pipefail
uid="${SUDO_UID:-$(id -u)}"
if [[ -r /dev/dri/renderD128 ]] && [[ -w /dev/dri/renderD128 ]]; then
  echo "DRI already writable for uid $uid"
  exit 0
fi
docker run --rm --privileged -v /dev/dri:/dev/dri alpine \
  sh -c "apk add -q acl && setfacl -m u:${uid}:rw /dev/dri/card1 /dev/dri/renderD128 && getfacl /dev/dri/renderD128"
echo "Granted ACL u:${uid}:rw on /dev/dri/{card1,renderD128}"
