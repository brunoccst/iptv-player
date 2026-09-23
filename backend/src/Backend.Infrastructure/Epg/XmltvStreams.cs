using System.IO.Compression;

namespace Backend.Infrastructure.Epg;

/// <summary>Returns a decompressed view when the body starts with the gzip magic bytes (some panels serve <c>.xml.gz</c>).</summary>
public static class GzipSniffer
{
    public static async Task<Stream> OpenAsync(Stream body, CancellationToken cancellationToken)
    {
        var head = new byte[2];
        var read = 0;
        while (read < head.Length)
        {
            var count = await body.ReadAsync(head.AsMemory(read), cancellationToken);
            if (count == 0)
            {
                break;
            }
            read += count;
        }

        Stream restored = new PrefixedStream(head[..read], body);
        return read == 2 && head[0] == 0x1f && head[1] == 0x8b ? new GZipStream(restored, CompressionMode.Decompress) : restored;
    }
}

/// <summary>Read-only stream: <paramref name="prefix"/> bytes, then the rest of <paramref name="inner"/>.</summary>
internal sealed class PrefixedStream(byte[] prefix, Stream inner) : Stream
{
    private int _offset;

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();
    public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }

    public override int Read(byte[] buffer, int offset, int count) => Read(buffer.AsSpan(offset, count));

    public override int Read(Span<byte> buffer)
    {
        if (_offset < prefix.Length)
        {
            var count = Math.Min(buffer.Length, prefix.Length - _offset);
            prefix.AsSpan(_offset, count).CopyTo(buffer);
            _offset += count;
            return count;
        }
        return inner.Read(buffer);
    }

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        if (_offset < prefix.Length)
        {
            return Read(buffer.Span);
        }
        return await inner.ReadAsync(buffer, cancellationToken);
    }

    public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
        ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            inner.Dispose();
        }
        base.Dispose(disposing);
    }
}

/// <summary>Wraps a response body so disposing the stream also disposes the response.</summary>
public sealed class OwnedStream(Stream inner, IDisposable owner) : Stream
{
    public override bool CanRead => inner.CanRead;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();
    public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }

    public override int Read(byte[] buffer, int offset, int count) => inner.Read(buffer, offset, count);
    public override int Read(Span<byte> buffer) => inner.Read(buffer);
    public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default) => inner.ReadAsync(buffer, cancellationToken);
    public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
        inner.ReadAsync(buffer, offset, count, cancellationToken);

    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            inner.Dispose();
            owner.Dispose();
        }
        base.Dispose(disposing);
    }
}
