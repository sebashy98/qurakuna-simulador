module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, imageBase64, imageType } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt requerido' });

    const FAL_KEY = process.env.FAL_API_KEY;

    if (imageBase64) {
      // Subir imagen a Fal usando el endpoint correcto
      const imgBuffer = Buffer.from(imageBase64, 'base64');
      const mime = imageType || 'image/jpeg';

      // Fal storage upload - endpoint correcto
      const uploadRes = await fetch('https://fal.run/fal-ai/storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': mime,
        },
        body: imgBuffer
      });

      if (!uploadRes.ok) {
        const e = await uploadRes.text();
        throw new Error('Upload failed: ' + e);
      }

      const uploadData = await uploadRes.json();
      const imageUrl = uploadData.url;
      if (!imageUrl) throw new Error('No URL from upload: ' + JSON.stringify(uploadData));

      // Usar flux image-to-image con la foto real del cliente
      const falRes = await fetch('https://fal.run/fal-ai/flux/dev/image-to-image', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_url: imageUrl,
          prompt: prompt,
          strength: 0.6,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true
        })
      });

      if (!falRes.ok) {
        const e = await falRes.text();
        throw new Error('Fal image-to-image failed: ' + e);
      }

      const falData = await falRes.json();
      const url = falData.images?.[0]?.url;
      if (!url) throw new Error('No image returned: ' + JSON.stringify(falData));
      return res.status(200).json({ url });

    } else {
      // Sin imagen: generación pura
      const falRes = await fetch('https://fal.run/fal-ai/flux/dev', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true,
          image_size: 'landscape_4_3'
        })
      });

      const falData = await falRes.json();
      const url = falData.images?.[0]?.url;
      if (!url) throw new Error('No image: ' + JSON.stringify(falData));
      return res.status(200).json({ url });
    }

  } catch (e) {
    console.error('Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
