import { keyGreenScreen } from './green-screen.mjs';

// Stream one tightly packed RGBA frame in and one equally sized frame out.
try {
  const [width, height, greenLevel, edgeStart, clear, trim] = process.argv.slice(2).map(Number);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || !Number.isInteger(trim) || trim < 0 || 2 * trim >= width) {
    throw new Error('Invalid frame dimensions or horizontal trim.');
  }

  const data = new Uint8ClampedArray(width * height * 4);
  const output = Buffer.from(data.buffer);
  const options = { greenLevel: greenLevel || undefined, edgeStart, clear };
  let offset = 0;
  for await (const chunk of process.stdin) {
    let read = 0;
    while (read < chunk.length) {
      const size = Math.min(data.length - offset, chunk.length - read);
      data.set(chunk.subarray(read, read + size), offset);
      read += size;
      offset += size;
      if (offset !== data.length) continue;

      keyGreenScreen({ data, width, height }, options);
      for (let y = 0; trim && y < height; y++) {
        const start = y * width * 4;
        const end = start + width * 4;
        data.fill(0, start, start + trim * 4);
        data.fill(0, end - trim * 4, end);
      }
      await new Promise((resolve, reject) => {
        process.stdout.write(output, error => error ? reject(error) : resolve());
      });
      offset = 0;
    }
  }
  if (offset) throw new Error('Incomplete input frame.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
