const major = Number(process.versions.node.split('.')[0]);

if (major !== 22) {
  console.error(`Expected Node 22.x, got ${process.version}.`);
  console.error('Run `nvm use` from the repo root or server directory, then reinstall/rebuild dependencies.');
  process.exit(1);
}
