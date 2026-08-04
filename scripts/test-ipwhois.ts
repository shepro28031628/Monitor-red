export async function runIpwhois() {
  try {
    const res = await fetch("https://ipwho.is/8.8.8.8", {
      headers: { 'User-Agent': 'MikroTik-Monitor/1.0' }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", data);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

runIpwhois();
