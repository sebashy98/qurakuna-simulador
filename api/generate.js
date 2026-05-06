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
      // Paso 1: subir la imagen del cliente a Fal storage
      const imgBuffer = Buffer.from(imageBase64, 'base64');
      const mime = imageType || 'image/jpeg';

      const uploadRes = await fetch('https://fal.run/fal-ai/storage/upload/initiate', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content_type: mime, file_name: 'room.jpg' })
      });

      if (!uploadRes.ok) {
        const e = await uploadRes.json();
        throw new Error('Upload initiate failed: ' + JSON.stringify(e));
      }

      const { upload_url, file_url } = await uploadRes.json();

      // Paso 2: subir el archivo binario
      await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': mime },
        body: imgBuffer
      });

      // Paso 3: usar fal-ai/flux/dev/image-to-image para editar la foto real
      const falRes = await fetch('https://fal.run/fal-ai/flux/dev/image-to-image', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_url: file_url,
          prompt: prompt,
          strength: 0.55,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true
        })
      });

      if (!falRes.ok) {
        const e = await falRes.json();
        throw new Error('Fal image-to-image failed: ' + JSON.stringify(e));
      }

      const falData = await falRes.json();
      const url = falData.images?.[0]?.url;
      if (!url) throw new Error('No image returned from Fal');
      return res.status(200).json({ url });

    } else {
      // Sin imagen: generación pura con Fal flux
      const falRes = await fetch('https://fal.run/fal-ai/flux/dev', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true,
          image_size: 'landscape_4_3'
        })
      });

      if (!falRes.ok) {
        const e = await falRes.json();
        throw new Error('Fal generation failed: ' + JSON.stringify(e));
      }

      const falData = await falRes.json();
      const url = falData.images?.[0]?.url;
      if (!url) throw new Error('No image returned from Fal');
      return res.status(200).json({ url });
    }

  } catch (e) {
    console.error('Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
