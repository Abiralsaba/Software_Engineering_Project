'use strict';

const crypto = require('crypto');
const sharp = require('sharp');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function detectMime(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return null;
}

async function processImage(file) {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer)) throw Object.assign(new Error('Image data is required.'), { status: 400 });
    if (file.buffer.length > MAX_IMAGE_BYTES) throw Object.assign(new Error('Each image must be 8 MB or smaller.'), { status: 400 });
    const detectedMime = detectMime(file.buffer);
    if (!detectedMime || !allowedTypes.has(detectedMime) || file.mimetype !== detectedMime) {
        throw Object.assign(new Error('Image content must be a genuine JPEG, PNG, or WebP file.'), { status: 400 });
    }

    const sourceHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    try {
        const pipeline = sharp(file.buffer, { failOn: 'error', limitInputPixels: 40_000_000 });
        const metadata = await pipeline.metadata();
        if (!metadata.width || !metadata.height) throw new Error('Missing image dimensions');
        const output = await pipeline
            .rotate()
            .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
            .toBuffer({ resolveWithObject: true });
        return {
            buffer: output.data,
            mimeType: 'image/jpeg',
            hash: sourceHash,
            metadata: {
                original_mime: detectedMime,
                original_bytes: file.buffer.length,
                original_width: metadata.width,
                original_height: metadata.height,
                processed_bytes: output.info.size,
                processed_width: output.info.width,
                processed_height: output.info.height
            }
        };
    } catch {
        throw Object.assign(new Error('The image is corrupt or cannot be decoded. Please choose another image.'), { status: 400 });
    }
}

module.exports = { MAX_IMAGE_BYTES, detectMime, processImage };
