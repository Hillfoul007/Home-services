const Redis = require('ioredis');

const raw = process.env.REDIS_URL || '';

// Strip accidental "redis-cli --tls -u " prefix if user pasted the CLI command
const url = raw.replace(/^redis-cli\s+--tls\s+-u\s+/i, '').trim();

if (!url) {
  console.error('❌ REDIS_URL is not set. Add it to your .env file.');
  process.exit(1);
}

// Upstash requires TLS (rediss://). Warn if using redis:// against upstash host.
if (url.startsWith('redis://') && url.includes('upstash.io')) {
  console.warn('⚠️  Your URL uses redis:// but Upstash requires rediss:// (TLS).');
  console.warn('   Fix: change redis:// → rediss:// in your REDIS_URL env var.\n');
}

console.log('🔌 Connecting to Redis...');
console.log('   Host:', url.replace(/:\/\/[^@]+@/, '://***@'));  // hide password

const client = new Redis(url, {
  tls: url.startsWith('rediss://') ? {} : undefined,
  connectTimeout: 8000,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

(async () => {
  try {
    await client.connect();
    console.log('✅ Connected!\n');

    // PING
    const pong = await client.ping();
    console.log('PING →', pong);

    // SET + GET
    await client.set('test:laundrify', 'hello_redis', 'EX', 60);
    const val = await client.get('test:laundrify');
    console.log('SET/GET →', val === 'hello_redis' ? '✅ OK' : '❌ mismatch');

    // Clean up
    await client.del('test:laundrify');
    console.log('\n🎉 Redis is working correctly!');
  } catch (err) {
    console.error('\n❌ Redis connection failed:', err.message);
    if (err.message.includes('ECONNREFUSED')) {
      console.error('   The host refused the connection. Check your REDIS_URL host/port.');
    } else if (err.message.includes('SSL') || err.message.includes('TLS')) {
      console.error('   TLS error — make sure the URL starts with rediss:// (double s).');
    } else if (err.message.includes('WRONGPASS') || err.message.includes('NOAUTH')) {
      console.error('   Wrong password. Copy the URL fresh from the Upstash dashboard.');
    }
    process.exit(1);
  } finally {
    client.disconnect();
  }
})();
