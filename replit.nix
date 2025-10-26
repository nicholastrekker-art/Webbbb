
{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.postgresql
    pkgs.chromium
    pkgs.nss
    pkgs.freetype
    pkgs.harfbuzz
    pkgs.ttf_bitstream_vera
    pkgs.libX11
    pkgs.libXcomposite
    pkgs.libXdamage
    pkgs.libXext
    pkgs.libXfixes
    pkgs.libXrandr
    pkgs.libXrender
    pkgs.libxcb
    pkgs.libxkbcommon
    pkgs.libxshmfence
    pkgs.mesa
    pkgs.expat
    pkgs.libdrm
    pkgs.xorg.libxshmfence
    pkgs.glib
    pkgs.gtk3
    pkgs.pango
    pkgs.cairo
    pkgs.gdk-pixbuf
    pkgs.atk
    pkgs.at-spi2-atk
    pkgs.cups
    pkgs.dbus
    pkgs.nspr
    pkgs.alsa-lib
  ];
}
