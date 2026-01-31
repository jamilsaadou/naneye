import QRCode from "qrcode";

export async function renderQrSvg(data: string) {
  return QRCode.toString(data, {
    type: "svg",
    margin: 1,
    width: 140,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
