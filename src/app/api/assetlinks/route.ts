// Digital Asset Links: prova para o Android que o app da Play Store e este site são do mesmo dono.
// Sem isso, o app abre com uma barra de endereço do navegador no topo.
export const dynamic = "force-dynamic";

export function GET() {
  const pkg = process.env.ANDROID_PACKAGE_NAME;
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const body =
    pkg && fingerprints.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fingerprints },
          },
        ]
      : [];

  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
