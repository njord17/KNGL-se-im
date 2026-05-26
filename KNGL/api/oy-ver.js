export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ hata: 'Yalnızca POST istekleri kabul edilir.' });
    const { secim, turnstileToken } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        const cfResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${process.env.CF_SECRET_KEY}&response=${turnstileToken}`
        });
        const cfResult = await cfResponse.json();
        if (!cfResult.success) return res.status(400).json({ hata: 'Bot doğrulaması başarısız oldu.' });
        const supabaseResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/oylar`, {
            method: 'POST',
            headers: {
                'apikey': process.env.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ ip_adresi: ip, secim: secim })
        });
        if (supabaseResponse.status === 409) return res.status(400).json({ hata: 'Bu IP adresinden zaten oy kullanılmış!' });
        if (!supabaseResponse.ok) return res.status(500).json({ hata: 'Veri tabanına kaydedilirken bir hata oluştu.' });
        const sonuclarResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/oylar?select=secim`, {
            method: 'GET',
            headers: { 'apikey': process.env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}` }
        });
        const tumOylar = await sonuclarResponse.json();
        const sayilar = { eray: 0, hobbit: 0 };
        tumOylar.forEach(oy => {
            if (oy.secim === 'Eray') sayilar.eray++;
            if (oy.secim === "Hobbit Emo'nun Tarafı") sayilar.hobbit++;
        });
        return res.status(200).json({ success: true, sonuclar: sayilar });
    } catch (error) { return res.status(500).json({ hata: 'Sunucu hatası oluştu.' }); }
}