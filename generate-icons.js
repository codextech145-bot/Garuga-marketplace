// Simple script to resize logo using canvas
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
    const logoPath = path.join(__dirname, '..', 'Garuga-Entebbe Market Logo_20260410_123603_0000.png');
    const publicDir = path.join(__dirname, '..', 'client', 'public');
    
    const sizes = [
        { name: 'pwa-192x192.png', size: 192 },
        { name: 'pwa-512x512.png', size: 512 },
        { name: 'favicon.ico', size: 32 },
        { name: 'apple-touch-icon.png', size: 180 }
    ];

    try {
        const image = await loadImage(logoPath);
        
        for (const { name, size } of sizes) {
            const canvas = createCanvas(size, size);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, size, size);
            
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(path.join(publicDir, name), buffer);
            console.log(`Created ${name} (${size}x${size})`);
        }
        
        console.log('All icons generated successfully!');
    } catch (error) {
        console.error('Error generating icons:', error.message);
        console.log('\nNote: Canvas package not available. Icons will use the logo directly.');
    }
}

generateIcons();
