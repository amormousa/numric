# Numerical Project

Interactive numerical methods tools for solving nonlinear equations and linear systems.

## Getting Started

The project is a collection of static HTML/CSS/JS files. No build step is needed.

**Option 1 — Python:**
```bash
python -m http.server 5500
```

**Option 2 — Node.js (via npx):**
```bash
npx serve .
```

**Option 3 — Node.js (via the E2E test script):**
```bash
node e2e_test.js
```

Open [http://localhost:5500/auth/auth.html](http://localhost:5500/auth/auth.html) in your browser.

---

## Authentication (Login / Register)

The app uses **client-side authentication** — all user data is stored in your browser's `localStorage`. There is no server-side auth.

### First visit — Create an account

1. Open `auth/auth.html`
2. Click **"Create one"** to switch to the register panel
3. Fill in **Username**, **Email**, **Password** (min 6 characters), and **Confirm password**
4. Click **"Create account"**
5. On success, you'll be switched to the login panel

### Returning user — Log in

1. Enter your **Email** and **Password**
2. Click **"Log in"**
3. On success, you are automatically redirected to the main page (`index.html`)

### Log out

Click the **Logout** button in the top-right corner of the main page.

### How it works

- Registration saves `{ username, email, passwordHash }` into `localStorage['users']`
- Login looks up the email + password hash in the stored users array
- On success, `localStorage['loggedInUser']` is set and `index.html` checks for it
- If not logged in, `index.html` redirects back to `auth/auth.html`
- **Passwords are obfuscated (not cryptographically hashed)** — this is a frontend-only demo.

---

## Backend (C++ numerical solver)

Optional C++ backend for server-side computation.

### Build

```bash
cd backend
mkdir build && cd build
cmake .. -G "MinGW Makefiles"
cmake --build . --config Release
```

### Run

```bash
.\numerical_backend.exe
```

The server starts on **port 18080**. The frontend can be configured to use it instead of client-side calculation.

---

## Project Structure

| Path | Description |
|---|---|
| `index.html` / `index.js` / `style.css` | Main page — Nonlinear Equation Solver |
| `auth/auth.html` / `auth.js` / `auth.css` | Login / Register page |
| `linear/` | Linear System Solver module |
| `backend/` | C++ backend (Crow framework) |
| `e2e_test.js` | Puppeteer end-to-end test |
