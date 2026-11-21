import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// ──────────────────────────────────────────────
//  Standalone package for a GitHub Release
//
//  The npm layout is a thin main package plus one platform package per
//  target, joined at install time through optionalDependencies and
//  postinstall. A release asset has no registry behind it, so the two halves
//  are merged here into one tarball-ready tree for a single platform:
//
//    npm install -g ./cometix-claude-code-<version>-<platform>.tgz
//
//  The platform files are already in place, so postinstall has nothing to
//  copy. The marker field tells it so (see templates/install.cjs).
// ──────────────────────────────────────────────

export async function buildStandalonePackage({ distDir, platform, outputDir }) {
  const mainDir = join(distDir, 'main');
  const platformDir = join(distDir, 'packages', platform);

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(mainDir, outputDir, { recursive: true });

  // Everything the platform package ships except its own manifest, which
  // would overwrite the main one — the same rule postinstall follows.
  for (const entry of await readdir(platformDir)) {
    if (entry === 'package.json') continue;
    await cp(join(platformDir, entry), join(outputDir, entry), { recursive: true });
  }

  const pkgPath = join(outputDir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  const platformPkg = JSON.parse(await readFile(join(platformDir, 'package.json'), 'utf8'));

  // The platform packages are never published from a release build, so npm
  // would fail resolving them. sharp's natives stay: they come from npm.
  for (const dep of Object.keys(pkg.optionalDependencies ?? {})) {
    if (dep.startsWith('@cometix/claude-code-')) delete pkg.optionalDependencies[dep];
  }
  pkg.os = platformPkg.os;
  pkg.cpu = platformPkg.cpu;
  pkg.cometixStandalone = platform;
  // The merged tree ships everything in it; `files` only listed what the
  // main package expected postinstall to add.
  delete pkg.files;

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  return { outputDir };
}

const isMain = process.argv[1]?.endsWith('build-standalone-package.mjs');
if (isMain) {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dist' && args[i+1]) flags.distDir = args[++i];
    else if (args[i] === '--platform' && args[i+1]) flags.platform = args[++i];
    else if (args[i] === '--output' && args[i+1]) flags.outputDir = args[++i];
  }
  if (!flags.distDir || !flags.platform || !flags.outputDir) {
    console.error('Usage: node build-standalone-package.mjs --dist <dir> --platform <p> --output <dir>');
    process.exit(1);
  }
  await buildStandalonePackage(flags);
  console.log(`✓ ${flags.platform} → ${flags.outputDir}`);
}
