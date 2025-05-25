const seekBzip = require("seek-bzip");

const MASK = [0x00, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF];
const MPQ_ID = 0x1a51504d;
const MpqFileFlags = {
  Compressed: 0x200,
  Encrypted:  0x10000,
  SingleUnit: 0x1000000,
  Exists:     0x80000000,
};

const stormBuffer = Buffer.alloc(0x500 * 4);

let seed = 0x100001;
for (let index1 = 0; index1 < 0x100; index1++) {
  let index2 = index1;

  for (let i = 0; i < 5; i++, index2 += 0x100) {
    seed = ((seed * 125 + 3) % 0x2aaaab) >>> 0;
    let temp = (seed & 0xffff) << 16;
    seed = ((seed * 125 + 3) % 0x2aaaab) >>> 0;
    stormBuffer.writeUInt32LE((temp | (seed & 0xffff)) >>> 0, index2 * 4);
  }
}

class MpqFile {

  constructor(buffer) {
    this.buffer = buffer;
    this.header = new MpqHeader(this.buffer);
    this.blockSize = 0x200 << this.header.blockSize;
    this.entries = new Map();

    const hashes = new Map();
    const hashTable = MpqTools.decryptTable(Buffer.from(this.buffer.buffer, this.header.hashTablePos, this.header.hashTableSize * MpqHash.size), "(hash table)");
    for (let i = 0; i < this.header.hashTableSize; i++) {
      const hash = new MpqHash(hashTable, i * MpqHash.size);
      hashes.set(hash.key, hash);
    }

    const entries = [];
    const entryTable = MpqTools.decryptTable(Buffer.from(this.buffer.buffer, this.header.blockTablePos, this.header.blockTableSize * MpqEntry.size), "(block table)");
    for (let i = 0; i < this.header.blockTableSize; i++) {
      entries.push(new MpqEntry(entryTable, i * MpqEntry.size, this.header.headerOffset));
    }

    const filenames = new MpqStream(this, entries[hashes.get(key("(listfile)")).blockIndex]).read().toString().split("\r\n");
    for (const filename of filenames) {
      const hash = hashes.get(key(filename));

      if (hash) {
        const entry = entries[hash.blockIndex];
        entry.filename = filename;
        this.entries.set(filename, entry);
      }
    }
  }

  read(filename) {
    return new MpqStream(this, this.entries.get(filename)).read();
  }

}

class MpqBuffer {

  constructor(buffer) {
    this.buffer = buffer;
    this.index = 0;

    this.next = null;
    this.nextBits = 0;
  }

  done() {
    return (this.nextBits === 0) && (this.index >= this.buffer.length);
  }

  read() {
    const type = this.readBits(8);

    switch (type) {
      case 0: {
        const array = [];
        const size = this.readInt();

        for (let i = 0; i < size; i++) {
          const value = this.read();

          array.push(value);
        }

        return array;
      }
      case 2: return this.readBlob(this.readInt());
      case 4: return this.readBits(8) ? this.read() : null;
      case 5: {
        const map = {};
        const size = this.readInt();

        for (let i = 0; i < size; i++) {
          const key = this.readInt();
          const value = this.read();

          map[key] = value;
        }

        return map;
      }
      case 9: return this.readInt();
    }
  }

  readBlob(length) {
    const start = this.buffer.byteOffset + this.index;

    this.index += length;
    this.nextBits = 0;

    return Buffer.from(this.buffer.buffer, start, length);
  }

  readBits(bits) {
    let result = 0;
    let resultBits = 0;

    while (resultBits != bits) {
      if (this.nextBits === 0) {
        if (this.done()) return 0;

        this.next = this.buffer.readUInt8(this.index++);
        this.nextBits = 8;
      }

      let copyBits = Math.min(bits - resultBits, this.nextBits);
      let copy = (this.next & ((1 << copyBits) - 1));

      result |= copy << (bits - resultBits - copyBits);

      this.next >>>= copyBits;
      this.nextBits -= copyBits;

      resultBits += copyBits;
    }

    return result;
  }

  readInt(bytes) {
    if (bytes) {
      let result = this.next & MASK[this.nextBits];
      let bits = bytes - this.nextBits;

      while (bits > 0) {
        this.next = this.buffer.readUInt8(this.index++);

        if (bits >= 8) {
          result <<= 8;
          result |= this.next;
          bits -= 8;
        } else {
          result <<= bits;
          result |= (this.next & MASK[bits]);
          this.next >>= bits;
          bits = 0;
        }
      }

      return result;
    } else {
      let byte = this.buffer.readUInt8(this.index++);
      const isNegative = (byte & 0x01);
      let result = (byte & 0x7F) >> 1;
      let bits = 6;

      while (byte & 0x80) {
        byte = this.buffer.readUInt8(this.index++);
        result |= (byte & 0x7F) << bits;
        bits += 7;
      }

      this.nextBits = 0;

      return isNegative ? -result : result;
    }
  }

  skip(bytes) {
    this.index += bytes;
    this.nextBits = 0;
  }

  seek(isMatching, length) {
    for (let bufferIndex = this.index; bufferIndex < this.buffer.length - length; bufferIndex++) {
      const data = [];

      for (let dataIndex = 0; dataIndex < length; dataIndex++) {
        data.push(this.buffer.readUInt8(bufferIndex + dataIndex));
      }

      if (isMatching(...data)) {
        this.index = bufferIndex;
        return true;
      }
    }

    return false;
  }

  toString(encoding, start, end) {
    return this.buffer.toString(encoding, start, end);
  }

}

class MpqEntry {

  static size = 16;

  constructor(buffer, offset, headerOffset) {
    this.fileOffset = buffer.readUInt32LE(offset);
    this.filePos = this.fileOffset + headerOffset;
    this.compressedSize = buffer.readUInt32LE(offset + 4);
    this.fileSize = buffer.readUInt32LE(offset + 8);
    this.flags = buffer.readUInt32LE(offset + 12);
  }

  exists() {
    return this.flags !== 0;
  }

  isCompressed() {
    return (this.flags & MpqFileFlags.Compressed) !== 0;
  }

  isSingleUnit() {
    return (this.flags & MpqFileFlags.SingleUnit) !== 0;
  }

  toString() {
    return this.filename;
  }

}

class MpqHash {

  static size = 16;

  constructor(buffer, offset) {
    if (buffer && (offset >= 0)) {
      this.name1 = buffer.readUInt32LE(offset);
      this.name2 = buffer.readUInt32LE(offset + 4);
      this.locale = buffer.readUInt32LE(offset + 8);
      this.blockIndex = buffer.readUInt32LE(offset + 12);
      this.key = MpqHash.key(this.name1, this.name2);
    }
  }

  static key(name1, name2) {
    return name1 + "-" + name2;
  }

}

class MpqHeader {

  static size = 32;

  constructor(buffer) {
    for (let offset = 0; offset < buffer.length - 32; offset++) {
      if (buffer.readUInt32LE(offset) === MPQ_ID) {
        this.id = MPQ_ID;
        this.headerOffset = offset;
        this.dataOffset = buffer.readUInt32LE(offset + 4);
        this.archiveSize = buffer.readUInt32LE(offset + 8);
        this.mpqVersion = buffer.readUInt16LE(offset + 12);
        this.blockSize = buffer.readUInt16LE(offset + 14);
        this.hashTablePos = buffer.readUInt32LE(offset + 16) + offset;
        this.blockTablePos = buffer.readUInt32LE(offset + 20) + offset;
        this.hashTableSize = buffer.readUInt32LE(offset + 24);
        this.blockTableSize = buffer.readUInt32LE(offset + 28);
        return;
      }
    }
  }

}

class MpqStream {

  constructor(file, entry) {
    this.file = file;
    this.entry = entry;

    this.blockSize = file.blockSize;
    this.blockPositions = [0, entry.compressedSize];

    this.currentBlockIndex = -1;
    this.currentData = null;

    if (entry.isCompressed() && entry.isSingleUnit()) {
      this.blockSize = entry.fileSize;
    }
  }

  read() {
    const fileSize = this.entry.fileSize;
    const result = Buffer.alloc(fileSize);

    let offset = 0;
    let readLeft = fileSize;
    let readTotal = 0;

    while (readLeft > 0) {
      const blockIndex = Math.floor(offset / this.blockSize);

      if (blockIndex != this.currentBlockIndex) {
        const expectedLength = Math.floor(Math.min(fileSize - (blockIndex * this.blockSize), this.blockSize));
        const blockOffset = this.entry.isCompressed() ? this.blockPositions[blockIndex] : blockIndex * this.blockSize;
        const blockLength = this.entry.isCompressed() ? this.blockPositions[blockIndex + 1] - blockOffset : expectedLength;
        const blockBuffer = Buffer.from(this.file.buffer.buffer, this.entry.filePos + blockOffset, blockLength);

        if (this.entry.isCompressed() && (blockLength != expectedLength)) {
          this.currentData = MpqTools.decompress(blockBuffer, expectedLength, fileSize);
        } else {
          this.currentData = blockBuffer;
        }

        this.currentBlockIndex = blockIndex;
      }

      const localPosition = (offset % this.blockSize);
      const bytesToCopy = Math.min(this.currentData.length - localPosition, readLeft);

      const read = (bytesToCopy > 0) ? this.currentData.copy(result, readTotal, localPosition, localPosition + bytesToCopy) : 0;

      if (read === 0) break;

      readLeft -= read;
      readTotal += read;
      offset += read;
    }

    return new MpqBuffer(result);
  }

}

class MpqTools {

  static hashString(input, offset) {
    let seed1 = 0x7fed7fed;
    let seed2 = 0xeeeeeeee;
    input = input.toUpperCase();

    for (let i = 0; i < input.length; i++) {
        let val = input.charCodeAt(i);
        seed1 = stormBuffer.readUInt32LE((offset + val) * 4) ^ (seed1 + seed2);
        seed2 = val + seed1 + seed2 + (seed2 << 5) + 3;
    }

    return seed1 >>> 0;
  }

  static decryptTable(buffer, key) {
    let seed1 = MpqTools.hashString(key, 0x300);
    let seed2 = 0xeeeeeeee;

    for (let i = 0; i < buffer.length - 3; i += 4) {
      seed2 = (seed2 + stormBuffer.readUInt32LE((0x400 + (seed1 & 0xFF)) * 4)) >>> 0;

      let result = buffer.readUInt32LE(i);
      result = (result ^ (seed1 + seed2)) >>> 0;

      seed1 = ((((~seed1 << 21) + 0x11111111) >>> 0) | (seed1 >>> 11)) >>> 0;
      seed2 = (result + seed2 + (seed2 << 5) + 3) >>> 0;

      buffer.writeUInt32LE(result >>> 0, i);
    }

    return buffer;
  }

  static decompress(buffer, expectedBlockLength, expectedFileLength) {
    let type = buffer.readUInt8(0);

    if (type === 0x10) {
      // BZip2
      buffer = decompress(buffer, 1, buffer.length, expectedBlockLength);
    } else if (type === 0x3C) {
      // Block BZip2
      const buffers = [];
      let from = -1;
      let decodedLength = 0;

      for (let i = 0; i < buffer.length; i++) {
        if (String.fromCharCode(buffer[i], buffer[i + 1], buffer[i + 2]) === "BZh") {
          if (from >= 0) {
            buffers.push(decompress(buffer, from, i, expectedBlockLength));
            decodedLength += expectedBlockLength;
          }

          from = i;
        }
      }

      if (from >= 0) {
        buffers.push(decompress(buffer, from, buffer.length, expectedFileLength - decodedLength));
      }

      buffer = Buffer.concat(buffers);
    } else {
      throw Error("Decompression type 0x" + type.toString(16).toUpperCase() + " is not supported!");
    }

    return buffer;
  }
}

function key(filename) {
  const name1 = MpqTools.hashString(filename, 0x100);
  const name2 = MpqTools.hashString(filename, 0x200);

  return MpqHash.key(name1, name2);
}

function decompress(buffer, from, to, length) {
  const compressed = Buffer.from(buffer.buffer, buffer.offset + from, to - from);
  const decompressed = Buffer.alloc(length);

  seekBzip.decode(compressed, decompressed);

  return decompressed;
}

module.exports = MpqFile;
