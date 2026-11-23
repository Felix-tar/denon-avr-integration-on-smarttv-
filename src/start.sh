#!/bin/sh
# Dedicated Denon app service. No changes to ARC, CEC, sources or receiver on start.
[ -e /APPS/flexdenon/off ] && exit 0
: "${FLEX_DENON_HOST:?Set the IPv4 address of your receiver}"
export FLEX_DENON_HOST
D=/tmp/flexdenon
U=/var/local/applications/UI/flexdenon
[ -L "$D" ] && exit 1
mkdir -p "$D" || exit 1
[ "$(stat -c %u "$D")" = 0 ] || exit 1
chmod 755 "$D"
[ -L "$D/b" ] && exit 1
mkdir -p "$D/b" /APPS/flexdenon/history /APPS/flexdenon/labels || exit 1
chown 10009:10009 "$D/b" /APPS/flexdenon/history /APPS/flexdenon/labels
chmod 700 "$D/b" /APPS/flexdenon/history /APPS/flexdenon/labels
mkdir -p /APPS/flexdenon/targets || exit 1
chown 0:0 /APPS/flexdenon/targets
chmod 755 /APPS/flexdenon/targets
if [ -e "$U" ] || [ -L "$U" ]; then
  [ -L "$U" ] && [ "$U" -ef "$D/b" ] || exit 1
else
  ln -s "$D/b" "$U" || exit 1
fi
setsid /APPS/flexdenon/flex-denon-bridge </dev/null >/APPS/flexdenon/service.log 2>&1 &
