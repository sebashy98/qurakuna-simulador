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
    const mime = imageType || 'image/jpeg';
    const imageDataUri = imageBase64 ? `data:${mime};base64,${imageBase64}` : null;

    if (imageDataUri) {
      const falRes = await fetch('https://fal.run/fal-ai/flux/dev/image-to-image', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_url: imageDataUri,
          prompt: prompt,
          strength: 0.68,
          num_inference_steps: 35,
          guidance_scale: 5,
          num_images: 1,
          enable_safety_checker: true
        })
      });

      const falData = await falRes.json();
      if (!falRes.ok) throw new Error(JSON.stringify(falData));
      const url = falData.images?.[0]?.url;
      if (!url) throw new Error('No image: ' + JSON.stringify(falData));
      return res.status(200).json({ url });

    } else {
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
