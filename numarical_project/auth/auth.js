// auth.js
// Frontend-only authentication using localStorage.
// Flow:
// - register: saves {username,email,passwordHash} into localStorage under 'users' (array)
// - login: checks email+password against stored users; on success saves 'loggedInUser'
// - session persistence: if 'loggedInUser' found, redirect to index.html
// - logout: clear 'loggedInUser' and optionally redirect to auth page

(function(){
  // Helpers
  function $(sel){return document.querySelector(sel)}
  function showToast(text, type='success'){
    const t = $('#toast'); t.textContent = text; t.className = 'toast show '+type; t.setAttribute('aria-hidden','false');
    setTimeout(()=>{t.className='toast'; t.setAttribute('aria-hidden','true')}, 3500);
  }

  // Basic hashing (not secure) - lightweight obfuscation for localStorage
  function hash(s){
    let h=2166136261; for(let i=0;i<s.length;i++){h ^= s.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);} return (h>>>0).toString(36);
  }

  // Storage helpers
  function loadUsers(){
    try{ return JSON.parse(localStorage.getItem('users')||'[]') }catch(e){return[]}
  }
  function saveUsers(users){ localStorage.setItem('users', JSON.stringify(users)) }

  // redirect if already logged in
  const logged = localStorage.getItem('loggedInUser');
  if(logged){
    // session persistence: redirect to main page
    window.location.replace('../index.html');
    return;
  }

  // DOM refs
  const loginPanel = $('#loginPanel');
  const registerPanel = $('#registerPanel');
  const showRegister = $('#showRegister');
  const showLogin = $('#showLogin');

  // Form refs
  const loginForm = $('#loginForm');
  const registerForm = $('#registerForm');

  // Ensure panels exist and set initial state
  if(loginPanel) loginPanel.classList.add('active');
  if(registerPanel) registerPanel.classList.remove('active');

  // show register (defensive)
  if (showRegister && loginPanel && registerPanel) {
    showRegister.addEventListener('click', (e)=>{ e.preventDefault(); loginPanel.classList.remove('active'); registerPanel.classList.add('active'); });
  }
  if (showLogin && loginPanel && registerPanel) {
    showLogin.addEventListener('click', (e)=>{ e.preventDefault(); registerPanel.classList.remove('active'); loginPanel.classList.add('active'); });
  }

  // Register submission
  registerForm.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const username = $('#regUsername').value.trim();
    const email = $('#regEmail').value.trim().toLowerCase();
    const pw = $('#regPassword').value;
    const pwc = $('#regConfirm').value;

    // Validation
    if(!username || !email || !pw || !pwc){ showToast('Please fill all fields','error'); return }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showToast('Invalid email address','error'); return }
    if(pw !== pwc){ showToast('Passwords do not match','error'); return }
    if(pw.length < 6){ showToast('Password should be at least 6 characters','warn'); }

    const users = loadUsers();
    if(users.some(u=>u.email===email)){ showToast('Account with this email already exists','error'); return }

    const user = { username, email, passwordHash: hash(pw) };
    users.push(user); saveUsers(users);
    showToast('Account created — you can now sign in','success');
    // switch to login
    registerPanel.classList.remove('active'); loginPanel.classList.add('active');
  });

  // Login submission
  loginForm.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const email = $('#loginEmail').value.trim().toLowerCase();
    const pw = $('#loginPassword').value;

    if(!email || !pw){ showToast('Please provide email and password','error'); return }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showToast('Invalid email address','error'); return }

    const users = loadUsers();
    const u = users.find(x=>x.email===email && x.passwordHash===hash(pw));
    if(!u){ showToast('Invalid credentials','error'); return }

    // login success: persist session
    localStorage.setItem('loggedInUser', JSON.stringify({ username: u.username, email: u.email }));
    showToast('Login successful — redirecting...', 'success');
    setTimeout(()=>{ window.location.replace('../index.html') }, 700);
  });

  // Expose logout helper on window for usage in other pages
  window.appAuth = {
    logout: function(){ localStorage.removeItem('loggedInUser'); showToast('Signed out','success'); setTimeout(()=>{ window.location.replace('./auth/auth.html') },400) }
  };

  // subtle mouse follow effect for the card
  const card = document.querySelector('.card');
  document.addEventListener('mousemove', (e)=>{
    const rect = card.getBoundingClientRect();
    const mx = ((e.clientX - rect.left)/rect.width)*100; const my = ((e.clientY - rect.top)/rect.height)*100;
    card.style.setProperty('--mx', mx + '%'); card.style.setProperty('--my', my + '%');
  });

})();
