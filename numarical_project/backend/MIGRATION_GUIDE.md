Migration Guide — Move numerical logic to C++ backend (Crow)

Goal
Keep your existing frontend (HTML/CSS/JS) unchanged. Move calculation logic into a C++ backend using Crow and expose each numerical method as a JSON API.

Folder layout (how it maps to your existing project):

numerical_project/
├─ index.html (unchanged)
├─ index.js   (UI code; replace calculation calls with fetch wrappers)
├─ style.css
├─ linear/
│  ├─ index.html
│  ├─ index.js
│  └─ linear.css
└─ backend/   <-- new folder with C++ server
   ├─ CMakeLists.txt
   ├─ main.cpp
   ├─ include/
   │  ├─ crow_all.h       (place Crow single-header here)
   │  └─ nlohmann/json.hpp
   ├─ methods/
   │  ├─ bisection.h
   │  └─ bisection.cpp
   ├─ README.md
   └─ example_fetch.js    (JS examples you can copy into your frontend)

JSON API Contract (example: Bisection)
Request (POST /api/bisection)
{
  "coeffs": [a_n, a_{n-1}, ..., a0],
  "a": <number>,
  "b": <number>,
  "tol": <number, optional>,
  "max_iter": <int, optional>
}

Response
{
  "root": <number>,
  "iterations": <int>,
  "converged": <bool>,
  "message": "..."
}

How to integrate into your frontend (no UI changes)
- Find where `index.js` performs the bisection calculation. Replace that call with a remote fetch to `/api/bisection` using the `example_fetch.js` wrapper.
- Keep DOM updates, form handling, and result rendering unchanged.
- Example replacement:
  - Old: const root = localBisection(coeffs, a, b, tol);
  - New: bisectionRemote(coeffs, a, b, tol).then(res => renderResult(res.root));

Adding new numerical methods
- For each method create `methods/<method>.h` and `methods/<method>.cpp` implementing the algorithm and returning a structured result type.
- In `main.cpp`, add a new Crow route `/api/<method>` that parses JSON input, calls the method implementation, and returns JSON with the same response shape as your frontend expects.
- Keep each algorithm isolated to its own files for modularity and tests.

CORS and Security
- For development, run the server on localhost and call from your frontend with full URL (http://localhost:18080).
- If you load your frontend from file://, browsers block cross-origin requests. Serve frontend from a local static server (python -m http.server or serve) or enable CORS in the backend.

Debugging
- Validate JSON bodies using tools like Postman or curl before wiring UI.
- Add logging in `main.cpp` for request bodies and responses.

Build notes
- See README.md for step-by-step build commands for MinGW and Visual Studio. Prefer using CMake for cross-platform workflows.
