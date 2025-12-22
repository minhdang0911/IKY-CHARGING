// apis/vietqr.js
export async function vietqrGenerate({
  accountNo,
  accountName,
  acqId,
  amount,
  addInfo,
  template = "compact",
  format = "text",
}) {
  const res = await fetch("https://api.vietqr.io/v2/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // VietQR có cơ chế API Key. Nếu project bạn có key thì thêm vào đây:
      // "x-client-id": "...",
      // "x-api-key": "...",
    },
    body: JSON.stringify({
      accountNo,
      accountName,
      acqId,
      amount,
      addInfo,
      format,
      template,
    }),
  });

  const json = await res.json();
  if (!res.ok || json?.code !== "00") {
    throw new Error(json?.desc || json?.message || "VietQR generate failed");
  }
  return json; // thường có: data.qrCode (payload), data.qrDataURL (base64 image)
}
