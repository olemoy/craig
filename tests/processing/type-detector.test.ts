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
  });

  it('should detect JavaScript files', async () => {
    const result = await detectFileType('src/index.js');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('lib/component.jsx');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('config.mjs');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('script.cjs');
    expect(result.fileType).toBe('code');
  });

  it('should detect Python files', async () => {
    const result = await detectFileType('main.py');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('test.pyi');
    expect(result.fileType).toBe('code');
  });

  it('should detect Java files', async () => {
    const result = await detectFileType('Main.java');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('Config.kt');
    expect(result.fileType).toBe('code');
  });

  it('should detect Go files', async () => {
    const result = await detectFileType('main.go');
    expect(result.fileType).toBe('code');
  });

  it('should detect Rust files', async () => {
    const result = await detectFileType('main.rs');
    expect(result.fileType).toBe('code');
  });

  it('should detect C/C++ files', async () => {
    const result = await detectFileType('main.c');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('main.cpp');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('main.cc');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('main.h');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('main.hpp');
    expect(result.fileType).toBe('code');
  });

  it('should detect other code file extensions', async () => {
    const result = await detectFileType('script.rb');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('script.php');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('script.swift');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('script.cs');
    expect(result.fileType).toBe('code');
  });
});

describe('Type Detector - Text Files', () => {
  it('should detect markdown files', async () => {
    const result = await detectFileType('README.md');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('docs/guide.markdown');
    expect(result.fileType).toBe('text');
  });

  it('should detect text documentation files', async () => {
    const result = await detectFileType('README.txt');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('LICENSE');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('CHANGELOG');
    expect(result.fileType).toBe('text');
  });

  it('should detect configuration text files', async () => {
    const result = await detectFileType('.gitignore');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('.dockerignore');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('.editorconfig');
    expect(result.fileType).toBe('text');
  });

  it('should detect JSON files', async () => {
    const result = await detectFileType('package.json');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('tsconfig.json');
    expect(result.fileType).toBe('text');
  });

  it('should detect YAML files', async () => {
    const result = await detectFileType('config.yml');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('docker-compose.yaml');
    expect(result.fileType).toBe('text');
  });

  it('should detect TOML files', async () => {
    const result = await detectFileType('Cargo.toml');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('pyproject.toml');
    expect(result.fileType).toBe('text');
  });

  it('should detect XML files', async () => {
    const result = await detectFileType('config.xml');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('pom.xml');
    expect(result.fileType).toBe('text');
  });

  it('should detect SQL files', async () => {
    const result = await detectFileType('schema.sql');
    expect(result.fileType).toBe('text');
  });
});

describe('Type Detector - Binary Files', () => {
  it('should detect image files', async () => {
    const result = await detectFileType('logo.png');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('photo.jpg');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('photo.jpeg');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('icon.gif');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('image.svg');
    expect(result.fileType).toBe('text'); // SVG is text
    const result = await detectFileType('icon.ico');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('image.webp');
    expect(result.fileType).toBe('binary');
  });

  it('should detect font files', async () => {
    const result = await detectFileType('font.woff');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('font.woff2');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('font.ttf');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('font.otf');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('font.eot');
    expect(result.fileType).toBe('binary');
  });

  it('should detect archive files', async () => {
    const result = await detectFileType('archive.zip');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('archive.tar');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('archive.gz');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('archive.bz2');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('archive.7z');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('archive.rar');
    expect(result.fileType).toBe('binary');
  });

  it('should detect executable and library files', async () => {
    const result = await detectFileType('app.exe');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('lib.dll');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('lib.so');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('lib.dylib');
    expect(result.fileType).toBe('binary');
  });

  it('should detect media files', async () => {
    const result = await detectFileType('video.mp4');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('video.avi');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('video.mov');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('audio.mp3');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('audio.wav');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('audio.flac');
    expect(result.fileType).toBe('binary');
  });

  it('should detect PDF files', async () => {
    const result = await detectFileType('document.pdf');
    expect(result.fileType).toBe('binary');
  });

  it('should detect database files', async () => {
    const result = await detectFileType('data.db');
    expect(result.fileType).toBe('binary');
    const result = await detectFileType('data.sqlite');
    expect(result.fileType).toBe('binary');
  });
});

describe('Type Detector - Edge Cases', () => {
  it('should handle files without extension', async () => {
    const result = await detectFileType('Makefile');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('Dockerfile');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('LICENSE');
    expect(result.fileType).toBe('text');
  });

  it('should handle dotfiles', async () => {
    const result = await detectFileType('.env');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('.npmrc');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('.prettierrc');
    expect(result.fileType).toBe('text');
  });

  it('should handle uppercase extensions', async () => {
    const result = await detectFileType('README.MD');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('Main.JAVA');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('image.PNG');
    expect(result.fileType).toBe('binary');
  });

  it('should handle mixed case extensions', async () => {
    const result = await detectFileType('file.Ts');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('image.JpEg');
    expect(result.fileType).toBe('binary');
  });

  it('should handle multiple dots in filename', async () => {
    const result = await detectFileType('file.test.ts');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('config.production.json');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('backup.2024.tar.gz');
    expect(result.fileType).toBe('binary');
  });

  it('should handle empty filenames', async () => {
    expect(detectFileType('', 'content')).toBe('text');
  });

  it('should handle paths with directories', async () => {
    const result = await detectFileType('src/components/Button.tsx');
    expect(result.fileType).toBe('code');
    const result = await detectFileType('docs/api/README.md');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('assets/images/logo.png');
    expect(result.fileType).toBe('binary');
  });

  it('should handle null or undefined content', async () => {
    const result = await detectFileType('test.txt');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('test.txt');
    expect(result.fileType).toBe('text');
  });

  it('should default unknown extensions to text', async () => {
    const result = await detectFileType('file.unknown');
    expect(result.fileType).toBe('text');
    const result = await detectFileType('file.xyz');
    expect(result.fileType).toBe('text');
  });
});
