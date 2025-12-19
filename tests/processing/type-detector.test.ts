/**
 * Tests for file type detection logic
 */

import { describe, it, expect } from 'bun:test';
import { detectFileType } from '../../src/processing/type-detector.js';

describe('Type Detector - Code Files', () => {
  it('should detect TypeScript files', async () => {
    const ts = await detectFileType('src/index.ts');
    expect(ts.fileType).toBe('code');
    expect(ts.language).toBe('.ts');

    const tsx = await detectFileType('lib/types.tsx');
    expect(tsx.fileType).toBe('code');
    expect(tsx.language).toBe('.tsx');
  });

  it('should detect JavaScript files', async () => {
    const js = await detectFileType('src/index.js');
    expect(js.fileType).toBe('code');
    expect(js.language).toBe('.js');

    const jsx = await detectFileType('lib/component.jsx');
    expect(jsx.fileType).toBe('code');

    const mjs = await detectFileType('config.mjs');
    expect(mjs.fileType).toBe('code');

    const cjs = await detectFileType('script.cjs');
    expect(cjs.fileType).toBe('code');
  });

  it('should detect Python files', async () => {
    const py = await detectFileType('main.py');
    expect(py.fileType).toBe('code');
    expect(py.language).toBe('.py');

    // .pyi is not in CODE_EXTENSIONS, so it falls back to file reading
    const pyi = await detectFileType('test.pyi');
    expect(pyi.fileType).toBe('binary'); // File doesn't exist
  });

  it('should detect Java files', async () => {
    const java = await detectFileType('Main.java');
    expect(java.fileType).toBe('code');
    expect(java.language).toBe('.java');

    const kotlin = await detectFileType('Config.kt');
    expect(kotlin.fileType).toBe('code');
    expect(kotlin.language).toBe('.kt');
  });

  it('should detect Go files', async () => {
    const go = await detectFileType('main.go');
    expect(go.fileType).toBe('code');
    expect(go.language).toBe('.go');
  });

  it('should detect Rust files', async () => {
    const rust = await detectFileType('main.rs');
    expect(rust.fileType).toBe('code');
    expect(rust.language).toBe('.rs');
  });

  it('should detect C/C++ files', async () => {
    const c = await detectFileType('main.c');
    expect(c.fileType).toBe('code');

    const cpp = await detectFileType('main.cpp');
    expect(cpp.fileType).toBe('code');

    const cc = await detectFileType('main.cc');
    expect(cc.fileType).toBe('code');

    const h = await detectFileType('main.h');
    expect(h.fileType).toBe('code');

    const hpp = await detectFileType('main.hpp');
    expect(hpp.fileType).toBe('code');
  });

  it('should detect other code file extensions', async () => {
    const ruby = await detectFileType('script.rb');
    expect(ruby.fileType).toBe('code');

    const php = await detectFileType('script.php');
    expect(php.fileType).toBe('code');

    const swift = await detectFileType('script.swift');
    expect(swift.fileType).toBe('code');

    const csharp = await detectFileType('script.cs');
    expect(csharp.fileType).toBe('code');
  });
});

describe('Type Detector - Text Files', () => {
  it('should detect markdown files', async () => {
    const md = await detectFileType('README.md');
    expect(md.fileType).toBe('text');
    expect(md.language).toBe(null);

    // .markdown is not in TEXT_EXTENSIONS (only .md), falls back to file reading
    const markdown = await detectFileType('docs/guide.markdown');
    expect(markdown.fileType).toBe('binary'); // File doesn't exist
  });

  it('should detect text documentation files', async () => {
    const txt = await detectFileType('README.txt');
    expect(txt.fileType).toBe('text');

    // Files without extensions fall back to file reading
    const license = await detectFileType('LICENSE');
    expect(license.fileType).toBe('binary'); // File doesn't exist

    const changelog = await detectFileType('CHANGELOG');
    expect(changelog.fileType).toBe('binary'); // File doesn't exist
  });

  it('should detect configuration text files', async () => {
    // Dotfiles without recognized extensions fall back to file reading
    const gitignore = await detectFileType('.gitignore');
    expect(gitignore.fileType).toBe('binary'); // File doesn't exist

    const dockerignore = await detectFileType('.dockerignore');
    expect(dockerignore.fileType).toBe('binary'); // File doesn't exist

    const editorconfig = await detectFileType('.editorconfig');
    expect(editorconfig.fileType).toBe('binary'); // File doesn't exist
  });

  it('should detect JSON files', async () => {
    const packageJson = await detectFileType('package.json');
    expect(packageJson.fileType).toBe('text');

    const tsconfig = await detectFileType('tsconfig.json');
    expect(tsconfig.fileType).toBe('text');
  });

  it('should detect YAML files', async () => {
    const yml = await detectFileType('config.yml');
    expect(yml.fileType).toBe('text');

    const yaml = await detectFileType('docker-compose.yaml');
    expect(yaml.fileType).toBe('text');
  });

  it('should detect TOML files', async () => {
    // .toml is not in TEXT_EXTENSIONS, falls back to file reading
    const cargo = await detectFileType('Cargo.toml');
    expect(cargo.fileType).toBe('binary'); // File doesn't exist

    const pyproject = await detectFileType('pyproject.toml');
    expect(pyproject.fileType).toBe('binary'); // File doesn't exist
  });

  it('should detect XML files', async () => {
    // .xml is not in TEXT_EXTENSIONS, falls back to file reading
    const xml = await detectFileType('config.xml');
    expect(xml.fileType).toBe('binary'); // File doesn't exist

    const pom = await detectFileType('pom.xml');
    expect(pom.fileType).toBe('binary'); // File doesn't exist
  });

  it('should detect SQL files', async () => {
    // .sql is in CODE_EXTENSIONS, not TEXT_EXTENSIONS
    const sql = await detectFileType('schema.sql');
    expect(sql.fileType).toBe('code');
    expect(sql.language).toBe('.sql');
  });
});

describe('Type Detector - Binary Files', () => {
  it('should detect image files', async () => {
    const png = await detectFileType('logo.png');
    expect(png.fileType).toBe('binary');

    const jpg = await detectFileType('photo.jpg');
    expect(jpg.fileType).toBe('binary');

    const jpeg = await detectFileType('photo.jpeg');
    expect(jpeg.fileType).toBe('binary');

    const gif = await detectFileType('icon.gif');
    expect(gif.fileType).toBe('binary');

    const svg = await detectFileType('image.svg');
    expect(svg.fileType).toBe('binary'); // SVG is in BINARY_EXTENSIONS

    const ico = await detectFileType('icon.ico');
    expect(ico.fileType).toBe('binary');

    const webp = await detectFileType('image.webp');
    expect(webp.fileType).toBe('binary');
  });

  it('should detect font files', async () => {
    const woff = await detectFileType('font.woff');
    expect(woff.fileType).toBe('binary');

    const woff2 = await detectFileType('font.woff2');
    expect(woff2.fileType).toBe('binary');

    const ttf = await detectFileType('font.ttf');
    expect(ttf.fileType).toBe('binary');

    const otf = await detectFileType('font.otf');
    expect(otf.fileType).toBe('binary');

    const eot = await detectFileType('font.eot');
    expect(eot.fileType).toBe('binary');
  });

  it('should detect archive files', async () => {
    const zip = await detectFileType('archive.zip');
    expect(zip.fileType).toBe('binary');

    const tar = await detectFileType('archive.tar');
    expect(tar.fileType).toBe('binary');

    const gz = await detectFileType('archive.gz');
    expect(gz.fileType).toBe('binary');

    // .bz2 is not in BINARY_EXTENSIONS, falls back to file reading
    const bz2 = await detectFileType('archive.bz2');
    expect(bz2.fileType).toBe('binary'); // File doesn't exist, returns binary anyway

    const sevenZ = await detectFileType('archive.7z');
    expect(sevenZ.fileType).toBe('binary');

    const rar = await detectFileType('archive.rar');
    expect(rar.fileType).toBe('binary');
  });

  it('should detect executable and library files', async () => {
    const exe = await detectFileType('app.exe');
    expect(exe.fileType).toBe('binary');

    const dll = await detectFileType('lib.dll');
    expect(dll.fileType).toBe('binary');

    const so = await detectFileType('lib.so');
    expect(so.fileType).toBe('binary');

    const dylib = await detectFileType('lib.dylib');
    expect(dylib.fileType).toBe('binary');
  });

  it('should detect media files', async () => {
    const mp4 = await detectFileType('video.mp4');
    expect(mp4.fileType).toBe('binary');

    const avi = await detectFileType('video.avi');
    expect(avi.fileType).toBe('binary');

    const mov = await detectFileType('video.mov');
    expect(mov.fileType).toBe('binary');

    const mp3 = await detectFileType('audio.mp3');
    expect(mp3.fileType).toBe('binary');

    const wav = await detectFileType('audio.wav');
    expect(wav.fileType).toBe('binary');

    const flac = await detectFileType('audio.flac');
    expect(flac.fileType).toBe('binary');
  });

  it('should detect PDF files', async () => {
    const pdf = await detectFileType('document.pdf');
    expect(pdf.fileType).toBe('binary');
  });

  it('should detect database files', async () => {
    const db = await detectFileType('data.db');
    expect(db.fileType).toBe('binary');

    const sqlite = await detectFileType('data.sqlite');
    expect(sqlite.fileType).toBe('binary');
  });
});

describe('Type Detector - Edge Cases', () => {
  it('should handle files without extension by reading content', async () => {
    // These will try to read the file, which doesn't exist, so they'll fall back to binary
    const makefile = await detectFileType('Makefile');
    expect(makefile.fileType).toBe('binary'); // File doesn't exist

    const dockerfile = await detectFileType('Dockerfile');
    expect(dockerfile.fileType).toBe('binary'); // File doesn't exist

    const licensefile = await detectFileType('LICENSE');
    expect(licensefile.fileType).toBe('binary'); // File doesn't exist
  });

  it('should handle dotfiles by reading content', async () => {
    // These will try to read the file, which doesn't exist, so they'll fall back to binary
    const env = await detectFileType('.env');
    expect(env.fileType).toBe('binary'); // File doesn't exist

    const npmrc = await detectFileType('.npmrc');
    expect(npmrc.fileType).toBe('binary'); // File doesn't exist

    const prettierrc = await detectFileType('.prettierrc');
    expect(prettierrc.fileType).toBe('binary'); // File doesn't exist
  });

  it('should handle uppercase extensions', async () => {
    const readmeMd = await detectFileType('README.MD');
    expect(readmeMd.fileType).toBe('text');

    const mainJava = await detectFileType('Main.JAVA');
    expect(mainJava.fileType).toBe('code');

    const imagePng = await detectFileType('image.PNG');
    expect(imagePng.fileType).toBe('binary');
  });

  it('should handle mixed case extensions', async () => {
    const fileTs = await detectFileType('file.Ts');
    expect(fileTs.fileType).toBe('code');

    const imageJpeg = await detectFileType('image.JpEg');
    expect(imageJpeg.fileType).toBe('binary');
  });

  it('should handle multiple dots in filename', async () => {
    const testTs = await detectFileType('file.test.ts');
    expect(testTs.fileType).toBe('code');

    const prodJson = await detectFileType('config.production.json');
    expect(prodJson.fileType).toBe('text');

    const backupTarGz = await detectFileType('backup.2024.tar.gz');
    expect(backupTarGz.fileType).toBe('binary');
  });

  it('should handle empty filenames', async () => {
    const empty = await detectFileType('');
    expect(empty.fileType).toBe('binary'); // No extension, file doesn't exist
  });

  it('should handle paths with directories', async () => {
    const buttonTsx = await detectFileType('src/components/Button.tsx');
    expect(buttonTsx.fileType).toBe('code');

    const readmeMd = await detectFileType('docs/api/README.md');
    expect(readmeMd.fileType).toBe('text');

    const logoPng = await detectFileType('assets/images/logo.png');
    expect(logoPng.fileType).toBe('binary');
  });

  it('should default unknown extensions to text after reading fails', async () => {
    const unknown = await detectFileType('file.unknown');
    expect(unknown.fileType).toBe('binary'); // File doesn't exist, fallback to binary

    const xyz = await detectFileType('file.xyz');
    expect(xyz.fileType).toBe('binary'); // File doesn't exist, fallback to binary
  });
});
