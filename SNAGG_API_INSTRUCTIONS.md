# Snagg.meme API Enhancement Instructions

These instructions are for Claude (or any developer) working on the snagg.meme API to add watermarking, alt text generation, and improved security.

---

## 1. Database Schema Changes

Add these new columns to the `memes` table:

```sql
ALTER TABLE memes ADD COLUMN alt_text TEXT;
ALTER TABLE memes ADD COLUMN watermarked_image_url TEXT;
ALTER TABLE memes ADD COLUMN watermark_applied_at TIMESTAMP;
```

**Purpose:**
- `alt_text`: Accessibility description for screen readers (important for social media compliance)
- `watermarked_image_url`: URL to the watermarked version of the image
- `watermark_applied_at`: Track when watermark was applied for cache invalidation

---

## 2. Image Watermarking Implementation

### Option A: On-Demand Watermarking (Recommended)

Create an edge function or API route that watermarks images on request:

```typescript
// Example: /api/v1/image/[meme_id]/watermarked
import sharp from 'sharp';

export async function GET(request: Request, { params }: { params: { meme_id: string } }) {
  const meme = await getMemeById(params.meme_id);

  // Fetch original image
  const imageResponse = await fetch(meme.image_url);
  const imageBuffer = await imageResponse.arrayBuffer();

  // Create watermark overlay
  const watermarkSvg = `
    <svg width="200" height="40">
      <rect width="200" height="40" fill="rgba(0,0,0,0.5)" rx="5"/>
      <text x="10" y="28" font-family="Arial" font-size="18" fill="white">
        snagg.meme
      </text>
    </svg>
  `;

  // Apply watermark in bottom-right corner
  const watermarkedImage = await sharp(Buffer.from(imageBuffer))
    .composite([{
      input: Buffer.from(watermarkSvg),
      gravity: 'southeast',
      blend: 'over'
    }])
    .jpeg({ quality: 90 })
    .toBuffer();

  return new Response(watermarkedImage, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    }
  });
}
```

### Option B: Pre-generate Watermarked Images

If using Supabase Storage:

```typescript
async function generateAndStoreWatermarkedImage(meme: Meme): Promise<string> {
  const imageResponse = await fetch(meme.image_url);
  const imageBuffer = await imageResponse.arrayBuffer();

  const watermarkedBuffer = await applyWatermark(Buffer.from(imageBuffer));

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('watermarked-memes')
    .upload(`${meme.id}.jpg`, watermarkedBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('watermarked-memes')
    .getPublicUrl(`${meme.id}.jpg`);

  // Update database
  await supabase
    .from('memes')
    .update({
      watermarked_image_url: publicUrl,
      watermark_applied_at: new Date().toISOString()
    })
    .eq('id', meme.id);

  return publicUrl;
}
```

### Watermark Design Recommendations

1. **Position**: Bottom-right corner (least intrusive for most meme formats)
2. **Style**: Semi-transparent background with white text
3. **Size**: ~10-15% of image width, scaled proportionally
4. **Content**: "snagg.meme" or logo
5. **Fallback**: If watermarking fails, return original image (don't break the API)

---

## 3. Alt Text Generation

### Option A: AI-Generated Alt Text (Recommended)

Use an AI vision model to generate descriptive alt text:

```typescript
import Anthropic from '@anthropic-ai/sdk';

async function generateAltText(imageUrl: string): Promise<string> {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'url', url: imageUrl }
        },
        {
          type: 'text',
          text: `Generate a concise alt text description for this meme image.
                 Focus on describing the visual content (characters, text, expressions)
                 in a way that would help someone using a screen reader understand
                 what makes this image funny or interesting.
                 Keep it under 150 characters. Do not say "This meme shows" - just describe it.`
        }
      ]
    }]
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
```

### Option B: Template-Based Alt Text

For memes with known templates:

```typescript
function generateTemplateAltText(meme: Meme): string {
  if (meme.template_name) {
    // Use template-specific descriptions
    const templates: Record<string, string> = {
      'drake': 'Drake meme showing disapproval then approval',
      'distracted-boyfriend': 'Distracted boyfriend meme with three people',
      'change-my-mind': 'Man sitting at table with sign',
      // ... more templates
    };

    const base = templates[meme.template_name] || 'Meme image';
    return meme.title ? `${base}: "${meme.title}"` : base;
  }

  // Fallback to title/description
  return meme.description || meme.title || 'Meme from snagg.meme';
}
```

### Alt Text Guidelines

1. **Length**: 100-150 characters ideal, max 250
2. **Content**: Describe visual elements, not just the joke
3. **Include text in image**: If the meme has text, include it
4. **Avoid**: "Image of", "Picture of", "Meme showing" - just describe
5. **Example**: "Bender from Futurama saying 'I'm going to build my own theme park'"

---

## 4. API Response Updates

Update the `/api/v1/random` endpoint to include new fields:

```typescript
// Current response structure (keep all existing fields)
interface MemeResponse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string;
  thumbnail_url: string;
  // ... existing fields ...

  // NEW FIELDS TO ADD:
  alt_text: string | null;           // AI-generated or template-based
  watermarked_image_url: string | null;  // URL to watermarked version
}
```

Example implementation:

```typescript
export async function GET(request: Request) {
  const meme = await getRandomMeme();

  // Generate alt text if missing
  if (!meme.alt_text) {
    meme.alt_text = await generateAltText(meme.image_url);
    // Optionally save for future requests
    await saveMemeAltText(meme.id, meme.alt_text);
  }

  // Generate watermarked URL
  const watermarkedUrl = meme.watermarked_image_url ||
    `https://snagg.meme/api/v1/image/${meme.id}/watermarked`;

  return Response.json({
    data: {
      memes: [{
        ...meme,
        alt_text: meme.alt_text,
        watermarked_image_url: watermarkedUrl,
      }]
    },
    error: null
  });
}
```

---

## 5. API Authentication (Optional but Recommended)

### Add API Key Support

```typescript
// middleware.ts or in the API route
export async function validateApiKey(request: Request): Promise<boolean> {
  const apiKey = request.headers.get('X-API-Key');

  if (!apiKey) {
    // Allow unauthenticated requests with rate limiting
    return true;
  }

  // Validate API key against database
  const { data } = await supabase
    .from('api_keys')
    .select('id, rate_limit')
    .eq('key', apiKey)
    .eq('is_active', true)
    .single();

  return !!data;
}
```

### API Keys Table

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  owner_email TEXT,
  rate_limit INTEGER DEFAULT 100,  -- requests per minute
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  last_used_at TIMESTAMP
);

-- Generate a key for the bsky-bot
INSERT INTO api_keys (key, name, owner_email, rate_limit)
VALUES (
  'sk_' || encode(gen_random_bytes(24), 'hex'),
  'snagg-bsky-bot',
  'your-email@example.com',
  60
);
```

---

## 6. Security Headers

Add these headers to all API responses:

```typescript
// In middleware or response helper
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-RateLimit-Limit': rateLimit.toString(),
  'X-RateLimit-Remaining': remaining.toString(),
};
```

---

## 7. Testing the Changes

After implementing, you can test with:

```bash
# Test watermarked image
curl -s "https://snagg.meme/api/v1/random" | jq '.data.memes[0].watermarked_image_url'

# Test alt text
curl -s "https://snagg.meme/api/v1/random" | jq '.data.memes[0].alt_text'

# Test with API key
curl -s -H "X-API-Key: your-api-key" "https://snagg.meme/api/v1/random"
```

---

## 8. Bot Client Compatibility

The bsky-bot is already updated to:

1. Read `watermarked_image_url` and prefer it over `image_url`
2. Read `alt_text` and use it for Bluesky image accessibility
3. Send `X-API-Key` header if `SNAGG_API_KEY` env var is set

Environment variables for the bot:
```
SNAGG_API_KEY=your-api-key-here
SNAGG_API_URL=https://snagg.meme/api/v1  # optional, this is the default
```

---

## Summary of Required Changes

| Priority | Change | Effort |
|----------|--------|--------|
| HIGH | Add `alt_text` field to response | Medium |
| HIGH | Add `watermarked_image_url` field | Medium |
| MEDIUM | Implement image watermarking | Medium-High |
| MEDIUM | Generate alt text (AI or template) | Medium |
| LOW | Add API key authentication | Low |
| LOW | Add security headers | Low |

Start with the HIGH priority items - they'll immediately improve accessibility and branding for social media posts.
