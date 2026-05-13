// Example fetch wrapper you can copy into your existing index.js where calculations currently happen.
// This keeps the UI unchanged but sends calculation data to the C++ backend.

async function bisectionRemote(coeffs, a, b, tol = 1e-6, max_iter = 100) {
  const resp = await fetch('http://localhost:18080/api/bisection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coeffs, a, b, tol, max_iter })
  });
  if (!resp.ok) {
    throw new Error('Server error: ' + resp.statusText);
  }
  return resp.json();
}

// Usage example (copy into your existing UI handler):
// bisectionRemote([1, 0, -4], 0, 3).then(res => console.log(res)).catch(err => console.error(err));
