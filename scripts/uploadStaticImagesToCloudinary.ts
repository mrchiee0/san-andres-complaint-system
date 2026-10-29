import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { uploadToCloudinary } from '../src/services/cloudinaryService.ts';

const imageDirectory = path.join(process.cwd(), 'public', 'images');
const files = (await readdir(imageDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();

if (files.length === 0) {
  throw new Error(`No image files found in ${imageDirectory}.`);
}

for (const filename of files) {
  const filePath = path.join(imageDirectory, filename);
  const publicId = path.parse(filename).name;
  const url = await uploadToCloudinary(await readFile(filePath), {
    folder: 'san-andres-site',
    resource_type: 'image',
    public_id: publicId,
  });
  console.log(`Uploaded ${filename}: ${url}`);
}
