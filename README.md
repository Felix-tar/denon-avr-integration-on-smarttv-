# Denon AVR integration for Flex TV

A receiver bridge and source-selection panel for the Hisense 55U8QF reference model
with a Denon AVC-X3800H. AVR MAIN, the physical HDMI input, HDMI-CEC wake and ARC return
audio have separate state. A console selection can send ZONE2 power-off during the
reference receiver sequence. The automatic return of MAIN to TV audio leaves ZONE2 alone.

## Flex TV projects

- [Hisense VIDAA mod](https://github.com/Felix-tar/hisense-vidda-root-ssh-mod)
- [Kodi for Hisense VIDAA](https://github.com/Felix-tar/kodi-for-hisense-)
- [Denon AVR integration](https://github.com/Felix-tar/denon-avr-integration-on-smarttv-)

## Reproduce the setup

1. Set up the matching launcher using the [Flex launcher guide](https://github.com/Felix-tar/hisense-vidda-root-ssh-mod/blob/main/docs/03-launcher-and-recovery.md).
   Confirm the receiver is connected to the reference HDMI 1 path and HDMI-CEC/ARC
   works with the stock controls.
2. Rebuild [the C bridge](src/bridge.c) for ARM Linux with Zig 0.16.0 or verify the
   [included ARM build](prebuilt/README.md). The [setup guide](docs/01-architecture.md#build-and-install)
   includes the compiler command, expected paths and the use of `FLEX_DENON_HOST` for
   your own receiver IPv4 address.
3. In your authorized TV service setup install `flex-denon-bridge` and
   [start.sh](src/start.sh) under `/APPS/flexdenon`, then start the bridge with the
   configured address. The launcher already includes the Denon blocks. The
   [sync tool](src/sync-ui.py) regenerates those blocks after a source edit.
4. Open Denon in All Apps, check read-only status, then test MAIN selection, HDMI-CEC,
   Home/Kodi TV audio and the loss of receiver status. Follow the
   [validation and removal steps](docs/01-architecture.md#offline-and-hardware-validation).

From this directory, the source switching and UI simulations run on a regular host:

```sh
for test in src/test-*.js; do node "$test" || exit; done
```

- [Receiver protocol and allowed commands](docs/03-command-reference.md)
- [Switching state, player cleanup and bug history](docs/02-bugs-fixes-and-lessons.md)

## License

The original code and documentation are available under the [MIT License](LICENSE).
The [ARM build notes](prebuilt/README.md#license-notices) list the third-party runtime licenses.
