# ARM receiver bridge

`flex-denon-bridge` is the static musl build of [src/bridge.c](../src/bridge.c)
for little-endian ARMv7/soft-float. It was compiled with Zig 0.16.0 and reproduced
byte for byte using the command in the [setup guide](../docs/01-architecture.md#build-and-install).

```sh
sha256sum -c SHA256SUMS
chmod +x flex-denon-bridge
```

Use your own receiver IPv4 address through `FLEX_DENON_HOST` on the TV.

## License notices

The bridge statically links the C runtime from Zig 0.16.0.
The [musl copyright and license notices](licenses/musl-COPYRIGHT) and
the [Zig license](licenses/Zig-LICENSE) accompany the binary.
The runtime sources are in the [Zig 0.16.0 source release](https://ziglang.org/download/#release-0.16.0).
