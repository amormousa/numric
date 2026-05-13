Backend C++ server for numerical methods

Folder layout (place in project root under `backend/`):

backend/
├─ CMakeLists.txt
├─ main.cpp
├─ include/
│  └─ crow_all.h   (placeholder - download real header)
└─ methods/
   └─ bisection.cpp
   └─ bisection.h

Dependencies
- Crow single-header (crow_all.h). Get it from: https://github.com/CrowCpp/crow (or the single header distribution)
- nlohmann/json.hpp (https://github.com/nlohmann/json)
- A C++17-capable compiler (MSVC, MinGW g++)

Build (MinGW/g++ example)
1. Install dependencies (place headers into `backend/include/`):
   - copy `crow_all.h` into `backend/include/`
   - copy `json.hpp` into `backend/include/` as `nlohmann/json.hpp`

2. From project root run (PowerShell):
   mkdir build; cd build
   cmake .. -G "MinGW Makefiles"
   cmake --build . --config Release

3. Run the server:
   .\numerical_backend.exe

Build (Visual Studio)
- Open a Developer Command Prompt or use CMake GUI and generate a Visual Studio solution from the `backend` folder. Ensure include paths contain the `backend/include` directory.

API
- POST /api/bisection
  Request JSON: { "coeffs": [a_n, ..., a0], "a": <num>, "b": <num>, "tol": <num>, "max_iter": <int> }
  Response JSON: { "root": <num>, "iterations": <int>, "converged": <bool>, "message": "..." }

Frontend fetch example (in your existing JS; no UI changes required):

fetch('http://localhost:18080/api/bisection', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ coeffs: [1, 0, -4], a: 0, b: 3, tol: 1e-6, max_iter: 50 })
})
.then(r => r.json())
.then(data => console.log('Bisection result', data));

Notes
- Keep frontend files as-is. Replace calculation calls in your `index.js` files to send requests to backend endpoints returning the same numeric values.
- For production, secure CORS and validation. This scaffold focuses on moving logic to C++ while leaving UI unchanged.

Detailed Visual Studio steps (brief):
1. Install Visual Studio with Desktop development with C++ workload.
2. In the `backend` folder create a build directory and run: cmake .. -G "Visual Studio 17 2022" (or your VS generator) which produces a .sln file.
3. Open the solution, ensure include path for `backend/include` is set, and build the `numerical_backend` project.

Notes about headers:
- The `include/crow_all.h` here is a placeholder. Download the single-header Crow distribution or install via vcpkg. If you place crow_all.h and nlohmann/json.hpp under `backend/include/`, the project will compile.
- If you use vcpkg: vcpkg install crow jsoncpp or adapt to available port; vcpkg integration with CMake will resolve includes automatically.
