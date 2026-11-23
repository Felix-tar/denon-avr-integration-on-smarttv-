# Denon, Kodi and HDMI switching bugs

| Problem | Mechanism | Implementation and check |
| --- | --- | --- |
| Console tile disappears after DHCP renewal | Device address no longer matches a stored network probe | Removed console IP probing. Source list uses AVR names and signal; CEC gives active source events |
| TV power-on wakes the console too | Device auto-power/CEC Option was also used as the desired wake path | TV automatic wake and explicit per-console wake are separate. Check the stock CEC settings |
| Running console takes over Kodi | Source sends One Touch Play and CEC changes TV input asynchronously | Control One Touch Play per source. Flex cannot make a CEC-initiated switch atomic |
| Kodi video remains behind HDMI | The model reported a stale DMP source while HDMI was active | `dmpActive()` checks the physical source before entering the media lifecycle |
| Quiet return from console to Kodi | TV selected the app, but the receiver remained on an HDMI input | Flex Home queues AVR MAIN TV audio and rechecks the pending launch, also after repeat OK |
| Old console request runs after a new choice | In-flight amplifier controls outlive the original launcher context | Mark old selection obsolete. If it already wrote to the AVR, settle MAIN back to TV audio before the right next action |
| TV audio request lost during a status read | Bridge supports one in-flight request | Queue the transition and re-evaluate when free |
| No picture on the chosen input | AVR source can be correct before a device outputs video | Active check with 20/40-second windows depending on wake. Refresh after the deadline. Fall back only on current evidence |
| AVR status missing at the check deadline | Old power/input status looked like fresh no-video status | Clear the watcher after the grace period. The simulation distinguishes missing video metadata from an explicit no-signal response |
| Source rename lost while a soft keyboard is open | Auto-refresh could claim the one pending request | Pause the status ticker and explicit picture refresh while the label keyboard is active |
| HDMI blocked after minimizing Kodi | Native DMP stop was still pending as the next source was selected | Keep UI minimize distinct from native media release and wait for a known transition |
| TV service destabilized by video-window cleanup | Window operation outlived the original DMP session | Reset within the active session. Space cleanup and stop and confirm the original item before acting |
| Kodi AVR ring shows a fallback label | The TV runtime lacked `tr` for reading `avr.url` | Main wrapper uses its existing `awk` and strips a trailing CR from the first line |

On the reference hardware, targeted CEC Start succeeded with an unambiguous device type.
Several consoles can share the same CEC playback-device type. Treat that as ambiguous and
switch input without sending a directed wake. The reference PS5 did not respond to the TV's
UI standby key as a request to enter rest mode. Console automatic standby remains a
device-managed behavior.

Useful sequence to repeat: cold boot → choose console → wait for the AVR and video →
enter Kodi → minimize to Home → select HDMI → restore Kodi → switch to a stock app.
Repeat with held OK and Back, a receiver unavailable at the picture deadline, a source
with no signal, TV muted, and ZONE2 occupied. Compare receiver MAIN, TV HDMI/DMP, active
CEC device, player ownership and audio mode after each step. Test the normal receiver
remote controls after the integration is stopped.
