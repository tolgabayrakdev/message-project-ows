const API_URL = '/api';

let socket;
let currentUser = null;
let currentRoom = null;
let onlineUsers = [];

document.body.classList.add('loading');

function formatPhone(input) {
  let nums = input.replace(/\D/g, '').slice(0, 10);
  let formatted = '';
  if (nums.length > 0) formatted = nums.slice(0, 3);
  if (nums.length > 3) formatted += ' ' + nums.slice(3, 6);
  if (nums.length > 6) formatted += ' ' + nums.slice(6, 8);
  if (nums.length > 8) formatted += ' ' + nums.slice(8, 10);
  return formatted;
}

function formatPhoneInput(e) {
  const input = e.target;
  input.value = formatPhone(input.value);
}

function getRawPhone(input) {
  return input.value.replace(/\D/g, '');
}

function validatePhone(phone) {
  return /^\d{10}$/.test(phone);
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_ğüşöçİĞÜŞÖÇ]{3,20}$/.test(username);
}

function renderOnlineUsers() {
  let sidebar = $('.rooms-sidebar');
  let existing = $('#online-users');
  if (existing) existing.remove();
  
  const html = `
    <div id="online-users" class="online-section">
      <h3>Online (${onlineUsers.length})</h3>
      <ul class="online-list">
        ${onlineUsers.map(u => `<li class="online-user"><span class="dot"></span>${u}</li>`).join('')}
      </ul>
    </div>
  `;
  sidebar.insertAdjacentHTML('beforeend', html);
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(message, type = 'error') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showScreen(screenId) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#${screenId}`).classList.add('active');
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    credentials: 'include'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

$('#login-phone').addEventListener('input', formatPhoneInput);
$('#reg-phone').addEventListener('input', formatPhoneInput);

$('.tabs').addEventListener('click', (e) => {
  if (e.target.classList.contains('tab')) {
    $$('.tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    
    const isLogin = e.target.dataset.tab === 'login';
    $('#login-form').classList.toggle('hidden', !isLogin);
    $('#register-form').classList.toggle('hidden', isLogin);
  }
});

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = getRawPhone($('#login-phone'));
  const password = $('#login-password').value;
  
  if (!validatePhone(phone)) {
    showToast('Geçerli telefon girin (5xx xxx xx xx)');
    return;
  }
  if (!password) {
    showToast('Şifre girin');
    return;
  }
  
  try {
    const { token, user } = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    });
    localStorage.setItem('token', token);
    currentUser = user;
    document.body.classList.remove('loading');
    initChat();
  } catch (err) {
    showToast(err.message);
  }
});

$('#register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('#reg-username').value.trim();
  const phone = getRawPhone($('#reg-phone'));
  const password = $('#reg-password').value;
  
  if (!validateUsername(username)) {
    showToast('Kullanıcı adı 3-20 karakter olmalı (harf, rakam, _)');
    return;
  }
  if (!validatePhone(phone)) {
    showToast('Geçerli telefon girin (5xx xxx xx xx)');
    return;
  }
  if (password.length < 4) {
    showToast('Şifre en az 4 karakter olmalı');
    return;
  }
  
  try {
    const { token, user } = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, phone, password })
    });
    localStorage.setItem('token', token);
    currentUser = user;
    document.body.classList.remove('loading');
    initChat();
  } catch (err) {
    showToast(err.message);
  }
});

async function checkAuth() {
  try {
    const { user } = await request('/auth/verify');
    currentUser = user;
    document.body.classList.remove('loading');
    initChat();
  } catch {
    localStorage.removeItem('token');
    document.body.classList.remove('loading');
    showScreen('auth-screen');
  }
}

async function initChat() {
  $('#current-user').textContent = currentUser.username;
  showScreen('chat-screen');
  await loadRooms();
  
  socket = io({ auth: { token: localStorage.getItem('token') } });
  
  socket.on('connect', () => {
    if (currentRoom) socket.emit('join:room', currentRoom.id);
  });
  
  socket.on('message:new', (msg) => {
    if (currentRoom && msg.room_id == currentRoom.id) {
      appendMessage(msg);
      socket.emit('message:read', { roomId: currentRoom.id });
    }
  });

  socket.on('message:status', (data) => {
    const { messageId, status } = data;
    const msgEl = $(`.message[data-id="${messageId}"] .message-status`);
    if (msgEl) {
      msgEl.className = `message-status ${status}`;
    }
  });

  socket.on('users:online', (users) => {
    onlineUsers = users;
    renderOnlineUsers();
  });
}

async function loadRooms() {
  try {
    const rooms = await request('/chat/rooms');
    renderRooms(rooms);
    if (rooms.length && !currentRoom) {
      selectRoom(rooms[0]);
    }
  } catch (err) {
    showToast(err.message);
  }
}

function renderRooms(rooms) {
  $('#rooms-list').innerHTML = rooms.map(r => `
    <li class="room-item ${currentRoom?.id === r.id ? 'active' : ''}" data-id="${r.id}">
      <span class="room-name"># ${r.name}</span>
    </li>
  `).join('');
  
  $$('.room-item').forEach(item => {
    item.addEventListener('click', () => {
      const room = rooms.find(r => r.id == item.dataset.id);
      selectRoom(room);
    });
  });
}

async function selectRoom(room) {
  currentRoom = room;
  renderRooms(await request('/chat/rooms'));
  
  const messages = await request(`/chat/rooms/${room.id}/messages`);
  $('#messages-container').innerHTML = '';
  messages.forEach(msg => appendMessage(msg, false));
  
  if (socket) {
    socket.emit('join:room', room.id);
    socket.emit('message:read', { roomId: room.id });
  }
}

function appendMessage(msg, isNew = true) {
  const isOwn = msg.username === currentUser.username;
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : 'other'}`;
  div.dataset.id = msg.id;
  
  const status = isOwn ? (msg.status || 'sent') : '';
  div.innerHTML = `
    <div class="message-header">
      <span class="message-username">${msg.username}</span>
      <span>
        <span class="message-time">${new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
        ${isOwn ? `<span class="message-status ${status}"></span>` : ''}
      </span>
    </div>
    <div class="message-content">${msg.content}</div>
  `;
  $('#messages-container').appendChild(div);
  $('#messages-container').scrollTop = $('#messages-container').scrollHeight;
  
  if (isOwn && isNew && socket) {
    socket.emit('message:delivered', { messageId: msg.id, roomId: currentRoom.id });
  }
}

$('#message-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#message-input');
  const content = input.value.trim();
  
  if (!content || !currentRoom) return;
  
  socket.emit('message:send', { roomId: currentRoom.id, content });
  input.value = '';
});

$('#logout-btn').addEventListener('click', () => {
  if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
    localStorage.removeItem('token');
    if (socket) socket.disconnect();
    currentUser = null;
    currentRoom = null;
    showScreen('auth-screen');
  }
});

$('#new-room-btn').addEventListener('click', async () => {
  const name = prompt('Oda adı:');
  if (!name) return;
  
  try {
    const room = await request('/chat/rooms', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    selectRoom(room);
  } catch (err) {
    showToast(err.message);
  }
});

$('#menu-toggle').addEventListener('click', () => {
  $('.rooms-sidebar').classList.toggle('open');
});

$('.chat-main').addEventListener('click', (e) => {
  if (e.target !== $('.rooms-sidebar') && !$('.rooms-sidebar').contains(e.target)) {
    $('.rooms-sidebar').classList.remove('open');
  }
});

checkAuth();