export async function runIpapi() {
  try {
    const res = await fetch("https://ipapi.co/8.8.8.8/json/", {
      headers: { 'User-Agent': 'MikroTik-Monitor/1.0' }
    });
    console.log("Status:", res.status);
    const data = await res.text();
    console.log("Response:", data);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

runIpapi();
