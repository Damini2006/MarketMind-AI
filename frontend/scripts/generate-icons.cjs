// Generate proper PNG icons for PWA manifest using pure Node.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xffffffff;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData));
  return Buffer.concat([len, typeData, crc]);
}

function createPNG(width, height, r, g, b, a = 255) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Image data: each row starts with filter byte 0 (None)
  const raw = Buffer.alloc(height * (1 + width * 4));
  const cornerRadius = Math.floor(width * 0.15);
  
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // no filter
    
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      
      // Check if inside rounded rectangle
      let inside = true;
      // Top-left corner
      if (x < cornerRadius && y < cornerRadius) {
        const dx = cornerRadius - x, dy = cornerRadius - y;
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
      }
      // Top-right corner
      if (x >= width - cornerRadius && y < cornerRadius) {
        const dx = x - (width - cornerRadius - 1), dy = cornerRadius - y;
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
      }
      // Bottom-left corner
      if (x < cornerRadius && y >= height - cornerRadius) {
        const dx = cornerRadius - x, dy = y - (height - cornerRadius - 1);
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
      }
      // Bottom-right corner
      if (x >= width - cornerRadius && y >= height - cornerRadius) {
        const dx = x - (width - cornerRadius - 1), dy = y - (height - cornerRadius - 1);
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
      }
      
      // Gradient: blend from indigo (#6366f1) to violet (#8b5cf6)
      const t = (x + y) / (width + height);
      const gradR = Math.round(99 + (139 - 99) * t);
      const gradG = Math.round(102 + (92 - 102) * t);
      const gradB = Math.round(241 + (246 - 241) * t);
      
      if (inside) {
        raw[px] = gradR;
        raw[px + 1] = gradG;
        raw[px + 2] = gradB;
        raw[px + 3] = 255;
      } else {
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0; // transparent
      }
    }
  }

  const compressed = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

const publicDir = path.join(__dirname, '..', 'public');

// Generate icons at required PWA sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach(size => {
  const png = createPNG(size, size, 99, 102, 241); // indigo base
  const filePath = path.join(publicDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`✓ icon-${size}xx${size}.png (${(png.length / 1024).toFixed(1)} KB)`);
});

console.log('\nAll PWA icons generated!');
