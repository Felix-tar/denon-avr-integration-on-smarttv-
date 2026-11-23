# Receiver bridge and launcher integration

## Components and configuration

| Component | Responsibility |
| --- | --- |
| `src/bridge.c` | Validate a narrow receiver command set, snapshot MAIN/ZONE2 and return structured status |
| `src/start.sh` | Create or verify the device-local IPC directories and launch the bridge |
| `src/ui.js` and `src/style.css` | Render receiver settings. Handle requests, replies, rename editing and periodic refresh |
| `src/sources.js` | Console tile/menu, command and CEC state machine, HDMI 1 confirmation, cancellation and TV audio |
| `src/sync-ui.py` | Replace the three marked Denon blocks in the Flex launcher source |
| `src/test-*.js` | Node simulations of UI, receiver outcomes, CEC and competing source choices |

The bridge does not listen on the network. It opens TCP 23 to the one configured Denon address
for control/status and HTTP 11080 for input mapping, labels and HDMI signal metadata. It
receives the expected IPv4 destination in `FLEX_DENON_HOST`. The request to return MAIN to TV audio leaves ZONE2 alone. An explicit console selection can issue Z2OFF before routing MAIN. The code no longer guesses which consoles are online by querying
addresses on the LAN. Device labels known to the receiver and optional local display labels
drive the launcher list.

Receiver responses have fields for power (`ZM`, `Z2`), input (`SI`), volume (`MV`), mute
(`MU`) and audio settings. The bridge accepts only commands approved by `valid()` and the
explicit status/label flows. It saves a before-state for receiver changes and re-reads the
result. Stored history belongs with the receiver installation. Low receiver status and
command replies are not proof that the TV has changed to the correct connector.

## Files and state machines

The C service owns the request directory `/tmp/flexdenon/b`. The launcher's file namespace
sees it via `/var/local/applications/UI/flexdenon`. Startup checks ownership and the
expected directory/link before use. The bridge drops to the reference launcher user
when started by the authorized service supervisor.

A request is an ID line followed by one command line. The UI tracks at most one outstanding
request and only accepts the response bearing the same ID. The timeout leaves the result
unknown, so a later refresh is used to verify state. Label edits, receiver changes and
automatic source snapshots each have their own entry point. Opening the soft keyboard for
a label pauses automatic status refresh so that a pending status request cannot discard the
ordinary submission on return.

The console chooser tracks receiver source, whether a write was sent, selector generation,
physical TV input and picture lock separately. It can return to TV audio after an aborted
receiver change and waits for that outcome before starting a superseding app when required.
The picture watcher refreshes status near its deadline. Only a fresh source record for the
selected input permits fallback after no signal. An unavailable status leaves the selected
input alone. An incomplete video response remains unknown. Only an observed video field, including the receiver’s explicit no-signal marker, updates the video status.

## Build and install

1. Connect the receiver's TV HDMI output to the TV's ARC HDMI connector. The reference
   source routing uses HDMI 1. Check the correct connector in the TV menus. Connect your
   inputs to the receiver and verify that the TV and AVR each switch manually.
2. Build the bridge for ARM Linux on a host with Zig 0.16.0, or verify the
   [included build](../prebuilt/README.md).

   ```sh
   zig cc -target arm-linux-musleabi -mcpu=cortex_a7 -mfloat-abi=softfp \
     -static -O2 -Wall -Wextra -Wl,--strip-all -o flex-denon-bridge src/bridge.c
   ```

3. Through your authorized file transfer and service environment, install the verified
   `flex-denon-bridge` as `/APPS/flexdenon/flex-denon-bridge` and `src/start.sh` as
   `/APPS/flexdenon/start.sh`. Set the native bridge executable before starting.
   In the TV shell, substitute your actual receiver IPv4 address for the example.

   ```sh
   chmod 755 /APPS/flexdenon/flex-denon-bridge
   FLEX_DENON_HOST=192.0.2.80 sh /APPS/flexdenon/start.sh
   ```

   The input address is device-local configuration. Check
   `/APPS/flexdenon/service.log` and confirm that the Denon page reads status.

4. The reference [Flex launcher](https://github.com/Felix-tar/hisense-vidda-root-ssh-mod/blob/main/docs/03-launcher-and-recovery.md) already contains
   these three embedded blocks. After editing them in this repository, regenerate the embedded
   copies before redeploying the launcher.

   ```sh
   python3 src/sync-ui.py /path/to/hisense-vidaa-root-mod/mods/startscreen/flex
   ```

5. Open Denon from All Apps and read status first. Try one MAIN input while watching
   ZONE2. Confirm ARC audio and HDMI-CEC behavior using the TV and receiver's own controls.

Stop the service through its own supervisor. The local `/APPS/flexdenon/off` marker makes
`start.sh` exit normally before starting. For removal, restore the previous verified launcher
files or follow the [Flex launcher rollback guide](https://github.com/Felix-tar/hisense-vidda-root-ssh-mod/blob/main/docs/03-launcher-and-recovery.md#roll-back)
and preserve any receiver history you want.

## Offline and hardware validation

Run all `src/test-*.js` with Node and syntax-check the UI files. The source simulator covers
cancel, TV audio reversion, held remote keys, refresh timing, fresh signal/no signal and
status loss. On the receiver, confirm TCP command acknowledgements, actual source, ARC audio
and CEC wake from rest. Live tests depend on the receiver configuration. A passive PC input
with no CEC will not report or switch itself in the same way as a console.
