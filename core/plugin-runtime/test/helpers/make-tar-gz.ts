import { gzipSync } from "node:zlib";

function octalField(value: number, length: number): string {
  return value.toString(8).padStart(length - 1, "0") + "\0";
}

function tarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512, 0);
  header.write(name, 0, "utf8");
  header.write(octalField(0o644, 8), 100, "ascii");
  header.write(octalField(0, 8), 108, "ascii");
  header.write(octalField(0, 8), 116, "ascii");
  header.write(octalField(size, 12), 124, "ascii");
  header.write(octalField(0, 12), 136, "ascii");
  header.write("        ", 148, "ascii"); // chksum placeholder while summing
  header.write("0", 156, "ascii"); // typeflag: regular file
  header.write("ustar\0", 257, "ascii"); // magic
  header.write("00", 263, "ascii"); // version

  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");

  return header;
}

// Builds a minimal ustar+gzip buffer by hand, so download tests can exercise
// the real gzip/tar plugins without a `tar` build dependency.
export function makeTarGz(files: Array<{ path: string, content: string }>): Buffer {
  const parts: Array<Buffer> = [];
  for (const file of files) {
    const content = Buffer.from(file.content, "utf8");
    const paddedLength = Math.ceil(content.length / 512) * 512;
    const padded = Buffer.alloc(paddedLength, 0);
    content.copy(padded);
    parts.push(tarHeader(file.path, content.length), padded);
  }
  parts.push(Buffer.alloc(1024, 0)); // end-of-archive marker
  return gzipSync(Buffer.concat(parts));
}
