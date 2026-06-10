import jwt from 'jsonwebtoken';

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE1ZWU3MjEzLWQyYTYtNDNhNS1iOWJhLTlkNGFkZjBhMTY4OSIsImVtYWlsIjoicHRvcjBAYXZpY29yLmNvbSIsInJvbF9pZCI6IjMxYTk4YmJlLTQ1MzItNDFhOS1iYTg3LTkwODQ4M2FmYWUyMCIsImlhdCI6MTc2OTExMzIyMSwiZXhwIjoxNzY5MTk5NjIxfQ.wghBduK_gt1rhvlSuEOO5aMFMYdAtbUpQKhpxpiDvS8";

console.log('--- DEBUG JWT SCRIPT ---');
console.log('Token Length:', token.length);

try {
    console.log('Intentando decoding simple...');
    const decoded = jwt.decode(token);
    console.log('Decoded Payload:', decoded);
} catch (e) {
    console.error('❌ Decoding failed:', e.message);
}

try {
    console.log('Intentando decoding complete...');
    const decodedComplete = jwt.decode(token, { complete: true });
    console.log('Decoded Complete:', JSON.stringify(decodedComplete, null, 2));
} catch (e) {
    console.error('❌ Decoding complete failed:', e.message);
}

console.log('--- END ---');
