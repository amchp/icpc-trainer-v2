const path = require("node:path");

const bunExecutable = process.env.BUN_EXECUTABLE;

if (!bunExecutable) {
  throw new Error("BUN_EXECUTABLE must be set before running electron-builder.");
}

module.exports = {
  appId: "com.icpctrainer.desktop",
  productName: "ICPC Trainer",
  icon: path.resolve(__dirname, "resources/icon.ico"),
  directories: {
    output: "dist",
  },
  files: [
    "dist-electron/**/*",
    "package.json",
  ],
  extraResources: [
    {
      from: path.resolve(__dirname, "../web/dist"),
      to: "web/dist",
      filter: ["**/*"],
    },
    {
      from: path.resolve(__dirname, "../server/dist-bun"),
      to: "server/dist-bun",
      filter: ["**/*"],
    },
    {
      from: path.resolve(__dirname, "../server/drizzle"),
      to: "server/drizzle",
      filter: ["**/*"],
    },
    {
      from: path.dirname(bunExecutable),
      to: "bin",
      filter: [path.basename(bunExecutable)],
    },
  ],
  asar: true,
  mac: {
    artifactName: "${productName}-${version}-mac-${arch}.${ext}",
    category: "public.app-category.developer-tools",
    target: ["zip"],
  },
  win: {
    icon: path.resolve(__dirname, "resources/icon.ico"),
    artifactName: "${productName}-${version}-windows-installer-${arch}.${ext}",
    target: ["nsis"],
  },
  nsis: {
    artifactName: "${productName} Setup ${version}.${ext}",
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  linux: {
    artifactName: "${productName}-${version}-linux-${arch}.${ext}",
    target: ["AppImage"],
  },
};
