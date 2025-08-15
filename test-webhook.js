// Test webhook endpoint
const url = 'https://the-job-posting-hiring-tracking-system.onrender.com/api/linkedin/webhook';

console.log('Testing webhook endpoint...');

// Test GET with challenge
fetch(`${url}?challenge=test123`)
  .then(res => res.text())
  .then(data => console.log('GET response:', data))
  .catch(err => console.error('GET error:', err));

// Test POST
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ test: 'data' })
})
  .then(res => res.json())
  .then(data => console.log('POST response:', data))
  .catch(err => console.error('POST error:', err));