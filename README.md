# Denon AVR integration for Flex TV

A receiver bridge and source-selection panel for the Hisense 55U8QF reference model
with a Denon AVC-X3800H. AVR MAIN, the physical HDMI input, HDMI-CEC wake and ARC return
audio have separate state. A console selection can send ZONE2 power-off during the
reference receiver sequence. The automatic return of MAIN to TV audio leaves ZONE2 alone.

## Flex TV projects

- [Complete Flex TV bundle and master prompt](https://github.com/Felix-tar/FLEXTV-HISENSE_MOD-custom-software-addblock-kodi-and-denon-avr-)
- [Hisense VIDAA mod](https://github.com/Felix-tar/hisense-vidda-root-ssh-mod)
- [Kodi for Hisense VIDAA](https://github.com/Felix-tar/kodi-for-hisense-)
- [Denon AVR integration](https://github.com/Felix-tar/denon-avr-integration-on-smarttv-)

[Copy the standalone master prompt](#master-prompt)

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

## Run the bridge on its own

The C bridge and Node simulations can be built and tested independently of Kodi.
The bridge uses a single operator-configured Denon IPv4 address. The receiver
panel and source picker use the Flex launcher and its three embedded blocks.
[Bridge start and configuration](docs/01-architecture.md#build-and-install) ·
[Validation and removal](docs/01-architecture.md#offline-and-hardware-validation)

Start with the offline simulations and a receiver status check. Add launcher
integration only when you want to test the TV source transition, picture lock
and return to TV audio.

## Master prompt

Open this repository in a coding agent and paste this block. Provide the TV
model/firmware, receiver model, its TV HDMI connection and the desired feature.
Keep the actual LAN address in your device-local configuration.

```text
Help me build, test and run the Denon AVR bridge for my own equipment. The
reference is a Denon AVC-X3800H and a Hisense 55U8QF running VIDAA U4
V0000.01.00C.P0219. Confirm my receiver, TV, HDMI input and ARC/CEC behavior.
Treat the bridge as a separate component. Use the Flex launcher for the
optional Denon screen and source picker, and make Kodi optional.

1. Read README.md, docs/01-architecture.md, docs/02-bugs-fixes-and-lessons.md
   and docs/03-command-reference.md. Inspect src/bridge.c, src/start.sh,
   src/sources.js, src/ui.js, src/style.css and src/sync-ui.py. Explain the
   receiver command/status boundary, request/reply IDs, and TV-side ownership
   of HDMI selection and picture lock.

2. Run the Node tests in src/test-*.js. Verify the ARM bridge by checking
   prebuilt/SHA256SUMS or rebuild it from src/bridge.c with Zig 0.16.0 for
   the documented static ARM musl target. Explain which bugs the simulations
   cover and list tests that still require hardware.

3. Before installing, confirm the existing authorized TV session, stock
   HDMI/ARC behavior and a rollback plan. Save the previous bridge and
   launcher state privately. With my approval deploy the built bridge and
   start script as described in the build-and-install guide. Configure
   FLEX_DENON_HOST as the single receiver IPv4 address that I supply locally.
   Verify the service and check status through the documented bridge flow
   before I approve a receiver change.

4. If I want the launcher panel, confirm that the Flex launcher is present
   and inspect its three Denon blocks. Use src/sync-ui.py to keep their
   authoritative copies synchronized when changing the UI. Explain how
   explicit console selection and automatic return to TV audio differ.
   Validate AVR MAIN, physical TV HDMI selection, CEC wake, picture lock,
   source cancellation and audio return as separate conditions. Track ZONE2
   only when the approved scenario touches it.

5. Record host test results, the ARM artifact hash, input and receiver
   behavior, and safe rollback steps. Keep actual addresses, saved receiver
   state and credentials device-local. Restore the verified launcher files
   and stop the bridge using the documented service controls if needed.
```

## License

The original code and documentation are available under the [MIT License](LICENSE).
The [ARM build notes](prebuilt/README.md#license-notices) list the third-party runtime licenses.
