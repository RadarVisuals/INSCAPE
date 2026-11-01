import { copyFile, mkdir, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function createExperiment(root, name, from = 'reception') {
  if (!/^[a-z][a-z0-9-]{0,47}$/u.test(name) || /^(con|prn|aux|nul|com\d|lpt\d)$/iu.test(name)) throw Error('Use a short lowercase name with letters, numbers and hyphens.');
  if (!['reception', 'toolbar', 'workspace'].includes(from)) throw Error('Choose --from reception, toolbar or workspace.');
  const directory = resolve(root, 'design-system/lab/experiments');
  await mkdir(directory, { recursive: true });
  const file = resolve(directory, `${name}.jsx`);
  // These sibling folders intentionally use identical relative imports.
  await copyFile(resolve(root, `design-system/lab/artboards/${from}.jsx`), file, constants.COPYFILE_EXCL);
  return file;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [name, flag, from, ...extra] = process.argv.slice(2);
    if (!name || extra.length || flag && (flag !== '--from' || !from)) throw Error('Usage: npm run design:new -- name [--from reception|toolbar|workspace]');
    const file = await createExperiment(resolve(import.meta.dirname, '..'), name, from);
    console.log(`Created ${file}\nOpen http://127.0.0.1:5179/design-lab.html?artboard=experiments/${name}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
